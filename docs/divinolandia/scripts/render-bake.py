"""Draw src/data/divinolandia.json (the baked game data) as a top-down PNG for review.
Run from the repo root: python docs/divinolandia/scripts/render-bake.py"""
import json, math, base64
import numpy as np
from PIL import Image, ImageDraw
d = json.load(open('src/data/divinolandia.json', encoding='utf8'))
n = d['near']; H = np.frombuffer(base64.b64decode(n['h']), dtype=np.uint16).reshape(n['nz'], n['nx']) / 20.0
S = 0.5  # px per metre
x0, z0 = n['x0'], n['z0']; W = int((n['nx'] - 1) * n['cell'] * S); Hh = int((n['nz'] - 1) * n['cell'] * S)
gy, gx = np.gradient(H, n['cell']); hs = np.clip(0.6 + (-gx + gy) * 0.8, 0.2, 1.2)
base = (np.stack([0.42 * hs, 0.55 * hs, 0.30 * hs], -1) * 255).clip(0, 255).astype(np.uint8)
img = Image.fromarray(base).resize((W, Hh), Image.BILINEAR); dr = ImageDraw.Draw(img)
P = lambda x, z: ((x - x0) * S, (z - z0) * S)
for t in range(0, len(d['coffee']), 3):
    x, z, y = d['coffee'][t:t + 3]; dx, dz = math.cos(y) * 4, math.sin(y) * 4
    dr.line([P(x - dx, z - dz), P(x + dx, z + dz)], fill=(40, 80, 30), width=2)
for t in range(0, len(d['trees']), 3):
    x, z, s = d['trees'][t:t + 3]; a, b = P(x, z); dr.ellipse([a - 2, b - 2, a + 2, b + 2], fill=(20, 60, 20))
for w in d['waters']:
    dr.line([P(p[0], p[1]) for p in w['pts']], fill=(50, 110, 220), width=int(w['hw'] * 2 * S) + 1)
for p in d['plazas'] + d['areas']:
    dr.polygon([P(*q) for q in p['pts']], fill=(110, 170, 90) if p['k'] in ('praca', 'verde', 'campo', 'estadio') else (180, 180, 200))
for r in d['roads']:
    dr.line([P(*q) for q in r['pts']], fill=(70, 70, 75) if r['p'] else (160, 90, 60), width=max(1, int(r['hw'] * 2 * S)))
COLS = ['#e7d8c2', '#d8c5a6', '#e3b6a6', '#bcd4cd', '#ccd6d0', '#e0cbb1', '#c7b69e', '#d8bdac', '#f0e2a8', '#b9cfe0', '#f2f0ea', '#e6a98c']
for h in d['houses']:
    x, z, w, dd, rot = h[:5]; c, s_ = math.cos(rot), math.sin(rot)
    pts = [P(x + u * w / 2 * c - v * dd / 2 * s_, z + u * w / 2 * s_ + v * dd / 2 * c) for u, v in ((-1, -1), (1, -1), (1, 1), (-1, 1))]
    dr.polygon(pts, fill=COLS[h[6] % 12], outline=(90, 60, 50))
L = d['landmarks']
for name, p in [('MATRIZ', (L['matriz']['cx'], L['matriz']['cz'])), ('HOSPITAL', L['hospital']), ('TORRE', L['torre'])]:
    a, b = P(*p); dr.ellipse([a - 6, b - 6, a + 6, b + 6], fill=(255, 220, 0), outline=(0, 0, 0)); dr.text((a + 8, b - 8), name, fill=(0, 0, 0))
img.save('docs/divinolandia/mapa/bake-jogo.jpg', quality=84)
a, b = P(-900, -700); c_, e = P(900, 900)
img.crop((int(a), int(b), int(c_), int(e))).save('docs/divinolandia/mapa/bake-jogo-centro.png')
print('ok', img.size)
