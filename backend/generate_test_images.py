import cv2
import numpy as np
import os

def create_test_images():
    os.makedirs('test_images', exist_ok=True)
    
    # 1. Pure Black (Conditions Ideal, No Blue)
    # Actually, if no blue, it should error "Blue light not detected".
    img_black = np.zeros((500, 500, 3), dtype=np.uint8)
    cv2.imwrite('test_images/01_black_no_blue.jpg', img_black)
    
    # 2. Black Box with Blue Light (Ideal)
    img_blue = np.zeros((500, 500, 3), dtype=np.uint8)
    # Draw a blue circle. BGR: (255, 0, 0)
    cv2.circle(img_blue, (250, 250), 100, (255, 50, 0), -1) 
    # Add some noise to make it realistic
    noise = np.random.normal(0, 10, img_blue.shape).astype(np.uint8)
    img_blue = cv2.add(img_blue, noise)
    cv2.imwrite('test_images/02_good_blue.jpg', img_blue)
    
    # 3. Bright Image (Not Black Box)
    img_bright = np.ones((500, 500, 3), dtype=np.uint8) * 100
    cv2.imwrite('test_images/03_bright_env.jpg', img_bright)
    
    # 4. Black Box with Red Light (Wrong Color)
    img_red = np.zeros((500, 500, 3), dtype=np.uint8)
    cv2.circle(img_red, (250, 250), 100, (0, 0, 255), -1)
    cv2.imwrite('test_images/04_red_light.jpg', img_red)

    print("Test images created in backend/test_images")

if __name__ == "__main__":
    create_test_images()
