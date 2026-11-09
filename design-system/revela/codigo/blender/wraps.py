"""Gera as texturas da embalagem (wrap) da câmera descartável Revela, frente e topo.
Frente: 2600x1400 px = 13 x 7 cm (200 px/cm). Lente centrada em (480, 760) r=330.
Flash: x 1780-2420, y 150-470. Visor: x 1300-1560, y 170-330.
"""
import subprocess, os
WM = open('/home/claude/rv2/wm_gloock.txt').read()
X0, Y0, X1, Y1 = 6, 187, 2808, 991
WW, WH = X1 - X0, Y1 - Y0
OUT = '/home/claude/rv2/tex'

def wordmark(x, y, h, color):
    s = h / WH
    return f'<g transform="translate({x} {y}) scale({s:.5f}) translate({-X0} {-Y0})"><path fill="{color}" d="{WM}"/></g>'

def mark(x, y, size, bg, half, line):
    s = size / 64
    return (f'<g transform="translate({x} {y}) scale({s:.4f})"><rect width="64" height="64" rx="16" fill="{bg}"/>'
            f'<path d="M14 34.5a18 18 0 0 0 36 0z" fill="{half}"/>'
            f'<path d="M15 29.5a17 17 0 0 1 34 0z" fill="none" stroke="{line}" stroke-width="2.4" stroke-linejoin="round"/></g>')

def cutouts(c):
    # áreas onde ficam lente, flash e visor (pintadas escuras, ficam atrás das peças 3D)
    return (f'<circle cx="480" cy="760" r="350" fill="{c}"/>'
            f'<rect x="1770" y="140" width="660" height="340" rx="40" fill="{c}"/>'
            f'<rect x="1290" y="160" width="280" height="180" rx="30" fill="{c}"/>')

def svg(body, w=2600, h=1400):
    return f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="0 0 {w} {h}">{body}</svg>'

def fine(x, y, txt, color, size=54, anchor='start', family='Schibsted Grotesk', weight=600, ls=0):
    return f'<text x="{x}" y="{y}" font-family="{family}" font-size="{size}" font-weight="{weight}" fill="{color}" text-anchor="{anchor}" letter-spacing="{ls}">{txt}</text>'

WRAPS = {}

# 1 · Festa — laranja revela
b = ['<rect width="2600" height="1400" fill="#FF4D1F"/>',
     '<rect y="1040" width="2600" height="360" fill="#1A0700"/>',
     wordmark(1000, 420, 380, '#1A0700'),
     fine(1010, 1000, 'câmera do evento · 27 poses · ISO 400', '#1A0700', 62),
     fine(90, 1250, 'FESTA · FLASH · 400', '#FF4D1F', 58, 'start', 'Share Tech Mono', 400, 6),
     fine(2520, 1250, 'REVELA EM 12H', '#FFB27A', 58, 'end', 'Share Tech Mono', 400, 6),
     cutouts('#120500')]
WRAPS['festa'] = svg(''.join(b))

# 2 · Casamento — marfim e dourado
b = ['<rect width="2600" height="1400" fill="#F1E7D6"/>',
     '<rect y="1000" width="2600" height="400" fill="#C9A35B"/>',
     '<rect y="980" width="2600" height="8" fill="#A8843F"/>',
     f'<text x="1020" y="760" font-family="Gloock" font-size="250" fill="#2A211A">Ana &amp; Leo</text>',
     fine(1030, 900, '14 · 03 · 2027 · câmera dos convidados', '#6A5A48', 60, weight=500),
     wordmark(1030, 1110, 170, '#2A211A'),
     fine(2520, 1250, '27 POSES', '#2A211A', 60, 'end', 'Share Tech Mono', 400, 6),
     cutouts('#1A140E')]
WRAPS['casamento'] = svg(''.join(b))

# 3 · Aniversário — azul cobalto com confete
import random
random.seed(7)
conf = []
for i in range(130):
    x, y = random.uniform(900, 2600), random.uniform(0, 1000)
    c = random.choice(['#FFD23F', '#FF4D1F', '#F6EFE6', '#7FD6FF'])
    r = random.uniform(-60, 60)
    if random.random() < .5:
        conf.append(f'<rect x="{x:.0f}" y="{y:.0f}" width="46" height="18" rx="4" fill="{c}" transform="rotate({r:.0f} {x:.0f} {y:.0f})"/>')
    else:
        conf.append(f'<circle cx="{x:.0f}" cy="{y:.0f}" r="13" fill="{c}"/>')
b = ['<rect width="2600" height="1400" fill="#2340D8"/>', ''.join(conf),
     '<rect y="1040" width="2600" height="360" fill="#0E1A66"/>',
     wordmark(1000, 430, 380, '#F6EFE6'),
     fine(1010, 990, 'aniversário · 27 poses', '#F6EFE6', 62),
     fine(90, 1250, 'ANIVERSÁRIO · 400', '#FFD23F', 58, 'start', 'Share Tech Mono', 400, 6),
     fine(2520, 1250, '30 ANOS DO RAFA', '#FFD23F', 58, 'end', 'Share Tech Mono', 400, 6),
     cutouts('#060B2E')]
WRAPS['aniversario'] = svg(''.join(b))

# 4 · Noite — verde garrafa e champanhe
b = ['<rect width="2600" height="1400" fill="#17392C"/>',
     '<rect y="1040" width="2600" height="360" fill="#0B1F17"/>',
     '<rect y="1040" width="2600" height="6" fill="#E8CF9E"/>',
     wordmark(1000, 420, 380, '#E8CF9E'),
     fine(1010, 990, 'happy hour · 27 poses · flash', '#E8CF9E', 62),
     fine(90, 1250, 'NOITE · FLASH', '#E8CF9E', 58, 'start', 'Share Tech Mono', 400, 6),
     fine(2520, 1250, 'ISO 800', '#E8CF9E', 58, 'end', 'Share Tech Mono', 400, 6),
     cutouts('#06120D')]
WRAPS['noite'] = svg(''.join(b))

COLORS = {'festa': ('#FF4D1F', '#1A0700'), 'casamento': ('#F1E7D6', '#C9A35B'),
          'aniversario': ('#2340D8', '#0E1A66'), 'noite': ('#17392C', '#0B1F17')}

if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    for k, s in WRAPS.items():
        open(f'{OUT}/wrap-{k}.svg', 'w').write(s)
        subprocess.run(['rsvg-convert', f'{OUT}/wrap-{k}.svg', '-o', f'{OUT}/wrap-{k}.png'], check=True)
        print(k)
