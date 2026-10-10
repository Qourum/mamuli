#!/usr/bin/env python3
"""Draws the home-screen icons and the link preview picture (og.jpg) from the game's own art.
Needs Pillow, and the title font as a .woff2 or .ttf: FONT=/path/noto-serif-georgian-georgian-900-normal.woff2"""
import io, os
from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ART = os.path.join(ROOT, 'art')
FONT = os.environ.get('FONT', '/home/claude/devtools/node_modules/@fontsource/noto-serif-georgian/files/noto-serif-georgian-georgian-900-normal.woff2')
INK, WOOD, WOOD2, GOLD, GOLD_LO = (13, 16, 22), (77, 49, 29), (44, 27, 16), (232, 180, 76), (141, 95, 23)


def font(size):
    if FONT.endswith('.woff2'):
        from fontTools.ttLib import TTFont
        f = TTFont(FONT)
        f.flavor = None
        buf = io.BytesIO()
        f.save(buf)
        buf.seek(0)
        return ImageFont.truetype(buf, size)
    return ImageFont.truetype(FONT, size)


def art(name):
    return Image.open(os.path.join(ART, name + '.webp')).convert('RGBA')


def icon(size, maskable=False):
    im = Image.new('RGBA', (size, size), INK + (255,))
    d = ImageDraw.Draw(im)
    pad = 0 if maskable else round(size * .04)
    r = round(size * (.0 if maskable else .2))
    d.rounded_rectangle([pad, pad, size - pad - 1, size - pad - 1], radius=r, fill=WOOD2 + (255,))
    inset = round(size * (.13 if maskable else .09))
    d.rounded_rectangle([inset, inset, size - inset - 1, size - inset - 1], radius=max(1, r - inset // 2), outline=GOLD + (255,), width=max(2, size // 64))
    fort = art('s_fort')
    box = round(size * (.56 if maskable else .66))
    fort.thumbnail((box, box), Image.LANCZOS)
    shadow = Image.new('RGBA', im.size, (0, 0, 0, 0))
    sx, sy = (size - fort.width) // 2, (size - fort.height) // 2 + round(size * .02)
    shadow.paste((0, 0, 0, 150), (sx, sy + round(size * .03)), fort)
    im = Image.alpha_composite(im, shadow.filter(ImageFilter.GaussianBlur(size / 60)))
    im.alpha_composite(fort, (sx, sy))
    return im.convert('RGB')


def cover(name, W, H):
    bg = art(name).convert('RGB')
    s = max(W / bg.width, H / bg.height)
    bg = bg.resize((round(bg.width * s), round(bg.height * s)), Image.LANCZOS)
    return bg.crop(((bg.width - W) // 2, 0, (bg.width - W) // 2 + W, H)).convert('RGBA')


def og():
    # the game's two worlds side by side: Svaneti's towers on the left, the pirates' sea on the right
    W, H = 1200, 630
    bg, sea = cover('g_svan', W, H), cover('bg_sea', W, H)
    mask = Image.new('L', (W, H))
    md = ImageDraw.Draw(mask)
    for x in range(W):
        md.line([(x, 0), (x, H)], fill=max(0, min(255, int((x - W * .38) / (W * .24) * 255))))
    bg = Image.composite(sea, bg, mask)
    shade = Image.new('RGBA', (W, H))
    sd = ImageDraw.Draw(shade)
    for y in range(H):
        a = int(110 + 120 * (y / H))
        sd.line([(0, y), (W, y)], fill=INK + (a,))
    im = Image.alpha_composite(bg, shade)
    d = ImageDraw.Draw(im)
    f = font(150)
    text = 'შენი ჯერი'
    tw = d.textlength(text, font=f)
    x, y = (W - tw) / 2, 120
    d.text((x, y + 8), text, font=f, fill=WOOD2)
    d.text((x, y), text, font=f, fill=GOLD, stroke_width=5, stroke_fill=WOOD2)
    sub = font(38)
    line = 'საქართველოს ციხეები და მეკობრეების კუნძულები'   # (the title font has no hyphen)
    d.text(((W - d.textlength(line, font=sub)) / 2, 330), line, font=sub, fill=(255, 244, 218))
    heroes = ['por_h_david', 'por_h_tamar', 'por_h_erekle', 'por_p_blackbeard', 'por_p_chingshih', 'por_p_omalley']
    n, ps, gap = len(heroes), 96, 22
    x0 = (W - (n * ps + (n - 1) * gap)) // 2
    for k, h in enumerate(heroes):
        p = art(h).resize((ps, ps), Image.LANCZOS)
        mask = Image.new('L', (ps, ps), 0)
        ImageDraw.Draw(mask).ellipse([0, 0, ps - 1, ps - 1], fill=255)
        cx = x0 + k * (ps + gap)
        d.ellipse([cx - 5, 440 - 5, cx + ps + 4, 440 + ps + 4], fill=GOLD)
        im.paste(p, (cx, 440), mask)
    return im.convert('RGB')


if __name__ == '__main__':
    for n, s, m in [('icon-180.png', 180, False), ('icon-192.png', 192, False), ('icon-512.png', 512, False), ('icon-512-maskable.png', 512, True)]:
        icon(s, m).save(os.path.join(ROOT, n), optimize=True)
    og().save(os.path.join(ROOT, 'og.jpg'), quality=86, optimize=True)
    print('icons and og.jpg written')
