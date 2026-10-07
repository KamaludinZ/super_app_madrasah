"""Membuat motif latar "pendidikan modern" (garis putih tipis, latar transparan).

Ikon: buku terbuka, toga, pensil, bola lampu, atom, tabung lab, laptop, globe, penggaris,
roket, kaca pembesar, kode </>, rumus (π, E=mc², a²+b², ∑, √x, ABC, 123) dan kilau bintang,
disebar acak teratur (jitter grid) dengan rotasi ringan. Opasitas diatur di aplikasi
(komponen EduBackground), sehingga satu gambar bisa dipakai di semua latar hijau.

Hasil: assets/images/edu-pattern.png (1080x2400, RGBA)
Jalankan: python scripts/generate-edu-pattern.py  (butuh Pillow)
"""
import math
import os
import random

from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, '..', 'assets', 'images', 'edu-pattern.png')
W, H = 1080, 2400
SS = 3            # supersampling agar garis halus
CELL = 180        # jarak antar-ikon
STROKE = 3        # tebal garis (px akhir)
WHITE = (255, 255, 255, 255)

FONT_CANDIDATES = [
    os.path.join(HERE, '..', 'assets', 'fonts', 'PlusJakartaSans-Bold.ttf'),
    'C:/Windows/Fonts/arialbd.ttf',
    '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
]
SYMBOL_FONTS = ['C:/Windows/Fonts/arialbd.ttf', 'C:/Windows/Fonts/seguisym.ttf',
                '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf']


def load_font(paths, size):
    for p in paths:
        if os.path.exists(p):
            return ImageFont.truetype(p, size)
    return ImageFont.load_default()


# ---------------------------------------------------------------------------
# Ikon digambar dalam kotak 100x100 (unit), diskalakan ke kanvas s piksel.
# ---------------------------------------------------------------------------
class Pen:
    def __init__(self, size):
        self.s = size
        self.img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
        self.d = ImageDraw.Draw(self.img)
        self.w = max(1, round(STROKE * SS))

    def p(self, x, y):
        return (x * self.s / 100, y * self.s / 100)

    def line(self, *pts, close=False):
        pts = [self.p(*q) for q in pts]
        if close:
            pts.append(pts[0])
        self.d.line(pts, fill=WHITE, width=self.w, joint='curve')
        r = self.w / 2
        for (x, y) in (pts[0], pts[-1]):
            self.d.ellipse([x - r, y - r, x + r, y + r], fill=WHITE)

    def circle(self, cx, cy, r, fill=False):
        (x, y), rr = self.p(cx, cy), r * self.s / 100
        box = [x - rr, y - rr, x + rr, y + rr]
        if fill:
            self.d.ellipse(box, fill=WHITE)
        else:
            self.d.ellipse(box, outline=WHITE, width=self.w)

    def arc(self, cx, cy, r, a0, a1):
        (x, y), rr = self.p(cx, cy), r * self.s / 100
        self.d.arc([x - rr, y - rr, x + rr, y + rr], a0, a1, fill=WHITE, width=self.w)

    def ellipse_rot(self, cx, cy, rx, ry, deg):
        pts = []
        t = math.radians(deg)
        for i in range(73):
            a = 2 * math.pi * i / 72
            x, y = rx * math.cos(a), ry * math.sin(a)
            pts.append((cx + x * math.cos(t) - y * math.sin(t), cy + x * math.sin(t) + y * math.cos(t)))
        self.line(*pts)

    def rect(self, x0, y0, x1, y1, r=4):
        a, b = self.p(x0, y0), self.p(x1, y1)
        self.d.rounded_rectangle([a, b], radius=r * self.s / 100, outline=WHITE, width=self.w)

    def text(self, s, size, font_paths=FONT_CANDIDATES):
        f = load_font(font_paths, int(size * self.s / 100))
        bb = self.d.textbbox((0, 0), s, font=f)
        x = (self.s - (bb[2] - bb[0])) / 2 - bb[0]
        y = (self.s - (bb[3] - bb[1])) / 2 - bb[1]
        self.d.text((x, y), s, font=f, fill=WHITE)


def book(p):
    p.line((50, 30), (50, 78))
    p.line((50, 30), (40, 24), (12, 24), (12, 72), (40, 72), (50, 78))
    p.line((50, 30), (60, 24), (88, 24), (88, 72), (60, 72), (50, 78))
    for y in (36, 46, 56):
        p.line((20, y), (40, y))
        p.line((60, y), (80, y))


def cap(p):
    p.line((50, 22), (92, 40), (50, 58), (8, 40), close=True)
    p.line((26, 48), (26, 68))
    p.line((74, 48), (74, 68))
    p.arc(50, 60, 24, 0, 180)
    p.line((92, 40), (92, 64))
    p.circle(92, 68, 3, fill=True)


def pencil(p):
    p.line((22, 78), (70, 30), (82, 42), (34, 90), close=False)
    p.line((22, 78), (16, 96), (34, 90))
    p.line((64, 36), (76, 48))
    p.line((70, 30), (76, 24), (88, 36), (82, 42))


def bulb(p):
    p.arc(50, 42, 22, 140, 400)
    p.line((36, 58), (40, 72), (60, 72), (64, 58))
    p.line((41, 79), (59, 79))
    p.line((44, 86), (56, 86))
    p.line((50, 44), (50, 60))
    p.line((50, 6), (50, 12))
    p.line((16, 22), (21, 27))
    p.line((84, 22), (79, 27))
    p.line((8, 44), (15, 44))
    p.line((92, 44), (85, 44))


def atom(p):
    for deg in (0, 60, 120):
        p.ellipse_rot(50, 50, 40, 15, deg)
    p.circle(50, 50, 6, fill=True)


def flask(p):
    p.line((40, 12), (40, 42), (16, 84), (84, 84), (60, 42), (60, 12))
    p.line((34, 12), (66, 12))
    p.line((26, 66), (74, 66))
    p.circle(44, 74, 3, fill=True)
    p.circle(58, 76, 2, fill=True)


def laptop(p):
    p.rect(20, 22, 80, 64, r=4)
    p.line((8, 74), (92, 74), (86, 82), (14, 82), close=True)
    p.line((36, 36), (28, 43), (36, 50))
    p.line((64, 36), (72, 43), (64, 50))
    p.line((54, 34), (46, 52))


def globe(p):
    p.circle(50, 46, 32)
    p.ellipse_rot(50, 46, 14, 32, 0)
    p.line((18, 46), (82, 46))
    p.arc(50, 6, 50, 60, 120)
    p.arc(50, 86, 50, 240, 300)
    p.line((50, 78), (50, 90))
    p.line((34, 92), (66, 92))


def ruler(p):
    p.line((10, 70), (70, 10), (90, 30), (30, 90), close=True)
    for i in range(1, 8):
        x, y = 10 + i * 7.5, 70 - i * 7.5
        L = 10 if i % 2 == 0 else 6
        p.line((x, y), (x + L * 0.7, y + L * 0.7))


def rocket(p):
    p.line((50, 8), (64, 28), (64, 66), (36, 66), (36, 28), close=True)
    p.circle(50, 38, 6)
    p.line((36, 50), (24, 66), (36, 66))
    p.line((64, 50), (76, 66), (64, 66))
    p.line((44, 74), (44, 84))
    p.line((50, 74), (50, 92))
    p.line((56, 74), (56, 84))


def magnifier(p):
    p.circle(42, 42, 26)
    p.line((61, 61), (86, 86))
    p.arc(42, 42, 16, 200, 260)


def code(p):
    p.text('</>', 44, SYMBOL_FONTS)


def sparkle(p):
    p.line((50, 14), (56, 44), (86, 50), (56, 56), (50, 86), (44, 56), (14, 50), (44, 44), close=True)


def formula(label, size=40, fonts=SYMBOL_FONTS):
    def draw(p):
        p.text(label, size, fonts)
    return draw


ICONS = [book, cap, pencil, bulb, atom, flask, laptop, globe, ruler, rocket, magnifier, code,
         formula('π', 58), formula('E=mc²', 26), formula('a²+b²', 26), formula('∑', 56),
         formula('√x', 44), formula('ABC', 30, FONT_CANDIDATES), formula('123', 32, FONT_CANDIDATES)]


def stamp(canvas, fn, cx, cy, size, rot):
    pen = Pen(int(size * SS))
    fn(pen)
    icon = pen.img.rotate(rot, resample=Image.BICUBIC, expand=True)
    canvas.alpha_composite(icon, (int(cx * SS - icon.width / 2), int(cy * SS - icon.height / 2)))


def small_mark(canvas, cx, cy, kind):
    d = ImageDraw.Draw(canvas)
    x, y = cx * SS, cy * SS
    if kind == 'dot':
        r = 3.2 * SS
        d.ellipse([x - r, y - r, x + r, y + r], fill=WHITE)
    elif kind == 'plus':
        L, w = 9 * SS, max(1, round(STROKE * SS))
        d.line([(x - L, y), (x + L, y)], fill=WHITE, width=w)
        d.line([(x, y - L), (x, y + L)], fill=WHITE, width=w)
    else:  # ring
        r = 6 * SS
        d.ellipse([x - r, y - r, x + r, y + r], outline=WHITE, width=max(1, round(STROKE * SS)))


def main():
    rnd = random.Random(2026)
    canvas = Image.new('RGBA', (W * SS, H * SS), (0, 0, 0, 0))
    cols, rows = W // CELL + 1, H // CELL + 1
    order = list(range(len(ICONS)))
    k = 0
    for r in range(rows):
        for c in range(cols):
            # baris selang-seling digeser setengah sel → pola sarang lebah, tidak kaku
            cx = c * CELL + (CELL / 2 if r % 2 else 0) + rnd.uniform(-18, 18)
            cy = r * CELL + CELL / 2 + rnd.uniform(-14, 14)
            if k % len(order) == 0:
                rnd.shuffle(order)
            fn = ICONS[order[k % len(order)]]
            k += 1
            stamp(canvas, fn, cx, cy, rnd.uniform(78, 98), rnd.uniform(-18, 18))
            small_mark(canvas, cx + CELL / 2 + rnd.uniform(-10, 10), cy + CELL / 2 + rnd.uniform(-10, 10),
                       rnd.choice(['dot', 'plus', 'ring', 'dot']))
    out = canvas.resize((W, H), Image.LANCZOS)
    out.save(OUT, optimize=True)
    print('ditulis', os.path.normpath(OUT), out.size, os.path.getsize(OUT) // 1024, 'KB')


if __name__ == '__main__':
    main()
