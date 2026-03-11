#!/usr/bin/env python3
"""Generate CLCTerm app icon — modern terminal-themed logo.

Design: Dark rounded rectangle with a stylized ">_" terminal prompt
in a blue-to-purple gradient. Clean, minimal, developer-focused.
"""

from PIL import Image, ImageDraw, ImageFont
import os
import subprocess
import math

ICON_DIR = os.path.join(os.path.dirname(__file__), "..", "src-tauri", "icons")
MASTER_SIZE = 1024


def create_rounded_rect_mask(size, radius):
    """Create a mask with rounded corners."""
    mask = Image.new("L", (size, size), 0)
    draw = ImageDraw.Draw(mask)
    draw.rounded_rectangle([0, 0, size - 1, size - 1], radius=radius, fill=255)
    return mask


def lerp_color(c1, c2, t):
    """Linear interpolation between two RGB colors."""
    return tuple(int(c1[i] + (c2[i] - c1[i]) * t) for i in range(3))


def create_gradient(size, color_top, color_bottom):
    """Create a vertical gradient image."""
    img = Image.new("RGB", (size, size))
    pixels = img.load()
    for y in range(size):
        t = y / (size - 1)
        color = lerp_color(color_top, color_bottom, t)
        for x in range(size):
            pixels[x, y] = color
    return img


def draw_terminal_prompt(draw, size):
    """Draw a stylized '>_' terminal prompt."""
    # Scale factors
    s = size / 1024

    # Colors
    prompt_color = (255, 255, 255)  # White
    cursor_color = (139, 92, 246)   # Purple accent for cursor

    # Draw '>' character — two diagonal lines forming a chevron
    chevron_x = int(240 * s)
    chevron_y_center = int(480 * s)
    chevron_len = int(140 * s)
    line_width = int(56 * s)

    # Top line of > (going down-right)
    points_top = [
        (chevron_x, chevron_y_center - chevron_len),
        (chevron_x + chevron_len, chevron_y_center),
    ]
    draw.line(points_top, fill=prompt_color, width=line_width)

    # Bottom line of > (going up-right)
    points_bottom = [
        (chevron_x, chevron_y_center + chevron_len),
        (chevron_x + chevron_len, chevron_y_center),
    ]
    draw.line(points_bottom, fill=prompt_color, width=line_width)

    # Round the line caps by drawing circles at endpoints
    cap_r = line_width // 2
    for pt in [points_top[0], points_top[1], points_bottom[0]]:
        draw.ellipse(
            [pt[0] - cap_r, pt[1] - cap_r, pt[0] + cap_r, pt[1] + cap_r],
            fill=prompt_color,
        )

    # Draw '_' underscore — a horizontal line
    underscore_x = int(440 * s)
    underscore_y = int(580 * s)
    underscore_width = int(180 * s)
    underscore_thickness = int(56 * s)

    draw.rounded_rectangle(
        [underscore_x, underscore_y, underscore_x + underscore_width, underscore_y + underscore_thickness],
        radius=int(12 * s),
        fill=prompt_color,
    )

    # Draw blinking cursor — a thin tall rectangle with purple glow
    cursor_x = int(680 * s)
    cursor_top = int(340 * s)
    cursor_bottom = int(636 * s)
    cursor_width = int(40 * s)

    # Glow effect (soft purple behind cursor)
    glow_expand = int(16 * s)
    for i in range(6, 0, -1):
        alpha_color = lerp_color(cursor_color, (30, 27, 75), 1 - i / 6)
        draw.rounded_rectangle(
            [
                cursor_x - glow_expand * i // 3,
                cursor_top - glow_expand * i // 3,
                cursor_x + cursor_width + glow_expand * i // 3,
                cursor_bottom + glow_expand * i // 3,
            ],
            radius=int(8 * s),
            fill=alpha_color,
        )

    # Actual cursor
    draw.rounded_rectangle(
        [cursor_x, cursor_top, cursor_x + cursor_width, cursor_bottom],
        radius=int(8 * s),
        fill=cursor_color,
    )


def create_icon():
    """Create the master 1024x1024 icon with transparent padding.

    The logo is drawn at 80% of canvas size and centered, so it looks
    proportional to other app icons in the macOS dock/taskbar.
    """
    size = MASTER_SIZE
    # Logo occupies 80% of canvas — 10% transparent padding on each side
    logo_scale = 0.80
    logo_size = int(size * logo_scale)
    offset = (size - logo_size) // 2

    # Background gradient: deep navy to dark purple
    bg_top = (15, 23, 42)      # slate-900
    bg_bottom = (30, 27, 75)   # dark indigo

    # Create gradient at logo size (not full canvas)
    bg = create_gradient(logo_size, bg_top, bg_bottom)

    # Add a subtle radial glow in the center
    from PIL import ImageChops
    glow = Image.new("RGB", (logo_size, logo_size), (0, 0, 0))
    glow_draw = ImageDraw.Draw(glow)
    center = logo_size // 2
    max_radius = int(logo_size * 0.5)
    for r in range(max_radius, 0, -2):
        t = r / max_radius
        intensity = int(25 * (1 - t * t))
        color = (intensity // 2, intensity // 3, intensity)
        glow_draw.ellipse(
            [center - r, center - r, center + r, center + r],
            fill=color,
        )
    bg = ImageChops.add(bg, glow)

    # Draw terminal prompt (scaled to logo_size)
    draw = ImageDraw.Draw(bg)
    draw_terminal_prompt(draw, logo_size)

    # Apply rounded corners to logo
    corner_radius = int(logo_size * 0.22)
    mask = create_rounded_rect_mask(logo_size, corner_radius)

    # Place logo centered on transparent canvas
    final = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    logo_rgba = Image.new("RGBA", (logo_size, logo_size), (0, 0, 0, 0))
    logo_rgba.paste(bg, mask=mask)
    final.paste(logo_rgba, (offset, offset))

    return final


def generate_all_icons(master):
    """Generate all required icon sizes from master image."""
    sizes = {
        "icon.png": 512,
        "32x32.png": 32,
        "128x128.png": 128,
        "128x128@2x.png": 256,
        "Square30x30Logo.png": 30,
        "Square44x44Logo.png": 44,
        "Square71x71Logo.png": 71,
        "Square89x89Logo.png": 89,
        "Square107x107Logo.png": 107,
        "Square142x142Logo.png": 142,
        "Square150x150Logo.png": 150,
        "Square284x284Logo.png": 284,
        "Square310x310Logo.png": 310,
        "StoreLogo.png": 50,
    }

    for filename, size in sizes.items():
        resized = master.resize((size, size), Image.Resampling.LANCZOS)
        filepath = os.path.join(ICON_DIR, filename)
        resized.save(filepath, "PNG")
        print(f"  ✓ {filename} ({size}x{size})")

    # Generate .ico (Windows) — multiple sizes embedded
    ico_sizes = [16, 24, 32, 48, 64, 128, 256]
    ico_images = [master.resize((s, s), Image.Resampling.LANCZOS) for s in ico_sizes]
    ico_path = os.path.join(ICON_DIR, "icon.ico")
    ico_images[0].save(ico_path, format="ICO", sizes=[(s, s) for s in ico_sizes], append_images=ico_images[1:])
    print(f"  ✓ icon.ico (multi-size)")

    # Generate .icns (macOS) using iconutil
    generate_icns(master)


def generate_icns(master):
    """Generate .icns using macOS iconutil."""
    import tempfile
    iconset_dir = os.path.join(tempfile.mkdtemp(), "icon.iconset")
    os.makedirs(iconset_dir)

    icns_sizes = [
        ("icon_16x16.png", 16),
        ("icon_16x16@2x.png", 32),
        ("icon_32x32.png", 32),
        ("icon_32x32@2x.png", 64),
        ("icon_128x128.png", 128),
        ("icon_128x128@2x.png", 256),
        ("icon_256x256.png", 256),
        ("icon_256x256@2x.png", 512),
        ("icon_512x512.png", 512),
        ("icon_512x512@2x.png", 1024),
    ]

    for name, size in icns_sizes:
        resized = master.resize((size, size), Image.Resampling.LANCZOS)
        resized.save(os.path.join(iconset_dir, name), "PNG")

    icns_path = os.path.join(ICON_DIR, "icon.icns")
    result = subprocess.run(
        ["iconutil", "-c", "icns", iconset_dir, "-o", icns_path],
        capture_output=True, text=True
    )
    if result.returncode == 0:
        print(f"  ✓ icon.icns (macOS)")
    else:
        print(f"  ✗ icon.icns failed: {result.stderr}")

    # Cleanup
    import shutil
    shutil.rmtree(os.path.dirname(iconset_dir))


if __name__ == "__main__":
    print("Generating CLCTerm icons...")
    master = create_icon()

    # Save master for preview
    master_path = os.path.join(ICON_DIR, "master-1024.png")
    master.save(master_path, "PNG")
    print(f"  ✓ master-1024.png (1024x1024)")

    generate_all_icons(master)
    print("\nDone! All icons generated.")
