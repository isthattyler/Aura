#!/usr/bin/env python3
"""Generate Aura app icons — laptop + broomstick, dark rounded-square + teal glow."""

from PIL import Image, ImageDraw, ImageFilter
import subprocess, os, tempfile, shutil, math

SIZES = {
    "32x32.png": 32,
    "128x128.png": 128,
    "128x128@2x.png": 256,
    "tray-icon.png": 32,
}

ICONS_DIR = "src-tauri/icons"
PUBLIC_DIR = "public"
BASE = 1024

def create_base_icon(size):
    s = size / BASE
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    cx, cy = size // 2, size // 2

    # ── Background rounded rect ──
    draw = ImageDraw.Draw(canvas)
    corner = max(int(224 * s), 1)
    draw.rounded_rectangle((0, 0, size - 1, size - 1), radius=corner, fill=(13, 13, 20, 255))

    # ── Teal glow layers ──
    def glow_circle(radius, color, blur_ratio):
        r = int(radius * s)
        b = int(blur_ratio * s)
        layer = Image.new("RGBA", (size, size), (0, 0, 0, 0))
        ld = ImageDraw.Draw(layer)
        ld.ellipse((cx - r, cy - r, cx + r, cy + r), fill=color)
        if b > 0:
            layer = layer.filter(ImageFilter.GaussianBlur(b))
        return layer

    glow_specs = [
        (440, (6, 182, 212, 18), 120),
        (300, (0, 212, 170, 35), 70),
        (180, (6, 182, 212, 50), 40),
        (96,  (0, 212, 170, 65), 20),
        (48,  (0, 220, 180, 85), 8),
    ]
    for r, col, bl in glow_specs:
        layer = glow_circle(r, col, bl)
        canvas = Image.alpha_composite(canvas, layer)

    draw = ImageDraw.Draw(canvas)

    # ── Outer accent rings ──
    r1 = int(360 * s)
    w1 = max(int(1.5 * s), 1)
    draw.ellipse((cx - r1, cy - r1, cx + r1, cy + r1),
                 outline=(6, 182, 212, 70), width=w1)
    r2 = int(280 * s)
    w2 = max(int(1.0 * s), 1)
    draw.ellipse((cx - r2, cy - r2, cx + r2, cy + r2),
                 outline=(0, 212, 170, 45), width=w2)

    # ═══════════════════════════════════════
    #  BROOMSTICK  (drawn behind laptop)
    # ═══════════════════════════════════════

    # Handle diagonal: lower-left → upper-right
    hx1, hy1 = int(160 * s), int(750 * s)
    hx2, hy2 = int(600 * s), int(220 * s)

    hdx = hx2 - hx1
    hdy = hy2 - hy1
    hlen = math.sqrt(hdx * hdx + hdy * hdy)
    udx, udy = hdx / hlen, hdy / hlen       # unit direction
    pdx, pdy = -udy, udx                     # perpendicular (+90°)

    hw = max(int(18 * s), 2)

    # Handle drop shadow
    shx1 = hx1 + int(pdx * 4 * s)
    shy1 = hy1 + int(pdy * 4 * s)
    shx2 = hx2 + int(pdx * 4 * s)
    shy2 = hy2 + int(pdy * 4 * s)
    draw.line([(shx1, shy1), (shx2, shy2)], fill=(0, 0, 0, 60), width=hw)

    # Handle main body
    draw.line([(hx1, hy1), (hx2, hy2)], fill=(155, 120, 85, 240), width=hw)

    # Handle highlight (wood grain)
    hlw = max(int(5 * s), 1)
    hlx1 = hx1 + int(pdx * 5 * s)
    hly1 = hy1 + int(pdy * 5 * s)
    hlx2 = hx2 + int(pdx * 5 * s)
    hly2 = hy2 + int(pdy * 5 * s)
    draw.line([(hlx1, hly1), (hlx2, hly2)], fill=(200, 170, 135, 140), width=hlw)

    # Binding ring at bristle end
    ring_hw = max(int(30 * s), 1)
    ring_cx = hx2 - int(udx * 14 * s)
    ring_cy = hy2 - int(udy * 14 * s)
    ring_w = max(int(8 * s), 1)
    draw.line([
        (ring_cx + int(pdx * ring_hw), ring_cy + int(pdy * ring_hw)),
        (ring_cx - int(pdx * ring_hw), ring_cy - int(pdy * ring_hw)),
    ], fill=(90, 70, 50, 240), width=ring_w)

    # Bristle fan polygon
    bristle_spec = [
        (28, -55), (50, -60), (72, -45), (95, -15),  # left → tip
        (105, 0),                                        # centre tip
        (95, 15), (72, 45), (50, 60), (28, 55),        # right → base
    ]
    bp = []
    for fwd, spr in bristle_spec:
        px = hx2 + int((fwd * udx + spr * pdx) * s)
        py = hy2 + int((fwd * udy + spr * pdy) * s)
        bp.append((px, py))

    draw.polygon(bp, fill=(225, 218, 205, 235))
    bol = max(int(1 * s), 1)
    draw.polygon(bp, outline=(195, 185, 170, 120), width=bol)

    # Individual bristle strokes
    for i in range(9):
        angle_off = (i / 8.0 - 0.5) * 0.85
        cos_a = math.cos(angle_off)
        sin_a = math.sin(angle_off)
        bdx = udx * cos_a - pdx * sin_a
        bdy = udy * cos_a - pdy * sin_a
        blen = 65 + (i % 3) * 18
        sx = hx2 + int(10 * bdx * s)
        sy = hy2 + int(10 * bdy * s)
        ex = hx2 + int(blen * bdx * s)
        ey = hy2 + int(blen * bdy * s)
        alpha = 170 + (i % 2) * 30
        lw = max(int(2 * s), 1)
        draw.line([(sx, sy), (ex, ey)], fill=(240, 234, 225, alpha), width=lw)

    # Sweep motion lines (teal arcs near bristle tips)
    for i in range(3):
        arc_cx = hx2 + int((110 + i * 30) * udx * s)
        arc_cy = hy2 + int((110 + i * 30) * udy * s)
        arc_r = max(int((28 - i * 5) * s), 1)
        asw = max(int(2 * s), 1)
        draw.arc([
            arc_cx - arc_r, arc_cy - arc_r,
            arc_cx + arc_r, arc_cy + arc_r,
        ], start=190, end=270, fill=(0, 212, 170, 70 + i * 10), width=asw)

    # ═══════════════════════════════════════
    #  LAPTOP  (drawn on top)
    # ═══════════════════════════════════════

    sw_px = int(410 * s)
    sh_px = int(275 * s)
    s_left = cx - sw_px // 2
    s_top = int(cy - 125 * s)
    s_radius = max(int(18 * s), 2)

    # Screen drop shadow
    so = max(int(5 * s), 1)
    draw.rounded_rectangle(
        (s_left + so, s_top + so, s_left + sw_px + so, s_top + sh_px + so),
        radius=s_radius, fill=(0, 0, 0, 80))

    # Screen fill
    draw.rounded_rectangle(
        (s_left, s_top, s_left + sw_px, s_top + sh_px),
        radius=s_radius, fill=(20, 20, 38, 255))

    # Screen teal border
    border_w = max(int(3 * s), 1)
    draw.rounded_rectangle(
        (s_left, s_top, s_left + sw_px, s_top + sh_px),
        radius=s_radius, outline=(0, 212, 170, 75), width=border_w)

    # Screen inner glow patches (display sheen)
    glow_r = max(int(12 * s), 2)
    draw.rounded_rectangle(
        (s_left + int(30 * s), s_top + int(18 * s),
         s_left + int(230 * s), s_top + int(160 * s)),
        radius=glow_r, fill=(0, 212, 170, 18))
    draw.rounded_rectangle(
        (s_left + int(260 * s), s_top + int(180 * s),
         s_left + sw_px - int(15 * s), s_top + sh_px - int(15 * s)),
        radius=glow_r, fill=(0, 212, 170, 10))

    # Camera notch at screen top-centre
    notch_w = max(int(62 * s), 2)
    notch_r = max(int(4 * s), 1)
    draw.rounded_rectangle(
        (cx - notch_w // 2, s_top - int(7 * s),
         cx + notch_w // 2, s_top + int(5 * s)),
        radius=notch_r, fill=(35, 35, 55, 255),
        outline=(0, 212, 170, 50), width=max(int(1 * s), 1))

    # Camera lens dot
    cam_d = max(int(2 * s), 1)
    draw.ellipse(
        (cx - cam_d, s_top - int(3 * s), cx + cam_d, s_top + int(2 * s)),
        fill=(0, 212, 170, 180))

    # ── Keyboard deck ──
    bw_px = int(450 * s)
    bh_px = int(42 * s)
    b_left = cx - bw_px // 2
    b_top = s_top + sh_px + int(14 * s)
    b_radius = max(int(9 * s), 2)

    # Deck shadow
    draw.rounded_rectangle(
        (b_left + so, b_top + int(4 * s),
         b_left + bw_px + so, b_top + bh_px + int(4 * s)),
        radius=b_radius, fill=(0, 0, 0, 100))

    # Deck fill
    draw.rounded_rectangle(
        (b_left, b_top, b_left + bw_px, b_top + bh_px),
        radius=b_radius, fill=(16, 16, 30, 255))

    # Deck outline
    b_ol = max(int(2 * s), 1)
    draw.rounded_rectangle(
        (b_left, b_top, b_left + bw_px, b_top + bh_px),
        radius=b_radius, outline=(0, 212, 170, 35), width=b_ol)

    # Keyboard key row hints
    kw = max(int(1 * s), 1)
    for r_idx in range(6):
        ly = b_top + int(7 * s) + r_idx * int(5 * s)
        draw.line(
            (b_left + int(30 * s), ly,
             b_left + bw_px - int(30 * s), ly),
            fill=(45, 45, 65, 90), width=kw)

    # Trackpad
    tp_w = max(int(110 * s), 8)
    tp_h = max(int(16 * s), 2)
    tp_r = max(int(4 * s), 1)
    draw.rounded_rectangle(
        (cx - tp_w // 2, b_top + bh_px - int(20 * s),
         cx + tp_w // 2, b_top + bh_px - int(4 * s)),
        radius=tp_r, fill=(30, 30, 50, 80))

    # ═══════════════════════════════════════
    #  SPARKLES
    # ═══════════════════════════════════════

    # Ring sparkles (8 dots on outer ring)
    dot_r = int(360 * s)
    for i in range(8):
        angle = i * 45
        rad = math.radians(angle)
        dx = math.cos(rad) * dot_r
        dy = math.sin(rad) * dot_r
        ds = max(int((4 if i % 2 == 0 else 2) * s), 1)
        alpha = 70 if i % 2 == 0 else 40
        draw.ellipse(
            (int(cx + dx - ds), int(cy + dy - ds),
             int(cx + dx + ds), int(cy + dy + ds)),
            fill=(0, 212, 170, alpha))

    # Free-floating star sparkles
    star_positions = [
        (680, 180, 5, 90),
        (760, 260, 3, 55),
        (100, 680, 3, 55),
        (660, 560, 2, 40),
        (340, 760, 4, 70),
    ]
    for sx, sy, sz, sa in star_positions:
        pts = []
        for j in range(8):
            a = j * math.pi / 4
            r = (sz if j % 2 == 0 else sz * 0.4) * s
            pts.append((int(sx * s + r * math.cos(a)),
                        int(sy * s + r * math.sin(a))))
        draw.polygon(pts, fill=(0, 212, 170, sa))

    return canvas


def generate_png(size):
    img = create_base_icon(size)
    return img


def main():
    os.makedirs(ICONS_DIR, exist_ok=True)
    os.makedirs(PUBLIC_DIR, exist_ok=True)

    # Generate PNGs at each required size
    for name, size in SIZES.items():
        print(f"Generating {name} ({size}x{size})...")
        img = generate_png(size)
        path = os.path.join(ICONS_DIR, name)
        img.save(path, "PNG")
        print(f"  Saved {path}")

    # Generate high-res base for ICNS / ICO / public favicon
    print("Generating 1024x1024 base...")
    img_1024 = generate_png(BASE)

    # Save public app icon used by sidebar, onboarding, and favicon
    public_path = os.path.join(PUBLIC_DIR, "app-icon.png")
    img_1024.save(public_path, "PNG")
    print(f"  Saved {public_path}")

    # ── ICNS (macOS) ──
    iconset_dir = tempfile.mkdtemp(suffix=".iconset")
    icon_sizes = [16, 32, 64, 128, 256, 512, 1024]
    for s_ico in icon_sizes:
        base_name = f"icon_{s_ico}x{s_ico}"
        names = [f"{base_name}.png"]
        if s_ico * 2 <= 1024:
            names.append(f"icon_{s_ico}x{s_ico}@2x.png")
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

    # ── ICO (Windows) ──
    print("Generating icon.ico...")
    ico_sizes = [16, 24, 32, 48, 64, 128, 256]
    ico_path = os.path.join(ICONS_DIR, "icon.ico")
    img_1024.save(
        ico_path,
        format="ICO",
        sizes=[(sz, sz) for sz in ico_sizes],
    )
    print(f"  Saved {ico_path}")

    print("\nAll icons generated successfully!")


if __name__ == "__main__":
    main()
