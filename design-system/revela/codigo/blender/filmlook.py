"""Pós-processamento 'câmera descartável': gradação quente, halação, vinheta, grão e carimbo de data."""
import sys, numpy as np, cv2
from PIL import Image, ImageDraw, ImageFont, ImageFilter

FONT = '/home/claude/rv2/fonts/Share_Tech_Mono.ttf'

def film(src, dst, stamp="'27 03 14", seed=0, denoise=True):
    im = cv2.imread(src, cv2.IMREAD_COLOR)
    if denoise:
        im = cv2.fastNlMeansDenoisingColored(im, None, 5, 7, 7, 21)
    f = im.astype(np.float32) / 255
    # curva e calor
    f = np.clip(f * 1.04, 0, 1)
    f = f ** 0.95
    b, g, r = cv2.split(f)
    r = np.clip(r * 1.06 + 0.015, 0, 1); b = np.clip(b * 0.9 + 0.02, 0, 1); g = np.clip(g * 0.99 + 0.01, 0, 1)
    f = cv2.merge([b, g, r])
    # halação: brilho vermelho em altas luzes
    lum = cv2.cvtColor(f, cv2.COLOR_BGR2GRAY)
    hi = np.clip((lum - 0.75) / 0.25, 0, 1)
    hal = cv2.GaussianBlur(hi, (0, 0), 9)
    f[..., 2] = np.clip(f[..., 2] + hal * 0.25, 0, 1); f[..., 1] = np.clip(f[..., 1] + hal * 0.07, 0, 1)
    # vinheta
    h, w = lum.shape
    y, x = np.mgrid[0:h, 0:w].astype(np.float32)
    d = np.hypot((x - w / 2) / (w / 2), (y - h / 2) / (h / 2))
    f *= (1 - 0.35 * np.clip(d - 0.55, 0, 1) ** 1.4)[..., None]
    # grão
    rng = np.random.default_rng(seed)
    gr = rng.normal(0, 0.035, (h, w)).astype(np.float32)
    gr = cv2.GaussianBlur(gr, (0, 0), 0.6)
    f = np.clip(f + gr[..., None], 0, 1)
    out = Image.fromarray(cv2.cvtColor((f * 255).astype(np.uint8), cv2.COLOR_BGR2RGB))
    if stamp:
        fs = int(w * 0.055)
        font = ImageFont.truetype(FONT, fs)
        layer = Image.new('RGBA', out.size, (0, 0, 0, 0)); dr = ImageDraw.Draw(layer)
        tw = dr.textlength(stamp, font=font)
        pos = (w - tw - w * 0.07, h - fs * 2.1)
        dr.text(pos, stamp, font=font, fill=(255, 150, 60, 255))
        glow = layer.filter(ImageFilter.GaussianBlur(fs * 0.25))
        out = Image.alpha_composite(out.convert('RGBA'), glow)
        out = Image.alpha_composite(out, glow)
        out = Image.alpha_composite(out, layer).convert('RGB')
    out.save(dst, quality=88)

if __name__ == '__main__':
    film(sys.argv[1], sys.argv[2], sys.argv[3] if len(sys.argv) > 3 else "'27 03 14")
