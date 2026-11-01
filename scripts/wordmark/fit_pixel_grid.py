"""Reads the pixels off Xel's wordmark drawing, for src/ui/Wordmark.tsx.

The drawing (koihongo-source.png, here) is "fake" pixel art: an upscaled
picture whose pixels are about 12 screen pixels wide, drawn slightly off-grid.
This finds the grid and reads one colour per cell.

Run from the repo root (needs Python 3, Pillow and numpy; takes about a minute):

    python scripts/wordmark/fit_pixel_grid.py scripts/wordmark/koihongo-source.png <scratch folder>/koihongo

It tries pixel sizes from 11.5 to 12.3 and every offset, keeps the grid whose
cells are most uniform (the fewest drawing pixels disagreeing with their
cell's majority colour), then writes <prefix>.txt (rows of '.', '#' for the
letters, '~' for the teal curl: paste them into PIXELS in Wordmark.tsx) and
<prefix>-preview.png (the result at 8x under the drawing, to check by eye).
For a drawing with a different pixel size, change the range in the search.
"""
import sys

import numpy as np
from PIL import Image

src = Image.open(sys.argv[1]).convert("RGB")
img = np.asarray(src).astype(float)
ink = img.mean(axis=2) < 160
teal = (img[..., 1] > img[..., 0] + 30) & ink
cls = np.where(teal, 2, np.where(ink, 1, 0))

ys, xs = np.nonzero(ink)
x0, x1, y0, y1 = xs.min(), xs.max() + 1, ys.min(), ys.max() + 1
pad = 14
X0, Y0 = max(0, x0 - pad), max(0, y0 - pad)
region = cls[Y0 : y1 + pad, X0 : x1 + pad]
H, W = region.shape
yy, xx = np.mgrid[0:H, 0:W]


def cells(p, ox, oy):
    cx = np.floor((xx - ox) / p).astype(int) + 1
    cy = np.floor((yy - oy) / p).astype(int) + 1
    return cx, cy


def score(p, ox, oy):
    cx, cy = cells(p, ox, oy)
    ncx = cx.max() + 1
    idx = (cy * ncx + cx).ravel()
    counts = np.stack([np.bincount(idx, weights=(region.ravel() == k), minlength=idx.max() + 1) for k in range(3)])
    return (counts.sum(axis=0) - counts.max(axis=0)).sum(), counts, cx, cy, ncx


best = None
for p in np.arange(11.5, 12.31, 0.05):
    for ox in np.arange(0, p, 1.0):
        for oy in np.arange(0, p, 1.0):
            err = score(p, ox, oy)[0]
            if best is None or err < best[0]:
                best = (err, p, ox, oy)
# Refine offsets in quarter pixels around the best.
err, p, ox, oy = best
for dox in np.arange(-1, 1.01, 0.25):
    for doy in np.arange(-1, 1.01, 0.25):
        e = score(p, ox + dox, oy + doy)[0]
        if e < best[0]:
            best = (e, p, ox + dox, oy + doy)
err, p, ox, oy = best
print(f"pixel size {p:.2f}, offset ({ox:.2f}, {oy:.2f}), disagreeing source pixels {int(err)} of {H * W}")

_, counts, cx, cy, ncx = score(p, ox, oy)
majority = counts.argmax(axis=0)
ncy = cy.max() + 1
grid = np.zeros((ncy, ncx), dtype=int)
for gy in range(ncy):
    for gx in range(ncx):
        i = gy * ncx + gx
        if i < majority.size and counts[:, i].sum() > 0:
            grid[gy, gx] = majority[i]

# Trim empty rows and columns.
rows = np.nonzero(grid.any(axis=1))[0]
cols = np.nonzero(grid.any(axis=0))[0]
grid = grid[rows[0] : rows[-1] + 1, cols[0] : cols[-1] + 1]
print("size in pixels:", grid.shape[1], "x", grid.shape[0])

out = sys.argv[2]
with open(out + ".txt", "w") as f:
    for row in grid:
        f.write("".join(".#~"[v] for v in row) + "\n")

palette = {0: (254, 247, 238), 1: (73, 35, 18), 2: (94, 187, 181)}
small = Image.new("RGB", (grid.shape[1], grid.shape[0]))
small.putdata([palette[v] for v in grid.ravel()])
scale = 8
big = small.resize((grid.shape[1] * scale, grid.shape[0] * scale), Image.NEAREST)
crop = src.crop((x0 - 10, y0 - 10, x1 + 10, y1 + 10))
crop = crop.resize((big.width, int(crop.height * big.width / crop.width)))
sheet = Image.new("RGB", (big.width, big.height + crop.height + 20), (128, 128, 128))
sheet.paste(crop, (0, 0))
sheet.paste(big, (0, crop.height + 20))
sheet.save(out + "-preview.png")
print("wrote", out + ".txt and", out + "-preview.png")
