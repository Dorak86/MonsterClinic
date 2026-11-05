"""
Gleicht Farbe und Helligkeit einer Variante an eine Basistextur an (je Kanal Mittelwert und Streuung)
und daempft sehr helle Flecken, damit Varianten im Spiel nicht als hellere Bloecke auffallen.
Aufruf: python3 tone_match.py basis.jpg variante.jpg ziel.png
"""
import sys

import numpy as np
from PIL import Image

a = np.asarray(Image.open(sys.argv[1]).convert("RGB")).astype(np.float32)
c = np.asarray(Image.open(sys.argv[2]).convert("RGB")).astype(np.float32)
out = (c - c.mean((0, 1))) / c.std((0, 1)) * a.std((0, 1)) + a.mean((0, 1))
lum = out.mean(axis=2, keepdims=True)
bright = np.clip((lum - a.mean() - 25) / 60, 0, 1)
out = out * (1 - 0.35 * bright)
Image.fromarray(out.clip(0, 255).astype(np.uint8)).save(sys.argv[3])
