#!/usr/bin/env python3
"""Generate Aura app icons at all required sizes."""

from PIL import Image, ImageDraw, ImageFilter, ImageChops
import subprocess, os, tempfile, shutil

SIZES = {
    "32x32.png": 32,
    "128x128.png": 128,
    "128x128@2x.png": 256,
    "tray-icon.png": 32,
}

ICONS_DIR = "src-tauri/icons"
BASE = 1024
RADIUS = 224  # rounded rect corner radius

def radial_gradient(size, center, inner_color, outer_color):
    img = Image.new("RGBA", size, (0, 0, 0, 0))
    for y in range(size[1]):
        for x in range(size[0]):
            dx, dy = x - center[0], y - center[1]
            dist = (dx * dx + dy * dy) ** 0.5
            max_dist = max(size[0], size[1])
            t = min(dist / max_dist, 1.0)
            r = int(inner_color[0] + (outer_color[0] - inner_color[0]) * t)
            g = int(inner_color[1] + (outer_color[1] - inner_color[1]) * t)
            b = int(inner_color[2] + (outer_color[2] - inner_color[2]) * t)
            a = int(inner_color[3] + (outer_color[3] - inner_color[3]) * t)
            img.putpixel((x, y), (r, g, b, a))
    return img

def create_base_icon(size):
    """Render the Aura icon at the given size."""
    # Create a clean rounded-square base
    base_color = (13, 13, 20, 255)  # #0d0d14
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(canvas)

    # Background rounded rect
    corner = max(int(RADIUS * size / BASE), 1)
    draw.rounded_rectangle((0, 0, size - 1, size - 1), radius=corner, fill=base_color)

    cx, cy = size // 2, size // 2

    # Helper: create glow circle on its own layer, then blur + composite
    def glow_circle(radius, color, blur_ratio):
        r = int(radius * size / BASE)
        b = int(blur_ratio * size / BASE)
        # Draw filled circle on transparent layer
        layer = Image.new("RGBA", (size, size), (0, 0, 0, 0))
        ld = ImageDraw.Draw(layer)
        ld.ellipse(
            (cx - r, cy - r, cx + r, cy + r),
            fill=color,
        )
        if b > 0:
            layer = layer.filter(ImageFilter.GaussianBlur(b))
        return layer

    # Glow layers (ordered back to front)
    layers = []

    # 1. Outer glow: large soft cyan
    layers.append(glow_circle(440, (6, 182, 212, 25), 120))

    # 2. Mid glow: teal
    layers.append(glow_circle(300, (0, 212, 170, 40), 70))

    # 3. Inner glow: bright teal
    layers.append(glow_circle(180, (6, 182, 212, 55), 40))

    # 4. Core glow: white-teal blend
    layers.append(glow_circle(96, (0, 212, 170, 70), 20))

    # 5. Hot core
    layers.append(glow_circle(48, (0, 220, 180, 90), 8))

    # Composite glow layers
    for layer in layers:
        canvas = Image.alpha_composite(canvas, layer)

    # Reset draw for crisp elements
    draw = ImageDraw.Draw(canvas)

    # Ring 1: outer thin cyan ring
    r1 = int(360 * size / BASE)
    w1 = max(int(1.5 * size / BASE), 1)
    draw.ellipse(
        (cx - r1, cy - r1, cx + r1, cy + r1),
        outline=(6, 182, 212, 90),
        width=w1,
    )

    # Ring 2: inner thinner ring
    r2 = int(280 * size / BASE)
    w2 = max(int(1.0 * size / BASE), 1)
    draw.ellipse(
        (cx - r2, cy - r2, cx + r2, cy + r2),
        outline=(0, 212, 170, 55),
        width=w2,
    )

    # Sparkle dots on the outer ring trajectory (8 dots, alternating sizes)
    dot_radius = int(360 * size / BASE)
    for i in range(8):
        angle = i * 45
        import math
        rad = math.radians(angle)
        dx = math.cos(rad) * dot_radius
        dy = math.sin(rad) * dot_radius
        px, py = cx + dx, cy + dy
        dot_size = 3 if i % 2 == 0 else 2
        ds = max(int(dot_size * size / BASE), 1)
        alpha = 60 if i % 2 == 0 else 40
        draw.ellipse(
            (px - ds, py - ds, px + ds, py + ds),
            fill=(0, 212, 170, alpha),
        )

    return canvas


def generate_png(size):
    img = create_base_icon(size)
    return img


def main():
    os.makedirs(ICONS_DIR, exist_ok=True)

    # Generate PNGs at each required size
    for name, size in SIZES.items():
        print(f"Generating {name} ({size}x{size})...")
        img = generate_png(size)
        path = os.path.join(ICONS_DIR, name)
        img.save(path, "PNG")
        print(f"  Saved {path}")

    # Generate high-res base for ICNS + ICO
    print("Generating 1024x1024 base...")
    img_1024 = generate_png(BASE)

    # ICNS: use iconutil on macOS
    # iconutil expects a .iconset directory with specific naming convention
    iconset_dir = tempfile.mkdtemp(suffix=".iconset")
    icon_sizes = [16, 32, 64, 128, 256, 512, 1024]
    for s in icon_sizes:
        base_name = f"icon_{s}x{s}"
        # Create both 1x and 2x where applicable
        names = [f"{base_name}.png"]
        if s * 2 <= 1024:
            names.append(f"icon_{s}x{s}@2x.png")
        for name in names:
            target_size = int(name.split("_")[1].split("x")[0])
            scale = name.count("@2x")
            actual_size = target_size * (scale + 1)
            if actual_size <= 1024:
                resized = img_1024.resize(
                    (actual_size, actual_size), Image.LANCZOS
                )
                path = os.path.join(iconset_dir, name)
                resized.save(path, "PNG")

    iconutil_path = shutil.which("iconutil")
    if iconutil_path:
        icns_path = os.path.join(ICONS_DIR, "icon.icns")
        print("Generating icon.icns...")
        subprocess.run(
            ["iconutil", "-c", "icns", iconset_dir, "-o", icns_path],
            check=True,
        )
        print(f"  Saved {icns_path}")
    else:
        print("  iconutil not found, skipping ICNS generation")

    shutil.rmtree(iconset_dir)

    # ICO: use sizes parameter for multi-res icon
    print("Generating icon.ico...")
    ico_sizes = [16, 24, 32, 48, 64, 128, 256]
    ico_path = os.path.join(ICONS_DIR, "icon.ico")
    img_1024.save(
        ico_path,
        format="ICO",
        sizes=[(s, s) for s in ico_sizes],
    )
    print(f"  Saved {ico_path}")

    print("\nAll icons generated successfully!")


if __name__ == "__main__":
    main()
