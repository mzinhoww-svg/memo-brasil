"""Vídeo de abertura (loop de 4 s, 24 fps): câmera Revela flutuando, confete caindo, bokeh e flash."""
import sys, time, random, os; sys.path.insert(0, '/home/claude/rv2')
from blib import *
OUT = '/home/claude/rv2/video'; os.makedirs(OUT, exist_ok=True)
N = 96
start = int(sys.argv[1]) if len(sys.argv) > 1 else 0
end = int(sys.argv[2]) if len(sys.argv) > 2 else N
W, H = (int(sys.argv[3]), int(sys.argv[4])) if len(sys.argv) > 4 else (540, 1170)
SAMPLES = int(sys.argv[5]) if len(sys.argv) > 5 else 40

sc = reset()
rng = random.Random(5)
root, flash_m = disposable('festa')
studio(strength=0.9)
cam = camera((0, -4.6, 0.15), (0, 0, -0.42), lens=46)
cam.data.dof.use_dof = True; cam.data.dof.focus_distance = 4.6; cam.data.dof.aperture_fstop = 2.2

# bokeh ao fundo
for i in range(46):
    bpy.ops.mesh.primitive_uv_sphere_add(radius=rng.uniform(0.05, 0.12), location=(rng.uniform(-3.5, 3.5), rng.uniform(4, 10), rng.uniform(-3.5, 3.0)))
    c = rng.choice(['#FFB347', '#FF4D1F', '#FFE2B0', '#FF8FB1', '#7FD6FF'])
    assign(bpy.context.object, mat('bk' + c + str(i), c, emit=c, emit_str=rng.uniform(15, 45)))

# confete
ms = confetti_material_set()
TOP, HGT = 2.4, 5.2
pieces = []
for i in range(150):
    o = confetti_piece(ms, (0, 0, 0), rng)
    o.scale = (1.15, 1.15, 1.15)
    pieces.append(dict(o=o, x=rng.uniform(-1.5, 1.5), y=rng.uniform(-1.6, 2.0), p=rng.random(), k=rng.choice([1, 1, 2]),
                       rot=Vector((rng.uniform(0, 6.28), rng.uniform(0, 6.28), rng.uniform(0, 6.28))),
                       m=(rng.choice([-1, 1]), rng.choice([-2, -1, 1, 2]), rng.choice([-1, 1])), ph=rng.uniform(0, 6.28)))

# luz do flash
bpy.ops.object.light_add(type='POINT', location=(0.35, -0.6, 0.15)); fl = bpy.context.object; fl.data.shadow_soft_size = 0.2
fl.data.color = hexc('#FFF4E4')[:3]; fl.parent = root
flash_node = flash_m.node_tree.nodes['Principled BSDF']
FLASH_AT = 50

for f in range(start, end):
    u = f / N; tau = 2 * math.pi * u
    root.location = (0.0, 0.0, 0.05 * math.sin(tau))
    root.rotation_euler = (math.radians(7) * math.sin(tau + 1.2), math.radians(-6) * math.cos(tau), math.radians(-24) + math.radians(14) * math.sin(tau))
    for d in pieces:
        z = TOP - ((d['p'] + u * d['k']) % 1.0) * HGT
        d['o'].location = (d['x'] + 0.08 * math.sin(tau * d['k'] + d['ph']), d['y'], z)
        d['o'].rotation_euler = (d['rot'].x + tau * d['m'][0], d['rot'].y + tau * d['m'][1], d['rot'].z + tau * d['m'][2])
    k = f - FLASH_AT
    pulse = 0.0 if k < 0 else math.exp(-k / 2.2) if k < 14 else 0.0
    flash_node.inputs['Emission Strength'].default_value = 80 * pulse
    fl.data.energy = 900 * pulse
    sc.frame_set(f)
    save(f'{OUT}/raw_{f:03d}.png', (W, H), SAMPLES, transparent=False)
    print('FRAME', f, flush=True)
