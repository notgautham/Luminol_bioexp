import cv2
import os
import sys
import numpy as np

# Add current directory to path
sys.path.append(os.path.join(os.getcwd(), 'backend'))

try:
    from backend.processing import analyze_image
except ImportError:
    # Fallback if running from backend dir
    sys.path.append(os.getcwd())
    from backend.processing import analyze_image

def generate_verification_images():
    os.makedirs('backend/test_images', exist_ok=True)
    
    # 1. Good Blue (Dark BG, Blue Circle)
    img_good = np.zeros((500, 500, 3), dtype=np.uint8)
    # BGR Blue
    cv2.circle(img_good, (250, 250), 50, (200, 50, 0), -1) 
    cv2.imwrite('backend/test_images/verif_good.jpg', img_good)
    
    # 2. Bad Ambient (Gray BG)
    img_bad = np.ones((500, 500, 3), dtype=np.uint8) * 100
    cv2.imwrite('backend/test_images/verif_bad_ambient.jpg', img_bad)
    
    # 3. Wrong Color (Red)
    img_red = np.zeros((500, 500, 3), dtype=np.uint8)
    cv2.circle(img_red, (250, 250), 50, (0, 0, 255), -1) 
    cv2.imwrite('backend/test_images/verif_red.jpg', img_red)

    print("Generated verification images.")

def test_pipeline():
    generate_verification_images()
    test_dir = 'backend/test_images'
    files = [
        'verif_good.jpg',
        'verif_bad_ambient.jpg',
        'verif_red.jpg'
    ]
    
    print("\n--- Starting Pipeline Verification ---\n")
    
    for f in files:
        path = os.path.join(test_dir, f)
        if not os.path.exists(path):
            print(f"Skipping {f}, not found.")
            continue
            
        with open(path, 'rb') as file:
            data = file.read()
        
        print(f"Testing {f}...")
        try:
            res = analyze_image(data, 10.0, 800.0)
            status = res['status']
            print(f"  Result: {status}")
            if status == 'error':
                 print(f"  Error Type: {res.get('error_type')}")
                 print(f"  Message: {res.get('message')}")
            else:
                 print(f"  Metrics: {res.get('metrics')}")
                 
            # Assertions
            if f == 'verif_good.jpg' and status != 'success':
                print("  [FAIL] Expected success for good image.")
            elif f == 'verif_bad_ambient.jpg' and res.get('error_type') != 'BLACKBOX_NOT_DETECTED':
                print(f"  [FAIL] Expected BLACKBOX_NOT_DETECTED, got {res.get('error_type')}")
            elif f == 'verif_red.jpg' and res.get('error_type') != 'BLUE_NOT_DETECTED':
                print(f"  [FAIL] Expected BLUE_NOT_DETECTED, got {res.get('error_type')}")
            else:
                print("  [PASS]")
                
        except Exception as e:
            print(f"  [EXCEPTION] {e}")
        print("-" * 30)

if __name__ == "__main__":
    test_pipeline()
