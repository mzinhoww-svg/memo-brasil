"""Revela · Filme 35mm — pipeline completo de referência (mesmo algoritmo do film35.ts).
halação -> LUT 3D (17³, trilinear) -> vinheta -> grão -> [carimbo fica no canvas]."""
import numpy as np, sys
sys.path.insert(0, '/home/claude/rv2/f35'); from grade import grade, bw, lattice
N = 17
P = dict(halation=0.85, vignette=0.30, grain=0.030)

def lut8(fn=grade, n=N): return np.clip(np.rint(fn(lattice(n)) * 255), 0, 255).astype(np.uint8)   # (n³,3), índice r + g*n + b*n*n

def mulberry32(seed):
    a = seed & 0xFFFFFFFF
    def nxt():
        nonlocal a
        a = (a + 0x6D2B79F5) & 0xFFFFFFFF
        t = a
        t = ((t ^ (t >> 15)) * (t | 1)) & 0xFFFFFFFF
        t ^= (t + (((t ^ (t >> 7)) * (t | 61)) & 0xFFFFFFFF)) & 0xFFFFFFFF
        return ((t ^ (t >> 14)) & 0xFFFFFFFF) / 4294967296
    return nxt

def grain_tile(seed):
    T = 256; r = mulberry32(seed)
    t = np.array([r() + r() + r() + r() - 2 for _ in range(T * T)], np.float64).reshape(T, T)
    s = np.zeros_like(t)
    for dy in (-1, 0, 1):
        for dx in (-1, 0, 1):
            s += np.roll(np.roll(t, dy, 0), dx, 1) * (2 if dy == 0 else 1) * (2 if dx == 0 else 1)
    s /= 16
    return (s / np.sqrt((s * s).mean())).astype(np.float32)

def box_blur(a, r):
    """Média móvel separável com borda repetida, 3 passadas (float32)."""
    for _ in range(3):
        for axis in (1, 0):
            p = np.concatenate([np.repeat(a.take([0], axis), r, axis), a, np.repeat(a.take([-1], axis), r, axis)], axis).astype(np.float64)
            c = np.cumsum(p, axis); c = np.concatenate([np.zeros_like(c.take([0], axis)), c], axis)
            n = a.shape[axis]
            a = ((c.take(range(2 * r + 1, 2 * r + 1 + n), axis) - c.take(range(0, n), axis)) / (2 * r + 1)).astype(np.float32)
    return a

def halation_map(rgb, w, h):
    f = max(1, int(np.ceil(max(w, h) / 200))); sw, sh = w // f, h // f
    Y = (rgb[..., 0] * 0.2126 + rgb[..., 1] * 0.7152 + rgb[..., 2] * 0.0722).astype(np.float32)
    small = Y[:sh * f, :sw * f].reshape(sh, f, sw, f).mean((1, 3)) / 255
    m = np.clip((small - 0.66) / 0.34, 0, 1); m = (m * np.sqrt(m)).astype(np.float32)
    m = box_blur(m, max(1, round(max(sw, sh) * 0.016)))
    # ampliação bilinear (centro do bloco)
    ys = np.clip((np.arange(h) + 0.5) / f - 0.5, 0, sh - 1); xs = np.clip((np.arange(w) + 0.5) / f - 0.5, 0, sw - 1)
    y0 = np.floor(ys).astype(int); x0 = np.floor(xs).astype(int); y1 = np.minimum(y0 + 1, sh - 1); x1 = np.minimum(x0 + 1, sw - 1)
    fy = (ys - y0)[:, None].astype(np.float32); fx = (xs - x0)[None, :].astype(np.float32)
    return (m[y0][:, x0] * (1 - fx) + m[y0][:, x1] * fx) * (1 - fy) + (m[y1][:, x0] * (1 - fx) + m[y1][:, x1] * fx) * fy

def apply_lut(rgb, lut, n=N):
    v = np.clip(rgb, 0, 255).astype(np.float32) * ((n - 1) / 255)
    i0 = np.minimum(np.floor(v).astype(int), n - 2); f = v - i0
    r0, g0, b0 = i0[..., 0], i0[..., 1], i0[..., 2]; fr, fg, fb = f[..., 0:1], f[..., 1:2], f[..., 2:3]
    L = lut.astype(np.float32)
    def at(dr, dg, db): return L[(r0 + dr) + (g0 + dg) * n + (b0 + db) * n * n]
    c00 = at(0, 0, 0) * (1 - fr) + at(1, 0, 0) * fr; c10 = at(0, 1, 0) * (1 - fr) + at(1, 1, 0) * fr
    c01 = at(0, 0, 1) * (1 - fr) + at(1, 0, 1) * fr; c11 = at(0, 1, 1) * (1 - fr) + at(1, 1, 1) * fr
    return (c00 * (1 - fg) + c10 * fg) * (1 - fb) + (c01 * (1 - fg) + c11 * fg) * fb

def film35(img8, seed=1, lut=None, halation=P['halation'], vignette=P['vignette'], grain=P['grain'], mono=False):
    h, w = img8.shape[:2]; lut = lut8(bw if mono else grade) if lut is None else lut
    rgb = img8.astype(np.float32)
    if halation > 0:
        m = halation_map(rgb, w, h)[..., None] * (halation * 255)
        rgb = rgb + m * np.array([1.0, 0.30, 0.06], np.float32)
    rgb = apply_lut(rgb, lut)
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    if vignette > 0:
        d = np.hypot((xx + 0.5 - w / 2) / (w / 2), (yy + 0.5 - h / 2) / (h / 2))
        t = np.clip((d - 0.45) / 0.80, 0, 1); rgb = rgb * (1 - vignette * t * t * (3 - 2 * t))[..., None]
    if grain > 0:
        tile = grain_tile(seed); cs = max(1, round(max(w, h) / 1100))
        gx = (np.arange(w) // cs); gy = (np.arange(h) // cs)
        n1 = tile[(gy & 255)[:, None], (gx & 255)[None, :]]; n2 = tile[((gy + 31) & 255)[:, None], ((gx + 97) & 255)[None, :]]
        Y = (rgb[..., 0] * 0.2126 + rgb[..., 1] * 0.7152 + rgb[..., 2] * 0.0722) / 255
        amp = grain * 255 * (0.22 + 0.78 * (1 - (2 * Y - 1) ** 2)) * (1 - 0.55 * Y * Y)
        rgb = rgb + np.stack([n1 * amp, (n1 * 0.85 + n2 * 0.15) * amp * 0.92, (n1 * 0.7 + n2 * 0.3) * amp * 1.08], -1)
    return np.clip(np.rint(rgb), 0, 255).astype(np.uint8)

if __name__ == '__main__':
    import cv2
    src, dst = sys.argv[1], sys.argv[2]
    im = cv2.cvtColor(cv2.imread(src), cv2.COLOR_BGR2RGB)
    cv2.imwrite(dst, cv2.cvtColor(film35(im, seed=int(sys.argv[3]) if len(sys.argv) > 3 else 1), cv2.COLOR_RGB2BGR), [cv2.IMWRITE_JPEG_QUALITY, 90])
