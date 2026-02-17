import cv2
import os
import sys
# Add current directory to path to allow imports if running from root
sys.path.append(os.path.join(os.getcwd(), 'backend'))

from backend.processing import analyze_image

def test():
    test_dir = 'test_images'
    if not os.path.exists(test_dir):
        print(f"Directory {test_dir} not found.")
        return

    files = sorted(os.listdir(test_dir))
    print(f"Testing {len(files)} images from {test_dir}...")
    
    for f in files:
        if not f.endswith('.jpg'): continue
        path = os.path.join(test_dir, f)
        with open(path, 'rb') as file:
            data = file.read()
        
        print(f"\nAnalyzing {f}...")
        try:
            # Need to mock exposure time and iso
            res = analyze_image(data, 10.0, 800.0)
            
            status = res['status']
            print(f"  Status: {status}")
            
            if status == 'error':
                 print(f"  Error: {res.get('message')}")
                 print(f"  Debug: {res.get('debug_info')}")
            else:
                 print(f"  Blue Detected: {res.get('blue_detected')}")
                 print(f"  Metrics: {res.get('metrics')}")
                 
        except Exception as e:
            print(f"  Exception: {e}")

if __name__ == "__main__":
    test()
