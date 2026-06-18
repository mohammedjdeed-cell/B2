import os
from PIL import Image, ImageDraw, ImageFont

def create_app_icon(size, is_maskable=False):
    # Basis-Leinwand
    bg_color = (255, 255, 255, 255) if is_maskable else (255, 255, 255, 0)
    image = Image.new("RGBA", (size, size), bg_color)
    draw = ImageDraw.Draw(image)
    
    # Skalierungsvariablen
    s = size
    cx = s / 2
    cy = s / 2
    lw = max(2, int(s * 0.025)) # Dicke schwarze Konturlinien
    
    # Farbpalette aus der Vorlage
    c_skin = (255, 204, 203, 255)
    c_hair = (150, 111, 214, 255)
    c_shirt = (195, 240, 248, 255)
    c_bubble = (248, 92, 135, 255)
    c_line = (15, 15, 15, 255)
    
    # 1. T-Shirt (Körper)
    shirt_poly = [
        (cx - 0.4*s, s), 
        (cx - 0.35*s, cy + 0.15*s), 
        (cx + 0.25*s, cy + 0.15*s), 
        (cx + 0.3*s, s)
    ]
    draw.polygon(shirt_poly, fill=c_shirt, outline=c_line, width=lw)
    
    # 2. Hals
    draw.rectangle([cx - 0.08*s, cy + 0.05*s, cx + 0.08*s, cy + 0.2*s], fill=c_skin, outline=c_line, width=lw)
    
    # 3. Kragen (Zwei Dreiecke)
    draw.polygon([(cx, cy + 0.18*s), (cx - 0.15*s, cy + 0.15*s), (cx, cy + 0.25*s)], fill=(255,255,255,255), outline=c_line, width=lw)
    draw.polygon([(cx, cy + 0.18*s), (cx + 0.15*s, cy + 0.15*s), (cx, cy + 0.25*s)], fill=(255,255,255,255), outline=c_line, width=lw)
    draw.line([(cx, cy + 0.25*s), (cx, cy + 0.35*s)], fill=c_line, width=lw)
    
    # 4. Ohren
    draw.ellipse([cx - 0.23*s, cy - 0.1*s, cx - 0.13*s, cy + 0.02*s], fill=c_skin, outline=c_line, width=lw)
    draw.ellipse([cx + 0.13*s, cy - 0.1*s, cx + 0.23*s, cy + 0.02*s], fill=c_skin, outline=c_line, width=lw)
    
    # 5. Kopf
    draw.ellipse([cx - 0.18*s, cy - 0.25*s, cx + 0.18*s, cy + 0.12*s], fill=c_skin, outline=c_line, width=lw)
    
    # 6. Haare (Komplexe überlappende Polygone/Bögen)
    draw.chord([cx - 0.22*s, cy - 0.35*s, cx + 0.05*s, cy - 0.05*s], 150, 360, fill=c_hair, outline=c_line, width=lw)
    draw.chord([cx - 0.05*s, cy - 0.3*s, cx + 0.2*s, cy - 0.05*s], 180, 360, fill=c_hair, outline=c_line, width=lw)
    
    # 7. Sprechblase (Rechts oben)
    bx1, by1 = cx + 0.12*s, cy - 0.35*s
    bx2, by2 = cx + 0.42*s, cy - 0.12*s
    
    # Sprechblasen-Schwanz
    draw.polygon([(bx1 + 0.02*s, by2 - 0.05*s), (bx1 - 0.05*s, by2 + 0.08*s), (bx1 + 0.1*s, by2 - 0.02*s)], fill=c_bubble, outline=c_line, width=lw)
    # Sprechblasen-Kasten (Abgerundet)
    draw.rounded_rectangle([bx1, by1, bx2, by2], radius=int(s*0.03), fill=c_bubble, outline=c_line, width=lw)
    
    # 8. Text "DE" in der Sprechblase
    try:
        font = ImageFont.truetype("arialbd.ttf", int(s * 0.12))
    except IOError:
        font = ImageFont.load_default()
        
    label = "DE"
    try:
        bbox = draw.textbbox((0, 0), label, font=font)
        text_w = bbox[2] - bbox[0]
        text_h = bbox[3] - bbox[1]
    except AttributeError:
        text_w, text_h = draw.textsize(label, font=font)
        
    tx = bx1 + (bx2 - bx1 - text_w) / 2
    ty = by1 + (by2 - by1 - text_h) / 2 - int(s * 0.015)
    
    draw.text((tx, ty), label, fill=c_line, font=font)
    
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
        print(f"Icons gespeichert: {file_path}")
