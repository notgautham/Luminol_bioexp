"""
Luminol Blue Intensity Analyzer — Processing Pipeline
=====================================================
Single public entry point: analyze_image()

Why mean/integrated metrics instead of max:
  In most luminol images the peak blue channel clips at 255 (sRGB → ~1.0
  linear).  With constant shutter/ISO a max-based normalised intensity is
  identical across images.  Mean and integrated intensity inside a
  brightness-percentile "core glow" region are far more discriminative.

Blue scoring uses a single adaptive blue_score method:
  blue_score = B_lin − max(R_lin, G_lin)
  thresholded at the 99th percentile of blue_score, then cleaned.
  This is NOT a gate — dim samples are never rejected.

Spill suppression uses a single percentile-cutoff approach:
  P = 70 + 0.28 * sensitivity   (sens 0 → 70th pctl, sens 100 → 98th)
  core_mask = mask0 pixels where B_lin ≥ percentile(B_lin in mask0, P)
"""

import cv2
import numpy as np
import base64
from scipy import ndimage

# ── Attempt rawpy import (optional — only needed for RAW/DNG mode) ────
try:
    import rawpy
    HAS_RAWPY = True
except ImportError:
    HAS_RAWPY = False

# ─── Constants ────────────────────────────────────────────────────────
# Black-box detection (linear space)
LINEAR_DARK_THRESHOLD   = 0.05
LINEAR_BRIGHT_THRESHOLD = 0.40
BB_MIN_DARK_RATIO       = 0.80
BB_MAX_BRIGHT_RATIO     = 0.25

# Minimum pixel counts
MIN_BLUE_AREA_PX        = 50

# DNG / RAW magic-byte signatures
_DNG_TIFF_LE = b'\x49\x49\x2a\x00'   # Little-endian TIFF (DNG uses TIFF container)
_DNG_TIFF_BE = b'\x4d\x4d\x00\x2a'   # Big-endian TIFF

# JPEG signatures
_JPEG_SOI    = b'\xff\xd8\xff'


# ──────────────────────────────────────────────────────────────────────
# Helpers
# ──────────────────────────────────────────────────────────────────────

def srgb_to_linear(img_norm):
    """sRGB [0-1] → Linear [0-1] (IEC 61966-2-1)."""
    mask = img_norm <= 0.04045
    out = np.empty_like(img_norm)
    out[mask]  = img_norm[mask] / 12.92
    out[~mask] = np.power((img_norm[~mask] + 0.055) / 1.055, 2.4)
    return out


def _is_raw_file(data: bytes) -> bool:
    """Heuristic: check if bytes look like a TIFF/DNG container."""
    return data[:4] in (_DNG_TIFF_LE, _DNG_TIFF_BE)


def _is_jpeg_file(data: bytes) -> bool:
    return data[:3] == _JPEG_SOI


def _decode_raw(image_bytes: bytes):
    """
    Decode RAW/DNG → linear float32 RGB [0-1].
    Returns (img_linear, bit_depth).
    """
    if not HAS_RAWPY:
        return None, None
    try:
        import io
        raw = rawpy.imread(io.BytesIO(image_bytes))
        # postprocess: linear, no gamma, no white balance auto
        rgb16 = raw.postprocess(
            output_bps=16,
            no_auto_bright=True,
            use_camera_wb=True,
            gamma=(1, 1),          # linear output
            output_color=rawpy.ColorSpace.sRGB,
        )
        bit_depth = 16
        img_linear = rgb16.astype(np.float32) / 65535.0
        return img_linear, bit_depth
    except Exception:
        return None, None


def _decode_jpeg(image_bytes: bytes):
    """
    Decode JPEG/PNG/TIFF (processed) → linear float32 RGB [0-1].
    Applies sRGB → linear gamma correction.
    Returns (img_linear, img_bgr_8bit).
    """
    nparr = np.frombuffer(image_bytes, np.uint8)
    img_bgr = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    if img_bgr is None:
        return None, None
    img_rgb = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2RGB)
    img_norm = img_rgb.astype(np.float32) / 255.0
    img_linear = srgb_to_linear(img_norm)
    return img_linear, img_bgr


def _keep_best_component_by_sum(mask, score_map, min_area=50):
    """
    Keep the connected component with the highest integrated score energy.

    Unlike selecting the component containing the single brightest pixel,
    this is robust to specular highlights on glass (which are bright but tiny
    and have low total energy compared to a diffuse glow region).

    Additionally, thin streak-like components (aspect ratio > 8 and area < 2000 px)
    are skipped, as they are characteristic of edge reflections rather than glow blobs.

    Parameters
    ----------
    mask      : uint8 binary mask (255 = foreground).
    score_map : float array, same shape as mask. Negative values are clamped to 0.
    min_area  : components smaller than this are ignored.
    """
    labelled, n = ndimage.label(mask > 0)
    if n == 0:
        return mask
    if n == 1:
        return mask

    score_pos = np.maximum(score_map, 0.0)
    best_label = -1
    best_sum   = -1.0

    for lbl in range(1, n + 1):
        comp = labelled == lbl
        area = int(np.sum(comp))
        if area < min_area:
            continue

        # Shape sanity: skip thin streaks (specular edge reflections)
        rows = np.any(comp, axis=1)
        cols = np.any(comp, axis=0)
        h_span = int(np.sum(rows))
        w_span = int(np.sum(cols))
        if h_span > 0 and w_span > 0:
            aspect = max(h_span, w_span) / max(min(h_span, w_span), 1)
            if aspect > 8 and area < 2000:
                continue  # likely a thin edge reflection

        energy = float(np.sum(score_pos[comp]))
        if energy > best_sum:
            best_sum   = energy
            best_label = lbl

    if best_label < 0:
        # All components were filtered — fall back to returning the original mask
        return mask

    return ((labelled == best_label) * 255).astype(np.uint8)


def _build_overlay_png(core_mask, shape_hw):
    """
    Create a transparent RGBA overlay highlighting the core_mask.
    - Cyan fill (0, 220, 220, 90) inside core
    - Green contour lines (0, 255, 0, 200)
    Returns base64-encoded PNG with data URI prefix.
    """
    h, w = shape_hw
    overlay = np.zeros((h, w, 4), dtype=np.uint8)

    # Semi-transparent cyan fill
    overlay[core_mask == 255] = [0, 220, 220, 90]

    # Green contour
    contours, _ = cv2.findContours(core_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    cv2.drawContours(overlay, contours, -1, (0, 255, 0, 200), 2)

    _, enc = cv2.imencode(".png", overlay)
    return "data:image/png;base64," + base64.b64encode(enc).decode("utf-8")


# ──────────────────────────────────────────────────────────────────────
# PUBLIC ENTRY POINT
# ──────────────────────────────────────────────────────────────────────

def analyze_image(
    image_bytes: bytes,
    shutter_seconds: float,
    iso: float,
    sensitivity: float = 50,
    capture_mode: str = "jpeg",
):
    """
    Analyse a luminol chemiluminescence image.

    Parameters
    ----------
    image_bytes    : Raw file bytes.
    shutter_seconds: Shutter speed in seconds (e.g. 0.0167 for 1/60).
    iso            : Camera ISO.
    sensitivity    : Core-mask strictness 0-100.  Higher = stricter.
    capture_mode   : "jpeg" or "raw".

    Returns
    -------
    dict  JSON-serialisable result.
    """
    sensitivity = max(0, min(100, float(sensitivity)))

    # ══════════════════════════════════════════════════════════════════
    # A.  DECODE + MODE MISMATCH CHECK
    # ══════════════════════════════════════════════════════════════════
    is_raw_data  = _is_raw_file(image_bytes)
    is_jpeg_data = _is_jpeg_file(image_bytes)

    img_bgr_8bit = None  # only available in jpeg path

    if capture_mode == "raw":
        # Expect RAW/DNG data
        if is_jpeg_data and not is_raw_data:
            return _error("MODE_MISMATCH",
                          "JPEG/PNG file uploaded but RAW mode is selected. "
                          "Switch to JPEG mode or upload a DNG/RAW file.")
        img_linear, bit_depth = _decode_raw(image_bytes)
        if img_linear is None:
            # Maybe rawpy not installed or decode failed
            if not HAS_RAWPY:
                return _error("RAW_DECODE_FAIL",
                              "rawpy is not installed. Install it with: pip install rawpy")
            return _error("RAW_DECODE_FAIL",
                          "Failed to decode RAW/DNG file.")
        sat_threshold_linear = 0.98   # near-max in linear 16-bit
        jpeg_caveat = False

    else:  # capture_mode == "jpeg"
        if is_raw_data and not is_jpeg_data:
            return _error("MODE_MISMATCH",
                          "RAW/DNG file uploaded but JPEG mode is selected. "
                          "Switch to RAW mode or upload a JPEG file.")
        img_linear, img_bgr_8bit = _decode_jpeg(image_bytes)
        if img_linear is None:
            raise ValueError("Could not decode image")
        sat_threshold_linear = srgb_to_linear(np.array([250/255.0], dtype=np.float32))[0]
        jpeg_caveat = True

    h, w = img_linear.shape[:2]

    # ══════════════════════════════════════════════════════════════════
    # B.  MILD DENOISE (on linear data)
    # ══════════════════════════════════════════════════════════════════
    # For jpeg path we can denoise the 8-bit then re-linearise.
    # For raw path we do a mild bilateral on the float data.
    if img_bgr_8bit is not None:
        dn_bgr = cv2.fastNlMeansDenoisingColored(img_bgr_8bit, None, 3, 3, 7, 21)
        dn_rgb = cv2.cvtColor(dn_bgr, cv2.COLOR_BGR2RGB).astype(np.float32) / 255.0
        img_linear_dn = srgb_to_linear(dn_rgb)
    else:
        # RAW path: simple gaussian blur as mild denoise on float
        img_linear_dn = cv2.GaussianBlur(img_linear, (5, 5), 0.8)

    # ══════════════════════════════════════════════════════════════════
    # C.  BLACK-BOX CHECK
    # ══════════════════════════════════════════════════════════════════
    lum = (0.2126 * img_linear_dn[:, :, 0]
         + 0.7152 * img_linear_dn[:, :, 1]
         + 0.0722 * img_linear_dn[:, :, 2])

    total_px   = lum.size
    pct_dark   = float(np.sum(lum < LINEAR_DARK_THRESHOLD) / total_px)
    pct_bright = float(np.sum(lum > LINEAR_BRIGHT_THRESHOLD) / total_px)
    is_black_box = (pct_dark > BB_MIN_DARK_RATIO) and (pct_bright < BB_MAX_BRIGHT_RATIO)

    bb_debug = {
        "percent_near_black": pct_dark,
        "bright_area_ratio":  pct_bright,
        "is_black_box":       is_black_box,
    }

    if not is_black_box:
        return {
            "status":      "error",
            "error_type":  "BLACKBOX_NOT_DETECTED",
            "message":     "Black box not detected — surrounding conditions not ideal.",
            "debug_info":  bb_debug,
            "metrics":     {},
            "debug_image": None,
            "overlay_png_base64": None,
            "capture_mode": capture_mode,
        }

    # ══════════════════════════════════════════════════════════════════
    # D.  BLUE REGION — all pixels where blue is dominant
    # ══════════════════════════════════════════════════════════════════
    R = img_linear_dn[:, :, 0]
    G = img_linear_dn[:, :, 1]
    B = img_linear_dn[:, :, 2]

    # Noise floor: ignore pixels that are essentially black
    noise_floor = 0.002

    # Blue mask: every pixel where blue channel exceeds both red and green
    # and is above the noise floor.  No component selection — we keep ALL
    # blue-dominant pixels across the whole image.
    blue_mask = ((B > R) & (B > G) & (B > noise_floor)).astype(np.uint8) * 255

    blue_area = int(cv2.countNonZero(blue_mask))
    blue_detected = blue_area > MIN_BLUE_AREA_PX

    # ══════════════════════════════════════════════════════════════════
    # E.  SENSITIVITY SLIDER — simple brightness cutoff
    #     slider=0  → keep all blue pixels (no cutoff)
    #     slider=100 → keep only the top 1% brightest blue pixels
    # ══════════════════════════════════════════════════════════════════
    b_in_blue = B[blue_mask == 255]

    if b_in_blue.size > 0 and sensitivity > 0:
        # Map slider 0-100 → percentile 0-99 of the blue region's brightness
        cutoff_pct = sensitivity * 0.99          # 0→0th pctl, 100→99th pctl
        cutoff = float(np.percentile(b_in_blue, cutoff_pct))
        core_mask = ((blue_mask == 255) & (B >= cutoff)).astype(np.uint8) * 255
    else:
        core_mask = blue_mask.copy()             # slider=0: keep everything

    core_area = int(cv2.countNonZero(core_mask))

    # ══════════════════════════════════════════════════════════════════
    # F.  METRICS — computed inside core_mask in linear space
    # ══════════════════════════════════════════════════════════════════
    b_core = B[core_mask == 255]

    mean_lin   = float(np.mean(b_core))               if b_core.size > 0 else 0.0
    integ_lin  = float(np.sum(b_core))                 if b_core.size > 0 else 0.0
    max_lin    = float(np.max(b_core))                 if b_core.size > 0 else 0.0
    p99_5_lin  = float(np.percentile(b_core, 99.5))    if b_core.size > 0 else 0.0

    # Saturation ratio (bit-depth aware)
    if b_core.size > 0:
        sat_count  = int(np.sum(b_core >= sat_threshold_linear))
        sat_ratio  = float(sat_count / core_area) if core_area > 0 else 0.0
    else:
        sat_count  = 0
        sat_ratio  = 0.0

    # Legacy max_blue_raw (8-bit B channel in sRGB — only valid for jpeg path)
    if img_bgr_8bit is not None and core_area > 0:
        _, max_raw, _, _ = cv2.minMaxLoc(img_bgr_8bit[:, :, 0], mask=core_mask)
        max_raw = float(max_raw)
    else:
        max_raw = float(max_lin * 255)  # approximate for RAW or empty core

    # ── Normalisation ─────────────────────────────────────────────────
    t   = float(shutter_seconds) if shutter_seconds else 0.0
    iso_v = float(iso) if iso else 0.0
    denom = t * (iso_v / 100.0) if (t > 0 and iso_v > 0) else 0.0

    mean_norm   = float(mean_lin  / denom) if denom > 0 else None
    integ_norm  = float(integ_lin / denom) if denom > 0 else None
    max_norm    = float(max_lin   / denom) if denom > 0 else None

    # ══════════════════════════════════════════════════════════════════
    # G.  BUILD RESPONSE
    # ══════════════════════════════════════════════════════════════════
    metrics = {
        # ── Primary (new) ──
        "mean_linear_core":         mean_lin,
        "integrated_linear_core":   integ_lin,
        "core_area_px":             core_area,
        "max_linear_core":          max_lin,
        "p99_5_linear_core":        p99_5_lin,
        "mean_norm":                mean_norm,
        "integrated_norm":          integ_norm,
        "max_norm":                 max_norm,
        "saturation_ratio":         sat_ratio,
        "saturation_warning":       sat_ratio > 0.05,

        # ── Legacy (backward compat — kept for frontend) ──
        "mean_blue_linear_core":       mean_lin,
        "p95_blue_linear_core":        p99_5_lin,
        "integrated_blue_linear_core": integ_lin,
        "max_blue_raw":                max_raw,
        "max_blue_linear":             max_lin,
        "normalized_intensity":        mean_norm,
        "blue_mask_area_px":           blue_area,
    }

    # ── Warnings list ─────────────────────────────────────────────────
    warnings = []
    if sat_ratio > 0.05:
        warnings.append("Saturation detected; max/mean may be unreliable. Reduce shutter/ISO.")
    if jpeg_caveat:
        warnings.append("JPEG mode: phone ISP (tone mapping/HDR) may skew comparability.")
    if core_area < 200:
        warnings.append("Core area very small — results may be noisy.")

    # ── Debug overlay (JPEG with green contours — legacy) ─────────────
    if img_bgr_8bit is not None:
        debug_vis = img_bgr_8bit.copy()
    else:
        # For RAW, create an 8-bit visualisation
        vis = np.clip(img_linear * 255, 0, 255).astype(np.uint8)
        debug_vis = cv2.cvtColor(vis, cv2.COLOR_RGB2BGR)
    contours, _ = cv2.findContours(core_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    cv2.drawContours(debug_vis, contours, -1, (0, 255, 0), 2)
    _, enc = cv2.imencode(".jpg", debug_vis)
    debug_b64 = "data:image/jpeg;base64," + base64.b64encode(enc).decode("utf-8")

    # ── RGBA overlay PNG (transparent, for live preview) ──────────────
    overlay_b64 = _build_overlay_png(core_mask, (h, w))

    return {
        "status":             "success",
        "is_black_box":       True,
        "blue_detected":      blue_detected,
        "capture_mode":       capture_mode,
        "metrics":            metrics,
        "warnings":           warnings,
        "debug_info": {
            **bb_debug,
            "blue_area_px":      blue_area,
            "core_area_px":      core_area,
            "sensitivity_used":  float(sensitivity),
        },
        "debug_image":        debug_b64,
        "overlay_png_base64": overlay_b64,
    }


# ── Error helper ──────────────────────────────────────────────────────

def _error(error_type, message):
    return {
        "status":             "error",
        "error_type":         error_type,
        "message":            message,
        "debug_info":         {},
        "metrics":            {},
        "debug_image":        None,
        "overlay_png_base64": None,
    }
