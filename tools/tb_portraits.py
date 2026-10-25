# ტფილისი's people: their portraits for the game, cut round each face from the Meshy pictures (named Meshy_AI_<id>.png):
#   python3 -I tools/tb_portraits.py SRC_DIR OUT_DIR SHEET.jpg   (then copy OUT_DIR/*.webp to art/; the sheet shows them all)
import sys, os
from PIL import Image, ImageDraw
src, out, sheet = sys.argv[1], sys.argv[2], sys.argv[3]
S = int(sys.argv[4]) if len(sys.argv) > 4 else 640
# picture (its name's first 8 characters) -> (character, the face's middle x, y in the 1024 picture)
# (a size and where the face sits from the top, where the picture's own sign must stay in: the kinto's fruit tray)
OWN = {'kinto': (780, 0.57)}
P = {'e6f5b515': ('kinto', 512, 478), '48eb043c': ('karachokheli', 539, 375), '2ae0a18a': ('meetle', 529, 341),
     '12e705a2': ('tulukhchi', 512, 307), 'e4cfb3fb': ('mekise', 512, 444), 'fded815f': ('mezurne', 512, 375),
     'e53bbfa6': ('medukne', 512, 392), 'b74fb90b': ('flowers', 512, 256), '2c648ab1': ('mepure', 512, 341),
     '98d3348f': ('ashugh', 512, 369), 'f3d20522': ('kalbatoni', 502, 307), '8ba9f165': ('matsoni', 512, 273)}
os.makedirs(out, exist_ok=True)
tiles = []
for f in sorted(os.listdir(src)):
    k = f[9:17]
    if k not in P: continue
    key, fx, fy = P[k]
    s, at = OWN.get(key, (S, 0.42))
    im = Image.open(os.path.join(src, f)).convert('RGB')
    x0 = min(max(0, fx - s // 2), im.width - s); y0 = min(max(0, round(fy - at * s)), im.height - s)
    face = im.crop((x0, y0, x0 + s, y0 + s)).resize((224, 224), Image.LANCZOS)
    face.save(os.path.join(out, f'por_t_{key}.webp'), quality=86, method=6)
    tiles.append((key, face))
order = ['kinto', 'karachokheli', 'meetle', 'tulukhchi', 'mekise', 'mezurne', 'medukne', 'flowers', 'mepure', 'ashugh', 'kalbatoni', 'matsoni']
tiles.sort(key=lambda t: order.index(t[0]))
W = 224 + 16; sh = Image.new('RGB', (W * 6, (W + 18) * 2 + (96 + 18) * 2), (40, 36, 34)); d = ImageDraw.Draw(sh)
for n, (key, t) in enumerate(tiles):
    x, y = (n % 6) * W + 8, (n // 6) * (W + 18) + 8
    sh.paste(t, (x, y)); d.text((x, y + 226), key, fill=(255, 255, 255))
    # as a token: a 96 px round picture
    m = Image.new('L', (96, 96), 0); ImageDraw.Draw(m).ellipse((0, 0, 95, 95), fill=255)
    sh.paste(t.resize((96, 96), Image.LANCZOS), ((n % 6) * W + 8 + 64, 2 * (W + 18) + (n // 6) * (96 + 18) + 8), m)
sh.save(sheet, quality=88)
print('ok', sum(os.path.getsize(os.path.join(out, f)) for f in os.listdir(out)) // 1024, 'KB')
