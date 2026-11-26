# Baut die Fahrzeuge von Operation Y in Blender (eigene Entwürfe).
# Knoten: Hull, Turret, Barrel0..n, Muzzle0..n, Wheel0..n, Driver, Gunner. Blickrichtung -Y, oben Z.
# Aufruf: python vehicles.py <Zielordner>

import sys
import os
import math
import bpy

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from robots import reset, mats, prim, material  # noqa: E402

OUT = sys.argv[-1] if len(sys.argv) > 1 else '.'


def empty(name, loc, parent=None):
    bpy.ops.object.empty_add(location=loc)
    e = bpy.context.object
    e.name = name
    if parent:
        setp(e, parent)
    return e


def setp(obj, parent):
    bpy.context.view_layer.update()
    mw = obj.matrix_world.copy()
    obj.parent = parent
    bpy.context.view_layer.update()
    obj.matrix_world = mw


def P(parent, *a, **k):
    o = prim(*a, **k)
    setp(o, parent)
    return o


def tread_mat():
    m = material('Tread', (0.05, 0.05, 0.05), 0.4, 0.8)
    return m


def wheel(parent, name, loc, r, w, M):
    bpy.ops.mesh.primitive_cylinder_add(vertices=28, radius=r, depth=w, location=loc, rotation=(0, math.pi / 2, 0))
    o = bpy.context.object
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    o.name = name
    o.data.materials.append(M['rubber'])
    from robots import smooth
    smooth(o, r * 0.25, 3, 1)
    hub = prim('cyl', (r * 0.55, r * 0.55, w + 0.02), loc, (0, math.pi / 2, 0), mat=M['metal'], bevel=0.01, sub=0, verts=10)
    setp(hub, o)
    setp(o, parent)
    return o


def pilot(parent, loc, M, scale=1.0):
    # kleiner Roboterfahrer (Oberkörper und Helm), wird beim Fahrerabschuss ausgeblendet
    d = empty('Driver' if parent.name.startswith('Hull') else 'Gunner', loc, parent)
    s = scale
    o = prim('sph', (0.17 * s, 0.14 * s, 0.16 * s), (loc[0], loc[1], loc[2] + 0.12 * s), mat=M['armor'], verts=24)
    setp(o, d)
    o = prim('box', (0.3 * s, 0.1 * s, 0.14 * s), (loc[0], loc[1] - 0.12 * s, loc[2] + 0.12 * s), mat=M['team'], bevel=0.03)
    setp(o, d)
    o = prim('sph', (0.12 * s, 0.13 * s, 0.12 * s), (loc[0], loc[1], loc[2] + 0.38 * s), mat=M['armor'], verts=24)
    setp(o, d)
    o = prim('box', (0.15 * s, 0.04 * s, 0.035 * s), (loc[0], loc[1] - 0.11 * s, loc[2] + 0.38 * s), mat=M['glow'], bevel=0.012)
    setp(o, d)
    return d


def tracks(hull, L, H, W, X, M):
    for s in (1, -1):
        t = prim('box', (W, L, H), (X * s, 0, H / 2 + 0.02), mat=tread_mat(), bevel=min(W, H) * 0.3, sub=1)
        setp(t, hull)
        for i in range(5):
            y = -L / 2 + 0.25 + i * (L - 0.5) / 4
            r = prim('cyl', (H * 0.34, H * 0.34, W + 0.03), (X * s, y, H * 0.45), (0, math.pi / 2, 0), mat=M['metal'], bevel=0.01, sub=0, verts=16)
            setp(r, hull)
        g = prim('box', (W + 0.06, L * 0.9, 0.06), (X * s, 0, H + 0.04), mat=M['armor'], bevel=0.02)  # Kettenschutz
        setp(g, hull)


def build(kind):
    reset()
    M = mats()
    hull = empty('Hull', (0, 0, 0))
    wheels = 0
    if kind == 'buggy':
        P(hull, 'box', (1.1, 2.0, 0.32), (0, 0, 0.55), mat=M['armor'], bevel=0.1)
        P(hull, 'box', (0.95, 0.7, 0.2), (0, -0.62, 0.78), (-0.15, 0, 0), mat=M['team'], bevel=0.08)
        P(hull, 'box', (1.0, 0.06, 0.1), (0, -1.0, 0.6), mat=M['glow'], bevel=0.02)
        for x in (-0.42, 0.42):
            P(hull, 'cyl', (0.035, 0.035, 0.7), (x, 0.25, 1.05), mat=M['metal'], verts=12, sub=0)
        P(hull, 'cyl', (0.035, 0.035, 0.86), (0, 0.25, 1.4), (0, math.pi / 2, 0), mat=M['metal'], verts=12, sub=0)
        for i, (x, y) in enumerate(((0.6, -0.65), (-0.6, -0.65), (0.6, 0.65), (-0.6, 0.65))):
            wheel(hull, f'Wheel{i}', (x, y, 0.33), 0.33, 0.28, M)
        wheels = 4
        pilot(hull, (0.18, -0.1, 0.7), M)
        tur = empty('Turret', (0, 0.35, 0.95), hull)
        P(tur, 'cyl', (0.16, 0.16, 0.12), (0, 0.35, 0.97), mat=M['dark'], verts=20)
        b = empty('Barrel0', (0, 0.25, 1.1), tur)
        P(b, 'box', (0.13, 0.42, 0.14), (0, 0.15, 1.1), mat=M['metal'], bevel=0.03)
        P(b, 'cyl', (0.03, 0.03, 0.45), (0, -0.25, 1.11), (math.pi / 2, 0, 0), mat=M['dark'], verts=12, sub=0)
        empty('Muzzle0', (0, -0.5, 1.11), b)
        g = pilot(tur, (0, 0.62, 0.92), M, 0.9)
        g.name = 'Gunner'
    elif kind in ('lighttank', 'mediumtank', 'heavytank'):
        sc = {'lighttank': 1.0, 'mediumtank': 1.15, 'heavytank': 1.3}[kind]
        L, W = 2.3 * sc, 1.25 * sc
        tracks(hull, L * 1.04, 0.5 * sc, 0.4 * sc, W / 2 + 0.05, M)
        P(hull, 'box', (W, L * 0.95, 0.42 * sc), (0, 0, 0.7 * sc), mat=M['armor'], bevel=0.12)
        P(hull, 'box', (W * 0.9, 0.5 * sc, 0.25 * sc), (0, -L * 0.42, 0.78 * sc), (0.5, 0, 0), mat=M['team'], bevel=0.08)
        P(hull, 'box', (W * 0.8, 0.05, 0.07), (0, -L * 0.48, 0.72 * sc), mat=M['glow'], bevel=0.02)
        if kind != 'lighttank':
            for s in (1, -1):
                P(hull, 'box', (0.07, L * 0.85, 0.3 * sc), ((W / 2 + 0.3 * sc) * s, 0, 0.45 * sc), mat=M['team'], bevel=0.03)
        pilot(hull, (W * 0.25, -L * 0.3, 0.86 * sc), M, 0.85)
        P(hull, 'cyl', (0.2 * sc, 0.2 * sc, 0.08), (W * 0.25, -L * 0.3, 0.92 * sc), mat=M['dark'], verts=20)  # Fahrerluke
        tur = empty('Turret', (0, 0.1 * sc, 1.05 * sc), hull)
        P(tur, 'box', (0.95 * sc, 1.0 * sc, 0.36 * sc), (0, 0.1 * sc, 1.08 * sc), mat=M['armor'], bevel=0.14)
        P(tur, 'cyl', (0.14 * sc, 0.14 * sc, 0.1), (-0.25 * sc, 0.25 * sc, 1.3 * sc), mat=M['dark'], verts=20)  # Luke
        P(tur, 'box', (0.9 * sc, 0.06, 0.05), (0, -0.42 * sc, 1.18 * sc), mat=M['team'], bevel=0.02)
        n = 2 if kind == 'heavytank' else 1
        for i in range(n):
            x = (i - (n - 1) / 2) * 0.32 * sc
            b = empty(f'Barrel{i}', (x, -0.35 * sc, 1.1 * sc), tur)
            ln = 1.3 * sc
            P(b, 'cyl', (0.075 * sc, 0.085 * sc, ln), (x, -0.35 * sc - ln / 2, 1.1 * sc), (math.pi / 2, 0, 0), mat=M['metal'], bevel=0.01, verts=20)
            P(b, 'cyl', (0.11 * sc, 0.11 * sc, 0.2), (x, -0.35 * sc - ln, 1.1 * sc), (math.pi / 2, 0, 0), mat=M['dark'], bevel=0.02, verts=20)
            empty(f'Muzzle{i}', (x, -0.45 * sc - ln, 1.1 * sc), b)
    elif kind == 'launcher':
        P(hull, 'box', (1.2, 2.3, 0.3), (0, 0, 0.55), mat=M['dark'], bevel=0.06)
        P(hull, 'box', (1.15, 0.8, 0.65), (0, -0.78, 1.0), mat=M['armor'], bevel=0.12)
        P(hull, 'box', (1.0, 0.06, 0.3), (0, -1.19, 1.12), mat=M['dark'], bevel=0.03)  # Scheibe
        P(hull, 'box', (1.0, 0.06, 0.06), (0, -1.2, 0.78), mat=M['glow'], bevel=0.02)
        for i, (x, y) in enumerate(((0.62, -0.8), (-0.62, -0.8), (0.62, 0.15), (-0.62, 0.15), (0.62, 0.85), (-0.62, 0.85))):
            wheel(hull, f'Wheel{i}', (x, y, 0.31), 0.31, 0.25, M)
        wheels = 6
        pilot(hull, (0.25, -0.85, 0.95), M, 0.8)
        tur = empty('Turret', (0, 0.45, 0.85), hull)
        P(tur, 'cyl', (0.32, 0.32, 0.14), (0, 0.45, 0.82), mat=M['metal'], verts=24)
        b = empty('Barrel0', (0, 0.45, 1.15), tur)
        pod = P(b, 'box', (0.95, 1.2, 0.5), (0, 0.35, 1.25), (-0.35, 0, 0), mat=M['team'], bevel=0.08)
        void = pod
        for yy in (0.12, -0.12):
            for xx in (0.22, -0.22):
                P(b, 'cyl', (0.09, 0.09, 0.05), (xx, -0.22, 1.47 + yy), (math.pi / 2 - 0.35, 0, 0), mat=M['glow'], verts=16, sub=0)
        empty('Muzzle0', (0, -0.3, 1.5), b)
    path = f'{OUT}/vehicle_{kind}.glb'
    bpy.ops.export_scene.gltf(filepath=path, export_format='GLB', export_apply=True, export_yup=True,
                              export_animations=False, export_texcoords=True, export_cameras=False, export_lights=False)
    return path


if __name__ == '__main__':
    for k in ('buggy', 'lighttank', 'mediumtank', 'heavytank', 'launcher'):
        print('exported', build(k))
