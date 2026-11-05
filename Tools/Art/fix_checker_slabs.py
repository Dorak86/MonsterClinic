"""
Repariert ein Schachbrett aus Platten (Marmor im OP): Gemini hat in der Quelle vom 05.11.2026 zwei Reihen
gleich begonnen und eine Platte geteilt. Das Skript schneidet die Platten an den Fugenmitten aus,
sortiert sie nach Helligkeit (hell/dunkel) und setzt ein korrektes 4 x 4-Schachbrett neu zusammen.
Fehlerhafte Platten werden ausgelassen; fehlt dadurch eine Platte, wird eine vorhandene um 180 Grad gedreht.

Aufruf: python3 fix_checker_slabs.py quelle.jpg ziel.png --centers -1.5 254.5 510.5 768 1022.5 --skip 2,3 --spare 0,3
  --centers  Fugenmitten in Pixeln (5 Werte, erster/letzter duerfen ueber den Rand gehen; gilt fuer x und y)
  --skip     Zellen (Zeile,Spalte), die nicht verwendet werden
  --spare    Zelle, deren gedrehte Kopie fehlende Platten auffuellt
"""
import argparse

import numpy as np
from PIL import Image


def main():
    p = argparse.ArgumentParser()
    p.add_argument("source")
    p.add_argument("target")
    p.add_argument("--centers", nargs=5, type=float, required=True)
    p.add_argument("--skip", nargs="*", default=[])
    p.add_argument("--spare", default=None)
    a = p.parse_args()
    s = np.asarray(Image.open(a.source).convert("RGB"))
    n = s.shape[0]
    big = Image.fromarray(np.tile(s, (3, 3, 1)))
    c = a.centers

    def cell(r, k):
        box = (round(c[k] + n), round(c[r] + n), round(c[k + 1] + n), round(c[r + 1] + n))
        return big.crop(box).resize((256, 256), Image.LANCZOS)

    skip = {tuple(int(v) for v in x.split(",")) for x in a.skip}
    cells = {(r, k): cell(r, k) for r in range(4) for k in range(4)}
    light = [img for key, img in sorted(cells.items()) if key not in skip and np.asarray(img).mean() > 140]
    dark = [img for key, img in sorted(cells.items()) if key not in skip and np.asarray(img).mean() <= 140]
    if a.spare:
        spare = cells[tuple(int(v) for v in a.spare.split(","))].rotate(180)
        target = light if np.asarray(spare).mean() > 140 else dark
        while len(target) < 8:
            target.append(spare)
    if len(light) < 8 or len(dark) < 8:
        raise SystemExit(f"zu wenige Platten: hell {len(light)}, dunkel {len(dark)}")
    out = Image.new("RGB", (1024, 1024))
    li = di = 0
    for r in range(4):
        for k in range(4):
            if (r + k) % 2 == 0:
                out.paste(light[li], (k * 256, r * 256)); li += 1
            else:
                out.paste(dark[di], (k * 256, r * 256)); di += 1
    out.save(a.target)


if __name__ == "__main__":
    main()
