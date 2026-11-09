"""Cenas 'fotografadas com flash' para servir de fotos de convidados (substitutas em 3D)."""
import sys, time, random; sys.path.insert(0, '/home/claude/rv2')
from blib import *
OUT = '/home/claude/rv2/renders'
which = sys.argv[1]
t = time.time()
rng = random.Random(11)

def room(floor='#2a1a14', wall='#1a1210'):
    box('floor', (12, 12, 0.1), (0, 0, -0.55), mat('floor', floor, rough=0.7), 0)
    box('wall', (12, 0.1, 8), (0, 3.2, 2), mat('wall', wall, rough=0.9), 0)

def flash(cam_loc, energy=260):
    bpy.ops.object.light_add(type='SPOT', location=(cam_loc[0] + 0.15, cam_loc[1], cam_loc[2] + 0.1))
    l = bpy.context.object; l.data.energy = energy; l.data.spot_size = 1.6; l.data.shadow_soft_size = 0.05
    l.data.color = hexc('#FFF4E4')[:3]
    l.rotation_euler = (Vector((0, 0, 0)) - Vector(cam_loc)).to_track_quat('-Z', 'Y').to_euler()

def bokeh(n=40, cols=('#FFB347', '#FF4D1F', '#FFE2B0', '#7FD6FF'), y=(4, 9), spread=4, z=(0, 3)):
    for i in range(n):
        bpy.ops.mesh.primitive_uv_sphere_add(radius=rng.uniform(0.04, 0.09), location=(rng.uniform(-spread, spread), rng.uniform(*y), rng.uniform(*z)))
        c = rng.choice(cols); assign(bpy.context.object, mat('bk' + c, c, emit=c, emit_str=rng.uniform(20, 60)))

def dof(cam, dist, f=2.0):
    cam.data.dof.use_dof = True; cam.data.dof.focus_distance = dist; cam.data.dof.aperture_fstop = f

def floor_confetti(n=120, area=1.6, z=-0.495):
    ms = confetti_material_set()
    for i in range(n):
        o = confetti_piece(ms, (rng.uniform(-area, area), rng.uniform(-area, area * 0.8), z + rng.uniform(0, 0.01)), rng)
        o.rotation_euler = (0, 0, rng.uniform(0, 6.28))

if which == 'p-pista':
    sc = reset(); room('#1c1412', '#120c0b')
    disco_ball(0.42, (0.1, 0.6, 1.25))
    for loc, c, f in (((-0.9, 0.9, 0.25), '#FF4D1F', False), ((-0.45, 1.2, 0.55), '#F6EFE6', False), ((0.95, 1.0, 0.35), '#E8CF9E', True)):
        balloon(loc, c, 0.3, f)
    floor_confetti(140)
    for loc, c in (((-2, 2, 2), '#FF4D1F'), ((2, 2, 1.5), '#7FD6FF')):
        light_area('col', loc, (0, 0.6, 1), 1.0, 250, c)
    bokeh(30)
    cam = camera((0, -2.8, 0.55), (0, 0.6, 0.55), lens=32); dof(cam, 3.4, 2.8); flash(cam.location, 200)
    save(f'{OUT}/{which}.png', (900, 1200), 128, transparent=False)

elif which == 'p-bolo':
    sc = reset(); room('#2a1d16', '#140e0b')
    box('table', (3, 2, 0.1), (0, 0.4, -0.5), mat('cloth', '#EDE3D3', rough=0.9, sheen=0.5), 0.02)
    cyl('cake', 0.42, 0.36, (0, 0.4, -0.27), rot=(0, 0, 0), m=mat('frost', '#F4EADC', rough=0.6, sheen=0.4), bev=0.04)
    cyl('drip', 0.43, 0.07, (0, 0.4, -0.1), rot=(0, 0, 0), m=mat('choc', '#3A1E14', rough=0.25, coat=0.6), bev=0.03)
    flame = mat('flame', '#FFB347', emit='#FFB347', emit_str=50)
    for i in range(3):
        x = -0.12 + i * 0.12
        cyl(f'c{i}', 0.018, 0.2, (x, 0.4, -0.0), rot=(0, 0, 0), m=mat(f'cd{i}', ['#FF4D1F', '#F6EFE6', '#FFD23F'][i], rough=0.4))
        bpy.ops.mesh.primitive_uv_sphere_add(radius=0.025, location=(x, 0.4, 0.13)); fo = bpy.context.object; fo.scale = (1, 1, 1.9); assign(fo, flame)
    bpy.ops.object.light_add(type='POINT', location=(0, 0.4, 0.25)); bpy.context.object.data.energy = 25; bpy.context.object.data.color = hexc('#FFB347')[:3]
    floor_confetti(60, 1.0, -0.445)
    bokeh(25, ('#FFB347', '#FFE2B0'), (2.5, 6), 3, (0.2, 2))
    cam = camera((0.2, -1.5, 0.45), (0, 0.4, -0.1), lens=40); dof(cam, 1.95, 2.0); flash(cam.location, 90)
    save(f'{OUT}/{which}.png', (900, 1200), 128, transparent=False)

elif which == 'p-aliancas':
    sc = reset()
    box('velvet', (6, 6, 0.1), (0, 0, -0.08), mat('velvet', '#3d0a12', rough=0.98, sheen=0.25), 0)
    ring((-0.08, 0.05, 0.13), (math.radians(80), 0, math.radians(25)), 0.14, 0.024, '#E2B95E')
    ring((0.1, 0.0, 0.03), (math.radians(10), 0, 0), 0.12, 0.02, '#EBCB8A')
    bokeh(45, ('#FFE2B0', '#FFB347', '#F6EFE6'), (1.5, 5), 2.5, (0.3, 2))
    light_area('k', (-1, -1, 1.5), (0, 0, 0), 1, 25, '#FFE2C0'); reflect_cards()
    cam = camera((0, -1.35, 0.62), (0.01, 0.02, 0.04), lens=60); dof(cam, 1.5, 2.2); flash(cam.location, 9)
    save(f'{OUT}/{which}.png', (900, 1200), 160, transparent=False)

elif which == 'p-camera':
    sc = reset(); room('#3a2418', '#1a120e')
    box('table', (4, 3, 0.1), (0, 0.4, -0.5), mat('wood', '#5a3424', rough=0.45, coat=0.3), 0.02)
    root, fm = disposable('casamento'); root.scale = (0.55, 0.55, 0.55); root.location = (0.05, 0.25, -0.25)
    root.rotation_euler = (0, 0, math.radians(-22))
    floor_confetti(90, 1.2, -0.445)
    bokeh(30, ('#FFB347', '#FFE2B0', '#FF4D1F'), (2.5, 7), 3.5, (0.2, 2.2))
    cam = camera((-0.35, -1.6, 0.55), (0.05, 0.25, -0.25), lens=42); dof(cam, 1.95, 2.4); flash(cam.location, 110)
    save(f'{OUT}/{which}.png', (900, 1200), 128, transparent=False)

elif which == 'p-baloes':
    sc = reset(); room('#d8cfc2', '#E9E1D5')
    for loc, c, f in (((-0.5, 2.6, 0.9), '#FF4D1F', False), ((0.15, 2.7, 1.25), '#2340D8', False), ((0.7, 2.6, 0.75), '#E8CF9E', True), ((-0.05, 2.5, 0.45), '#F6EFE6', False), ((-0.95, 2.7, 1.4), '#FFD23F', False)):
        balloon(loc, c, 0.32, f)
    cam = camera((0, -1.4, 0.9), (0, 2.6, 0.9), lens=38); flash(cam.location, 900)
    light_area('amb', (0, 0, 3), (0, 2, 0), 4, 40)
    save(f'{OUT}/{which}.png', (900, 1200), 128, transparent=False)

elif which == 'p-brinde':
    sc = reset()
    glass = mat('glass', '#ffffff', rough=0.0, trans=1.0, ior=1.5)
    champ = mat('champ', '#F0C96A', rough=0.0, trans=1.0, ior=1.33)
    for x, tilt in ((-0.16, 0.25), (0.16, -0.25)):
        bpy.ops.mesh.primitive_cylinder_add(radius=0.14, depth=0.42, location=(x, 0, 0.1), vertices=48)
        g = bpy.context.object; g.rotation_euler = (0, tilt, 0)
        sol = g.modifiers.new('s', 'SOLIDIFY'); sol.thickness = 0.006
        bevel(g, 0.004, 2); assign(g, glass)
        bpy.ops.mesh.primitive_cylinder_add(radius=0.128, depth=0.26, location=(x, 0, 0.02), vertices=48)
        l = bpy.context.object; l.rotation_euler = (0, tilt, 0); assign(l, champ)
    bokeh(60, ('#FFB347', '#FFE2B0', '#FF4D1F', '#F6EFE6'), (2, 7), 3, (-0.5, 2.5))
    light_area('back', (0, 2, 0.6), (0, 0, 0.1), 1.2, 200, '#FFD9A0'); reflect_cards()
    cam = camera((0, -1.5, 0.2), (0, 0, 0.12), lens=55); dof(cam, 1.5, 2.0); flash(cam.location, 40)
    save(f'{OUT}/{which}.png', (900, 1200), 160, transparent=False)

print('DONE', which, round(time.time() - t, 1))
