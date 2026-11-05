"""
Toilettenboden aus dem Fliesenblock des Untersuchungszimmers: Weiss wird vergilbt, Gruen stumpfer.
Aufruf: python3 recolor_toilet.py floor_block_A.png ziel.png
"""
import sys

import numpy as np
from PIL import Image

im = np.asarray(Image.open(sys.argv[1]).convert("RGB")).astype(np.float32) / 255
r, g, b = im[..., 0], im[..., 1], im[..., 2]
light = im.mean(axis=2)
green = np.clip((g - (r + b) / 2) * 6, 0, 1)            # Anteil gruener Fliese
yellow = np.array([0.93, 0.86, 0.66], np.float32)        # vergilbtes Knochenweiss
dull = np.array([0.62, 0.66, 0.50], np.float32)          # stumpfes Gruen
tint = yellow * (1 - green[..., None]) + dull * green[..., None]
out = light[..., None] * tint * 1.08
out = out * 0.85 + im * 0.15                              # etwas Originalstruktur behalten
Image.fromarray((np.clip(out, 0, 1) * 255).astype(np.uint8)).save(sys.argv[2])
