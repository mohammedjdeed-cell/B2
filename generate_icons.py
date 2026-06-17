import os
from PIL import Image, ImageDraw, ImageFont

def create_app_icon(size, is_maskable=False):
    # Base configuration: Accent blue (#2563EB) background circle inside transparent box
    image = Image.new("RGBA", (size, size), (255, 255, 255, 0))
    draw = ImageDraw.Draw(image)
    
    # Position logic
    margin = 0 if is_maskable else int(size * 0.08)
    extent = size - margin
    
    # Fill solid modern background shape
    if is_maskable:
        # Solid filled rect on maskable icon formats
        draw.rectangle([0, 0, size, size], fill=(37, 99, 235, 255))
    else:
        # Rounded ellipse circle
        draw.ellipse([margin, margin, extent, extent], fill=(37, 99, 235, 255))
        
    # Draw White B2 Text markup structure
    try:
        font_size = int(size * 0.38)
        font = ImageFont.truetype("Arial", font_size)
    except IOError:
        font = ImageFont.load_default()

    label = "B2"
    
    try:
        bbox = draw.textbbox((0, 0), label, font=font)
        text_w = bbox[2] - bbox[0]
        text_h = bbox[3] - bbox[1]
    except AttributeError:
        text_w, text_h = draw.textsize(label, font=font)
        
    x_pos = (size - text_w) // 2
    y_pos = (size - text_h) // 2 - int(size * 0.03) # Fine adjusted alignment offset

    # Write solid text element
    draw.text((x_pos, y_pos), label, fill=(255, 255, 255, 255), font=font)
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
