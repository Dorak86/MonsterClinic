"""
Stellt ein Objektbild vor Magenta-Hintergrund frei (Gemini liefert keine Transparenz), entfernt den
Magenta-Saum an den Kanten, schneidet auf den Inhalt zu und skaliert auf die Zielbreite.

Aufruf: python3 key_object.py quelle.jpg ziel.png --width 384 [--mirror]
  --width   Breite des Objekts in Pixeln (Arbeitsaufloesung; eine Kachel ist 256 x 128)
  --mirror  waagerecht spiegeln (erzeugt die gegenueberliegende Ansicht bei symmetrischen Objekten)
"""
import argparse

import numpy as np
from PIL import Image

p = argparse.ArgumentParser()
p.add_argument("source")
p.add_argument("target")
p.add_argument("--width", type=int, required=True)
p.add_argument("--mirror", action="store_true")
a = p.parse_args()

im = np.asarray(Image.open(a.source).convert("RGB")).astype(np.float32)
r, g, b = im[..., 0], im[..., 1], im[..., 2]
# Magenta-Anteil: Rot und Blau hoch, Gruen niedrig
magenta = np.clip(((r + b) / 2 - g - 60) / 90, 0, 1) * np.clip(1 - np.abs(r - b) / 120, 0, 1)
alpha = 1 - magenta
alpha = np.where(alpha < 0.08, 0, alpha)
# Saum entfaerben: ueberschuessiges Rot/Blau an halbtransparenten Raendern auf Gruen-Niveau ziehen
spill = np.clip(np.minimum(r, b) - g, 0, None) * magenta
rgb = np.stack([r - spill, g, b - spill], axis=-1)
# Papierkoernung im Hintergrund hinterlaesst helle Krumen: nur zusammenhaengende Flaechen behalten (Oeffnen der Maske)
from PIL import ImageFilter
mask = Image.fromarray(((alpha > 0.5) * 255).astype(np.uint8))
mask = mask.filter(ImageFilter.MinFilter(7)).filter(ImageFilter.MaxFilter(7)).filter(ImageFilter.MaxFilter(5))
alpha = alpha * (np.asarray(mask) > 0)
out = np.dstack([np.clip(rgb, 0, 255), alpha * 255]).astype(np.uint8)
img = Image.fromarray(out, "RGBA")
img = img.crop(img.getbbox())
if a.mirror:
    img = img.transpose(Image.FLIP_LEFT_RIGHT)
h = round(img.height * a.width / img.width)
img.resize((a.width, h), Image.LANCZOS).save(a.target)
print(a.target, a.width, h)
