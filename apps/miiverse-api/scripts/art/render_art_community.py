"""Render the Juxt art community's images with Pillow.

Usage: render_art_community.py <out_dir> [title]
Writes 3DS.png (400x220), WiiU.png (1280x180) and icon.png (256x256); Juxt's
admin upload turns them into its JPEG headers and icon sizes. Everything is
drawn at SS x the final size and downsampled for smooth edges; a fixed seed
keeps the output reproducible.
"""
import math
import random
import sys

from PIL import Image, ImageDraw, ImageFilter, ImageFont

SS = 4  # supersampling factor
FONT = '/usr/share/fonts/opentype/urw-base35/NimbusSans-Bold.otf'
PAPER = (253, 247, 233)
INK = (44, 38, 58)
PAINTS = [
    (239, 71, 111),   # raspberry
    (255, 140, 66),   # orange
    (255, 209, 102),  # sunflower
    (6, 214, 160),    # mint
    (17, 138, 178),   # ocean
    (131, 56, 236),   # violet
]


def paper(w, h, rng):
    """Warm paper with a faint grain."""
    img = Image.new('RGB', (w, h), PAPER)
    grain = Image.effect_noise((w // 4, h // 4), 18).resize((w, h), Image.BICUBIC)
    tint = Image.new('RGB', (w, h), (232, 222, 200))
    return Image.composite(img, tint, grain.point(lambda v: 200 + v // 5))


def stroke(draw, pts, width, color, rng):
    """A brush stroke: a run of overlapping round dabs whose width breathes."""
    steps = []
    for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
        n = max(2, int(math.hypot(x1 - x0, y1 - y0) / (width * 0.12)))
        for i in range(n):
            t = i / n
            steps.append((x0 + (x1 - x0) * t, y0 + (y1 - y0) * t))
    for i, (x, y) in enumerate(steps):
        t = i / max(1, len(steps) - 1)
        r = width / 2 * (0.55 + 0.45 * math.sin(math.pi * t)) * rng.uniform(0.92, 1.05)
        draw.ellipse((x - r, y - r, x + r, y + r), fill=color)


def curve(p0, p1, p2, n=24):
    """Quadratic Bezier points."""
    out = []
    for i in range(n + 1):
        t = i / n
        out.append(((1 - t) ** 2 * p0[0] + 2 * (1 - t) * t * p1[0] + t * t * p2[0],
                    (1 - t) ** 2 * p0[1] + 2 * (1 - t) * t * p1[1] + t * t * p2[1]))
    return out


def splatter(draw, cx, cy, size, color, rng):
    """A paint splat: a blob, some lobes and flicked droplets."""
    draw.ellipse((cx - size, cy - size, cx + size, cy + size), fill=color)
    for _ in range(9):
        a = rng.uniform(0, 2 * math.pi)
        d = size * rng.uniform(0.6, 1.1)
        r = size * rng.uniform(0.25, 0.5)
        x, y = cx + math.cos(a) * d, cy + math.sin(a) * d
        draw.ellipse((x - r, y - r, x + r, y + r), fill=color)
    for _ in range(14):
        a = rng.uniform(0, 2 * math.pi)
        d = size * rng.uniform(1.4, 2.6)
        r = size * rng.uniform(0.06, 0.18)
        x, y = cx + math.cos(a) * d, cy + math.sin(a) * d
        draw.ellipse((x - r, y - r, x + r, y + r), fill=color)


def palette(img, cx, cy, s, rng, angle=-12):
    """A painter's palette (s = half width) with paint blobs and a thumb hole."""
    w, h = int(s * 2.4), int(s * 1.9)
    layer = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    body = (w * 0.05, h * 0.08, w * 0.95, h * 0.92)
    d.ellipse(body, fill=(196, 140, 84), outline=INK, width=max(2, int(s * 0.05)))
    d.ellipse((w * 0.09, h * 0.12, w * 0.91, h * 0.86), fill=(222, 170, 110))
    # thumb hole and notch
    hole = (w * 0.24, h * 0.52, w * 0.38, h * 0.70)
    d.ellipse(hole, fill=(0, 0, 0, 0), outline=INK, width=max(2, int(s * 0.04)))
    d.pieslice((w * 0.0, h * 0.62, w * 0.3, h * 1.02), 300, 30, fill=(0, 0, 0, 0))
    spots = [(0.30, 0.30), (0.48, 0.22), (0.66, 0.26), (0.80, 0.42), (0.74, 0.64), (0.55, 0.72)]
    for (fx, fy), c in zip(spots, PAINTS):
        r = s * 0.17
        x, y = w * fx, h * fy
        d.ellipse((x - r, y - r, x + r, y + r), fill=c)
        d.ellipse((x - r * 0.45, y - r * 0.55, x - r * 0.05, y - r * 0.2), fill=(255, 255, 255, 140))
    layer = layer.rotate(angle, resample=Image.BICUBIC, expand=True)
    shadow = Image.new('RGBA', layer.size, (0, 0, 0, 0))
    shadow.paste((40, 30, 20, 70), mask=layer.getchannel('A'))
    shadow = shadow.filter(ImageFilter.GaussianBlur(s * 0.08))
    ox, oy = int(cx - layer.width / 2), int(cy - layer.height / 2)
    img.alpha_composite(shadow, (ox + int(s * 0.06), oy + int(s * 0.08)))
    img.alpha_composite(layer, (ox, oy))


def brush(img, cx, cy, length, angle, tip):
    """A paintbrush: wooden handle, metal ferrule, bristles dipped in paint."""
    t = length * 0.07
    w, h = int(length), int(t * 3)
    layer = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    m = h / 2
    ow = max(2, int(t * 0.18))
    d.rounded_rectangle((0, m - t * 0.45, w * 0.62, m + t * 0.45), radius=t * 0.45,
                        fill=(122, 74, 46), outline=INK, width=ow)
    d.rectangle((w * 0.6, m - t * 0.55, w * 0.74, m + t * 0.55), fill=(190, 196, 206), outline=INK, width=ow)
    d.polygon([(w * 0.74, m - t * 0.55), (w * 0.93, m - t * 0.4), (w * 0.995, m), (w * 0.93, m + t * 0.4),
               (w * 0.74, m + t * 0.55)], fill=(232, 205, 160), outline=INK)
    d.polygon([(w * 0.86, m - t * 0.45), (w * 0.93, m - t * 0.4), (w * 0.995, m), (w * 0.93, m + t * 0.4),
               (w * 0.86, m + t * 0.45)], fill=tip)
    layer = layer.rotate(angle, resample=Image.BICUBIC, expand=True)
    img.alpha_composite(layer, (int(cx - layer.width / 2), int(cy - layer.height / 2)))


def pencil(img, cx, cy, length, angle, color):
    """A pencil with eraser, ferrule, painted body and sharpened tip."""
    t = length * 0.09
    w, h = int(length), int(t * 2)
    layer = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    m = h / 2
    ow = max(2, int(t * 0.14))
    d.rounded_rectangle((0, m - t * 0.5, w * 0.12, m + t * 0.5), radius=t * 0.3, fill=(244, 143, 177), outline=INK, width=ow)
    d.rectangle((w * 0.1, m - t * 0.52, w * 0.18, m + t * 0.52), fill=(190, 196, 206), outline=INK, width=ow)
    d.rectangle((w * 0.18, m - t * 0.5, w * 0.8, m + t * 0.5), fill=color, outline=INK, width=ow)
    d.line((w * 0.18, m, w * 0.8, m), fill=tuple(max(0, c - 40) for c in color), width=max(1, int(t * 0.12)))
    d.polygon([(w * 0.8, m - t * 0.5), (w * 0.985, m), (w * 0.8, m + t * 0.5)], fill=(240, 205, 160), outline=INK)
    d.polygon([(w * 0.93, m - t * 0.14), (w * 0.985, m), (w * 0.93, m + t * 0.14)], fill=INK)
    layer = layer.rotate(angle, resample=Image.BICUBIC, expand=True)
    img.alpha_composite(layer, (int(cx - layer.width / 2), int(cy - layer.height / 2)))


def title(img, text, cx, cy, size, colors):
    """Bold title: per-letter colours, dark outline, white outer edge, drop shadow."""
    font = ImageFont.truetype(FONT, int(size))
    widths = [font.getlength(ch) for ch in text]
    x = cx - sum(widths) / 2
    o1, o2 = size * 0.07, size * 0.14
    base = ImageDraw.Draw(img)
    asc, desc = font.getmetrics()
    y = cy - (asc + desc) / 2 + desc * 0.35
    shadow = Image.new('RGBA', img.size, (0, 0, 0, 0))
    ImageDraw.Draw(shadow).text((x + size * 0.05, y + size * 0.07), text, font=font, fill=(30, 20, 40, 120),
                                stroke_width=int(o2), stroke_fill=(30, 20, 40, 120))
    img.alpha_composite(shadow.filter(ImageFilter.GaussianBlur(size * 0.04)))
    base.text((x, y), text, font=font, fill='white', stroke_width=int(o2), stroke_fill='white')
    base.text((x, y), text, font=font, fill=INK, stroke_width=int(o1), stroke_fill=INK)
    ci = 0
    for ch, cw in zip(text, widths):
        if ch.strip():
            base.text((x, y), ch, font=font, fill=colors[ci % len(colors)])
            ci += 1
        x += cw


def strokes_band(img, w, h, rng, count, width_range, y_range, alpha=170):
    """Loose diagonal brush strokes across the canvas, in the paint colours."""
    layer = Image.new('RGBA', img.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    for i in range(count):
        c = PAINTS[i % len(PAINTS)]
        x0 = rng.uniform(-0.1, 1.0) * w
        y0 = rng.uniform(*y_range) * h
        length = rng.uniform(0.18, 0.4) * w
        a = rng.uniform(-0.35, 0.35)
        p0 = (x0, y0)
        p2 = (x0 + math.cos(a) * length, y0 + math.sin(a) * length)
        p1 = ((p0[0] + p2[0]) / 2, (p0[1] + p2[1]) / 2 + rng.uniform(-0.25, 0.25) * h)
        stroke(d, curve(p0, p1, p2), rng.uniform(*width_range), c + (alpha,), rng)
    img.alpha_composite(layer)


def splats(img, w, h, rng, count, size_range, avoid=None):
    layer = Image.new('RGBA', img.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    for i in range(count):
        for _ in range(20):
            x, y = rng.uniform(0.03, 0.97) * w, rng.uniform(0.08, 0.92) * h
            if not avoid or not (avoid[0] < x < avoid[2] and avoid[1] < y < avoid[3]):
                break
        splatter(d, x, y, rng.uniform(*size_range), PAINTS[(i * 2 + 1) % len(PAINTS)] + (210,), rng)
    img.alpha_composite(layer)


def header_3ds(text):
    rng = random.Random(7)
    w, h = 400 * SS, 220 * SS
    img = paper(w, h, rng).convert('RGBA')
    strokes_band(img, w, h, rng, 9, (34 * SS, 58 * SS), (0.05, 0.95), alpha=150)
    splats(img, w, h, rng, 7, (7 * SS, 13 * SS), avoid=(0.12 * w, 0.32 * h, 0.88 * w, 0.68 * h))
    palette(img, w * 0.8, h * 0.74, 46 * SS, rng)
    brush(img, w * 0.2, h * 0.8, 150 * SS, 24, PAINTS[4])
    pencil(img, w * 0.2, h * 0.18, 120 * SS, -14, PAINTS[2])
    title(img, text, w * 0.5, h * 0.47, 46 * SS, PAINTS)
    return img.convert('RGB').resize((400, 220), Image.LANCZOS)


def header_wiiu(text):
    rng = random.Random(11)
    w, h = 1280 * SS, 180 * SS
    img = paper(w, h, rng).convert('RGBA')
    strokes_band(img, w, h, rng, 22, (30 * SS, 52 * SS), (0.05, 0.95), alpha=150)
    splats(img, w, h, rng, 14, (6 * SS, 12 * SS), avoid=(0.3 * w, 0.2 * h, 0.7 * w, 0.8 * h))
    palette(img, w * 0.885, h * 0.52, 62 * SS, rng, angle=-8)
    brush(img, w * 0.775, h * 0.5, 190 * SS, 30, PAINTS[0])
    pencil(img, w * 0.15, h * 0.42, 170 * SS, -10, PAINTS[4])
    brush(img, w * 0.235, h * 0.62, 150 * SS, 196, PAINTS[3])
    title(img, text, w * 0.5, h * 0.5, 62 * SS, PAINTS)
    return img.convert('RGB').resize((1280, 180), Image.LANCZOS)


def icon():
    rng = random.Random(3)
    s = 256 * SS
    img = Image.new('RGBA', (s, s), (0, 0, 0, 0))
    bg = Image.new('RGBA', (s, s), (0, 0, 0, 0))
    ImageDraw.Draw(bg).rounded_rectangle((0, 0, s - 1, s - 1), radius=s * 0.18, fill=PAPER + (255,))
    img.alpha_composite(bg)
    strokes_band(img, s, s, rng, 5, (40 * SS, 64 * SS), (0.1, 0.9), alpha=130)
    palette(img, s * 0.5, s * 0.56, 92 * SS, rng, angle=-14)
    brush(img, s * 0.58, s * 0.3, 190 * SS, 32, PAINTS[5])
    mask = Image.new('L', (s, s), 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, s - 1, s - 1), radius=s * 0.18, fill=255)
    img.putalpha(Image.composite(img.getchannel('A'), mask, mask))
    out = Image.new('RGB', (s, s), PAPER)
    out.paste(img, mask=img.getchannel('A'))
    return out.resize((256, 256), Image.LANCZOS)


if __name__ == '__main__':
    out = sys.argv[1]
    text = sys.argv[2] if len(sys.argv) > 2 else 'Art Community'
    header_3ds(text).save(f'{out}/3DS.png')
    header_wiiu(text).save(f'{out}/WiiU.png')
    icon().save(f'{out}/icon.png')
    print('rendered', out)
