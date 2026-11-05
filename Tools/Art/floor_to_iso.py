"""
Macht aus einer quadratischen Bodentextur (von oben) isometrische Bodenkacheln (Pflichtenheft 2 und 6).

Vorgehen:
1. Aus der Textur wird ein Block geschnitten, dessen Raender mitten in Fugen liegen; dadurch ist er nahtlos.
2. Der Block wird auf N x N Spielkacheln verteilt. Kachel (x, y) im Spiel nutzt Variante (x mod N, y mod N),
   so laeuft das Muster ueber Kachelgrenzen weiter und wiederholt sich erst nach N Kacheln.
3. Jede Variante wird dimetrisch 2:1 in eine Raute von 256 x 128 Pixeln (Arbeitsaufloesung) umgerechnet.

Aufruf (Beispiel Untersuchungszimmer):
  python3 floor_to_iso.py quelle.jpg ziel_atlas.png vorschau.png --block 204.5 613.5 204.5 613.5 --tiles 4

Ausgabe: Atlas mit N x N Rauten (Spalte = x, Zeile = y) und eine Vorschau mit 8 x 8 Kacheln bei Zoom 0,5.
Benoetigt: Pillow, numpy.
"""
import argparse

import numpy as np
from PIL import Image

TILE_W, TILE_H = 256, 128


def main():
    p = argparse.ArgumentParser()
    p.add_argument("source")
    p.add_argument("atlas")
    p.add_argument("preview")
    p.add_argument("--block", nargs=4, type=float, required=True, metavar=("X0", "X1", "Y0", "Y1"),
                   help="Blockgrenzen in Pixeln der Quelle, jeweils Mitte einer Fuge")
    p.add_argument("--tiles", type=int, default=4, help="Spielkacheln je Blockseite")
    a = p.parse_args()

    im = np.asarray(Image.open(a.source).convert("RGB")).astype(np.float32)
    x0, x1, y0, y1 = a.block
    n = a.tiles

    def sample(fx, fy):
        px = x0 + (fx % n) / n * (x1 - x0)
        py = y0 + (fy % n) / n * (y1 - y0)
        xi = np.floor(px).astype(int)
        yi = np.floor(py).astype(int)
        ax = (px - xi)[..., None]
        ay = (py - yi)[..., None]
        top = im[yi, xi] * (1 - ax) + im[yi, xi + 1] * ax
        bottom = im[yi + 1, xi] * (1 - ax) + im[yi + 1, xi + 1] * ax
        return top * (1 - ay) + bottom * ay

    sx, sy = np.meshgrid(np.arange(TILE_W) + 0.5, np.arange(TILE_H) + 0.5)
    # Umkehrung von sx = (fx - fy) * 128 + 128, sy = (fx + fy) * 64
    lx = ((sx - 128) / 128 + sy / 64) / 2
    ly = (sy / 64 - (sx - 128) / 128) / 2
    inside = (lx >= 0) & (lx < 1) & (ly >= 0) & (ly < 1)
    alpha = np.where(inside, 255, 0)[..., None]

    tiles = {}
    atlas = Image.new("RGBA", (TILE_W * n, TILE_H * n))
    for ty in range(n):
        for tx in range(n):
            rgb = sample(tx + np.clip(lx, 0, 0.9999), ty + np.clip(ly, 0, 0.9999))
            img = Image.fromarray(np.concatenate([rgb, alpha], axis=2).clip(0, 255).astype(np.uint8), "RGBA")
            tiles[(tx, ty)] = img
            atlas.paste(img, (tx * TILE_W, ty * TILE_H))
    atlas.save(a.atlas)

    m = 8
    w, h = m * 2 * 128, m * 128 + 64
    preview = Image.new("RGBA", (w, h), (40, 32, 48, 255))
    for y in range(m):
        for x in range(m):
            preview.alpha_composite(tiles[(x % n, y % n)], ((x - y) * 128 + w // 2 - 128, (x + y) * 64 + 32))
    preview.convert("RGB").resize((w // 2, h // 2), Image.LANCZOS).save(a.preview)


if __name__ == "__main__":
    main()
