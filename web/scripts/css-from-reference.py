"""Gera web/src/styles/revela2.css a partir de design-system/revela/html/assets/revela2-screens.css:
- tira o :root de tokens (a fonte é tokens.css) e o body;
- troca todo valor hex por var(--token) (tokens existentes por valor; os demais viram tokens `--k-<hex>` em tokens.css);
- torna o quadro .scr fluido (a referência tem 390x844 fixos) e esconde o indicador de home (cromo do aparelho)."""
import re, sys, pathlib
root = pathlib.Path(__file__).resolve().parents[2]
src = (root/'design-system/revela/html/assets/revela2-screens.css').read_text()
tok = (root/'web/src/styles/tokens.css').read_text()
dark = re.search(r':root,\s*\[data-theme="dark"\]\s*\{(.*?)\}', tok, re.S).group(1)
def norm(h):
    h = h.lower().lstrip('#')
    if len(h) in (3,4): h = ''.join(c*2 for c in h)
    return '#' + h
byval = {}
for name, val in re.findall(r'--([a-z0-9-]+)\s*:\s*(#[0-9A-Fa-f]{3,8})\s*;', dark):
    byval.setdefault(norm(val), name)
src = re.sub(r'^/\*.*?\*/\s*:root\{.*?\}\s*', '', src, count=1, flags=re.S)  # cabeçalho + tokens
new = {}
def sub(m):
    h = norm(m.group(0))
    if h in byval: return f'var(--{byval[h]})'
    name = 'k-' + h[1:]
    new[name] = h
    return f'var(--{name})'
css = re.sub(r'#[0-9A-Fa-f]{8}\b|#[0-9A-Fa-f]{6}\b|#[0-9A-Fa-f]{3,4}\b', sub, src)
# .scr fluido; home-ind é cromo do aparelho
css = css.replace('.scr { width: 390px; height: 844px;', '.scr { width: 100%; max-width: 480px; margin: 0 auto; height: 100dvh;')
css = css.replace('body { margin: 0;', 'body.rv2 { margin: 0;')
css = css.replace('.dsk { width: 1440px; height: 900px;', '.dsk { width: 100%; height: 100dvh; min-width: 1100px;')
css += '\n/* fundos de textura do <style> de cada tela da referência */\n.grain{background-image:url(/revela/ref/fx-grain.png)}.flashfx{background-image:url(/revela/ref/fx-bloom.png)}.body--casamento{background-image:url(/revela/ref/body-casamento.jpg)}.sw-festa{background-image:url(/revela/ref/label-festa.jpg)}.sw-casamento{background-image:url(/revela/ref/label-casamento.jpg)}.sw-aniversario{background-image:url(/revela/ref/label-aniversario.jpg)}.sw-noite{background-image:url(/revela/ref/label-noite.jpg)}\n/* app: o indicador de home é do aparelho; só aparece nas telas de comparação (/dev/revela) */\n.scr .home-ind { display: none; }\n.dev-frame .scr .home-ind { display: block; }\n.dev-frame .scr { max-width: 390px; }\n'
(root/'web/src/styles/revela2.css').write_text('/* Revela 2.0 · telas. Gerado por scripts/css-from-reference.py de revela2-screens.css; valores só de tokens.css. */\n' + css)
# tokens novos (idempotente)
marker = '/* --- valores literais da referência Revela (gerado por css-from-reference.py) --- */'
base = tok.split(marker)[0].rstrip()
addon = '\n\n' + marker + '\n:root,\n[data-theme="dark"],\n[data-theme="light"] {\n' + '\n'.join(f'  --{n}: {v};' for n, v in sorted(new.items())) + '\n}\n'
(root/'web/src/styles/tokens.css').write_text(base + addon)
print(len(new), 'tokens novos;', css.count('var(--k-'), 'usos')
