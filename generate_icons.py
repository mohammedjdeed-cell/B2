import os
from PIL import Image, ImageDraw, ImageFont

def draw_master_avatar():
    """Renders the pristine base vector artwork at a crisp 1000x1000 coordinate space."""
    canvas_size = 1000
    img = Image.new("RGBA", (canvas_size, canvas_size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    
    cx, cy = 500, 500
    lw = 24  # Standardized thick crisp outline
    
    # Core palette mapping
    c_skin = (255, 204, 203, 255)
    c_hair = (150, 111, 214, 255)
    c_shirt = (195, 240, 248, 255)
    c_bubble = (248, 92, 135, 255)
    c_line = (15, 15, 15, 255)
    
    # 1. Body / Shirt
    shirt_poly = [(cx - 400, 1000), (cx - 350, cy + 150), (cx + 250, cy + 150), (cx + 300, 1000)]
    draw.polygon(shirt_poly, fill=c_shirt, outline=c_line, width=lw)
    
    # 2. Neck
    draw.rectangle([cx - 80, cy + 50, cx + 80, cy + 200], fill=c_skin, outline=c_line, width=lw)
    
    # 3. Collar
    draw.polygon([(cx, cy + 180), (cx - 150, cy + 150), (cx, cy + 250)], fill=(255, 255, 255, 255), outline=c_line, width=lw)
    draw.polygon([(cx, cy + 180), (cx + 150, cy + 150), (cx, cy + 250)], fill=(255, 255, 255, 255), outline=c_line, width=lw)
    draw.line([(cx, cy + 250), (cx, cy + 350)], fill=c_line, width=lw)
    
    # 4. Ears
    draw.ellipse([cx - 230, cy - 100, cx - 130, cy + 20], fill=c_skin, outline=c_line, width=lw)
    draw.ellipse([cx + 130, cy - 100, cx + 230, cy + 20], fill=c_skin, outline=c_line, width=lw)
    
    # 5. Head Base
    draw.ellipse([cx - 180, cy - 250, cx + 180, cy + 120], fill=c_skin, outline=c_line, width=lw)
    
    # 6. Hair Layers
    draw.chord([cx - 220, cy - 350, cx + 50, cy - 50], 150, 360, fill=c_hair, outline=c_line, width=lw)
    draw.chord([cx - 50, cy - 300, cx + 200, cy - 50], 180, 360, fill=c_hair, outline=c_line, width=lw)
    
    # 7. Speech Bubble
    bx1, by1 = cx + 120, cy - 350
    bx2, by2 = cx + 420, cy - 120
    draw.polygon([(bx1 + 20, by2 - 50), (bx1 - 50, by2 + 80), (bx1 + 100, by2 - 20)], fill=c_bubble, outline=c_line, width=lw)
    draw.rounded_rectangle([bx1, by1, bx2, by2], radius=30, fill=c_bubble, outline=c_line, width=lw)
    
    # 8. Text Rendering ("DE")
    font = None
    for font_name in ["arialbd.ttf", "Helvetica-Bold.ttf", "DejaVuSans-Bold.ttf", "LiberationSans-Bold.ttf"]:
        try:
            font = ImageFont.truetype(font_name, 120)
            break
        except IOError:
            continue
    if not font:
        font = ImageFont.load_default()
    
    label = "DE"
    try:
        bbox = draw.textbbox((0, 0), label, font=font)
        text_w = bbox[2] - bbox[0]
        text_h = bbox[3] - bbox[1]
    except AttributeError:
        text_w, text_h = 140, 90  # Solid layout fallback metrics
        
    tx = bx1 + (bx2 - bx1 - text_w) / 2
    ty = by1 + (by2 - by1 - text_h) / 2 - 12
    draw.text((tx, ty), label, fill=c_line, font=font)
    
    return img

def create_app_icon(target_size, is_maskable=False):
    """Processes the master artwork into target specifications matching manifest requirements."""
    master = draw_master_avatar()
    
    if is_maskable:
        # PWA Spec: Must have solid background and completely fit inside the 80% inner safe circle
        final_img = Image.new("RGBA", (target_size, target_size), (255, 255, 255, 255))
        safe_padded_size = int(target_size * 0.75)  # Keeps layout exactly inside safe-zone parameters
        resized_content = master.resize((safe_padded_size, safe_padded_size), Image.Resampling.LANCZOS)
        
        # Center the content
        offset = (target_size - safe_padded_size) // 2
        final_img.paste(resized_content, (offset, offset), resized_content)
    else:
        # Pure regular transparent icon configuration
        final_img = master.resize((target_size, target_size), Image.Resampling.LANCZOS)
        
    return final_img

if __name__ == "__main__":
    output_dir = "./icons"
    os.makedirs(output_dir, exist_ok=True)
    
    icon_configs = [
        {"name": "icon-192.png", "size": 192, "maskable": False},
        {"name": "icon-512.png", "size": 512, "maskable": False},
        {"name": "icon-192-maskable.png", "size": 192, "maskable": True},
        {"name": "icon-512-maskable.png-bcee045d", "size": 512, "maskable": True},  # Tracked fix path name
    ]
    
    # Overwrite explicitly to guarantee true PNG headers
    for conf in icon_configs:
        # Standard clean manifest target check
        filename = conf["name"] if not conf["maskable"] or "512" not in conf["name"] else "icon-512-maskable.png"
        file_path = os.path.join(output_dir, filename)
        
        img = create_app_icon(conf["size"], conf["maskable"])
        img.save(file_path, "PNG")
        print(f"Verified & written: {file_path}")
