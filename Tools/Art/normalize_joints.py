"""
Gleicht Fugen einer Rastertextur an (Steinplatten, Marmor): Gemini malt die Fuge am Bildrand oft doppelt
so breit wie innen. Wird die Textur dann wiederholt, entsteht alle N Kacheln ein breiter Spalt.
Das Skript findet die Fugen je Achse (die Randfuge laeuft ueber den Bildrand hinweg), verschiebt sie auf
gleiche Abstaende und gleiche Breite und rechnet das Bild stueckweise linear um. Ergebnis ist nahtlos.

Aufruf: python3 normalize_joints.py quelle.jpg ziel.png --count 4 [--joint 20]
"""
import argparse

import numpy as np
from PIL import Image


def joints(profile, count):
    n = len(profile)
    thr = profile.mean() - 0.6 * profile.std()
    dark = profile < thr
    # an einer hellen Stelle beginnen, damit keine Fuge am Anfang zerschnitten wird
    start = int(np.argmax(~dark))
    runs, i = [], 0
    while i < n:
        k = (start + i) % n
        if dark[k]:
            j = i
            while j < n and dark[(start + j) % n]:
                j += 1
            runs.append((start + i, start + j))  # [a, b) in fortlaufenden Koordinaten
            i = j
        else:
            i += 1
    runs = sorted(runs, key=lambda r: r[1] - r[0], reverse=True)[:count]
    return sorted(runs), start


def axis_map(runs, n, count, joint):
    """Ankerpunkte (Ziel -> Quelle, Quelle fortlaufend ohne Umbruch). Die Fuge naechst am Bildrand kommt nach 0."""
    def edge_distance(r):
        c = ((r[0] + r[1]) / 2) % n
        return min(c, n - c)
    wrap = min(runs, key=edge_distance)
    wa, wb = wrap
    cw = (wa + wb) / 2
    if cw < n / 2:          # Fuge liegt am linken Rand: auf das rechte Ende verschieben
        wa, wb, cw = wa + n, wb + n, cw + n
    # innere Fugen in fortlaufende Koordinaten zwischen (cw - n) und cw bringen
    inner = sorted((a, b) if a > cw - n else (a + n, b + n) for a, b in runs if (a, b) != wrap)
    dst = [0.0, joint / 2]
    src = [cw - n, wb - n]
    for k, (a, b) in enumerate(inner, start=1):
        t = k * n / count
        dst += [t - joint / 2, t + joint / 2]
        src += [a, b]
    dst += [n - joint / 2, float(n)]
    src += [wa, cw]
    return np.array(dst), np.array(src), 0.0


def main():
    p = argparse.ArgumentParser()
    p.add_argument("source")
    p.add_argument("target")
    p.add_argument("--count", type=int, default=4)
    p.add_argument("--joint", type=float, default=20)
    a = p.parse_args()
    im = np.asarray(Image.open(a.source).convert("RGB")).astype(np.float32)
    h, w, _ = im.shape
    lum = im.mean(axis=2)
    rx, _ = joints(lum.mean(axis=0), a.count)
    ry, _ = joints(lum.mean(axis=1), a.count)
    dx, sx, cx = axis_map(rx, w, a.count, a.joint)
    dy, sy, cy = axis_map(ry, h, a.count, a.joint)
    u = np.interp(np.arange(w) + 0.5, dx, sx) + cx
    v = np.interp(np.arange(h) + 0.5, dy, sy) + cy
    xs = np.mod(np.floor(u).astype(int), w)
    ys = np.mod(np.floor(v).astype(int), h)
    out = im[ys][:, xs]
    Image.fromarray(out.clip(0, 255).astype(np.uint8)).save(a.target)
    print("Fugen x:", rx, "Fugen y:", ry)


if __name__ == "__main__":
    main()
