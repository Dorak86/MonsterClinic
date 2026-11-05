"""
Macht eine Variante kantengleich zu einer Basistextur (fuer Boeden ohne Fugen, z. B. Hoellenboden).
Am Rand wird die Basis eingeblendet, innen die Variante. Weil alle Varianten dieselben Raender haben,
passen sie in jeder Anordnung nahtlos aneinander.

Aufruf: python3 match_edges.py basis.png variante.png ziel.png [--margin 160]
"""
import argparse

import numpy as np
from PIL import Image

p = argparse.ArgumentParser()
p.add_argument("base")
p.add_argument("variant")
p.add_argument("target")
p.add_argument("--margin", type=int, default=160)
a = p.parse_args()
base = np.asarray(Image.open(a.base).convert("RGB")).astype(np.float32)
var = np.asarray(Image.open(a.variant).convert("RGB").resize((base.shape[1], base.shape[0]), Image.LANCZOS)).astype(np.float32)
h, w, _ = base.shape
d = np.minimum.outer(np.minimum(np.arange(h), h - 1 - np.arange(h)), np.minimum(np.arange(w), w - 1 - np.arange(w)))
t = np.clip(d / a.margin, 0, 1)
t = (t * t * (3 - 2 * t))[..., None]  # weicher Uebergang
out = base * (1 - t) + var * t
Image.fromarray(out.clip(0, 255).astype(np.uint8)).save(a.target)
