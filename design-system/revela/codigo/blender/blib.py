"""Biblioteca Blender do Revela 2.0: materiais, luzes, câmera descartável e objetos de festa."""
import bpy, math, random
import addon_utils
from mathutils import Vector

addon_utils.enable('cycles', default_set=True)

def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    addon_utils.enable('cycles', default_set=True)
    sc = bpy.context.scene
    sc.render.engine = 'CYCLES'
    sc.cycles.device = 'CPU'
    sc.cycles.use_adaptive_sampling = True
    sc.cycles.adaptive_threshold = 0.02
    sc.cycles.max_bounces = 6
    sc.cycles.glossy_bounces = 4
    sc.cycles.transmission_bounces = 6
    sc.cycles.caustics_reflective = False
    sc.cycles.caustics_refractive = False
    sc.cycles.blur_glossy = 1.0
    sc.view_settings.view_transform = 'Standard'
    sc.view_settings.look = 'None'
    sc.render.image_settings.file_format = 'PNG'
    sc.render.image_settings.color_mode = 'RGBA'
    w = bpy.data.worlds.new('W'); sc.world = w
    w.use_nodes = True
    w.node_tree.nodes['Background'].inputs[0].default_value = (0.004, 0.0035, 0.003, 1)
    w.node_tree.nodes['Background'].inputs[1].default_value = 1.0
    return sc

def hexc(h, a=1.0):
    h = h.lstrip('#')
    r, g, b = [int(h[i:i+2], 16) / 255 for i in (0, 2, 4)]
    f = lambda c: c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4
    return (f(r), f(g), f(b), a)

def mat(name, color='#ffffff', rough=0.5, metal=0.0, coat=0.0, trans=0.0, ior=1.45, emit=None, emit_str=0.0, alpha=1.0, sheen=0.0):
    m = bpy.data.materials.new(name); m.use_nodes = True
    p = m.node_tree.nodes['Principled BSDF']
    p.inputs['Base Color'].default_value = hexc(color)
    p.inputs['Roughness'].default_value = rough
    p.inputs['Metallic'].default_value = metal
    p.inputs['Coat Weight'].default_value = coat
    p.inputs['Transmission Weight'].default_value = trans
    p.inputs['IOR'].default_value = ior
    p.inputs['Alpha'].default_value = alpha
    if sheen: p.inputs['Sheen Weight'].default_value = sheen
    if emit:
        p.inputs['Emission Color'].default_value = hexc(emit)
        p.inputs['Emission Strength'].default_value = emit_str
    return m

def img_mat(name, path, rough=0.55, coat=0.3):
    m = bpy.data.materials.new(name); m.use_nodes = True
    nt = m.node_tree; p = nt.nodes['Principled BSDF']
    t = nt.nodes.new('ShaderNodeTexImage'); t.image = bpy.data.images.load(path)
    t.interpolation = 'Cubic'
    nt.links.new(t.outputs['Color'], p.inputs['Base Color'])
    p.inputs['Roughness'].default_value = rough
    p.inputs['Coat Weight'].default_value = coat
    p.inputs['Coat Roughness'].default_value = 0.15
    # leve relevo de papelão
    n = nt.nodes.new('ShaderNodeTexNoise'); n.inputs['Scale'].default_value = 900; n.inputs['Detail'].default_value = 2
    bmp = nt.nodes.new('ShaderNodeBump'); bmp.inputs['Strength'].default_value = 0.04
    nt.links.new(n.outputs['Fac'], bmp.inputs['Height']); nt.links.new(bmp.outputs['Normal'], p.inputs['Normal'])
    return m

def assign(o, m):
    o.data.materials.clear(); o.data.materials.append(m)

def bevel(o, w=0.02, seg=4):
    mod = o.modifiers.new('bev', 'BEVEL'); mod.width = w; mod.segments = seg; mod.limit_method = 'ANGLE'
    o.modifiers.new('wn', 'WEIGHTED_NORMAL')
    for p in o.data.polygons: p.use_smooth = True
    return o

def box(name, size, loc, m=None, bev=0.02):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    o = bpy.context.object; o.name = name; o.scale = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if bev: bevel(o, bev)
    if m: assign(o, m)
    return o

def cyl(name, r, depth, loc, rot=(math.pi/2, 0, 0), m=None, verts=64, bev=0.006):
    bpy.ops.mesh.primitive_cylinder_add(radius=r, depth=depth, location=loc, rotation=rot, vertices=verts)
    o = bpy.context.object; o.name = name
    if bev: bevel(o, bev, 3)
    if m: assign(o, m)
    return o

def light_area(name, loc, target, size, energy, color='#ffffff'):
    bpy.ops.object.light_add(type='AREA', location=loc)
    l = bpy.context.object; l.name = name
    l.data.size = size; l.data.energy = energy; l.data.color = hexc(color)[:3]
    d = Vector(target) - Vector(loc); l.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()
    return l

def camera(loc, target, lens=85, name='Cam'):
    bpy.ops.object.camera_add(location=loc)
    c = bpy.context.object; c.name = name; c.data.lens = lens
    d = Vector(target) - Vector(loc); c.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()
    bpy.context.scene.camera = c
    return c

def reflect_cards():
    # cartões emissivos fora do quadro: dão reflexos em lente, metal e plástico
    em = mat('card', '#ffffff', emit='#FFF4E6', emit_str=6.0)
    for loc, rot, sz in (((-1.6, -2.2, 1.8), (1.0, 0, -0.6), (1.4, 0.5)), ((1.8, -2.0, 0.9), (1.2, 0, 0.7), (0.6, 1.2)), ((0, -2.6, -1.2), (2.2, 0, 0), (2.0, 0.3)), ((-0.9, -3.0, 0.9), (1.35, 0, -0.25), (0.5, 0.18))):
        bpy.ops.mesh.primitive_plane_add(size=1, location=loc, rotation=rot)
        c = bpy.context.object; c.scale = (sz[0], sz[1], 1); assign(c, em)
        c.visible_camera = False; c.visible_shadow = False

def studio(warm=True, strength=1.0):
    reflect_cards()
    light_area('Key', (-2.2, -3.0, 2.4), (0, 0, 0), 2.2, 420 * strength, '#FFE9D2' if warm else '#ffffff')
    light_area('Rim', (2.6, 2.4, 1.6), (0, 0, 0), 1.6, 380 * strength, '#FFC79A')
    light_area('Fill', (2.4, -2.6, -0.6), (0, 0, 0), 3.0, 90 * strength, '#C8D4FF')
    light_area('Top', (0, 0, 3.2), (0, 0, 0), 2.5, 120 * strength)

# ---------------------------------------------------------------- câmera descartável
WRAPCOL = {'festa': ('#FF4D1F', '#1A0700'), 'casamento': ('#F1E7D6', '#C9A35B'),
           'aniversario': ('#2340D8', '#0E1A66'), 'noite': ('#17392C', '#0B1F17')}

def disposable(wrap='festa', root_loc=(0, 0, 0)):
    """Câmera 1.30 x 0.34 x 0.72; frente voltada para -Y. Retorna o empty raiz e o material do flash."""
    bpy.ops.object.empty_add(location=root_loc); root = bpy.context.object; root.name = 'CamRoot'
    parts = []
    plastic = mat('plastic', '#141312', rough=0.38, coat=0.2)
    plastic_dark = mat('plastic2', '#0B0B0B', rough=0.3, coat=0.4)
    main, band = WRAPCOL[wrap]
    wrapm = mat('wrapbase', main, rough=0.55, coat=0.25)
    core = box('core', (1.30, 0.34, 0.72), (0, 0, 0), plastic, 0.045); parts.append(core)
    w = box('wrap', (1.268, 0.352, 0.646), (0, 0, 0), wrapm, 0.012); parts.append(w)
    # decalque frontal e traseiro
    tex = f'/home/claude/rv2/tex/wrap-{wrap}.png'
    dm = img_mat('decal', tex)
    for side, y, rz in (('front', -0.1772, 0), ('back', 0.1772, math.pi)):
        bpy.ops.mesh.primitive_plane_add(size=1, location=(0, y, 0), rotation=(math.pi/2, 0, rz))
        d = bpy.context.object; d.name = 'decal_' + side
        d.scale = (1.24, 0.646 * 1.0, 1); bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
        assign(d, dm if side == 'front' else wrapm); parts.append(d)
    # lente
    lx, lz = -0.6 + 480 / 2600 * 1.24, 0.323 - 760 / 1400 * 0.646
    parts.append(cyl('lens_housing', 0.158, 0.07, (lx, -0.205, lz), m=plastic_dark, bev=0.012))
    parts.append(cyl('lens_ring', 0.128, 0.03, (lx, -0.243, lz), m=mat('chrome', '#d9d9d9', rough=0.12, metal=1.0), bev=0.006))
    parts.append(cyl('lens_inner', 0.104, 0.02, (lx, -0.25, lz), m=mat('lensblack', '#1a2230', rough=0.08, metal=0.8, coat=1.0)))
    glass = mat('glass', '#ffffff', rough=0.02, trans=1.0, ior=1.5)
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.11, location=(lx, -0.205, lz), segments=48, ring_count=24)
    g = bpy.context.object; g.name = 'lens_glass'; g.scale = (1, 0.45, 1)
    for p in g.data.polygons: p.use_smooth = True
    assign(g, glass); parts.append(g)
    # reflexo laranja (eco do símbolo) no fundo da lente
    bpy.ops.mesh.primitive_circle_add(radius=0.06, fill_type='NGON', location=(lx, -0.258, lz - 0.012), rotation=(math.pi/2, 0, 0))
    hl = bpy.context.object; assign(hl, mat('lenscoat', '#FF7A2E', rough=0.2, metal=0.6)); parts.append(hl)
    # flash
    fx, fz = -0.6 + 2100 / 2600 * 1.24, 0.323 - 310 / 1400 * 0.646
    flash_m = mat('flash', '#F3F1EC', rough=0.25, trans=0.35, emit='#FFF6E6', emit_str=0.0)
    fl = box('flash', (0.30, 0.03, 0.15), (fx, -0.188, fz), flash_m, 0.012); parts.append(fl)
    for i in range(9):  # estrias do difusor
        parts.append(box(f'rib{i}', (0.006, 0.012, 0.13), (fx - 0.13 + i * 0.0325, -0.205, fz), flash_m, 0.002))
    parts.append(box('flash_frame', (0.33, 0.02, 0.18), (fx, -0.18, fz), plastic_dark, 0.015))
    # visor
    vx, vz = -0.6 + 1430 / 2600 * 1.24, 0.323 - 250 / 1400 * 0.646
    parts.append(box('vf_frame', (0.13, 0.03, 0.085), (vx, -0.188, vz), plastic_dark, 0.012))
    parts.append(box('vf_glass', (0.1, 0.01, 0.06), (vx, -0.204, vz), mat('vfglass', '#1c2630', rough=0.03, coat=1.0), 0.004))
    # botão do obturador, contador e roda
    parts.append(cyl('shutter', 0.052, 0.04, (0.42, 0.0, 0.372), rot=(0, 0, 0), m=mat('btn', '#FF4D1F' if wrap != 'festa' else '#1A0700', rough=0.35, coat=0.4)))
    parts.append(cyl('shutter_base', 0.07, 0.016, (0.42, 0.0, 0.358), rot=(0, 0, 0), m=plastic_dark))
    parts.append(box('counter', (0.09, 0.07, 0.012), (0.12, 0.05, 0.362), mat('cwin', '#0b0b0b', rough=0.05, coat=1.0), 0.008))
    wheel_m = mat('wheel', '#1d1d1d', rough=0.5)
    parts.append(cyl('wheel', 0.085, 0.07, (0.5, 0.15, 0.37), rot=(0, 0, 0), m=wheel_m, bev=0.004))
    for i in range(36):
        a = i / 36 * 2 * math.pi
        r = box(f'tooth{i}', (0.012, 0.02, 0.066), (0.5 + math.cos(a) * 0.088, 0.15 + math.sin(a) * 0.088, 0.37), wheel_m, 0.003)
        r.rotation_euler = (0, 0, a); parts.append(r)
    # alça
    parts.append(box('lug', (0.05, 0.07, 0.1), (-0.66, 0.0, 0.2), plastic_dark, 0.015))
    for p in parts:
        p.parent = root
    return root, flash_m

# ---------------------------------------------------------------- objetos de festa
def confetti_material_set():
    cols = ['#FF4D1F', '#FFD23F', '#F6EFE6', '#E8CF9E', '#7FD6FF', '#FF8FB1']
    ms = [mat(f'conf{i}', c, rough=0.45, sheen=0.3) for i, c in enumerate(cols)]
    ms.append(mat('foil', '#E8C77A', rough=0.18, metal=1.0))
    ms.append(mat('foil2', '#D9D9D9', rough=0.15, metal=1.0))
    return ms

def confetti_piece(ms, loc, rng):
    kind = rng.random()
    if kind < 0.6:
        bpy.ops.mesh.primitive_plane_add(size=1, location=loc)
        o = bpy.context.object; o.scale = (0.05, 0.022, 1)
    else:
        bpy.ops.mesh.primitive_circle_add(radius=0.018, fill_type='NGON', vertices=16, location=loc)
        o = bpy.context.object
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    sol = o.modifiers.new('s', 'SOLIDIFY'); sol.thickness = 0.002
    if kind < 0.6:
        bend = o.modifiers.new('b', 'SIMPLE_DEFORM'); bend.deform_method = 'BEND'; bend.angle = rng.uniform(-1.2, 1.2); bend.deform_axis = 'Y'
        # subdivisão para dobrar
        sub = o.modifiers.new('sub', 'SUBSURF'); sub.levels = 0
        o.modifiers.move(2, 0)
        bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.subdivide(number_cuts=6); bpy.ops.object.mode_set(mode='OBJECT')
    o.rotation_euler = (rng.uniform(0, 6.28), rng.uniform(0, 6.28), rng.uniform(0, 6.28))
    assign(o, rng.choice(ms))
    return o

def disco_ball(r=0.5, loc=(0, 0, 0)):
    bpy.ops.mesh.primitive_uv_sphere_add(radius=r, segments=44, ring_count=22, location=loc)
    o = bpy.context.object; o.name = 'disco'
    bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.mesh.edge_split(type='EDGE')
    bpy.ops.mesh.inset(thickness=0.004, use_individual=True)
    bpy.ops.object.mode_set(mode='OBJECT')
    m = mat('mirror', '#e8e8e8', rough=0.04, metal=1.0)
    assign(o, m)
    cyl('disco_cap', 0.06, 0.06, (loc[0], loc[1], loc[2] + r + 0.02), rot=(0, 0, 0), m=mat('cap', '#888888', rough=0.3, metal=1))
    return o

def ring(loc, rot, r=0.22, t=0.035, color='#E2B95E', diamond=False):
    bpy.ops.mesh.primitive_torus_add(major_radius=r, minor_radius=t, location=loc, rotation=rot, major_segments=96, minor_segments=32)
    o = bpy.context.object
    for p in o.data.polygons: p.use_smooth = True
    o.scale = (1, 1, 0.7)
    assign(o, mat('gold' + color, color, rough=0.12, metal=1.0))
    return o

def balloon(loc, color, r=0.36, foil=False):
    bpy.ops.mesh.primitive_uv_sphere_add(radius=r, location=loc, segments=64, ring_count=32)
    o = bpy.context.object; o.scale = (1, 1, 1.18)
    for p in o.data.polygons: p.use_smooth = True
    sub = o.modifiers.new('s', 'SUBSURF'); sub.levels = 1
    if foil:
        assign(o, mat('bfoil' + color, color, rough=0.12, metal=1.0))
    else:
        assign(o, mat('latex' + color, color, rough=0.18, coat=1.0, sheen=0.2))
    k = cyl('knot', r * 0.09, r * 0.12, (loc[0], loc[1], loc[2] - r * 1.2), rot=(0, 0, 0), m=o.data.materials[0], verts=24)
    return o

def save(path, res=(1000, 1000), samples=160, transparent=True):
    sc = bpy.context.scene
    sc.render.resolution_x, sc.render.resolution_y = res
    sc.render.resolution_percentage = 100
    sc.cycles.samples = samples
    sc.render.film_transparent = transparent
    sc.render.filepath = path
    bpy.ops.render.render(write_still=True)
