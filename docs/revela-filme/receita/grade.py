"""Revela · Filme 35mm — transformação de cor (a parte que vira LUT 3D).
Emulação de negativo colorido de consumo, ISO 400, copiado em papel: pretos levantados e
levemente frios, altas luzes quentes com ombro suave, verdes para o oliva, azuis para o ciano,
pele protegida. Entrada e saída em sRGB codificado, 0..1."""
import numpy as np

def s2l(c): return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)
def l2s(c):
    c = np.clip(c, 0, None)
    return np.where(c <= 0.0031308, c * 12.92, 1.055 * c ** (1 / 2.4) - 0.055)

M1 = np.array([[0.4122214708, 0.5363325363, 0.0514459929], [0.2119034982, 0.6806995451, 0.1073969566], [0.0883024619, 0.2817188376, 0.6299787005]])
M2 = np.array([[0.2104542553, 0.7936177850, -0.0040720468], [1.9779984951, -2.4285922050, 0.4505937099], [0.0259040371, 0.7827717662, -0.8086757660]])
M1i, M2i = np.linalg.inv(M1), np.linalg.inv(M2)
def to_oklab(lin): return np.cbrt(lin @ M1.T) @ M2.T
def from_oklab(lab): return ((lab @ M2i.T) ** 3) @ M1i.T

def scurve(x, pivot=0.42, k=1.22):
    lo = pivot * (np.clip(x, 0, pivot) / pivot) ** k
    hi = 1 - (1 - pivot) * ((1 - np.clip(x, pivot, 1)) / (1 - pivot)) ** k
    return np.where(x < pivot, lo, hi)
def bump(h, center, width):
    d = np.angle(np.exp(1j * (h - np.deg2rad(center))))
    return np.exp(-0.5 * (d / np.deg2rad(width)) ** 2)
def sstep(a, b, x):
    t = np.clip((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t)

def grade(c):
    c = np.asarray(c, np.float64)
    # 1. exposição e balanço quente, em luz linear
    lin = s2l(c) * 2 ** 0.10
    lin = lin * np.array([1.06, 1.0, 0.905])
    # 2. cor em Oklab: matiz e saturação por faixa
    lab = to_oklab(np.clip(lin, 0, None))
    L, a, b = lab[..., 0], lab[..., 1], lab[..., 2]
    C = np.hypot(a, b); h = np.arctan2(b, a)
    skin, red, yel, grn, cyn, blu, mag = bump(h, 55, 22), bump(h, 28, 18), bump(h, 100, 20), bump(h, 142, 26), bump(h, 205, 28), bump(h, 264, 26), bump(h, 330, 26)
    h = h + np.deg2rad(-12) * grn + np.deg2rad(-14) * blu + np.deg2rad(6) * cyn + np.deg2rad(4) * red + np.deg2rad(-5) * mag
    sat = 1.00 * (1 + 0.06 * red + 0.00 * skin + 0.04 * yel - 0.22 * grn - 0.10 * cyn - 0.20 * blu - 0.10 * mag)
    sat = sat * (1 - 0.25 * sstep(0.80, 1.0, L)) * (1 - 0.08 * sstep(0.25, 0.0, L))
    # compressão de croma: cores muito saturadas perdem mais (o negativo não sustenta neon)
    C2 = C * sat; C2 = C2 / (1 + 0.7 * C2 ** 2)
    # densidade: cor saturada escurece um pouco
    L2 = L * (1 - 0.22 * C2 * (1 - 0.6 * skin))
    lin = from_oklab(np.stack([L2, C2 * np.cos(h), C2 * np.sin(h)], -1))
    e = l2s(np.clip(lin, 0, 1))
    # 3. curva de contraste com ombro suave
    e = scurve(np.clip(e, 0, 1))
    # 4. viragem: sombras frias e esverdeadas, altas luzes amareladas
    Y = (e @ np.array([0.2126, 0.7152, 0.0722]))[..., None]
    sh, hi = (1 - Y) ** 2.2, Y ** 2.0
    e = e + sh * np.array([-0.002, 0.007, 0.012]) + hi * np.array([0.020, 0.008, -0.034])
    # 5. papel: preto levantado e branco que não estoura
    e = 0.036 + e * (0.972 - 0.036)
    e = e * np.array([1.0, 0.995, 0.985]) + np.array([0.004, 0.002, 0.004]) * (1 - Y)
    return np.clip(e, 0, 1)

def bw(c):
    """Preto e branco de filme: mistura pancromática, curva forte, papel morno."""
    c = np.asarray(c, np.float64)
    y = (s2l(c) @ np.array([0.30, 0.56, 0.14]))
    e = scurve(l2s(y * 2 ** 0.05), 0.42, 1.38)
    e = 0.035 + e * 0.945
    return np.clip(np.stack([e * 1.0 + 0.004, e * 0.992 + 0.002, e * 0.972], -1), 0, 1)

def lattice(n):
    r = np.linspace(0, 1, n)
    B, G, R = np.meshgrid(r, r, r, indexing='ij')   # índice = r + g*n + b*n*n
    return np.stack([R, G, B], -1).reshape(-1, 3)

def write_cube(path, n, fn, title):
    v = fn(lattice(n))
    with open(path, 'w') as f:
        f.write(f'TITLE "{title}"\n# Revela · gerado por f35/grade.py · entrada e saída sRGB\nLUT_3D_SIZE {n}\nDOMAIN_MIN 0.0 0.0 0.0\nDOMAIN_MAX 1.0 1.0 1.0\n')
        for r, g, b in v: f.write(f'{r:.6f} {g:.6f} {b:.6f}\n')

def apply_exact(img8, fn=grade): return fn(img8.astype(np.float64) / 255)
