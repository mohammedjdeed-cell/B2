import os
from PIL import Image, ImageDraw, ImageFont

def draw_artwork(canvas_size, colors, line_weight, is_maskable):
    """
    Renders the improved B2 Trainer artwork from scratch with clean, 
    modern graphics and text.
    """
    # Create high-res canvas (always use RGBA for transparency)
    img = Image.new("RGBA", (canvas_size, canvas_size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    
    # 1. Define safe zone (for maskable icons)
    # Maskable icons must have core content within the inner 80% circle.
    margin = int(canvas_size * 0.1) if is_maskable else 0
    safe_zone = [margin, margin, canvas_size - margin, canvas_size - margin]
    
    # Pre-calculate main coordinates
    cx = canvas_size / 2
    cy = canvas_size / 2
    
    # Determine safe drawing radius
    if is_maskable:
        # Use slightly less radius to ensure clearance
        safe_radius = (canvas_size * 0.7) / 2
    else:
        # Full circular icon looks better centered
        safe_radius = (canvas_size * 0.9) / 2
        # Center circle back-plate for non-maskable (makes it look cleaner on home screens)
        backplate_margin = (canvas_size * 0.05)
        draw.ellipse([backplate_margin, backplate_margin, canvas_size-backplate_margin, canvas_size-backplate_margin], fill=(255,255,255,255), outline=colors['line'], width=int(line_weight/2))

    # --- Draw the Avatar (simplified, modern vector style) ---
    # Colors defined below: skin, hair, shirt, bubble, line
    
    # Body/Shirt (A modern V-neck)
    v_neck_depth = 120
    shirt_poly = [
        (cx - safe_radius * 0.8, canvas_size), # Bottom left
        (cx - safe_radius * 0.7, cy + 200),     # Top left shoulder
        (cx, cy + 200 + v_neck_depth),           # V-neck point
        (cx + safe_radius * 0.7, cy + 200),     # Top right shoulder
        (cx + safe_radius * 0.8, canvas_size)  # Bottom right
    ]
    draw.polygon(shirt_poly, fill=colors['shirt'], outline=colors['line'], width=line_weight)
    
    # White V-neck inlay
    v_neck_inlay = [
        (cx, cy + 200 + v_neck_depth * 0.9),  # Bottom center
        (cx - safe_radius * 0.15, cy + 200),  # Top left
        (cx + safe_radius * 0.15, cy + 200)   # Top right
    ]
    draw.polygon(v_neck_inlay, fill=(255, 255, 255, 255), outline=colors['line'], width=int(line_weight/1.5))

    # Neck
    neck_box = [cx - 60, cy + 80, cx + 60, cy + 220]
    draw.rectangle(neck_box, fill=colors['skin'], outline=colors['line'], width=line_weight)

    # Face/Head
    face_box = [cx - 150, cy - 200, cx + 150, cy + 100]
    draw.ellipse(face_box, fill=colors['skin'], outline=colors['line'], width=line_weight)
    
    # Ears
    ear_size = 40
    draw.ellipse([cx - 150 - ear_size/2, cy - ear_size/2, cx - 150 + ear_size/2, cy + ear_size/2], fill=colors['skin'], outline=colors['line'], width=line_weight)
    draw.ellipse([cx + 150 - ear_size/2, cy - ear_size/2, cx + 150 + ear_size/2, cy + ear_size/2], fill=colors['skin'], outline=colors['line'], width=line_weight)

    # Hair (Simplified modern cut)
    hair_box = [cx - 180, cy - 250, cx + 180, cy - 50]
    draw.chord(hair_box, 180, 360, fill=colors['hair'], outline=colors['line'], width=line_weight) # Top part
    draw.ellipse([cx - 180, cy - 180, cx - 120, cy - 80], fill=colors['hair']) # Left temple curl
    draw.ellipse([cx + 120, cy - 180, cx + 180, cy - 80], fill=colors['hair']) # Right temple curl
    draw.line([(cx - 150, cy - 150), (cx + 150, cy - 150)], fill=colors['hair'], width=line_weight) # Connect

    # --- Draw the Speech Bubble (Padded for maskable) ---
    bubble_center_x = cx + safe_radius * 0.6  # Position it in the upper right
    bubble_center_y = cy - safe_radius * 0.6
    bubble_w = canvas_size * 0.3
    bubble_h = canvas_size * 0.2
    
    # Calculate corner radius dynamically
    radius_val = int(bubble_h / 4)
    
    # Make bubble slightly transparent for modern effect
    bubble_color_trans = colors['bubble'][:3] + (220,) # Adds transparency

    # The actual bubble with tail (a rounded polygon)
    bubble_poly = [
        (bubble_center_x - bubble_w / 2, bubble_center_y + bubble_h / 2), # Bottom left
        (bubble_center_x - bubble_w / 2, bubble_center_y - bubble_h / 2), # Top left
        (bubble_center_x + bubble_w / 2, bubble_center_y - bubble_h / 2), # Top right
        (bubble_center_x + bubble_w / 2, bubble_center_y + bubble_h / 2), # Bottom right
        (bubble_center_x + bubble_w * 0.1, bubble_center_y + bubble_h / 2), # Tail connection (top)
        (bubble_center_x - bubble_w * 0.2, bubble_center_y + bubble_h * 0.75), # Tail tip
        (bubble_center_x - bubble_w * 0.1, bubble_center_y + bubble_h / 2), # Tail connection (bottom)
    ]
    # Rounded corners implementation requires drawing the path
    # Simplified approach: draw the rounded rectangle, then paste the tail.
    
    # Corrected modern rounded rectangle + tail composition
    bubble_rrect = [
        bubble_center_x - bubble_w/2, 
        bubble_center_y - bubble_h/2, 
        bubble_center_x + bubble_w/2, 
        bubble_center_y + bubble_h/2
    ]
    draw.rounded_rectangle(bubble_rrect, radius=radius_val, fill=bubble_color_trans, outline=colors['line'], width=line_weight)
    
    # The tail
    bubble_tail = [
        (bubble_center_x + bubble_w * 0.1, bubble_center_y + bubble_h / 2 + line_weight/2), # Start top (past edge)
        (bubble_center_x - bubble_w * 0.2, bubble_center_y + bubble_h * 0.75),             # Tip
        (bubble_center_x - bubble_w * 0.1, bubble_center_y + bubble_h / 2 + line_weight/2)  # End bottom (past edge)
    ]
    draw.polygon(bubble_tail, fill=bubble_color_trans, outline=colors['line'], width=line_weight)
    # Correcting connection: erase the line where tail meets rectangle
    draw.line([(bubble_center_x - bubble_w*0.1, bubble_center_y + bubble_h/2 + line_weight), 
              (bubble_center_x + bubble_w*0.1, bubble_center_y + bubble_h/2 + line_weight)], fill=bubble_color_trans, width=line_weight*2)

    # --- Draw the Text "DE" (Bold, crisp) ---
    # Modern font stack with reliable cross-platform fallbacks
    font_files = [
        "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf", # Debian/Ubuntu
        "Arial Bold",
        "Helvetica-Bold",
        "DejaVuSans-Bold"
    ]
    
    font = None
    # Use a large size for high-res drawing
    font_size = int(canvas_size * 0.11)
    
    for f_path in font_files:
        try:
            # First try direct path, then try generic font name
            font = ImageFont.truetype(f_path, font_size)
            print(f"Loaded font: {f_path}")
            break
        except OSError:
            try:
                # Try generic font lookup
                font = ImageFont.truetype(f_path, font_size)
                print(f"Loaded font (generic): {f_path}")
                break
            except OSError:
                continue

    if not font:
        print("Warning: Could not find a bold sans-serif font. Falling back to default. Text will be lower quality.")
        font = ImageFont.load_default()

    label = "DE"
    # Measure text to center it perfectly
    try:
        # Modern pillow text measurement
        bbox = draw.textbbox((0, 0), label, font=font)
        text_w = bbox[2] - bbox[0]
        text_h = bbox[3] - bbox[1]
    except AttributeError:
        # Fallback for old pillow versions
        text_w, text_h = draw.textsize(label, font=font)

    # Center text within the bubble (ignoring the tail)
    tx = bubble_center_x - text_w / 2
    # Adjust y-offset slightly upward so it feels centered visually with descenders
    ty = bubble_center_y - text_h / 2 - (canvas_size * 0.005) 
    
    draw.text((tx, ty), label, fill=colors['text'], font=font)

    return img

if __name__ == "__main__":
    # --- Project Configuration ---
    # Set this to where your images will live. The path must exist.
    output_dir = "icons_improved"
    os.makedirs(output_dir, exist_ok=True)
    
    # Modern Vector-inspired Palette (clean, anti-aliased look)
    COLORS = {
        'skin':  (255, 204, 203, 255),  # Soft Peach Skin
        'hair':  (150, 111, 214, 255),  # Modern Violet
        'shirt': (195, 240, 248, 255),  # Light Cyan
        'bubble':(248,  92, 135, 255),  # Pink
        'text':  (255, 255, 255, 255),  # Pure White
        'line':  (15, 15, 15, 255)      # Near Black for clean edges
    }

    # Configuration for standard PWA icons
    # 'maskable=True' means we add margin and force a solid background.
    ICON_CONFIGS = [
        {"name": "icon-192.png", "size": 192, "maskable": False},
        {"name": "icon-512.png", "size": 512, "maskable": False},
        {"name": "icon-192-maskable.png", "size": 192, "maskable": True},
        {"name": "icon-512-maskable.png", "size": 512, "maskable": True},
    ]

    # --- Execution Loop ---
    # 1. Create a huge high-res master image (2000x2000) for drawing.
    # We use huge line weights here (60px) so they are proportional.
    drawing_canvas_size = 2000
    drawing_line_weight = 60
    
    print(f"--- Generating Improved PWA Icons (Output: {output_dir}) ---")

    # Generate transparent high-res master
    master_transparent = draw_artwork(drawing_canvas_size, COLORS, drawing_line_weight, is_maskable=False)
    # Generate high-res master that is pre-padded/safe for maskable
    master_maskable = draw_artwork(drawing_canvas_size, COLORS, drawing_line_weight, is_maskable=True)

    for icon in ICON_CONFIGS:
        target_path = os.path.join(output_dir, icon["name"])
        target_size = icon["size"]
        
        # PWA Spec: Maskable icons must have solid background
        if icon["maskable"]:
            # Create a solid canvas and paste the maskable-ready high-res onto it
            canvas = Image.new("RGB", (drawing_canvas_size, drawing_canvas_size), (255, 255, 255))
            canvas.paste(master_maskable, (0,0), master_maskable)
            
            # Use high-quality Lanczos resampling for resizing
            final_img = canvas.resize((target_size, target_size), Image.Resampling.LANCZOS)
        else:
            # Just resize the transparent high-res master
            final_img = master_transparent.resize((target_size, target_size), Image.Resampling.LANCZOS)

        # Save explicitly as PNG
        final_img.save(target_path, "PNG")
        print(f"Saved: {target_path} ({target_size}x{target_size})")

    print(f"--- Complete. Icons are now available in '{output_dir}' ---")
