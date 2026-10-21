"""Clean the DEM (fill no-data holes) and draw an annotated overview map:
hillshaded relief + OSM roads, rivers, plazas and landmarks with their altitude.
Writes relevo/dem.npy (cleaned, in place), mapa/visao-geral.png and
osm/marcos.json (landmarks with lat/lon/altitude). Run from docs/divinolandia."""
import json, math, os
import numpy as np
from PIL import Image, ImageDraw, ImageFont

meta = json.load(open('relevo/dem-meta.json'))
dem = np.load('relevo/dem.npy').astype(np.float64)
bad = (dem < 600) | (dem > 1800)
for _ in range(50):                       # iterative 3x3 mean fill of the holes
    if not bad.any():
        break
    v = np.where(bad, 0, dem); w = (~bad).astype(np.float64)
    pv = np.pad(v, 1); pw = np.pad(w, 1)
    sv = sum(pv[1 + dy:pv.shape[0] - 1 + dy, 1 + dx:pv.shape[1] - 1 + dx] for dy in (-1, 0, 1) for dx in (-1, 0, 1))
    sw = sum(pw[1 + dy:pw.shape[0] - 1 + dy, 1 + dx:pw.shape[1] - 1 + dx] for dy in (-1, 0, 1) for dx in (-1, 0, 1))
    fill = bad & (sw > 0)
    dem[fill] = sv[fill] / sw[fill]; bad &= ~fill
np.save('relevo/dem.npy', dem.astype(np.float32))
meta['min'], meta['max'] = float(dem.min()), float(dem.max())
json.dump(meta, open('relevo/dem-meta.json', 'w'), indent=2)

R, C = dem.shape
Z = meta['zoom']
def merc(lat, lon):
    n = 2 ** Z
    return (lon + 180) / 360 * n * 256, (1 - math.asinh(math.tan(math.radians(lat))) / math.pi) / 2 * n * 256
ox, oy = merc(meta['north'], meta['west'])
def px(lat, lon):
    x, y = merc(lat, lon); return x - ox, y - oy
def elev(lat, lon):
    x, y = px(lat, lon); x = min(max(int(x), 0), C - 1); y = min(max(int(y), 0), R - 1)
    return float(dem[y, x])

# --- hillshade base
gy, gx = np.gradient(dem, 4.4)
sl = np.pi / 2 - np.arctan(np.hypot(gx, gy)); asp = np.arctan2(-gx, gy)
hs = np.sin(math.radians(45)) * np.sin(sl) + np.cos(math.radians(45)) * np.cos(sl) * np.cos(math.radians(315) - asp)
t = (dem - dem.min()) / (dem.max() - dem.min())
rgb = np.stack([0.30 + 0.55 * t, 0.50 + 0.30 * t, 0.25 + 0.30 * t], -1) * (0.35 + 0.65 * np.clip(hs, 0, 1))[..., None]
img = Image.fromarray((np.clip(rgb, 0, 1) * 255).astype(np.uint8)).convert('RGBA')
dr = ImageDraw.Draw(img)

osm = json.load(open('osm/urbano.json', encoding='utf8'))
ROADW = {'primary': 7, 'primary_link': 5, 'secondary': 6, 'tertiary': 5, 'residential': 3, 'unclassified': 3, 'service': 2}
for e in osm['elements']:
    t = e.get('tags', {}); g = e.get('geometry')
    if not g:
        continue
    pts = [px(p['lat'], p['lon']) for p in g]
    if t.get('natural') == 'water' and len(pts) > 2:
        dr.polygon(pts, fill=(60, 120, 200, 255))
    elif t.get('leisure') in ('park', 'stadium', 'pitch') and len(pts) > 2:
        dr.polygon(pts, fill=(90, 170, 80, 255))
    elif 'waterway' in t:
        dr.line(pts, fill=(40, 100, 220, 255), width=5 if t['waterway'] == 'river' else 2)
for e in osm['elements']:
    t = e.get('tags', {}); g = e.get('geometry')
    if g and t.get('highway') in ROADW:
        dr.line([px(p['lat'], p['lon']) for p in g], fill=(250, 245, 230, 255), width=ROADW[t['highway']])
    if g and 'building' in t and len(g) > 2:
        dr.polygon([px(p['lat'], p['lon']) for p in g], fill=(200, 80, 60, 255))

# --- landmarks (OSM ids picked by hand from osm/urbano.json; see README)
def centroid(e):
    if 'lat' in e: return e['lat'], e['lon']
    g = e['geometry']; return sum(p['lat'] for p in g) / len(g), sum(p['lon'] for p in g) / len(g)
byid = {(e['type'], e['id']): e for e in osm['elements']}
MARCOS = [
    ('Igreja Matriz (Paróquia do Divino Espírito Santo)', 'way', 542649940),
    ('Praça Prof. Ladislau Rodrigues Pinto (praça da Matriz)', 'way', 732002964),
    ('Prefeitura Municipal', 'way', 543759772),
    ('Hospital (OSM: Hospital Ortopedista de Divinolândia)', 'way', 542649938),
    ('Torre de comunicação (sul, alta)', 'way', 543759751),
    ('Torre celular (centro A)', 'node', 8051191473),
    ('Torre celular (centro B)', 'node', 8051191474),
    ('Torre celular (norte)', 'node', 8051200595),
    ('Estádio Municipal Armando Grespan', 'way', 542649859),
    ('Cemitério Municipal', 'way', 536783868),
    ('Praça Jorge Galhano', 'way', 536783873),
    ('Praça Nossa Senhora do Rosário', 'way', 732002971),
    ('Praça Dom Bosco', 'way', 732004527),
    ('Igreja São Francisco (Igreja Ecológica)', 'way', 543759981),
    ('Posto Petrobras', 'node', 13690275377),
    ('Polícia Militar', 'node', 13690279160),
    ('Escola Estadual Dep. Vicente Nasser', 'way', 542649937),
]
font = ImageFont.truetype("C:/Windows/Fonts/arialbd.ttf", 22) if os.path.exists("C:/Windows/Fonts/arialbd.ttf") else ImageFont.load_default(size=22)
out = []
for name, typ, oid in MARCOS:
    e = byid.get((typ, oid))
    if not e:
        print('missing', name); continue
    lat, lon = centroid(e); x, y = px(lat, lon); h = elev(lat, lon)
    out.append(dict(nome=name, osm=f'{typ}/{oid}', lat=round(lat, 6), lon=round(lon, 6), altitude_m=round(h)))
    dr.ellipse([x - 9, y - 9, x + 9, y + 9], fill=(255, 220, 0, 255), outline=(0, 0, 0, 255), width=3)
    dr.text((x + 12, y - 12), f'{name.split(" (")[0]} {round(h)}m', fill=(0, 0, 0, 255), font=font, stroke_width=3, stroke_fill=(255, 255, 255, 255))
# river samples
for e in osm['elements']:
    t = e.get('tags', {})
    if t.get('name') == 'Rio do Peixe' and e.get('geometry'):
        hs_ = [elev(p['lat'], p['lon']) for p in e['geometry']]
        out.append(dict(nome='Rio do Peixe (trecho)', osm=f"way/{e['id']}", altitude_min_m=round(min(hs_)), altitude_max_m=round(max(hs_))))
json.dump(out, open('osm/marcos.json', 'w', encoding='utf8'), ensure_ascii=False, indent=2)
os.makedirs('mapa', exist_ok=True)
img.convert('RGB').save('mapa/visao-geral.png')
# zoomed crop on the town
x0, y0 = px(-21.648, -46.756); x1, y1 = px(-21.684, -46.718)
img.crop((int(x0), int(y0), int(x1), int(y1))).convert('RGB').save('mapa/centro-urbano.png')
for o in out: print(o)

# --- compact, versioned DEM for the game bake: 2x downsampled (~8.8 m, still finer than
# SRTM's native 30 m), uint16 decimetres above 500 m, gzip. tools/bake-divinolandia.ts reads it.
import gzip
d2 = dem[:R // 2 * 2, :C // 2 * 2].reshape(R // 2, 2, C // 2, 2).mean(axis=(1, 3))
u16 = np.clip(np.round((d2 - 500) * 10), 0, 65535).astype('<u2')
with gzip.open('relevo/dem-u16.bin.gz', 'wb', compresslevel=9) as f:
    f.write(u16.tobytes())
small = dict(meta, rows=int(d2.shape[0]), cols=int(d2.shape[1]), zoom_px_scale=0.5,
             encoding='uint16 little-endian, (altitude_m - 500) * 10, row-major north→south, gzip',
             zoom_note='pixel (i,j) covers Web-Mercator z15 pixels (2i..2i+1, 2j..2j+1) of the crop')
json.dump(small, open('relevo/dem-u16-meta.json', 'w'), indent=2)
print('dem-u16', d2.shape)
