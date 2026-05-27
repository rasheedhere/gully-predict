import sys
from PIL import Image

def make_transparent(input_path, output_path, threshold=20):
    img = Image.open(input_path).convert("RGBA")
    datas = img.getdata()
    
    # Auto-detect background color from the top-left corner pixel
    corner_pixel = datas[0] # (r, g, b, a)
    corner_brightness = sum(corner_pixel[:3]) / 3
    is_white_bg = corner_brightness > 128
    print(f"Detected background: {'WHITE' if is_white_bg else 'BLACK'} (corner brightness: {corner_brightness})")
    
    newData = []
    if is_white_bg:
        # Key out white background
        # Pixels with min channel > (255 - threshold) are considered background
        limit = 255 - threshold
        for item in datas:
            r, g, b, a = item
            val = min(r, g, b)
            if val > limit:
                # Smooth transition
                diff = 255 - val
                alpha = int((diff / threshold) * 255)
                newData.append((r, g, b, alpha))
            else:
                newData.append(item)
    else:
        # Key out black background
        for item in datas:
            r, g, b, a = item
            val = max(r, g, b)
            if val < threshold:
                alpha = int((val / threshold) * 255)
                newData.append((r, g, b, alpha))
            else:
                newData.append(item)
            
    img.putdata(newData)
    img.save(output_path, "PNG")
    print(f"Saved transparent image to {output_path}")

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python make_transparent.py input_path output_path [threshold]")
        sys.exit(1)
    
    input_path = sys.argv[1]
    output_path = sys.argv[2]
    threshold = int(sys.argv[3]) if len(sys.argv) > 3 else 20
    
    make_transparent(input_path, output_path, threshold)
