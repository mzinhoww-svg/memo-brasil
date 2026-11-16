import sys, time, random; sys.path.insert(0, '/home/claude/rv2')
from blib import *
OUT = '/home/claude/rv2/renders'
which = sys.argv[1]
t = time.time()

if which.startswith('cam-') and which != 'cam-hero-tilt':
    wrap = which.split('-')[1]
    sc = reset(); root, fm = disposable(wrap)
    root.rotation_euler = (0, 0, math.radians(-34))
    studio()
    camera((-1.55, -3.2, 1.15), (0.0, 0, -0.02), lens=58)
    save(f'{OUT}/{which}.png', (1200, 1200), 128)

elif which == 'cam-hero-tilt':
    sc = reset(); root, fm = disposable('festa')
    root.rotation_euler = (math.radians(12), math.radians(-14), math.radians(-28))
    studio()
    camera((-1.4, -3.4, 0.6), (0.0, 0, 0.02), lens=58)
    save(f'{OUT}/{which}.png', (1200, 1200), 128)

elif which == 'confetti':
    sc = reset(); ms = confetti_material_set(); rng = random.Random(3)
    for i in range(150):
        v = Vector((rng.gauss(0, 1), rng.gauss(0, 0.6), rng.gauss(0, 1))).normalized() * (rng.uniform(0.15, 1.0) ** 0.7) * 1.7
        o = confetti_piece(ms, tuple(v), rng); o.scale = (2.4, 2.4, 2.4)
    studio(); camera((0, -4.2, 0.2), (0, 0, 0), lens=36)
    save(f'{OUT}/{which}.png', (1400, 1400), 96)

elif which == 'disco':
    sc = reset(); disco_ball(0.6)
    # mundo com luzes coloridas para refletir
    for loc, c in (((-2, -2, 1), '#FF4D1F'), ((2, -1.5, 0.5), '#7FD6FF'), ((0.5, -2.5, -1.5), '#FFD23F'), ((-1, 2, 2), '#FF8FB1')):
        light_area('dl', loc, (0, 0, 0), 0.8, 300, c)
    reflect_cards()
    w = bpy.context.scene.world.node_tree; bg = w.nodes['Background']
    grad = w.nodes.new('ShaderNodeTexGradient'); mp = w.nodes.new('ShaderNodeMapping'); tc = w.nodes.new('ShaderNodeTexCoord')
    ramp = w.nodes.new('ShaderNodeValToRGB')
    ramp.color_ramp.elements[0].color = hexc('#1a0a06'); ramp.color_ramp.elements[1].color = hexc('#FF8A5E')
    w.links.new(tc.outputs['Generated'], mp.inputs['Vector']); w.links.new(mp.outputs['Vector'], grad.inputs['Vector'])
    w.links.new(grad.outputs['Fac'], ramp.inputs['Fac']); w.links.new(ramp.outputs['Color'], bg.inputs['Color']); bg.inputs[1].default_value = 1.6
    for i in range(30):
        a = i / 30 * 6.283; bpy.ops.mesh.primitive_uv_sphere_add(radius=0.12, location=(math.cos(a) * 3, math.sin(a) * 3, (i % 5 - 2) * 0.8))
        o = bpy.context.object; o.visible_camera = False; assign(o, mat(f'sp{i}', '#ffffff', emit=['#FFE2B0', '#FF4D1F', '#7FD6FF'][i % 3], emit_str=40))
    camera((0, -3.4, 0.4), (0, 0, 0.05), lens=70)
    save(f'{OUT}/{which}.png', (1000, 1000), 160)

elif which == 'rings':
    sc = reset()
    ring((-0.12, 0, 0), (math.radians(70), 0, math.radians(20)), 0.24, 0.04, '#E2B95E')
    ring((0.16, 0.02, -0.05), (math.radians(60), math.radians(30), math.radians(-30)), 0.2, 0.032, '#EBCB8A')
    studio(); camera((0, -2.2, 0.9), (0.02, 0, -0.03), lens=85)
    save(f'{OUT}/{which}.png', (1000, 1000), 160)

elif which == 'balloons':
    sc = reset()
    for loc, c, f in (((-0.35, 0, 0.2), '#FF4D1F', False), ((0.3, 0.2, 0.45), '#E8CF9E', True), ((0.05, -0.25, -0.25), '#F6EFE6', False), ((0.55, -0.1, -0.15), '#2340D8', False)):
        balloon(loc, c, 0.34, f)
    studio(); camera((0, -4.2, 0.4), (0.1, 0, 0.1), lens=60)
    save(f'{OUT}/{which}.png', (1000, 1100), 128)

elif which == 'cake':
    sc = reset()
    cyl('cake', 0.55, 0.42, (0, 0, -0.2), rot=(0, 0, 0), m=mat('frost', '#F4EADC', rough=0.6, sheen=0.4), bev=0.05)
    cyl('drip', 0.56, 0.08, (0, 0, 0.0), rot=(0, 0, 0), m=mat('choc', '#3A1E14', rough=0.25, coat=0.6), bev=0.03)
    cyl('plate', 0.75, 0.04, (0, 0, -0.43), rot=(0, 0, 0), m=mat('plate', '#d8d2c8', rough=0.2, coat=1.0))
    flame = mat('flame', '#FFB347', emit='#FFB347', emit_str=40)
    for i in range(6):
        a = i / 6 * 6.283
        x, y = math.cos(a) * 0.32, math.sin(a) * 0.32
        cyl(f'candle{i}', 0.022, 0.24, (x, y, 0.16), rot=(0, 0, 0), m=mat(f'cd{i}', ['#FF4D1F', '#F6EFE6', '#FFD23F'][i % 3], rough=0.4))
        bpy.ops.mesh.primitive_uv_sphere_add(radius=0.03, location=(x, y, 0.32)); fo = bpy.context.object; fo.scale = (1, 1, 1.8); assign(fo, flame)
    light_area('Key', (-1.6, -2.4, 1.6), (0, 0, 0), 2, 180, '#FFE2C0'); reflect_cards()
    bpy.ops.object.light_add(type='POINT', location=(0, 0, 0.45)); bpy.context.object.data.energy = 40; bpy.context.object.data.color = hexc('#FFB347')[:3]
    camera((0, -3.0, 1.4), (0, 0, -0.05), lens=60)
    save(f'{OUT}/{which}.png', (1000, 1000), 160)

print('DONE', which, round(time.time() - t, 1))
