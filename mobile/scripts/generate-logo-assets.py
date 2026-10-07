"""Buat ikon & aset aplikasi dari logo resmi MTsN 2 Kota Malang (logo yang dipakai aplikasi web).

Sumber: assets/images/logo-madrasah.png (salinan `logo_url` di Pengaturan web, 1024 px, latar transparan).
Jalankan dari folder mobile/:  python scripts/generate-logo-assets.py   (butuh Pillow)

Menghasilkan (assets/images/):
  icon.png             1024  logo di atas latar putih membulat (ikon umum / Expo Go)
  adaptive-icon.png    1024  foreground ikon adaptif Android (logo di zona aman 66%, latar transparan)
  splash-icon.png      1024  logo untuk layar pembuka (dipasang di atas latar hijau #006837)
  notification-icon.png 256  siluet putih (Android mewajibkan ikon notifikasi monokrom)
  favicon.png            48
  logo.png              512  logo untuk dipakai di dalam aplikasi (login, kunci, header)
"""
import os

from PIL import Image, ImageDraw, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, '..', 'assets', 'images')
SRC = os.path.join(OUT, 'logo-madrasah.png')


def fit(logo: Image.Image, box: int) -> Image.Image:
    """Perkecil logo agar sisi terpanjang = box (rasio dipertahankan)."""
    w, h = logo.size
    scale = box / max(w, h)
    return logo.resize((max(1, round(w * scale)), max(1, round(h * scale))), Image.LANCZOS)


def centered(canvas: Image.Image, logo: Image.Image) -> Image.Image:
    x = (canvas.width - logo.width) // 2
    y = (canvas.height - logo.height) // 2
    canvas.alpha_composite(logo, (x, y))
    return canvas


def main():
    logo = Image.open(SRC).convert('RGBA')
    logo = logo.crop(logo.getchannel('A').getbbox())  # buang tepi transparan

    # Ikon umum: latar putih membulat + logo 84%.
    icon = Image.new('RGBA', (1024, 1024), (0, 0, 0, 0))
    ImageDraw.Draw(icon).rounded_rectangle([0, 0, 1023, 1023], radius=224, fill=(255, 255, 255, 255))
    centered(icon, fit(logo, 860)).save(os.path.join(OUT, 'icon.png'))

    # Ikon adaptif Android: launcher dapat memotong hingga lingkaran 66% → logo 62% agar utuh.
    adaptive = Image.new('RGBA', (1024, 1024), (0, 0, 0, 0))
    centered(adaptive, fit(logo, 636)).save(os.path.join(OUT, 'adaptive-icon.png'))

    # Splash: logo dengan sedikit bayangan lembut agar menonjol di atas hijau.
    splash = Image.new('RGBA', (1024, 1024), (0, 0, 0, 0))
    big = fit(logo, 900)
    shadow = Image.new('RGBA', splash.size, (0, 0, 0, 0))
    mask = big.getchannel('A').point(lambda a: int(a * 0.35))
    shadow.paste((0, 0, 0, 255), ((1024 - big.width) // 2, (1024 - big.height) // 2 + 14), mask)
    splash.alpha_composite(shadow.filter(ImageFilter.GaussianBlur(18)))
    centered(splash, big).save(os.path.join(OUT, 'splash-icon.png'))

    # Notifikasi: siluet putih; garis/teks gelap pada logo dilubangi agar bentuknya tetap dikenali.
    small = fit(logo, 236)
    px = small.load()
    sil = Image.new('RGBA', small.size, (255, 255, 255, 0))
    sp = sil.load()
    for y in range(small.height):
        for x in range(small.width):
            r, g, b, a = px[x, y]
            dark = (0.299 * r + 0.587 * g + 0.114 * b) < 70
            sp[x, y] = (255, 255, 255, 0 if dark else a)
    notif = Image.new('RGBA', (256, 256), (0, 0, 0, 0))
    centered(notif, sil).save(os.path.join(OUT, 'notification-icon.png'))

    fav = Image.new('RGBA', (48, 48), (0, 0, 0, 0))
    centered(fav, fit(logo, 46)).save(os.path.join(OUT, 'favicon.png'))

    fit(logo, 512).save(os.path.join(OUT, 'logo.png'))
    print('Aset logo dibuat di', os.path.normpath(OUT))


if __name__ == '__main__':
    main()
