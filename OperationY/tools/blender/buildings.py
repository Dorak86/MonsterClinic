# Baut die Gebäude von Operation Y in Blender nach dem Konzeptblatt des Auftraggebers.
# Ursprung = Mitte der Grundfläche am Boden, Tor/Front zeigt nach -Y (im Spiel nach Süden).
# Knoten: Turret, Barrel0..n, Muzzle0..n, Spin, Belt, Chimney0..n.
# Aufruf: python buildings.py <Zielordner>

import sys
import os
import math
import bpy

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from robots import reset, mats, material  # noqa: E402
from vehicles import P, plate, rivets, empty  # noqa: E402

OUT = sys.argv[-1] if len(sys.argv) > 1 else '.'


def extra():
    return {
        'amber': material('Amber', (0.1, 0.05, 0.0), 0.0, 0.4, (1.0, 0.55, 0.12), 6.0),
        'hazard': material('Hazard', (0.75, 0.55, 0.08), 0.2, 0.6),
        'concrete': material('Concrete', (0.36, 0.35, 0.33), 0.0, 0.9),
        'tread': material('Tread', (0.06, 0.055, 0.05), 0.5, 0.8),
        'energy': material('Energy', (0.02, 0.08, 0.1), 0.0, 0.3, (0.3, 0.9, 1.0), 5.0),
        'char': material('Char', (0.05, 0.045, 0.04), 0.0, 0.95),
        'rubble': material('Rubble', (0.28, 0.26, 0.24), 0.0, 0.95),
    }


def coil(root, M, X, x, y, z, h=1.4, r=0.32):
    # Generatorspule: Sockel, gewickelte Leuchtringe, Kugelkopf
    P(root, 'cyl', (r * 1.3, r * 1.4, 0.3), (x, y, z + 0.15), mat=M['dark'], verts=16, sub=0)
    P(root, 'cyl', (r * 0.6, r * 0.6, h), (x, y, z + 0.3 + h / 2), mat=M['metal'], verts=16, sub=0)
    for k in range(5):
        P(root, 'torus', (r, 0.05), (x, y, z + 0.45 + k * h / 5.5), mat=X['energy'])
    P(root, 'sph', (r * 0.75, r * 0.75, r * 0.75), (x, y, z + 0.45 + h), mat=X['energy'], verts=20)


def hangar(root, M, X, W, D, H):
    # Werkhalle: wuchtiger Baukörper mit gefasten Kanten, Dachaufbau, Tunneltor mit Förderband
    team, dark = M['team'], M['dark']
    plate(root, (W + 0.3, D + 0.3, 0.25), (0, 0, 0.12), (0, 0, 0), X['concrete'], 0.04)
    plate(root, (W, D, H), (0, 0.1, H / 2 + 0.2), (0, 0, 0), team, 0.35)
    plate(root, (W * 0.78, D * 0.7, 0.55), (0, 0.25, H + 0.45), (0, 0, 0), team, 0.18)
    for k in range(3):  # Lüftungsgitter
        x = (k - 1) * W * 0.24
        plate(root, (W * 0.18, D * 0.3, 0.22), (x, 0.4, H + 0.82), (0, 0, 0), dark, 0.04)
        for j in range(4):
            plate(root, (W * 0.16, 0.03, 0.04), (x, 0.4 - D * 0.12 + j * D * 0.08, H + 0.95), (0, 0, 0), M['metal'], 0.005)
    # Strebepfeiler mit Nieten
    for s in (1, -1):
        for y in (-D * 0.3, D * 0.3):
            plate(root, (0.35, 0.6, H * 0.85), (s * (W / 2 + 0.1), y, H * 0.45), (0, s * 0.18, 0), team, 0.06)
            rivets(root, M, (s * (W / 2 + 0.25), y - 0.25, H * 0.75), (s * (W / 2 + 0.25), y + 0.25, H * 0.75), 4)
        P(root, 'cyl', (0.09, 0.09, D * 0.8), (s * (W / 2 + 0.05), 0.2, H * 0.35), (math.pi / 2, 0, 0), mat=M['metal'], verts=12, sub=0)
    # Tunneltor vorn (-Y)
    fy = -D / 2 + 0.1
    plate(root, (W * 0.6, 0.6, H * 0.8), (0, fy - 0.05, H * 0.42), (0, 0, 0), dark, 0.05)
    plate(root, (W * 0.7, 0.4, 0.35), (0, fy - 0.2, H * 0.86), (0, 0, 0), team, 0.08)
    for s in (1, -1):
        plate(root, (0.3, 0.45, H * 0.8), (s * W * 0.34, fy - 0.15, H * 0.42), (0, 0, 0), team, 0.06)
        P(root, 'cyl', (0.09, 0.09, 0.06), (s * W * 0.34, fy - 0.4, H * 0.92), (math.pi / 2, 0, 0), mat=X['amber'], verts=14, sub=0)
        plate(root, (0.4, 0.06, 0.5), (s * W * 0.42, fy - 0.35, H * 0.35), (0, 0, 0), dark, 0.02)  # Wartungsklappen
    for k in range(6):  # Warnstreifen am Torrahmen
        plate(root, (W * 0.08, 0.05, 0.1), (-W * 0.25 + k * W * 0.1, fy - 0.42, H * 0.72), (0, 0.6, 0), X['hazard'], 0.005)
    belt = P(root, 'box', (W * 0.5, 1.6, 0.12), (0, fy - 0.6, 0.28), mat=X['tread'], bevel=0.05, sub=0)
    belt.name = 'Belt'
    for k in range(5):
        P(root, 'cyl', (0.07, 0.07, W * 0.52), (0, fy - 1.3 + k * 0.35, 0.2), (0, math.pi / 2, 0), mat=M['metal'], verts=10, sub=0)
    empty('Chimney0', (W * 0.3, D * 0.3, H + 1.0), root)


def export(path):
    bpy.ops.export_scene.gltf(filepath=path, export_format='GLB', export_apply=True, export_yup=True,
                              export_animations=False, export_texcoords=True, export_cameras=False, export_lights=False)


def build(kind):
    reset()
    M = mats()
    X = extra()
    root = empty('Building', (0, 0, 0))
    team, dark = M['team'], M['dark']
    if kind == 'vehicle':
        hangar(root, M, X, 5.4, 5.2, 2.5)
    elif kind == 'robot':
        hangar(root, M, X, 5.4, 3.4, 2.0)
    elif kind == 'radar':
        plate(root, (1.95, 1.95, 0.35), (0, 0, 0.18), (0, 0, 0), X['concrete'], 0.05)
        plate(root, (1.5, 1.5, 0.55), (0, 0, 0.6), (0, 0, 0), team, 0.12)
        plate(root, (0.5, 0.1, 0.45), (0, -0.78, 0.55), (0, 0, 0), dark, 0.03)
        for sx in (1, -1):
            for sy in (1, -1):
                leg = P(root, 'cyl', (0.06, 0.08, 2.4), (sx * 0.45, sy * 0.45, 2.05), (sy * 0.17, -sx * 0.17, 0), mat=team, verts=10, sub=0)
                void = leg
        for z in (1.4, 2.2):
            for r in (0, math.pi / 2):
                P(root, 'box', (0.95 - (z - 1.4) * 0.2, 0.05, 0.05), (0, 0, z), (0, 0, r), mat=M['metal'], bevel=0.01, sub=0)
        plate(root, (1.0, 1.0, 0.2), (0, 0, 3.3), (0, 0, 0), team, 0.05)
        plate(root, (0.3, 0.25, 0.3), (0.4, -0.35, 3.55), (0, 0, 0), dark, 0.03)
        P(root, 'cyl', (0.01, 0.01, 0.9), (-0.4, 0.4, 3.8), mat=M['metal'], verts=6, sub=0)
        spin = empty('Spin', (0, 0, 3.5), root)
        P(spin, 'cyl', (0.22, 0.22, 0.35), (0, 0, 3.6), mat=dark, verts=16, sub=0)
        bpy.ops.mesh.primitive_cone_add(vertices=32, radius1=1.15, radius2=0.18, depth=0.45, location=(0, -0.35, 4.15), rotation=(math.radians(-55), 0, 0))
        dish = bpy.context.object
        dish.data.materials.append(M['metal'])
        for p in dish.data.polygons:
            p.use_smooth = True
        mod = dish.modifiers.new('S', 'SOLIDIFY')
        mod.thickness = 0.04
        bpy.context.view_layer.update()
        from vehicles import setp
        setp(dish, spin)
        P(spin, 'cyl', (0.025, 0.025, 0.9), (0, -0.75, 4.45), (math.radians(35), 0, 0), mat=M['metal'], verts=8, sub=0)
        P(spin, 'sph', (0.07, 0.07, 0.07), (0, -1.1, 4.7), mat=M['glow'], verts=12)
        for s in (1, -1):
            plate(spin, (0.12, 0.35, 0.5), (s * 0.95, 0.1, 4.0), (0, 0, 0), team, 0.03)
    elif kind == 'fort':
        plate(root, (6.3, 6.3, 0.35), (0, 0, 0.17), (0, 0, 0), X['concrete'], 0.05)
        H = 2.6
        plate(root, (5.6, 0.9, H), (0, -2.45, H / 2 + 0.3), (0, 0, 0), team, 0.12)   # Frontmauer
        plate(root, (5.6, 0.9, H * 0.9), (0, 2.45, H * 0.45 + 0.3), (0, 0, 0), team, 0.12)
        for s in (1, -1):
            plate(root, (0.9, 4.2, H * 0.9), (s * 2.45, 0, H * 0.45 + 0.3), (0, 0, 0), team, 0.12)
            plate(root, (0.5, 4.0, 0.6), (s * 2.95, 0, 0.5), (0, s * 0.5, 0), team, 0.05)  # Böschung
        plate(root, (5.0, 0.5, 0.8), (0, -2.75, 0.6), (-0.5, 0, 0), team, 0.05)
        for k in range(7):  # Zinnen
            x = -2.5 + k * 0.83
            plate(root, (0.45, 0.9, 0.4), (x, -2.45, H + 0.5), (0, 0, 0), team, 0.05)
            plate(root, (0.45, 0.9, 0.35), (x, 2.45, H * 0.9 + 0.45), (0, 0, 0), team, 0.05)
        # Großes Doppeltor
        plate(root, (2.4, 0.2, 2.1), (0, -2.95, 1.35), (0, 0, 0), dark, 0.05)
        for s in (1, -1):
            plate(root, (1.08, 0.12, 1.95), (s * 0.57, -3.07, 1.33), (0, 0, 0), team, 0.03)
            rivets(root, M, (s * 0.15, -3.14, 0.55), (s * 1.0, -3.14, 0.55), 5)
            rivets(root, M, (s * 0.15, -3.14, 2.1), (s * 1.0, -3.14, 2.1), 5)
            plate(root, (0.8, 0.05, 0.12), (s * 0.57, -3.15, 1.3), (0, 0, 0), M['metal'], 0.01)
        rivets(root, M, (-2.7, -2.92, 2.6), (2.7, -2.92, 2.6), 14)
        # Ecktürme mit Kuppel
        for s in (1, -1):
            P(root, 'cyl', (0.95, 1.05, 3.4), (s * 2.6, -2.5, 1.9), mat=team, verts=8, bevel=0.05, sub=0)
            P(root, 'cyl', (1.05, 1.05, 0.2), (s * 2.6, -2.5, 3.65), mat=dark, verts=8, sub=0)
            P(root, 'sph', (0.62, 0.62, 0.5), (s * 2.6, -2.5, 3.8), mat=team, verts=24)
            P(root, 'box', (0.4, 0.06, 0.1), (s * 2.6, -3.1, 3.85), mat=X['amber'], bevel=0.01, sub=0)
            P(root, 'cyl', (0.06, 0.06, 0.7), (s * 2.6 + 0.0, -3.1, 3.75), (math.pi / 2, 0, 0), mat=M['metal'], verts=10, sub=0)
        # Zentrales Kanonenwerk (Fortgeschütz)
        plate(root, (2.6, 2.6, 0.9), (0, 0.4, 1.0), (0, 0, 0), dark, 0.05)
        tur = empty('Turret', (0, 0.3, 2.4), root)
        plate(tur, (1.7, 1.6, 0.75), (0, 0.4, 2.7), (0, 0, 0), team, 0.2)
        plate(tur, (1.5, 0.5, 0.06), (0, -0.45, 2.75), (0.7, 0, 0), team, 0.03)
        for i, x in enumerate((-0.32, 0.32)):
            b = empty(f'Barrel{i}', (x, -0.5, 2.75), tur)
            P(b, 'cyl', (0.11, 0.13, 1.8), (x, -1.4, 2.75), (math.pi / 2, 0, 0), mat=M['metal'], verts=16, sub=0)
            P(b, 'box', (0.28, 0.25, 0.24), (x, -2.25, 2.75), mat=dark, bevel=0.03, sub=0)
            empty(f'Muzzle{i}', (x, -2.4, 2.75), b)
        P(root, 'cyl', (0.03, 0.05, 2.4), (-2.1, 2.1, 4.1), mat=M['metal'], verts=8, sub=0)
        P(root, 'sph', (0.1, 0.1, 0.1), (-2.1, 2.1, 5.3), mat=M['glow'], verts=12)
        empty('Chimney0', (2.0, 2.0, 3.2), root)
        for s in (1, -1):
            coil(root, M, X, s * 2.1, 2.05, 2.6, 1.1, 0.28)
    elif kind == 'turret':
        P(root, 'cyl', (0.95, 1.05, 0.55), (0, 0, 0.3), mat=team, verts=8, bevel=0.05, sub=0)
        P(root, 'cyl', (0.8, 0.85, 0.25), (0, 0, 0.7), mat=dark, verts=8, sub=0)
        for k in range(8):
            a = k / 8 * math.pi * 2 + math.pi / 8
            P(root, 'sph', (0.03, 0.03, 0.02), (math.cos(a) * 0.98, math.sin(a) * 0.98, 0.5), mat=M['metal'], verts=8, sub=0)
        tur = empty('Turret', (0, 0, 0.9), root)
        plate(tur, (1.0, 1.15, 0.7), (0, 0.1, 1.15), (0, 0, 0), team, 0.18)
        plate(tur, (0.9, 0.4, 0.06), (0, -0.48, 1.2), (0.6, 0, 0), team, 0.03)
        b = empty('Barrel0', (0, -0.45, 1.2), tur)
        P(b, 'cyl', (0.09, 0.1, 1.4), (0, -1.15, 1.2), (math.pi / 2, 0, 0), mat=M['metal'], verts=16, sub=0)
        P(b, 'cyl', (0.13, 0.13, 0.18), (0, -1.85, 1.2), (math.pi / 2, 0, 0), mat=dark, verts=16, sub=0)
        empty('Muzzle0', (0, -1.95, 1.2), b)
    elif kind == 'mgturret':
        P(root, 'cyl', (0.7, 0.75, 0.15), (0, 0, 0.08), mat=X['concrete'], verts=12, sub=0)
        for k in range(3):
            a = k / 3 * math.pi * 2
            P(root, 'cyl', (0.04, 0.04, 0.95), (math.cos(a) * 0.32, math.sin(a) * 0.32, 0.5), (math.sin(a) * 0.45, -math.cos(a) * 0.45, 0), mat=dark, verts=8, sub=0)
        P(root, 'cyl', (0.1, 0.1, 0.25), (0, 0, 0.95), mat=dark, verts=12, sub=0)
        tur = empty('Turret', (0, 0, 1.1), root)
        plate(tur, (0.5, 0.6, 0.35), (0, 0.05, 1.2), (0, 0, 0), team, 0.08)
        plate(tur, (0.2, 0.3, 0.25), (0.35, 0.1, 1.15), (0, 0, 0), dark, 0.03)  # Munitionskasten
        b = empty('Barrel0', (0, -0.3, 1.22), tur)
        for x in (-0.1, 0.1):
            P(b, 'cyl', (0.035, 0.035, 0.8), (x, -0.7, 1.22), (math.pi / 2, 0, 0), mat=M['metal'], verts=10, sub=0)
            P(b, 'cyl', (0.05, 0.05, 0.12), (x, -1.08, 1.22), (math.pi / 2, 0, 0), mat=dark, verts=10, sub=0)
        empty('Muzzle0', (0, -1.15, 1.22), b)
    elif kind == 'repair':
        plate(root, (4.0, 4.0, 0.25), (0, 0, 0.12), (0, 0, 0), X['concrete'], 0.05)
        plate(root, (2.7, 2.7, 0.12), (0, 0, 0.3), (0, 0, 0), X['hazard'], 0.03)
        plate(root, (2.4, 2.4, 0.14), (0, 0, 0.42), (0, 0, 0), M['metal'], 0.03)
        for sx in (1, -1):
            for sy in (1, -1):
                P(root, 'cyl', (0.09, 0.09, 0.45), (sx * 1.05, sy * 1.05, 0.3), mat=dark, verts=10, sub=0)
        plate(root, (0.35, 0.35, 3.0), (-1.7, 1.7, 1.6), (0, 0, 0), team, 0.05)
        plate(root, (2.6, 0.3, 0.3), (-0.5, 1.7, 3.0), (0, 0, 0), team, 0.05)
        P(root, 'cyl', (0.02, 0.02, 1.2), (0.6, 1.7, 2.3), mat=M['metal'], verts=6, sub=0)
        plate(root, (0.3, 0.3, 0.3), (0.6, 1.7, 1.6), (0, 0, 0), dark, 0.05)
        P(root, 'cyl', (0.25, 0.25, 0.08), (-1.7, 1.7, 3.15), mat=X['amber'], verts=16, sub=0)
        plate(root, (0.8, 0.5, 1.2), (1.5, 1.5, 0.85), (0, 0, 0), team, 0.08)  # Werkzeugschrank
        plate(root, (0.6, 0.05, 0.8), (1.5, 1.24, 0.9), (0, 0, 0), dark, 0.02)
    elif kind == 'power':
        # Stromwerk 4x4 m: Generatorhalle, zwei Spulen, Kabeltrasse, Ladeplatz vorn
        plate(root, (4.1, 4.1, 0.25), (0, 0, 0.12), (0, 0, 0), X['concrete'], 0.05)
        plate(root, (2.6, 2.0, 1.6), (0, 0.7, 1.05), (0, 0, 0), team, 0.22)
        plate(root, (2.2, 1.6, 0.4), (0, 0.75, 2.05), (0, 0, 0), dark, 0.08)
        for k in range(4):
            plate(root, (0.08, 1.4, 0.3), (-0.75 + k * 0.5, 0.75, 2.3), (0, 0, 0), M['metal'], 0.01)
        plate(root, (1.2, 0.08, 0.8), (0, -0.32, 0.95), (0, 0, 0), dark, 0.03)
        P(root, 'box', (0.9, 0.05, 0.12), (0, -0.37, 1.2), mat=X['energy'], bevel=0.01, sub=0)
        rivets(root, M, (-1.25, -0.32, 1.7), (1.25, -0.32, 1.7), 9)
        for s in (1, -1):
            coil(root, M, X, s * 1.55, 0.9, 0.25, 1.6, 0.34)
            P(root, 'cyl', (0.05, 0.05, 1.0), (s * 1.05, 0.9, 1.6), (0, math.pi / 2, 0), mat=M['dark'], verts=8, sub=0)
        # Ladeplatz mit Leuchtring
        P(root, 'cyl', (1.0, 1.0, 0.08), (0, -1.3, 0.28), mat=M['metal'], verts=32, sub=0)
        P(root, 'torus', (0.95, 0.05), (0, -1.3, 0.34), mat=X['energy'])
        for k in range(6):  # Warnstreifen
            plate(root, (0.3, 0.05, 0.05), (-1.6 + k * 0.64, -2.0, 0.27), (0, 0, 0.7), X['hazard'], 0.005)
    elif kind.startswith('ruin'):
        # Ruinen: rissige Bodenplatte, gezackte Mauerreste, verbogene Träger, Schutthaufen
        import random
        rnd = random.Random(hash(kind) & 0xffff)
        W, D = {'ruin6x6': (6, 6), 'ruin6x4': (6, 4), 'ruin4x4': (4, 4), 'ruin2x2': (2, 2)}[kind]
        for i in range(4):
            sx, sy = (i % 2 - 0.5) * W / 2, (i // 2 - 0.5) * D / 2
            plate(root, (W / 2 * 0.97, D / 2 * 0.97, 0.25), (sx, sy, 0.1 + rnd.random() * 0.06), (rnd.uniform(-0.05, 0.05), rnd.uniform(-0.05, 0.05), 0), X['concrete'], 0.04)
        nwall = max(3, int((W + D) * 0.9))
        for i in range(nwall):
            edge = rnd.randint(0, 3)
            t = rnd.uniform(-0.45, 0.45)
            x = t * W if edge < 2 else (W / 2 - 0.3) * (1 if edge == 2 else -1)
            y = t * D if edge >= 2 else (D / 2 - 0.3) * (1 if edge == 0 else -1)
            h = rnd.uniform(0.4, 1.8) * min(1.5, W / 3)
            ln = rnd.uniform(0.5, 1.4)
            m = team if rnd.random() < 0.45 else X['char']
            plate(root, (ln if edge < 2 else 0.35, 0.35 if edge < 2 else ln, h), (x, y, h / 2 + 0.2), (rnd.uniform(-0.15, 0.15), rnd.uniform(-0.15, 0.15), rnd.uniform(-0.2, 0.2)), m, 0.03)
        for i in range(max(2, W // 2)):
            P(root, 'box', (0.12, 0.12, rnd.uniform(1.0, 2.2)), (rnd.uniform(-W / 3, W / 3), rnd.uniform(-D / 3, D / 3), 0.8), (rnd.uniform(-0.9, 0.9), rnd.uniform(-0.9, 0.9), 0), mat=M['metal'], bevel=0.01, sub=0)
        for i in range(int(W * D * 0.8) + 4):
            r = rnd.uniform(0.12, 0.45) * (W / 4 + 0.6)
            P(root, 'sph', (r, r * rnd.uniform(0.6, 1.1), r * 0.55), (rnd.uniform(-W / 2.4, W / 2.4), rnd.uniform(-D / 2.4, D / 2.4), 0.25), (rnd.random(), rnd.random(), rnd.random()), mat=X['rubble'] if rnd.random() < 0.6 else X['char'], verts=7)
        empty('Fire0', (0, 0, 0.6), root)
    elif kind == 'flag':
        # Flaggensockel: sechseckige Plinthe, Leuchtrille, Mast mit Querträger
        P(root, 'cyl', (1.15, 1.25, 0.22), (0, 0, 0.11), mat=X['concrete'], verts=6, bevel=0.04, sub=0)
        P(root, 'cyl', (0.9, 0.95, 0.12), (0, 0, 0.28), mat=M['dark'], verts=6, sub=0)
        for k in range(6):
            a = k / 6 * math.pi * 2
            P(root, 'box', (0.25, 0.06, 0.06), (math.cos(a) * 1.05, math.sin(a) * 1.05, 0.25), (0, 0, a + math.pi / 2), mat=X['hazard'], bevel=0.01, sub=0)
            P(root, 'sph', (0.04, 0.04, 0.03), (math.cos(a + 0.5) * 1.12, math.sin(a + 0.5) * 1.12, 0.23), mat=M['metal'], verts=8, sub=0)
        P(root, 'cyl', (0.16, 0.2, 0.35), (0, 0, 0.5), mat=M['metal'], verts=12, sub=0)
        P(root, 'cyl', (0.045, 0.055, 3.4), (0, 0, 2.3), mat=M['metal'], verts=12, sub=0)
        P(root, 'box', (0.05, 0.05, 0.06), (0, 0, 3.98), mat=M['metal'], bevel=0.01, sub=0)
        P(root, 'sph', (0.09, 0.09, 0.09), (0, 0, 4.05), mat=M['chrome'], verts=12)
        for s in (1, -1):  # Bodenstrahler
            P(root, 'box', (0.16, 0.12, 0.1), (s * 0.55, -0.55, 0.42), (0.6, 0, 0), mat=M['dark'], bevel=0.02, sub=0)
    path = f'{OUT}/building_{kind}.glb'
    export(path)
    return path


if __name__ == '__main__':
    for k in ('vehicle', 'robot', 'radar', 'fort', 'turret', 'mgturret', 'repair', 'power', 'ruin6x6', 'ruin6x4', 'ruin4x4', 'ruin2x2', 'flag'):
        print('exported', build(k))
