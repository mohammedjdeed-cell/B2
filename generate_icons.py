import os
from PIL import Image, ImageDraw, ImageFont

def create_app_icon(size, is_maskable=False):
    # Create background canvas with transparency
    image = Image.new("RGBA", (size, size), (255, 255, 255, 0))
    
    # Border spacing parameters - PWA safe zones
    margin = 0 if is_maskable else int(size * 0.05)
    extent = size - margin
    
    # 1. Background layer rendering matrix
    bg_img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    bg_draw = ImageDraw.Draw(bg_img)
    
    # Modern rounded corner radius configuration
    r = int(size * 0.24) if not is_maskable else 0
    box = [margin, margin, extent, extent] if not is_maskable else [0, 0, size, size]
    
    # Linear row rendering loop for smooth blue gradient transition
    for y in range(box[1], box[3]):
        ratio = (y - box[1]) / (box[3] - box[1]) if (box[3] - box[1]) > 0 else 0
        # Hex variation match: #3b82f6 to #1d4ed8
        r_col = int(59 + (29 - 59) * ratio)
        g_col = int(130 + (78 - 130) * ratio)
        b_col = int(246 + (216 - 246) * ratio)
        bg_draw.line([(box[0], y), (box[2], y)], fill=(r_col, g_col, b_col, 255))
        
    if not is_maskable:
        # Construct masking layer for squircles
        mask = Image.new("L", (size, size), 0)
        mask_draw = ImageDraw.Draw(mask)
        mask_draw.rounded_rectangle(box, radius=r, fill=255)
        image.paste(bg_img, (0, 0), mask=mask)
    else:
        image.paste(bg_img, (0, 0))
        
    draw_canvas = ImageDraw.Draw(image)
    
    # 2. Advanced Typography Metrics Matching
    # Expanded text scale factor to maximize real estate occupancy inside safe boundaries
    font_size = int(size * 0.58)
    
    try:
        try:
            font = ImageFont.truetype("arialbd.ttf", font_size)  # Windows Core Bold
        except IOError:
            try:
                font = ImageFont.truetype("Helvetica-Bold.ttf", font_size)  # MacOS Native Core
            except IOError:
                font = ImageFont.truetype("DejaVuSans-Bold.ttf", font_size)  # Linux Native Core
    except IOError:
        font = ImageFont.load_default()

    label = "DE"
    
    # Exact center extraction via typographic canvas measurements
    try:
        bbox = draw_canvas.textbbox((0, 0), label, font=font)
        text_w = bbox[2] - bbox[0]
        text_h = bbox[3] - bbox[1]
        offset_y = bbox[1]
    except AttributeError:
        text_w, text_h = draw_canvas.textsize(label, font=font)
        offset_y = 0
        
    x_pos = (size - text_w) // 2
    # Adjust alignment offset to counteract typographical ascender skewing
    y_pos = (size - text_h) // 2 - offset_y - int(size * 0.02)

    # 3. Soft Layer Drop Shadow Rendering
    shadow_offset = int(size * 0.02)
    draw_canvas.text((x_pos, y_pos + shadow_offset), label, fill=(17, 24, 39, 90), font=font)
    
    # 4. Foreground Rendering
    draw_canvas.text((x_pos, y_pos), label, fill=(255, 255, 255, 255), font=font)
    
    return image

if __name__ == "__main__":
    output_dir = "./icons"
    os.makedirs(output_dir, exist_ok=True)
    
    icon_configs = [
        {"name": "icon-192.png", "size": 192, "maskable": False},
        {"name": "icon-512.png", "size": 512, "maskable": False},
        {"name": "icon-192-maskable.png", "size": 192, "maskable": True},
        {"name": "icon-512-maskable.png", "size": 512, "maskable": True},
    ]
    
    for conf in icon_configs:
        file_path = os.path.join(output_dir, conf["name"])
        img = create_app_icon(conf["size"], conf["maskable"])
        img.save(file_path, "PNG")
        print(f"Icons saved: {file_path}")
