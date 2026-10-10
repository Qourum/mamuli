# the archipelago's card pictures and the lobby's, from the Higgsfield pictures (the zip of them, unpacked):
#   python3 -I tools/sea_scenes.py SRC_DIR OUT_DIR SHEET.png   (then copy OUT_DIR/*.webp to art/)
# Each one is wide (for a card's head): the place's picture whole on the right, its left edge fading into a blur of itself.
import sys, glob, os
from PIL import Image, ImageFilter, ImageOps, ImageEnhance
src, out, sheet = sys.argv[1], sys.argv[2], sys.argv[3]
S = {  # name: (job id, crop box as fractions)
  'sc_north': ('2e9c0f85', (0.12, 0.10, 0.92, 0.90)), 'sc_gotland': ('69cd54d4', (0.615, 0.19, 0.865, 0.45)), 'sc_med': ('5d96e513', (0.12, 0.08, 0.92, 0.92)),
  'sc_atlantic': ('809438ff', (0.16, 0.48, 0.46, 0.72)), 'sc_antilles': ('2bf834e1', (0.10, 0.06, 0.92, 0.94)),
  'sc_caribbean': ('809438ff', (0.17, 0.168, 0.46, 0.37)), 'sc_indian': ('93eb0351', (0.0, 0.0, 1.0, 1.0)),
  'sc_pacific': ('e7486706', (0.12, 0.08, 0.94, 0.94)), 'sc_oak': ('e55f2d92', (0.08, 0.10, 0.92, 0.94)),
  'sc_cocos': ('00fa721b', (0.06, 0.12, 0.94, 0.95)),
  'sc_qar': ('de4b6134', (0.42, 0.13, 0.57, 0.43)), 'sc_whydah': ('de4b6134', (0.21, 0.12, 0.43, 0.44)),
  'sc_galley': ('de4b6134', (0.24, 0.455, 0.42, 0.72)), 'sc_fortune': ('de4b6134', (0.42, 0.42, 0.57, 0.71)),
  'sc_lighthouse': ('38f7342a', (0.015, 0.14, 0.275, 0.71)), 'sc_shipyard': ('38f7342a', (0.26, 0.20, 0.50, 0.70)),
  'sc_customs': ('38f7342a', (0.495, 0.17, 0.74, 0.70)), 'sc_whirlpool': ('38f7342a', (0.72, 0.33, 0.995, 0.70)),
  'sc_port': ('82da7dee', (0.0, 0.16, 0.27, 0.74)), 'sc_isle': ('82da7dee', (0.255, 0.08, 0.50, 0.74)),
  'sc_tavern': ('82da7dee', (0.50, 0.24, 0.745, 0.74)), 'sc_kraken': ('82da7dee', (0.73, 0.16, 1.0, 0.74)),
  'sc_chest': ('f92a6114', (0.52, 0.42, 0.86, 0.75)), 'sc_bottle': ('de4b6134', (0.62, 0.0, 1.0, 0.31)),
}
W, H = 1000, 400
os.makedirs(out, exist_ok=True)
made = []
for name, (jid, (a, b, c, d)) in S.items():
    im = Image.open(glob.glob(os.path.join(src, f'*{jid}*.png'))[0]).convert('RGB')
    crop = im.crop((round(a * im.width), round(b * im.height), round(c * im.width), round(d * im.height)))
    bg = ImageEnhance.Brightness(ImageOps.fit(crop, (W, H)).filter(ImageFilter.GaussianBlur(26))).enhance(0.92)
    fg = crop.resize((round(crop.width * H / crop.height), H), Image.LANCZOS)
    if fg.width > W * 0.74: fg = ImageOps.fit(fg, (round(W * 0.74), H))
    feather = round(fg.width * 0.22)
    mask = Image.new('L', fg.size, 255)
    for x in range(feather):
        v = round(255 * (x / feather) ** 1.5)
        for y in range(fg.height): mask.putpixel((x, y), v)
    bg.paste(fg, (W - fg.width, 0), mask)
    bg.save(os.path.join(out, name + '.webp'), quality=80, method=6)
    made.append(bg)
# the lobby's picture: the golden board
im = Image.open(glob.glob(os.path.join(src, '*8433f388*.png'))[0]).convert('RGB').resize((1080, 1080), Image.LANCZOS)
im.save(os.path.join(out, 'bg_sea.webp'), quality=72, method=6)
cols = 3; rows = (len(made) + cols - 1) // cols
sh = Image.new('RGB', (cols * 500, rows * 200), (20, 20, 20))
for k, m in enumerate(made): sh.paste(m.resize((500, 200)), ((k % cols) * 500, (k // cols) * 200))
sh.save(sheet, quality=80)
print('ok', len(made), sum(os.path.getsize(os.path.join(out, f)) for f in os.listdir(out)) // 1024, 'KB')
