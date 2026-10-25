#!/usr/bin/env python3
"""A baked picture made cleaner, like painted: Meshy's colours are smudged (blotches inside a wall, a roof's edge blurred);
mean shift flattens each patch of colour and keeps the edges between them, a little sharpening and saturation make it
crisp. Only the model's own points (MASK white) are changed; the gaps between patches are filled again from them.
  python3 -I tools/paint_clean.py IN.png MASK.png OUT.png [--sp 3] [--sr 18] [--sharp 0.8] [--radius 1.0] [--sat 1.12]
(tools/city_make.mjs calls it after baking)"""
import argparse
import cv2
import numpy as np

ap = argparse.ArgumentParser()
ap.add_argument('src'); ap.add_argument('mask'); ap.add_argument('out')
ap.add_argument('--sp', type=float, default=3); ap.add_argument('--sr', type=float, default=18)
ap.add_argument('--sharp', type=float, default=0.8); ap.add_argument('--radius', type=float, default=1.0)
ap.add_argument('--sat', type=float, default=1.12)
a = ap.parse_args()

img = cv2.imread(a.src, cv2.IMREAD_COLOR)
mask = cv2.imread(a.mask, cv2.IMREAD_GRAYSCALE) > 127
out = cv2.pyrMeanShiftFiltering(img, a.sp, a.sr)
if a.sharp > 0:
    blur = cv2.GaussianBlur(out, (0, 0), a.radius)
    out = cv2.addWeighted(out, 1 + a.sharp, blur, -a.sharp, 0)
if a.sat != 1:
    hsv = cv2.cvtColor(out, cv2.COLOR_BGR2HSV).astype(np.float32)
    hsv[..., 1] = np.clip(hsv[..., 1] * a.sat, 0, 255)
    out = cv2.cvtColor(hsv.astype(np.uint8), cv2.COLOR_HSV2BGR)
# the gaps: each pass takes the average of its filled neighbours
res = np.where(mask[..., None], out, 0).astype(np.float32)
m = mask.astype(np.float32)
for _ in range(24):
    s = cv2.boxFilter(res, -1, (3, 3), normalize=False, borderType=cv2.BORDER_CONSTANT)
    n = cv2.boxFilter(m, -1, (3, 3), normalize=False, borderType=cv2.BORDER_CONSTANT)
    add = (m == 0) & (n > 0)
    if not add.any():
        break
    res[add] = s[add] / n[add][:, None]
    m[add] = 1
res = np.where(m[..., None] > 0, res, img.astype(np.float32))
cv2.imwrite(a.out, np.clip(res, 0, 255).astype(np.uint8))
print(f'clean: {mask.mean() * 100:.0f}% of the picture is the model\'s')
