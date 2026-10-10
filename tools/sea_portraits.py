# the pirates' portraits, cropped round the face, from the Higgsfield pictures (the zip of them, unpacked):
#   python3 -I tools/sea_portraits.py SRC_DIR OUT_DIR SHEET.png   (then copy OUT_DIR/*.webp to art/)
import sys, glob, os
from PIL import Image
src, out, sheet = sys.argv[1], sys.argv[2], sys.argv[3]
# job id -> (key, centre x, centre y, size), in a 300 px view of the 2048 px picture
P = {'5c56e5b4': ('blackbeard', 150, 104, 172), '84155426': ('bonny', 146, 104, 170), 'cbc44a0a': ('read', 146, 86, 160),
     '70e0247f': ('chingshih', 152, 92, 168), '27ab1cf2': ('omalley', 138, 96, 160), '9f6e51e7': ('morgan', 148, 108, 172),
     '8b583a52': ('kidd', 146, 78, 160), '05bb9474': ('roberts', 146, 96, 168), 'b71d1ea4': ('barbarossa', 140, 98, 172),
     'eb3547e5': ('bellamy', 150, 82, 162), 'fc5ed5fc': ('labuse', 150, 92, 168), '441efeaa': ('stortebeker', 140, 92, 176)}
os.makedirs(out, exist_ok=True)
tiles = []
for jid, (key, cx, cy, s) in P.items():
    f = glob.glob(os.path.join(src, f'*{jid}*.png'))[0]
    im = Image.open(f).convert('RGB'); k = im.width / 300
    box = (round((cx - s / 2) * k), round((cy - s / 2) * k), round((cx + s / 2) * k), round((cy + s / 2) * k))
    face = im.crop(box).resize((224, 224), Image.LANCZOS)
    face.save(os.path.join(out, f'por_p_{key}.webp'), quality=84, method=6)
    tiles.append(face)
S = Image.new('RGB', (224 * 6, 224 * 2), (30, 30, 30))
for n, t in enumerate(tiles): S.paste(t, ((n % 6) * 224, (n // 6) * 224))
S.save(sheet, quality=85)
print('ok', sum(os.path.getsize(os.path.join(out, f)) for f in os.listdir(out)) // 1024, 'KB')
