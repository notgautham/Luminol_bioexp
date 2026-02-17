import cv2
import numpy as np
import base64

# --- Parameters & Thresholds ---
# User can tune these if needed.

# Black Box Detection
LINEAR_DARK_THRESHOLD = 0.05    # Pixels darker than this (in linear 0-1) are "dark"
LINEAR_BRIGHT_THRESHOLD = 0.4   # Pixels brighter than this are "bright"
BB_MIN_DARK_RATIO = 0.80        # At least 80% of pixels must be dark
BB_MAX_BRIGHT_RATIO = 0.25      # At most 25% of pixels can be bright (prevents bright ambient scenes)

# Blue Detection
# OpenCV HSV ranges: H (0-179), S (0-255), V (0-255)
# User request: 190-260 degrees -> 95-130 in OpenCV
BLUE_H_MIN = 90  # Slightly generous lower bound (Cyan/Blue boundary is ~90)
BLUE_H_MAX = 135 # Slightly generous upper bound (Blue/Violet boundary)
BLUE_S_MIN = 40  # Avoid white/gray
BLUE_V_MIN = 20  # Avoid absolute black

# Channel Dominance (Linear Space)
# B > G * k1 AND B > R * k2
BLUE_DOM_G_FACTOR = 1.1 
BLUE_DOM_R_FACTOR = 1.3

MIN_BLUE_AREA_PX = 50   # Minimum pixels to count as detection

def srgb_to_linear(img_srgb_norm):
    """
    Convert sRGB (0-1) to Linear (0-1).
    Formula:
    if c <= 0.04045: c / 12.92
    else: ((c + 0.055) / 1.055) ^ 2.4
    """
    mask_small = img_srgb_norm <= 0.04045
    img_linear = np.empty_like(img_srgb_norm)
    img_linear[mask_small] = img_srgb_norm[mask_small] / 12.92
    img_linear[~mask_small] = np.power((img_srgb_norm[~mask_small] + 0.055) / 1.055, 2.4)
    return img_linear

def analyze_image(image_bytes, exposure_time, iso):
    # --- Step A: Load & Decode ---
    nparr = np.frombuffer(image_bytes, np.uint8)
    img_bgr = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    
    if img_bgr is None:
        raise ValueError("Could not decode image")
        
    # Convert to RGB (for consistent logic)
    img_rgb = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2RGB)
    
    # Create Normalized sRGB (0-1) for calculations
    img_srgb_norm = img_rgb.astype(np.float32) / 255.0
    
    # Create Linear RGB (0-1)
    img_linear = srgb_to_linear(img_srgb_norm)

    # --- Step B: Denoise ---
    # Mild denoise on BGR 8-bit for heuristics, preserving edges
    # 'fastNlMeansDenoisingColored' is good but slow. 
    # For speed on large batches, GaussianBlur or MedianBlur on high-res might be preferred,
    # but let's stick to mild NLMeans with lower parameters for quality/speed balance.
    # strength=3 is very mild.
    img_bgr_denoised = cv2.fastNlMeansDenoisingColored(img_bgr, None, 3, 3, 7, 21)
    img_rgb_denoised = cv2.cvtColor(img_bgr_denoised, cv2.COLOR_BGR2RGB)
    
    # Re-calculate linear from denoised? 
    # Technically "correct" is denoise raw -> linear, but we don't have raw.
    # We'll use the denoised 8-bit for Masks/Heuristics and the original Linear for intensity stats 
    # (or denoised linear if noise is bad, let's use denoised linear to be safe against salt/pepper).
    img_srgb_denoised_norm = img_rgb_denoised.astype(np.float32) / 255.0
    img_linear_denoised = srgb_to_linear(img_srgb_denoised_norm)

    # --- Step C: Black Box Detection ---
    # Calculate luminance in linear space (Rec. 709 coefficients aprox: 0.2126 R + 0.7152 G + 0.0722 B)
    # or just simple mean for approximate "brightness" check.
    # Luminance Y = 0.2126 R + 0.7152 G + 0.0722 B
    lum_linear = (0.2126 * img_linear_denoised[:,:,0] + 
                  0.7152 * img_linear_denoised[:,:,1] + 
                  0.0722 * img_linear_denoised[:,:,2])
    
    total_pixels = lum_linear.size
    count_near_black = np.sum(lum_linear < LINEAR_DARK_THRESHOLD)
    count_bright = np.sum(lum_linear > LINEAR_BRIGHT_THRESHOLD)
    
    percent_near_black = count_near_black / total_pixels
    bright_area_ratio = count_bright / total_pixels
    
    is_black_box = (percent_near_black > BB_MIN_DARK_RATIO) and (bright_area_ratio < BB_MAX_BRIGHT_RATIO)
    
    bb_debug = {
        "percent_near_black": float(percent_near_black),
        "bright_area_ratio": float(bright_area_ratio),
        "is_black_box": bool(is_black_box)
    }

    if not is_black_box:
        return {
            "status": "error",
            "error_type": "BLACKBOX_NOT_DETECTED", 
            "message": "Sample not detected / Surrounding conditions not ideal (Black box check failed).",
            "debug_info": bb_debug,
            "metrics": {},
            "debug_image": None
        }

    # --- Step D: Blue Glow Detection ---
    # 1. HSV Mask (on Denoised 8-bit)
    img_hsv = cv2.cvtColor(img_bgr_denoised, cv2.COLOR_BGR2HSV)
    lower_blue = np.array([BLUE_H_MIN, BLUE_S_MIN, BLUE_V_MIN])
    upper_blue = np.array([BLUE_H_MAX, 255, 255])
    mask_hsv = cv2.inRange(img_hsv, lower_blue, upper_blue)
    
    # 2. Linear Channel Dominance Mask
    # Extract channels from Linear Denoised
    R_lin = img_linear_denoised[:,:,0]
    G_lin = img_linear_denoised[:,:,1]
    B_lin = img_linear_denoised[:,:,2]
    
    mask_dominance = (B_lin > (G_lin * BLUE_DOM_G_FACTOR)) & (B_lin > (R_lin * BLUE_DOM_R_FACTOR))
    mask_dominance_uint8 = (mask_dominance * 255).astype(np.uint8)
    
    # Combine Masks (Intersection)
    # We require BOTH correct Hue AND Blue Dominance to avoid purple/cyan noise artifacting?
    # Or maybe Union? User said "intersection/union strategy (document choice)".
    # Intersection is safer for "pure blue".
    final_mask = cv2.bitwise_and(mask_hsv, mask_dominance_uint8)
    
    # Morphological Cleanup
    kernel = np.ones((3,3), np.uint8)
    final_mask = cv2.morphologyEx(final_mask, cv2.MORPH_OPEN, kernel)
    
    # Connected Components to remove tiny specks
    # (Optional vs just area check) -> Let's count total pixels first.
    blue_area_px = cv2.countNonZero(final_mask)
    
    blue_detected = blue_area_px > MIN_BLUE_AREA_PX
    
    if not blue_detected:
         return {
            "status": "error",
            "error_type": "BLUE_NOT_DETECTED",
            "message": "Blue light not detected.",
            "debug_info": {**bb_debug, "blue_area_px": int(blue_area_px)},
            "metrics": {},
            "debug_image": None
        }

    # --- Step E: Compute Intensity Metrics ---
    # We compute metrics ONLY within the mask.
    
    # maxBlueRaw: Max of B channel in sRGB (0-255)
    # We use the ORIGINAL sRGB image (img_bgr) or Denoised?
    # User said "Step E ... maxBlueRaw = max(B channel in sRGB within mask)".
    # Using denoised reduces outlier single-pixel noise which is good for "Max".
    # Using original might capture true peak.
    # Let's use PRE-DENOISED (Original) for intensity to be scientifically rigorous about what the camera saw?
    # Actually, single pixel hot pixels are bad. Denoised is safer for "Max".
    # Let's use Denoised for now, or maybe a median.
    # Img_bgr_denoised is available.
    
    b_channel_srgb = img_bgr_denoised[:,:,0] # BGR -> B is 0
    min_val, max_val_raw, min_loc, max_loc = cv2.minMaxLoc(b_channel_srgb, mask=final_mask)
    
    # maxBlueLinear: Max of B channel in Linear
    # We can mask the linear B channel
    b_linear_masked = B_lin[final_mask == 255]
    if b_linear_masked.size > 0:
        max_val_linear = np.max(b_linear_masked)
    else:
        max_val_linear = 0.0
        
    # Saturation Ratio
    # Fraction of masked pixels with B_raw >= 250
    # Use original image for saturation check to catch clipping before denoise
    b_channel_original = img_bgr[:,:,0]
    saturated_pixels = cv2.countNonZero(((b_channel_original >= 250) & (final_mask == 255)).astype(np.uint8))
    saturation_ratio = saturated_pixels / blue_area_px if blue_area_px > 0 else 0

    # --- Step F: Normalization ---
    # Formula: maxBlueLinear / (t * (iso/100))
    t = float(exposure_time) if exposure_time else 0
    iso_val = float(iso) if iso else 0
    
    if t > 0 and iso_val > 0:
        normalized_intensity = max_val_linear / (t * (iso_val / 100.0))
    else:
        normalized_intensity = None
        
    # --- Step G: Final Output ---
    metrics = {
        "max_blue_raw": float(max_val_raw),
        "max_blue_linear": float(max_val_linear),
        "normalized_intensity": float(normalized_intensity) if normalized_intensity is not None else None,
        "blue_mask_area_px": int(blue_area_px),
        "saturation_ratio": float(saturation_ratio),
        "saturation_warning": saturation_ratio > 0.05
    }
    
    # Debug Image Generation
    # Overlay green contour on original denoised
    contours, _ = cv2.findContours(final_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    debug_vis = img_bgr_denoised.copy()
    cv2.drawContours(debug_vis, contours, -1, (0, 255, 0), 2)
    
    # Encode
    _, encoded_img = cv2.imencode('.jpg', debug_vis)
    debug_img_b64 = "data:image/jpeg;base64," + base64.b64encode(encoded_img).decode('utf-8')
    
    return {
        "status": "success",
        "is_black_box": True,
        "blue_detected": True,
        "metrics": metrics,
        "debug_info": {**bb_debug, "blue_area_px": int(blue_area_px)},
        "debug_image": debug_img_b64
    }
