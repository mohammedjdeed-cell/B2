import os
from PIL import Image, ImageDraw, ImageFont

def create_app_icon(size, is_maskable=False):
    # Create background with transparent pixels
    image = Image.new("RGBA", (size, size), (255, 255, 255, 0))
    draw = ImageDraw.Draw(image)
    
    margin = 0 if is_maskable else int(size * 0.08)
    extent = size - margin
    
    # Draw a premium dark blue/indigo gradient background squircle
    bg_img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    bg_draw = ImageDraw.Draw(bg_img)
    
    # Custom rounded rectangle draw for premium material appearance
    r = int(size * 0.22) if not is_maskable else 0
    box = [margin, margin, extent, extent] if not is_maskable else [0, 0, size, size]
    
    # Draw premium gradient manually across rows
    for y in range(box[1], box[3]):
        # Soft blue-to-indigo deep sky gradient
        ratio = (y - box[1]) / (box[3] - box[1]) if (box[3] - box[1]) > 0 else 0
        r_col = int(29 + (15 - 29) * ratio)
        g_col = int(78 + (23 - 78) * ratio)
        b_col = int(216 + (43 - 216) * ratio)
        bg_draw.line([(box[0], y), (box[2], y)], fill=(r_col, g_col, b_col, 255))
        
    if not is_maskable:
        # Create mask for round corners
        mask = Image.new("L", (size, size), 0)
        mask_draw = ImageDraw.Draw(mask)
        mask_draw.rounded_rectangle([margin, margin, extent, extent], radius=r, fill=255)
        image.paste(bg_img, (0, 0), mask=mask)
    else:
        image.paste(bg_img, (0, 0))
        
    draw_canvas = ImageDraw.Draw(image)
    
    # Compute relative sizing
    center_x = size // 2
    center_y = size // 2
    
    # 1. Draw graduation cap (mortarboard) resting elegantly on the B2 text
    # Draw the skull cap base
    skull_w = int(size * 0.24)
    skull_h = int(size * 0.12)
    skull_x = center_x - int(size * 0.18)
    skull_y = center_y - int(size * 0.22)
    draw_canvas.chord([skull_x, skull_y, skull_x + skull_w, skull_y + skull_h * 2], 180, 360, fill=(15, 23, 42, 255))
    
    # Draw the diamond top board
    diamond_w = int(size * 0.44)
    diamond_h = int(size * 0.16)
    dx = center_x - int(size * 0.28)
    dy = center_y - int(size * 0.28)
    
    diamond_points = [
        (dx, dy + diamond_h // 2),                   # Left
        (dx + diamond_w // 2, dy),                   # Top
        (dx + diamond_w, dy + diamond_w // 4),       # Right
        (dx + diamond_w // 2, dy + diamond_h)        # Bottom
    ]
    draw_canvas.polygon(diamond_points, fill=(30, 41, 59, 255), outline=(245, 158, 11, 255), width=max(1, int(size * 0.01)))
    
    # Draw gold tassel hanging down right side
    tassel_start = (dx + diamond_w // 2, dy + diamond_h // 2)
    tassel_mid = (dx + diamond_w - int(size * 0.08), dy + diamond_h // 2 + int(size * 0.04))
    tassel_end = (dx + diamond_w - int(size * 0.06), dy + diamond_h // 2 + int(size * 0.16))
    draw_canvas.line([tassel_start, tassel_mid, tassel_end], fill=(245, 158, 11, 255), width=max(1, int(size * 0.008)))
    draw_canvas.ellipse([tassel_end[0] - int(size * 0.02), tassel_end[1], tassel_end[0] + int(size * 0.02), tassel_end[1] + int(size * 0.04)], fill=(245, 158, 11, 255))

    # 2. Draw "B" text
    try:
        font_size = int(size * 0.38)
        font = ImageFont.truetype("Arial", font_size)
    except IOError:
        font = ImageFont.load_default()

    # Draw "B"
    draw_canvas.text((center_x - int(size * 0.24), center_y - int(size * 0.06)), "B", fill=(255, 255, 255, 255), font=font)
    # Draw "2" in gold
    draw_canvas.text((center_x + int(size * 0.02), center_y - int(size * 0.06)), "2", fill=(245, 158, 11, 255), font=font)
    
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
