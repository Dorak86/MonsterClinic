# Baut die Fahrzeuge von Operation Y in Blender nach dem Konzeptblatt des Auftraggebers:
# durchgehend teamfarben lackiert, schräge Panzerplatten, Nieten, kräftige Laufrollen, Lkw mit Ladung.
# Knoten: Hull, Turret, Barrel0..n, Muzzle0..n, Wheel0..n, Driver. Blickrichtung -Y, oben Z.
# Aufruf: python vehicles.py <Zielordner>

import sys
import os
import math
import bpy

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from robots import reset, mats, prim, material, smooth  # noqa: E402

OUT = sys.argv[-1] if len(sys.argv) > 1 else '.'


def setp(obj, parent):
    bpy.context.view_layer.update()
    mw = obj.matrix_world.copy()
    obj.parent = parent
    bpy.context.view_layer.update()
    obj.matrix_world = mw


def empty(name, loc, parent=None):
    bpy.ops.object.empty_add(location=loc)
    e = bpy.context.object
    e.name = name
    if parent:
        setp(e, parent)
    return e


def P(parent, *a, **k):
    o = prim(*a, **k)
    setp(o, parent)
    return o


def plate(parent, size, loc, rot, mat, bevel=0.03):
    # Panzerplatte: Fase ohne Unterteilung -> kantig, aber nicht scharf
    return P(parent, 'box', size, loc, rot, mat=mat, bevel=bevel, sub=0)


def rivets(parent, M, a, b, n, r=0.022):
    for i in range(n):
        t = (i + 0.5) / n
        loc = tuple(a[k] + (b[k] - a[k]) * t for k in range(3))
        P(parent, 'sph', (r, r, r * 0.6), loc, mat=M['metal'], verts=8, sub=0)


def wheel(parent, name, loc, r, w, M, rim='metal'):
    bpy.ops.mesh.primitive_cylinder_add(vertices=24, radius=r, depth=w, location=loc, rotation=(0, math.pi / 2, 0))
    o = bpy.context.object
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    o.name = name
    o.data.materials.append(M['rubber'])
    smooth(o, r * 0.22, 3, 1)
    hub = prim('cyl', (r * 0.55, r * 0.55, w + 0.02), loc, (0, math.pi / 2, 0), mat=M[rim], bevel=0.015, sub=0, verts=12)
    setp(hub, o)
    for k in range(5):  # Radmuttern
        a = k / 5 * math.pi * 2
        nut = prim('cyl', (0.025, 0.025, w + 0.05), (loc[0], loc[1] + math.cos(a) * r * 0.32, loc[2] + math.sin(a) * r * 0.32), (0, math.pi / 2, 0), mat=M['dark'], bevel=0, sub=0, verts=6)
        setp(nut, o)
    setp(o, parent)
    return o


def commander(parent, loc, M, s=0.8):
    # Roboter-Kommandant in der Luke (wird beim Fahrerabschuss ausgeblendet)
    d = empty('Driver', loc, parent)
    P(d, 'cyl', (0.16 * s, 0.16 * s, 0.06), (loc[0], loc[1], loc[2] - 0.02), mat=M['dark'], verts=20)
    P(d, 'sph', (0.16 * s, 0.13 * s, 0.15 * s), (loc[0], loc[1], loc[2] + 0.1 * s), mat=M['armor'], verts=20)
    P(d, 'sph', (0.12 * s, 0.13 * s, 0.12 * s), (loc[0], loc[1], loc[2] + 0.33 * s), mat=M['armor'], verts=20)
    P(d, 'box', (0.15 * s, 0.04 * s, 0.035 * s), (loc[0], loc[1] - 0.11 * s, loc[2] + 0.33 * s), mat=M['glow'], bevel=0.012)
    return d


def running_gear(hull, M, L, X, R, n, h0):
    # Laufwerk: Kette, Laufrollen, Treib- und Leitrad, Kettenschutz
    tread = material('Tread', (0.06, 0.055, 0.05), 0.5, 0.8)
    for s in (1, -1):
        x = X * s
        belt = P(hull, 'box', (0.36, L, R * 2 + 0.12), (x, 0, h0), mat=tread, bevel=R * 0.85, sub=1)
        for i in range(n):
            y = -L / 2 + R + 0.1 + i * (L - 2 * R - 0.2) / (n - 1)
            P(hull, 'cyl', (R, R, 0.3), (x * 1.02, y, h0 - 0.02), (0, math.pi / 2, 0), mat=M['dark'], bevel=0.02, sub=0, verts=16)
            P(hull, 'cyl', (R * 0.45, R * 0.45, 0.34), (x * 1.03, y, h0 - 0.02), (0, math.pi / 2, 0), mat=M['metal'], bevel=0.01, sub=0, verts=10)
        for y in (-L / 2 + 0.12, L / 2 - 0.12):
            P(hull, 'cyl', (R * 0.8, R * 0.8, 0.32), (x * 1.02, y, h0 + 0.12), (0, math.pi / 2, 0), mat=M['metal'], bevel=0.02, sub=0, verts=12)
        void = belt


def truck_base(hull, M, L=2.6):
    # Allrad-Lkw: Rahmen, Kabine mit Kühlergrill, Kotflügel, drei Achsen
    paint = M['team']
    plate(hull, (1.0, L, 0.22), (0, 0.1, 0.62), (0, 0, 0), M['dark'])
    cab = (0, -L / 2 + 0.45, 1.05)
    P(hull, 'box', (1.2, 0.85, 0.75), cab, mat=paint, bevel=0.1)
    P(hull, 'box', (1.12, 0.62, 0.32), (0, cab[1] - 0.48, 0.82), mat=paint, bevel=0.08)  # Motorhaube
    P(hull, 'box', (1.0, 0.05, 0.28), (0, cab[1] - 0.43, 1.22), (-0.15, 0, 0), mat=M['dark'], bevel=0.02)  # Scheibe
    for sx in (0.3, -0.3):
        P(hull, 'box', (0.32, 0.05, 0.22), (sx, cab[1] - 0.43, 1.22), (-0.15, 0, 0), mat=M['metal'], bevel=0.01, sub=0)
    grille = cab[1] - 0.8
    P(hull, 'box', (0.8, 0.06, 0.32), (0, grille, 0.8), mat=M['dark'], bevel=0.02, sub=0)
    for k in range(6):
        P(hull, 'box', (0.04, 0.07, 0.3), (-0.3 + k * 0.12, grille - 0.01, 0.8), mat=M['metal'], bevel=0.005, sub=0)
    P(hull, 'box', (1.25, 0.12, 0.12), (0, grille - 0.05, 0.6), mat=M['metal'], bevel=0.03)  # Stoßstange
    for sx in (0.42, -0.42):
        P(hull, 'cyl', (0.07, 0.07, 0.05), (sx, grille - 0.02, 0.95), (math.pi / 2, 0, 0), mat=M['glow'], verts=16, sub=0)
        P(hull, 'cyl', (0.045, 0.045, 0.9), (sx * 1.45, cab[1] + 0.3, 1.4), mat=M['metal'], verts=12, sub=0)  # Auspuff
    wheels = []
    for i, y in enumerate((cab[1] - 0.25, L / 2 - 0.75, L / 2 - 0.15)):
        for j, x in enumerate((0.63, -0.63)):
            wheels.append(wheel(hull, f'Wheel{len(wheels)}', (x, y, 0.38), 0.38, 0.3, M))
        P(hull, 'box', (1.45, 0.6, 0.06), (0, y, 0.82), mat=M['dark'], bevel=0.02, sub=0)  # Kotflügel
    return cab


def build(kind):
    reset()
    M = mats()
    weather = material('Team', (0.55, 0.12, 0.08), 0.35, 0.45)
    void = weather
    hull = empty('Hull', (0, 0, 0))
    paint, dark = M['team'], M['dark']
    if kind == 'buggy':
        P(hull, 'box', (1.15, 2.0, 0.3), (0, 0, 0.55), mat=paint, bevel=0.09)
        P(hull, 'box', (1.0, 0.75, 0.2), (0, -0.62, 0.77), (-0.15, 0, 0), mat=paint, bevel=0.07)
        P(hull, 'box', (1.05, 0.08, 0.12), (0, -1.0, 0.55), mat=M['metal'], bevel=0.03)
        for sx in (0.35, -0.35):
            P(hull, 'cyl', (0.06, 0.06, 0.04), (sx, -1.03, 0.66), (math.pi / 2, 0, 0), mat=M['glow'], verts=14, sub=0)
        for x in (-0.42, 0.42):
            P(hull, 'cyl', (0.035, 0.035, 0.7), (x, 0.25, 1.0), mat=M['metal'], verts=10, sub=0)
        P(hull, 'cyl', (0.035, 0.035, 0.86), (0, 0.25, 1.35), (0, math.pi / 2, 0), mat=M['metal'], verts=10, sub=0)
        for i, (x, y) in enumerate(((0.62, -0.65), (-0.62, -0.65), (0.62, 0.65), (-0.62, 0.65))):
            wheel(hull, f'Wheel{i}', (x, y, 0.34), 0.34, 0.3, M)
        commander(hull, (0.2, -0.1, 0.7), M, 0.85)
        tur = empty('Turret', (0, 0.35, 0.95), hull)
        P(tur, 'cyl', (0.16, 0.16, 0.12), (0, 0.35, 0.97), mat=dark, verts=18)
        b = empty('Barrel0', (0, 0.25, 1.1), tur)
        P(b, 'box', (0.13, 0.42, 0.14), (0, 0.15, 1.1), mat=M['metal'], bevel=0.03)
        P(b, 'cyl', (0.03, 0.03, 0.45), (0, -0.25, 1.11), (math.pi / 2, 0, 0), mat=dark, verts=10, sub=0)
        empty('Muzzle0', (0, -0.5, 1.11), b)
    elif kind == 'lighttank':
        L = 2.3
        running_gear(hull, M, L, 0.55, 0.17, 5, 0.3)
        plate(hull, (1.0, L * 0.92, 0.38), (0, 0.05, 0.72), (0, 0, 0), paint, 0.05)
        plate(hull, (1.0, 0.5, 0.06), (0, -L * 0.45, 0.78), (0.6, 0, 0), paint)  # Bugplatte
        for s in (1, -1):
            plate(hull, (0.36, L * 0.95, 0.05), (0.55 * s, 0, 0.62), (0, 0, 0), paint)  # Kettenabdeckung
            rivets(hull, M, (0.51 * s, -L * 0.42, 0.85), (0.51 * s, L * 0.45, 0.85), 8)
        commander(hull, (0.28, -0.55, 0.9), M, 0.7)
        tur = empty('Turret', (0, 0.05, 0.92), hull)
        P(tur, 'cyl', (0.42, 0.46, 0.38), (0, 0.05, 1.1), mat=paint, bevel=0.05, sub=0, verts=8)
        P(tur, 'cyl', (0.14, 0.14, 0.1), (0.12, 0.2, 1.33), mat=dark, verts=16)
        rivets(tur, M, (-0.38, -0.2, 1.2), (0.38, -0.2, 1.2), 6)
        b = empty('Barrel0', (0, -0.38, 1.1), tur)
        P(b, 'box', (0.24, 0.16, 0.2), (0, -0.42, 1.1), mat=paint, bevel=0.03, sub=0)
        P(b, 'cyl', (0.055, 0.06, 0.7), (0, -0.85, 1.1), (math.pi / 2, 0, 0), mat=M['metal'], verts=16, sub=0)
        empty('Muzzle0', (0, -1.22, 1.1), b)
    elif kind == 'mediumtank':
        L = 2.75
        running_gear(hull, M, L, 0.68, 0.2, 6, 0.34)
        plate(hull, (1.3, L * 0.9, 0.42), (0, 0.05, 0.82), (0, 0, 0), paint, 0.05)
        plate(hull, (1.3, 0.62, 0.06), (0, -L * 0.45, 0.86), (0.65, 0, 0), paint)
        plate(hull, (1.3, 0.4, 0.06), (0, L * 0.46, 0.92), (-0.5, 0, 0), paint)
        for s in (1, -1):
            plate(hull, (0.4, L * 0.96, 0.06), (0.68 * s, 0, 0.72), (0, 0, 0), paint)
            for k in range(3):  # Staukisten
                plate(hull, (0.22, 0.4, 0.2), (0.74 * s, -0.6 + k * 0.6, 0.88), (0, 0, 0), dark, 0.02)
            rivets(hull, M, (0.62 * s, -L * 0.42, 1.0), (0.62 * s, L * 0.44, 1.0), 10)
        commander(hull, (0.35, -0.7, 1.05), M, 0.7)
        tur = empty('Turret', (0, 0.1, 1.05), hull)
        plate(tur, (0.95, 1.1, 0.4), (0, 0.15, 1.25), (0, 0, 0), paint, 0.08)
        plate(tur, (0.85, 0.35, 0.06), (0, -0.48, 1.25), (0.7, 0, 0), paint)
        P(tur, 'cyl', (0.16, 0.18, 0.14), (-0.22, 0.35, 1.52), mat=paint, verts=16, bevel=0.03, sub=0)
        P(tur, 'cyl', (0.008, 0.008, 0.6), (0.3, 0.55, 1.75), mat=M['metal'], verts=6, sub=0)
        rivets(tur, M, (-0.45, -0.3, 1.38), (-0.45, 0.6, 1.38), 6)
        rivets(tur, M, (0.45, -0.3, 1.38), (0.45, 0.6, 1.38), 6)
        b = empty('Barrel0', (0, -0.45, 1.22), tur)
        P(b, 'box', (0.34, 0.22, 0.28), (0, -0.52, 1.22), mat=paint, bevel=0.04, sub=0)  # Blende
        P(b, 'cyl', (0.07, 0.075, 1.3), (0, -1.25, 1.22), (math.pi / 2, 0, 0), mat=M['metal'], verts=18, sub=0)
        P(b, 'box', (0.2, 0.18, 0.14), (0, -1.92, 1.22), mat=dark, bevel=0.02, sub=0)  # Mündungsbremse
        empty('Muzzle0', (0, -2.02, 1.22), b)
    elif kind == 'heavytank':
        L = 3.2
        running_gear(hull, M, L, 0.82, 0.22, 7, 0.38)
        plate(hull, (1.55, L * 0.9, 0.55), (0, 0.05, 0.98), (0, 0, 0), paint, 0.06)
        plate(hull, (1.55, 0.75, 0.07), (0, -L * 0.45, 1.0), (0.7, 0, 0), paint)
        for s in (1, -1):
            plate(hull, (0.08, L * 0.92, 0.55), (0.96 * s, 0, 0.62), (0, 0, 0), paint)  # Seitenschürze
            rivets(hull, M, (1.0 * s, -L * 0.42, 0.85), (1.0 * s, L * 0.44, 0.85), 12)
            rivets(hull, M, (1.0 * s, -L * 0.42, 0.45), (1.0 * s, L * 0.44, 0.45), 12)
            plate(hull, (0.4, 0.5, 0.35), (0.6 * s, L * 0.38, 1.35), (0, 0, 0), dark, 0.03)
        commander(hull, (0.45, -0.95, 1.25), M, 0.75)
        tur = empty('Turret', (0, 0.15, 1.28), hull)
        plate(tur, (1.25, 1.35, 0.55), (0, 0.2, 1.55), (0, 0, 0), paint, 0.09)
        plate(tur, (1.1, 0.45, 0.07), (0, -0.55, 1.55), (0.75, 0, 0), paint)
        P(tur, 'box', (0.4, 0.35, 0.28), (-0.25, 0.4, 1.95), mat=paint, bevel=0.04, sub=0)
        P(tur, 'box', (0.12, 0.04, 0.08), (-0.25, 0.22, 1.98), mat=M['glow'], bevel=0.01, sub=0)
        rivets(tur, M, (-0.62, -0.35, 1.7), (-0.62, 0.8, 1.7), 7)
        rivets(tur, M, (0.62, -0.35, 1.7), (0.62, 0.8, 1.7), 7)
        # Gatling-Kanone: Barrel0 dreht sich beim Feuern um die Rohrachse
        b = empty('Barrel0', (0, -0.6, 1.5), tur)
        P(b, 'cyl', (0.24, 0.26, 0.45), (0, -0.85, 1.5), (math.pi / 2, 0, 0), mat=dark, verts=18, bevel=0.03, sub=0)
        for k in range(6):
            a = k / 6 * math.pi * 2
            P(b, 'cyl', (0.045, 0.045, 1.2), (math.cos(a) * 0.14, -1.5, 1.5 + math.sin(a) * 0.14), (math.pi / 2, 0, 0), mat=M['metal'], verts=10, sub=0)
        P(b, 'cyl', (0.22, 0.22, 0.08), (0, -1.95, 1.5), (math.pi / 2, 0, 0), mat=dark, verts=18, sub=0)
        P(b, 'cyl', (0.22, 0.22, 0.06), (0, -1.3, 1.5), (math.pi / 2, 0, 0), mat=dark, verts=18, sub=0)
        empty('Muzzle0', (0, -2.1, 1.5), b)
    elif kind in ('launcher', 'transporter', 'fueltruck'):
        cab = truck_base(hull, M)
        commander(hull, (0.28, cab[1] + 0.05, 1.32), M, 0.7)
        bed_y = 0.55
        if kind == 'transporter':
            # Ladefläche mit Gitterkäfig und Kisten
            plate(hull, (1.25, 1.65, 0.1), (0, bed_y, 0.82), (0, 0, 0), dark)
            for x in (-0.6, 0.6):
                for y in (bed_y - 0.78, bed_y, bed_y + 0.78):
                    P(hull, 'box', (0.06, 0.06, 0.7), (x, y, 1.2), mat=M['metal'], bevel=0.01, sub=0)
                P(hull, 'box', (0.06, 1.62, 0.06), (x, bed_y, 1.53), mat=M['metal'], bevel=0.01, sub=0)
                P(hull, 'box', (0.06, 1.62, 0.06), (x, bed_y, 1.15), mat=M['metal'], bevel=0.01, sub=0)
            crate = [material('CrateOlive', (0.25, 0.3, 0.14), 0.0, 0.8), material('CrateTan', (0.5, 0.4, 0.22), 0.0, 0.8),
                     material('CrateRed', (0.4, 0.1, 0.07), 0.2, 0.6)]
            k = 0
            for x in (-0.28, 0.28):
                for y in (bed_y - 0.5, bed_y + 0.05, bed_y + 0.55):
                    h = 0.3 + (k % 3) * 0.08
                    P(hull, 'box', (0.48, 0.48, h), (x, y, 0.87 + h / 2), mat=crate[k % 3], bevel=0.02, sub=0)
                    if k % 2 == 0:
                        P(hull, 'box', (0.36, 0.36, 0.22), (x, y, 0.87 + h + 0.11), mat=crate[(k + 1) % 3], bevel=0.02, sub=0)
                    k += 1
            P(hull, 'cyl', (0.16, 0.16, 0.5), (0.5, bed_y + 0.95, 0.65), (0, math.pi / 2, 0), mat=M['metal'], verts=14, sub=0)
            tur = empty('Turret', (0, cab[1] + 0.1, 1.5), hull)
            P(tur, 'cyl', (0.14, 0.14, 0.1), (0, cab[1] + 0.1, 1.48), mat=dark, verts=16)
            b = empty('Barrel0', (0, cab[1], 1.6), tur)
            P(b, 'box', (0.1, 0.36, 0.12), (0, cab[1] - 0.05, 1.6), mat=M['metal'], bevel=0.02, sub=0)
            P(b, 'cyl', (0.025, 0.025, 0.4), (0, cab[1] - 0.4, 1.61), (math.pi / 2, 0, 0), mat=dark, verts=10, sub=0)
            empty('Muzzle0', (0, cab[1] - 0.62, 1.61), b)
        elif kind == 'fueltruck':
            # Batterie-Lkw: Gestell mit großen Akkuzellen, Ladeanzeigen und Kabelpeitsche
            charge = material('Charge', (0.02, 0.08, 0.04), 0.0, 0.3, (0.35, 1.0, 0.5), 4.0)
            plate(hull, (1.25, 1.65, 0.1), (0, bed_y, 0.82), (0, 0, 0), dark)
            for x in (-0.3, 0.3):
                for y in (bed_y - 0.5, bed_y + 0.05, bed_y + 0.6):
                    P(hull, 'box', (0.5, 0.48, 0.62), (x, y, 1.2), mat=paint, bevel=0.05, sub=0)
                    P(hull, 'box', (0.04, 0.3, 0.42), (x + (0.26 if x > 0 else -0.26), y, 1.2), mat=charge, bevel=0.01, sub=0)
                    for t in (-0.1, 0.1):
                        P(hull, 'cyl', (0.04, 0.04, 0.08), (x + t, y, 1.55), mat=M['metal'], verts=8, sub=0)
            for x in (-0.62, 0.62):
                P(hull, 'box', (0.05, 1.7, 0.05), (x, bed_y, 1.55), mat=M['metal'], bevel=0.01, sub=0)
            P(hull, 'box', (0.9, 0.03, 0.22), (0, bed_y + 0.86, 1.1), mat=charge, bevel=0.01, sub=0)
            P(hull, 'cyl', (0.025, 0.025, 1.3), (0.5, bed_y + 0.9, 1.0), (0.4, 0, 0), mat=dark, verts=8, sub=0)
            empty('Turret', (0, bed_y, 1.3), hull)
        else:  # Raketenwerfer auf Lkw-Fahrgestell
            plate(hull, (1.25, 1.65, 0.1), (0, bed_y, 0.82), (0, 0, 0), dark)
            tur = empty('Turret', (0, bed_y + 0.2, 0.9), hull)
            P(tur, 'cyl', (0.36, 0.36, 0.14), (0, bed_y + 0.2, 0.95), mat=M['metal'], verts=20, sub=0)
            b = empty('Barrel0', (0, bed_y + 0.2, 1.25), tur)
            P(b, 'box', (1.0, 1.3, 0.55), (0, bed_y + 0.15, 1.35), (-0.35, 0, 0), mat=paint, bevel=0.06, sub=0)
            rivets(b, M, (-0.5, bed_y - 0.4, 1.5), (-0.5, bed_y + 0.6, 1.2), 6)
            rivets(b, M, (0.5, bed_y - 0.4, 1.5), (0.5, bed_y + 0.6, 1.2), 6)
            for zz in (0.13, -0.13):
                for xx in (0.3, 0.1, -0.1, -0.3):
                    P(b, 'cyl', (0.07, 0.07, 0.05), (xx, bed_y - 0.47, 1.57 + zz), (math.pi / 2 - 0.35, 0, 0), mat=M['glow'], verts=12, sub=0)
            empty('Muzzle0', (0, bed_y - 0.55, 1.6), b)
    path = f'{OUT}/vehicle_{kind}.glb'
    bpy.ops.export_scene.gltf(filepath=path, export_format='GLB', export_apply=True, export_yup=True,
                              export_animations=False, export_texcoords=True, export_cameras=False, export_lights=False)
    return path


if __name__ == '__main__':
    for k in ('buggy', 'lighttank', 'mediumtank', 'heavytank', 'launcher', 'transporter', 'fueltruck'):
        print('exported', build(k))
