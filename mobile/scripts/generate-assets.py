"""Generate app icon, adaptive icon, splash icon, notification icon & Islamic geometric pattern.

Run: python3 scripts/generate-assets.py  (from /app/mobile). Requires Pillow.
"""
import math
import os

from PIL import Image, ImageDraw

GREEN = (0, 104, 55)       # #006837
ACCENT = (11, 122, 59)     # #0B7A3B
GOLD = (255, 193, 7)       # #FFC107
WHITE = (255, 255, 255)
OUT = os.path.join(os.path.dirname(__file__), '..', 'assets', 'images')
os.makedirs(OUT, exist_ok=True)


def star_polygon(cx, cy, r_out, r_in, points=8, rot=0.0):
    pts = []
    for i in range(points * 2):
        r = r_out if i % 2 == 0 else r_in
        a = rot + i * math.pi / points
        pts.append((cx + r * math.cos(a), cy + r * math.sin(a)))
    return pts


def draw_logo(draw, cx, cy, size, fg=WHITE, accent=GOLD):
    """Logo: 8-point star (motif Islam) dengan buku terbuka di tengah."""
    r = size * 0.42
    draw.polygon(star_polygon(cx, cy, r, r * 0.72, 8, math.pi / 8), outline=fg, width=max(3, int(size * 0.035)))
    # Buku terbuka
    bw, bh = size * 0.36, size * 0.24
    top = cy - bh * 0.35
    left_page = [(cx - bw / 2, top), (cx - size * 0.02, top + bh * 0.12), (cx - size * 0.02, top + bh), (cx - bw / 2, top + bh * 0.88)]
    right_page = [(cx + bw / 2, top), (cx + size * 0.02, top + bh * 0.12), (cx + size * 0.02, top + bh), (cx + bw / 2, top + bh * 0.88)]
    draw.polygon(left_page, fill=fg)
    draw.polygon(right_page, fill=fg)
    # Pita penanda (aksen emas)
    draw.rectangle([cx - size * 0.012, top + bh * 0.12, cx + size * 0.012, top + bh], fill=accent)
    # Titik bintang kecil di atas buku
    sr = size * 0.045
    draw.polygon(star_polygon(cx, top - size * 0.09, sr, sr * 0.45, 4, 0), fill=accent)


def icon(size, bg=GREEN, rounded=True, padding=0.0):
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    if rounded:
        d.rounded_rectangle([0, 0, size - 1, size - 1], radius=int(size * 0.22), fill=bg)
    else:
        d.rectangle([0, 0, size, size], fill=bg)
    draw_logo(d, size / 2, size / 2, size * (1 - padding))
    return img


def pattern(w, h, cell=120, dark=False):
    """Pola geometris Islam (bintang 8 + persegi berputar) nada hijau."""
    base = (8, 54, 32) if dark else GREEN
    line = (36, 140, 84, 110) if dark else (255, 255, 255, 46)
    img = Image.new('RGBA', (w, h), base + (255,))
    layer = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    r = cell * 0.46
    for y in range(-cell, h + cell, cell):
        for x in range(-cell, w + cell, cell):
            cx, cy = x + cell / 2, y + cell / 2
            d.polygon(star_polygon(cx, cy, r, r * 0.68, 8, math.pi / 8), outline=line, width=2)
            d.polygon(star_polygon(cx, cy, r * 0.5, r * 0.5, 4, math.pi / 4), outline=line, width=2)
            # Oktagon kecil di persimpangan sel
            d.regular_polygon((x, y, cell * 0.18), 8, rotation=22.5, outline=line, width=2)
    img.alpha_composite(layer)
    return img


if __name__ == '__main__':
    icon(1024).save(os.path.join(OUT, 'icon.png'))
    # Adaptive icon: foreground transparan dengan logo (safe zone 66%)
    fg = Image.new('RGBA', (1024, 1024), (0, 0, 0, 0))
    draw_logo(ImageDraw.Draw(fg), 512, 512, 1024 * 0.62)
    fg.save(os.path.join(OUT, 'adaptive-icon.png'))
    # Splash icon (logo putih di atas latar hijau yang diatur app.json)
    sp = Image.new('RGBA', (1024, 1024), (0, 0, 0, 0))
    draw_logo(ImageDraw.Draw(sp), 512, 512, 1024 * 0.7)
    sp.save(os.path.join(OUT, 'splash-icon.png'))
    # Notification icon: putih siluet transparan (Android butuh monokrom)
    ni = Image.new('RGBA', (96, 96), (0, 0, 0, 0))
    draw_logo(ImageDraw.Draw(ni), 48, 48, 92, fg=WHITE, accent=WHITE)
    ni.save(os.path.join(OUT, 'notification-icon.png'))
    # Favicon web
    icon(64).save(os.path.join(OUT, 'favicon.png'))
    # Pola latar onboarding (portrait) terang & gelap
    pattern(1080, 1920).save(os.path.join(OUT, 'pattern.png'), optimize=True)
    pattern(1080, 1920, dark=True).save(os.path.join(OUT, 'pattern-dark.png'), optimize=True)
    print('assets generated in', OUT)
