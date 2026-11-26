# Baut die Roboter von Operation Y in Blender: glatte Körperteile, Skelett mit Knien,
# Animationen (Idle, Walk, Shoot) und exportiert je Typ eine GLB-Datei.
# Aufruf: python robots.py <Zielordner>
# Achsen in Blender: Z oben, Blickrichtung -Y, linke Körperseite +X.

import sys
import math
import bpy

OUT = sys.argv[-1] if len(sys.argv) > 1 else '.'
FPS = 30


def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.context.scene.render.fps = FPS


MATS = {}


def material(name, color, metal=0.0, rough=0.5, emit=None, strength=0.0):
    if name in MATS:
        return MATS[name]
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes.get('Principled BSDF')
    b.inputs['Base Color'].default_value = (*color, 1)
    b.inputs['Metallic'].default_value = metal
    b.inputs['Roughness'].default_value = rough
    if emit:
        b.inputs['Emission Color'].default_value = (*emit, 1)
        b.inputs['Emission Strength'].default_value = strength
    MATS[name] = m
    return m


def mats():
    MATS.clear()
    return {
        # Platzhalter "Team*" werden im Spiel durch Teamfarben ersetzt
        'team': material('Team', (0.55, 0.12, 0.08), 0.35, 0.45),
        'glow': material('TeamGlow', (0.05, 0.05, 0.05), 0.0, 0.4, (1.0, 0.35, 0.2), 6.0),
        'armor': material('Armor', (0.23, 0.24, 0.25), 0.55, 0.42),
        'dark': material('Dark', (0.045, 0.048, 0.052), 0.5, 0.5),
        'joint': material('Joint', (0.12, 0.12, 0.13), 0.85, 0.28),
        'metal': material('Metal', (0.42, 0.43, 0.45), 0.9, 0.3),
        'rubber': material('Rubber', (0.02, 0.02, 0.02), 0.0, 0.9),
        'chrome': material('Chrome', (0.8, 0.8, 0.82), 1.0, 0.12),
        'gold': material('Gold', (0.85, 0.6, 0.2), 1.0, 0.25),
        'skin': material('CapRed', (0.35, 0.05, 0.04), 0.1, 0.6),
    }


def smooth(obj, bevel=0.0, seg=3, sub=1):
    for p in obj.data.polygons:
        p.use_smooth = True
    if bevel > 0:
        m = obj.modifiers.new('Bevel', 'BEVEL')
        m.width = bevel
        m.segments = seg
        m.limit_method = 'ANGLE'
    if sub > 0:
        m = obj.modifiers.new('Sub', 'SUBSURF')
        m.levels = sub
        m.render_levels = sub


def prim(kind, size, loc, rot=(0, 0, 0), mat=None, bevel=0.02, sub=1, name=None, verts=24):
    if kind == 'box':
        bpy.ops.mesh.primitive_cube_add(size=1, location=loc, rotation=rot)
        o = bpy.context.object
        o.scale = size
    elif kind == 'cyl':
        bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=1, depth=1, location=loc, rotation=rot)
        o = bpy.context.object
        o.scale = (size[0], size[1], size[2])
    elif kind == 'sph':
        bpy.ops.mesh.primitive_uv_sphere_add(segments=verts, ring_count=max(8, verts // 2), radius=1, location=loc, rotation=rot)
        o = bpy.context.object
        o.scale = size
        bevel = 0
    elif kind == 'torus':
        bpy.ops.mesh.primitive_torus_add(major_radius=size[0], minor_radius=size[1], location=loc, rotation=rot, major_segments=32, minor_segments=10)
        o = bpy.context.object
        bevel = 0
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if name:
        o.name = name
    if mat:
        o.data.materials.append(mat)
    smooth(o, bevel, 3, sub)
    return o


def attach(obj, arm, bone):
    bpy.context.view_layer.update()
    mw = obj.matrix_world.copy()
    obj.parent = arm
    obj.parent_type = 'BONE'
    obj.parent_bone = bone
    bpy.context.view_layer.update()
    obj.matrix_world = mw


BONES = [
    # name, head, tail, parent
    ('Hips', (0, 0, 0.95), (0, 0, 1.05), None),
    ('Spine', (0, 0, 1.05), (0, 0, 1.42), 'Hips'),
    ('Head', (0, 0, 1.5), (0, 0, 1.72), 'Spine'),
    ('Thigh.L', (0.13, 0, 0.93), (0.13, 0.01, 0.53), 'Hips'),
    ('Shin.L', (0.13, 0.01, 0.53), (0.13, 0, 0.12), 'Thigh.L'),
    ('Foot.L', (0.13, 0, 0.12), (0.13, -0.16, 0.06), 'Shin.L'),
    ('Thigh.R', (-0.13, 0, 0.93), (-0.13, 0.01, 0.53), 'Hips'),
    ('Shin.R', (-0.13, 0.01, 0.53), (-0.13, 0, 0.12), 'Thigh.R'),
    ('Foot.R', (-0.13, 0, 0.12), (-0.13, -0.16, 0.06), 'Shin.R'),
    ('UpperArm.L', (0.27, 0, 1.38), (0.31, -0.06, 1.12), 'Spine'),
    ('Forearm.L', (0.31, -0.06, 1.12), (0.12, -0.36, 1.1), 'UpperArm.L'),
    ('UpperArm.R', (-0.27, 0, 1.38), (-0.29, -0.02, 1.12), 'Spine'),
    ('Forearm.R', (-0.29, -0.02, 1.12), (-0.1, -0.26, 1.06), 'UpperArm.R'),
    ('Gun', (-0.06, -0.2, 1.08), (-0.06, -0.6, 1.08), 'Spine'),
]


def armature():
    bpy.ops.object.armature_add(location=(0, 0, 0))
    arm = bpy.context.object
    arm.name = 'Rig'
    bpy.ops.object.mode_set(mode='EDIT')
    eb = arm.data.edit_bones
    eb.remove(eb[0])
    for name, h, t, p in BONES:
        b = eb.new(name)
        b.head = h
        b.tail = t
        if p:
            b.parent = eb[p]
            b.use_connect = False
    bpy.ops.object.mode_set(mode='OBJECT')
    for pb in arm.pose.bones:
        pb.rotation_mode = 'XYZ'
    return arm


def limb(a, b, r, mat, arm, bone, rr=None):
    # abgerundetes Glied zwischen zwei Punkten
    import mathutils
    va, vb = mathutils.Vector(a), mathutils.Vector(b)
    mid = (va + vb) / 2
    d = vb - va
    ln = d.length
    bpy.ops.mesh.primitive_cylinder_add(vertices=20, radius=1, depth=1, location=mid)
    o = bpy.context.object
    o.rotation_mode = 'QUATERNION'
    o.rotation_quaternion = mathutils.Vector((0, 0, 1)).rotation_difference(d.normalized())
    o.scale = (r, rr or r, ln)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    o.data.materials.append(mat)
    smooth(o, min(r, rr or r) * 0.6, 4, 1)
    attach(o, arm, bone)
    return o


def build(kind):
    reset()
    M = mats()
    arm = armature()
    heavy = kind == 'grenadier'
    slim = kind == 'sniper'
    w = 1.12 if heavy else 0.9 if slim else 1.0
    P = []

    def part(bone, *args, **kw):
        o = prim(*args, **kw)
        attach(o, arm, bone)
        P.append(o)
        return o

    # Beine mit Kniegelenk
    for s, side in ((1, 'L'), (-1, 'R')):
        x = 0.13 * s
        part(f'Thigh.{side}', 'sph', (0.085, 0.085, 0.085), (x, 0, 0.93), mat=M['joint'])
        limb((x, 0, 0.9), (x, 0.01, 0.57), 0.07 * w, M['dark'], arm, f'Thigh.{side}')
        part(f'Thigh.{side}', 'box', (0.15 * w, 0.17 * w, 0.26), (x + 0.0, -0.025, 0.74), mat=M['armor'], bevel=0.05)
        part(f'Shin.{side}', 'sph', (0.075, 0.075, 0.075), (x, 0.01, 0.53), mat=M['joint'])
        part(f'Shin.{side}', 'box', (0.13 * w, 0.16 * w, 0.1), (x, -0.07, 0.53), mat=M['team'], bevel=0.035)  # Knieschutz
        limb((x, 0.01, 0.5), (x, 0, 0.17), 0.075 * w, M['armor'], arm, f'Shin.{side}', 0.085 * w)
        part(f'Foot.{side}', 'sph', (0.06, 0.06, 0.06), (x, 0, 0.13), mat=M['joint'])
        part(f'Foot.{side}', 'box', (0.16 * w, 0.3, 0.1), (x, -0.06, 0.06), mat=M['dark'], bevel=0.035)
        part(f'Foot.{side}', 'box', (0.17 * w, 0.08, 0.05), (x, -0.19, 0.035), mat=M['armor'], bevel=0.02)

    # Becken, Rumpf
    part('Hips', 'box', (0.34 * w, 0.24 * w, 0.16), (0, 0, 0.97), mat=M['dark'], bevel=0.06)
    part('Spine', 'cyl', (0.08, 0.08, 0.14), (0, 0, 1.08), mat=M['joint'], verts=20)
    part('Spine', 'sph', (0.24 * w, 0.2 * w, 0.22), (0, 0.01, 1.27), mat=M['armor'], verts=32)
    part('Spine', 'box', (0.34 * w, 0.12, 0.26), (0, -0.14 * w, 1.27), mat=M['team'], bevel=0.05)  # Brustplatte
    part('Spine', 'box', (0.2, 0.03, 0.025), (0, -0.205 * w, 1.33), mat=M['glow'], bevel=0.01, sub=0)
    part('Spine', 'box', (0.28 * w, 0.18, 0.3), (0, 0.2 * w, 1.28), mat=M['dark'], bevel=0.05)  # Rucksack
    part('Spine', 'cyl', (0.04, 0.04, 0.05), (0, 0.29 * w, 1.34), (math.pi / 2, 0, 0), mat=M['glow'], verts=16, sub=0)
    # Schulterpanzer
    for s in (1, -1):
        part('Spine', 'sph', (0.14 * w, 0.15, 0.1), (0.28 * w * s, 0, 1.42), mat=M['team'], verts=28)
    # Kopf / Helm
    part('Head', 'cyl', (0.06, 0.06, 0.1), (0, 0, 1.48), mat=M['joint'], verts=16)
    if kind == 'rocketeer':
        part('Head', 'sph', (0.15, 0.16, 0.15), (0, 0, 1.62), mat=M['armor'], verts=32)
        for s in (1, -1):
            part('Head', 'cyl', (0.065, 0.065, 0.05), (0.15 * s, 0, 1.61), (0, math.pi / 2, 0), mat=M['dark'], verts=20)
        part('Head', 'box', (0.18, 0.05, 0.05), (0, -0.14, 1.62), mat=M['glow'], bevel=0.02)
    elif kind == 'grenadier':
        part('Head', 'sph', (0.17, 0.17, 0.14), (0, 0, 1.62), mat=M['armor'], verts=32)
        part('Head', 'box', (0.05, 0.26, 0.05), (0, 0.0, 1.76), mat=M['team'], bevel=0.02)  # Kamm
        part('Head', 'box', (0.24, 0.08, 0.09), (0, -0.13, 1.58), mat=M['dark'], bevel=0.03)
        part('Head', 'box', (0.2, 0.04, 0.035), (0, -0.165, 1.63), mat=M['glow'], bevel=0.012)
    elif kind == 'sniper':
        part('Head', 'sph', (0.13, 0.14, 0.14), (0, 0, 1.62), mat=M['armor'], verts=32)
        part('Head', 'cyl', (0.045, 0.045, 0.1), (0.05, -0.13, 1.63), (math.pi / 2, 0, 0), mat=M['dark'], verts=20)
        part('Head', 'cyl', (0.035, 0.035, 0.012), (0.05, -0.185, 1.63), (math.pi / 2, 0, 0), mat=M['glow'], verts=20, sub=0)
        part('Head', 'cyl', (0.008, 0.008, 0.35), (-0.08, 0.06, 1.85), mat=M['metal'], verts=8, sub=0)
    else:
        part('Head', 'sph', (0.14, 0.15, 0.14), (0, 0, 1.62), mat=M['armor'], verts=32)
        part('Head', 'box', (0.07, 0.18, 0.03), (0, 0.0, 1.76), mat=M['team'], bevel=0.012)
        part('Head', 'box', (0.17, 0.05, 0.04), (0, -0.135, 1.62), mat=M['glow'], bevel=0.018)

    # Arme mit Ellbogen
    for s, side in ((1, 'L'), (-1, 'R')):
        ua = 'UpperArm.' + side
        fa = 'Forearm.' + side
        bone = arm.data.bones[ua]
        h, t = bone.head_local, bone.tail_local
        bf = arm.data.bones[fa]
        part(ua, 'sph', (0.07, 0.07, 0.07), tuple(h), mat=M['joint'])
        limb(tuple(h), tuple(t), 0.055 * w, M['dark'], arm, ua)
        part(fa, 'sph', (0.06, 0.06, 0.06), tuple(bf.head_local), mat=M['joint'])
        limb(tuple(bf.head_local), tuple(bf.tail_local), 0.06 * w, M['armor'], arm, fa, 0.07 * w)
        part(fa, 'sph', (0.06, 0.07, 0.06), tuple(bf.tail_local), mat=M['dark'])  # Hand

    # Waffe (am Rumpf, wird von den Händen gehalten)
    g = 'Gun'
    if kind == 'rocketeer':
        part(g, 'cyl', (0.085, 0.085, 0.85), (-0.24, -0.05, 1.5), (math.pi / 2, 0, 0), mat=M['metal'], verts=24)
        part(g, 'cyl', (0.1, 0.1, 0.14), (-0.24, 0.32, 1.5), (math.pi / 2, 0, 0), mat=M['dark'], verts=24)
        part(g, 'cyl', (0.095, 0.095, 0.03), (-0.24, -0.48, 1.5), (math.pi / 2, 0, 0), mat=M['glow'], verts=24, sub=0)
        muzzle = (-0.24, -0.5, 1.5)
    elif kind == 'grenadier':
        part(g, 'box', (0.12, 0.42, 0.13), (-0.06, -0.3, 1.08), mat=M['dark'], bevel=0.035)
        part(g, 'cyl', (0.1, 0.1, 0.13), (-0.06, -0.24, 1.0), mat=M['metal'], verts=24)
        part(g, 'cyl', (0.055, 0.055, 0.3), (-0.06, -0.6, 1.1), (math.pi / 2, 0, 0), mat=M['metal'], verts=20)
        muzzle = (-0.06, -0.76, 1.1)
    elif kind == 'sniper':
        part(g, 'box', (0.07, 0.48, 0.08), (-0.06, -0.3, 1.08), mat=M['dark'], bevel=0.025)
        part(g, 'cyl', (0.022, 0.022, 0.62), (-0.06, -0.82, 1.09), (math.pi / 2, 0, 0), mat=M['metal'], verts=14)
        part(g, 'cyl', (0.032, 0.032, 0.2), (-0.06, -0.3, 1.16), (math.pi / 2, 0, 0), mat=M['dark'], verts=18)
        muzzle = (-0.06, -1.13, 1.09)
    else:
        part(g, 'box', (0.08, 0.42, 0.1), (-0.06, -0.3, 1.08), mat=M['dark'], bevel=0.03)
        part(g, 'box', (0.06, 0.08, 0.14), (-0.06, -0.22, 0.99), mat=M['dark'], bevel=0.02)
        part(g, 'cyl', (0.028, 0.028, 0.24), (-0.06, -0.62, 1.09), (math.pi / 2, 0, 0), mat=M['metal'], verts=14)
        muzzle = (-0.06, -0.74, 1.09)
    bpy.ops.object.empty_add(location=muzzle)
    mz = bpy.context.object
    mz.name = 'Muzzle'
    attach(mz, arm, 'Gun')

    animate(arm)
    path = f'{OUT}/robot_{kind}.glb'
    export(path)
    return path


def key(arm, frame, poses):
    for bone, val in poses.items():
        pb = arm.pose.bones[bone]
        if 'loc' in val:
            pb.location = val['loc']
            pb.keyframe_insert('location', frame=frame)
        pb.rotation_euler = val.get('rot', (0, 0, 0))
        pb.keyframe_insert('rotation_euler', frame=frame)


ALL = [b[0] for b in BONES]


def action(arm, name, frames, fn):
    arm.animation_data_create()
    act = bpy.data.actions.new(name)
    arm.animation_data.action = act
    for f in frames:
        poses = {b: {'rot': (0, 0, 0)} for b in ALL}
        poses['Hips']['loc'] = (0, 0, 0)
        fn(f, poses)
        key(arm, f, poses)
    track = arm.animation_data.nla_tracks.new()
    track.name = name
    track.strips.new(name, int(frames[0]), act)
    arm.animation_data.action = None


def animate(arm):
    # Knochenachsen: Beinknochen zeigen nach unten; Drehung um lokales X schwingt nach vorn/hinten.
    def walk(f, p):
        ph = 2 * math.pi * f / 30
        for side, off in (('L', 0), ('R', math.pi)):
            a = ph + off
            p[f'Thigh.{side}']['rot'] = (0.55 * math.sin(a), 0, 0)
            knee = 0.08 + 0.95 * max(0.0, math.cos(a)) ** 1.4
            p[f'Shin.{side}']['rot'] = (-knee, 0, 0)
            p[f'Foot.{side}']['rot'] = (0.25 * math.sin(a) + 0.3 * max(0.0, math.cos(a)), 0, 0)
            p[f'UpperArm.{side}']['rot'] = (-0.12 * math.sin(a), 0, 0)
        p['Hips']['loc'] = (0, 0.045 * abs(math.cos(ph)) - 0.03, 0)
        p['Hips']['rot'] = (0, 0.12 * math.sin(ph), 0)
        p['Spine']['rot'] = (0.12, -0.14 * math.sin(ph), 0.03 * math.sin(ph))
        p['Head']['rot'] = (-0.06, 0.1 * math.sin(ph), 0)

    def idle(f, p):
        ph = 2 * math.pi * f / 60
        p['Hips']['loc'] = (0, -0.012 + 0.012 * math.sin(ph), 0)
        p['Spine']['rot'] = (0.03 * math.sin(ph), 0, 0)
        p['Head']['rot'] = (0.03 * math.sin(ph + 1), 0.25 * math.sin(ph * 0.5), 0)
        for side in ('L', 'R'):
            p[f'Thigh.{side}']['rot'] = (0.03, 0, 0)
            p[f'Shin.{side}']['rot'] = (-0.08 - 0.03 * math.sin(ph), 0, 0)
            p[f'Foot.{side}']['rot'] = (0.05, 0, 0)
            p[f'UpperArm.{side}']['rot'] = (0.03 * math.sin(ph), 0, 0)

    def shoot(f, p):
        k = max(0.0, 1 - f / 6) if f <= 6 else 0
        p['Spine']['rot'] = (-0.12 * k, 0, 0)
        p['Gun']['rot'] = (-0.18 * k, 0, 0)
        p['Head']['rot'] = (-0.05 * k, 0, 0)
        for side in ('L', 'R'):
            p[f'Shin.{side}']['rot'] = (-0.08, 0, 0)
            p[f'UpperArm.{side}']['rot'] = (-0.15 * k, 0, 0)

    action(arm, 'Walk', list(range(0, 31, 2)), walk)
    action(arm, 'Idle', list(range(0, 61, 5)), idle)
    action(arm, 'Shoot', [0, 1, 2, 3, 4, 6, 9], shoot)


def export(path):
    bpy.ops.export_scene.gltf(
        filepath=path, export_format='GLB', export_apply=True, export_yup=True,
        export_animation_mode='NLA_TRACKS', export_force_sampling=True,
        export_texcoords=False, export_normals=True, export_cameras=False, export_lights=False,
    )


if __name__ == '__main__':
    for k in ('runner', 'grenadier', 'rocketeer', 'sniper'):
        print('exported', build(k))
