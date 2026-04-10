"""
Luminol Blue Intensity Analyzer — Video Processing Pipeline
============================================================
Single public entry point: analyze_video()

Handles MP4/MOV video files by:
  1. Sampling ~10 evenly-spaced frames for dark-box validation.
  2. Scanning EVERY frame for the one with the highest total blue energy.
  3. Feeding that peak frame into the existing analyze_image() pipeline.

The result dict mirrors analyze_image() output, augmented with video metadata.
"""

import cv2
import numpy as np
import base64
import tempfile
import os

from processing import analyze_image, srgb_to_linear, _run_analysis


def analyze_video(
    video_bytes: bytes,
    shutter_seconds: float,
    iso: float,
    sensitivity: float = 50,
    capture_mode: str = "jpeg",
):
    """
    Analyse a luminol chemiluminescence video.

    Finds the frame with the brightest blue glow and runs the full
    image analysis pipeline on it.

    Parameters
    ----------
    video_bytes     : Raw file bytes of an MP4/MOV video.
    shutter_seconds : Shutter speed in seconds.
    iso             : Camera ISO.
    sensitivity     : Core-mask strictness 0-100.
    capture_mode    : "jpeg" or "raw" (videos are always treated as jpeg-path).

    Returns
    -------
    dict  JSON-serialisable result (same shape as analyze_image output + video_info).
    """

    # ══════════════════════════════════════════════════════════════════
    # A.  DECODE VIDEO
    # ══════════════════════════════════════════════════════════════════
    # OpenCV needs a file path, so write to a temp file
    tmp_fd, tmp_path = tempfile.mkstemp(suffix=".mp4")
    try:
        os.write(tmp_fd, video_bytes)
        os.close(tmp_fd)

        cap = cv2.VideoCapture(tmp_path)
        if not cap.isOpened():
            return _video_error("VIDEO_DECODE_FAIL", "Could not open video file.")

        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
        duration_s = total_frames / fps if fps > 0 else 0.0

        if total_frames < 1:
            cap.release()
            return _video_error("VIDEO_DECODE_FAIL", "Video contains no frames.")

        # ══════════════════════════════════════════════════════════════
        # B.  DARK-BOX CHECK — sampled frames (~10 evenly spaced)
        # ══════════════════════════════════════════════════════════════
        LINEAR_DARK_THRESHOLD   = 0.05
        LINEAR_BRIGHT_THRESHOLD = 0.40
        BB_MIN_DARK_RATIO       = 0.80
        BB_MAX_BRIGHT_RATIO     = 0.25

        num_samples = min(10, total_frames)
        sample_indices = np.linspace(0, total_frames - 1, num_samples, dtype=int)

        for idx in sample_indices:
            cap.set(cv2.CAP_PROP_POS_FRAMES, int(idx))
            ret, frame_bgr = cap.read()
            if not ret or frame_bgr is None:
                continue

            # Convert to linear space for the check
            frame_rgb = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2RGB).astype(np.float32) / 255.0
            frame_linear = srgb_to_linear(frame_rgb)

            lum = (0.2126 * frame_linear[:, :, 0]
                 + 0.7152 * frame_linear[:, :, 1]
                 + 0.0722 * frame_linear[:, :, 2])

            total_px   = lum.size
            pct_dark   = float(np.sum(lum < LINEAR_DARK_THRESHOLD) / total_px)
            pct_bright = float(np.sum(lum > LINEAR_BRIGHT_THRESHOLD) / total_px)

            if not ((pct_dark > BB_MIN_DARK_RATIO) and (pct_bright < BB_MAX_BRIGHT_RATIO)):
                cap.release()
                return {
                    "status":             "error",
                    "error_type":         "BLACKBOX_NOT_DETECTED",
                    "message":            f"Dark box check failed at frame {idx} "
                                          f"(timestamp {idx/fps:.2f}s). "
                                          f"Ensure consistent dark conditions throughout the video.",
                    "input_type":         "video",
                    "debug_info": {
                        "failed_frame":       int(idx),
                        "percent_near_black": pct_dark,
                        "bright_area_ratio":  pct_bright,
                    },
                    "metrics":            {},
                    "debug_image":        None,
                    "overlay_png_base64": None,
                    "video_info": {
                        "total_frames":    total_frames,
                        "fps":             round(fps, 2),
                        "duration_seconds": round(duration_s, 2),
                    },
                }

        # ══════════════════════════════════════════════════════════════
        # C.  PEAK BLUE SCAN — every single frame
        # ══════════════════════════════════════════════════════════════
        cap.set(cv2.CAP_PROP_POS_FRAMES, 0)

        best_frame_idx   = 0
        best_blue_energy = -1.0
        best_frame_bgr   = None

        frame_idx = 0
        while True:
            ret, frame_bgr = cap.read()
            if not ret or frame_bgr is None:
                break

            # Quick blue energy: sum of max(B - max(R,G), 0) in sRGB space
            # (no need for full linear conversion — relative ordering is preserved)
            b = frame_bgr[:, :, 0].astype(np.float32)  # OpenCV is BGR
            g = frame_bgr[:, :, 1].astype(np.float32)
            r = frame_bgr[:, :, 2].astype(np.float32)

            blue_energy = float(np.sum(np.maximum(b - np.maximum(r, g), 0)))

            if blue_energy > best_blue_energy:
                best_blue_energy = blue_energy
                best_frame_idx   = frame_idx
                best_frame_bgr   = frame_bgr.copy()

            frame_idx += 1

        cap.release()

        if best_frame_bgr is None:
            return _video_error("VIDEO_DECODE_FAIL", "Could not read any frames from video.")

        # ══════════════════════════════════════════════════════════════
        # D.  ANALYSE PEAK FRAME — pass BGR array directly to pipeline
        # ══════════════════════════════════════════════════════════════
        # Convert BGR → linear RGB directly — no encode/decode round-trip.
        frame_rgb = cv2.cvtColor(best_frame_bgr, cv2.COLOR_BGR2RGB)
        
        # ── Color Range Fix ──
        # MP4 videos often use "Limited Range" (16-235) instead of "Full Range" (0-255).
        # Standard video players expand this automatically to match the screen's full range.
        # OpenCV ffmpeg decoders often do not. Since luminol images are inside a dark box, 
        # true black should be 0. If minimum > 10, the video is likely left in Limited Range,
        # which traps peak brightness at ~235 and crushes contrast. 
        # We manually stretch [16-235] -> [0-255] to restore the visual brightness and contrast.
        if frame_rgb.min() >= 8:
            frame_rgb = np.clip((frame_rgb.astype(np.float32) - 16.0) * (255.0 / (235.0 - 16.0)), 0, 255).astype(np.uint8)

        img_norm   = frame_rgb.astype(np.float32) / 255.0
        img_linear = srgb_to_linear(img_norm)
        sat_threshold_linear = srgb_to_linear(
            np.array([250 / 255.0], dtype=np.float32)
        )[0]

        result = _run_analysis(
            img_linear,
            best_frame_bgr,           # img_bgr_8bit (for denoising & debug overlay)
            sat_threshold_linear,
            True,                     # jpeg_caveat: video frames are compressed
            shutter_seconds, iso, sensitivity, "jpeg",
        )

        # ══════════════════════════════════════════════════════════════
        # E.  AUGMENT RESPONSE with video metadata
        # ══════════════════════════════════════════════════════════════
        result["input_type"] = "video"
        result["video_info"] = {
            "total_frames":           total_frames,
            "fps":                    round(fps, 2),
            "duration_seconds":       round(duration_s, 2),
            "peak_frame_index":       best_frame_idx,       # 0-based (OpenCV convention)
            "peak_frame_index_1based": best_frame_idx + 1,  # 1-based (human-readable)
            "peak_frame_timestamp":   round(best_frame_idx / fps, 3) if fps > 0 else 0,
            "peak_blue_energy":       round(best_blue_energy, 2),
        }

        # Generate a base64 preview of the peak frame for the frontend thumbnail
        _, preview_enc = cv2.imencode(".jpg", best_frame_bgr, [cv2.IMWRITE_JPEG_QUALITY, 85])
        result["peak_frame_preview"] = (
            "data:image/jpeg;base64," + base64.b64encode(preview_enc).decode("utf-8")
        )

        return result

    finally:
        # Clean up temp file
        try:
            os.remove(tmp_path)
        except OSError:
            pass


# ── Error helper ──────────────────────────────────────────────────────

def _video_error(error_type, message):
    return {
        "status":             "error",
        "error_type":         error_type,
        "message":            message,
        "input_type":         "video",
        "debug_info":         {},
        "metrics":            {},
        "debug_image":        None,
        "overlay_png_base64": None,
        "video_info":         {},
    }
