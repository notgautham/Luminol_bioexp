import cv2
import numpy as np
import processing

# Create a dark synthetic image
img = np.zeros((100, 100, 3), dtype=np.uint8)

# Add a faint blue glow in the center
cv2.circle(img, (50, 50), 20, (30, 0, 0), -1)  # BGR format, so (30, 0, 0) is faint blue

# encode to jpeg
_, buf = cv2.imencode('.jpg', img)

# Test analyze
res = processing.analyze_image(buf.tobytes(), 0.0167, 800, sensitivity=50, capture_mode='jpeg')

print("Blue area px:", res['metrics'].get('blue_mask_area_px'))
print("Core area px:", res['metrics'].get('core_area_px'))
print("Integrated Norm:", res['metrics'].get('integrated_norm'))
print("Is Black Box:", res['is_black_box'])
print("Blue Detected:", res['blue_detected'])

# Test empty image (no blue glow)
img_empty = np.zeros((100, 100, 3), dtype=np.uint8)
# Add some white noise
noise = np.random.randint(0, 5, (100, 100, 3), dtype=np.uint8)
img_empty = cv2.add(img_empty, noise)

_, buf_empty = cv2.imencode('.jpg', img_empty)
res_empty = processing.analyze_image(buf_empty.tobytes(), 0.0167, 800, sensitivity=50, capture_mode='jpeg')

print("\nEmpty Image Test:")
print("Blue Detected:", res_empty['blue_detected'])
print("Core area px:", res_empty['debug_info'].get('core_area_px'))
