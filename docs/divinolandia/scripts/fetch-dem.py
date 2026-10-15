"""Download AWS Terrain Tiles (terrarium encoding, SRTM-derived) for a lat/lon box,
stitch them, crop and save: relevo/dem.npy (float32 metres) + relevo/dem-meta.json
+ a hillshade preview PNG.  Usage: python -I fetch-dem.py"""
import math, io, json, urllib.request, os
import numpy as np
from PIL import Image
Z = 15
S, W, N, E = -21.715, -46.795, -21.610, -46.680
def tile(lat, lon):
    n = 2 ** Z
    x = (lon + 180) / 360 * n
    y = (1 - math.asinh(math.tan(math.radians(lat))) / math.pi) / 2 * n
    return x, y
x0, y0 = tile(N, W); x1, y1 = tile(S, E)
tx0, ty0, tx1, ty1 = int(x0), int(y0), int(x1), int(y1)
os.makedirs('relevo/tiles', exist_ok=True)
rows = []
for ty in range(ty0, ty1 + 1):
    row = []
    for tx in range(tx0, tx1 + 1):
        p = f'relevo/tiles/{Z}_{tx}_{ty}.png'
        if not os.path.exists(p):
            url = f'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{Z}/{tx}/{ty}.png'
            open(p, 'wb').write(urllib.request.urlopen(url, timeout=60).read())
        a = np.asarray(Image.open(p).convert('RGB')).astype(np.float64)
        row.append(a[..., 0] * 256 + a[..., 1] + a[..., 2] / 256 - 32768)
    rows.append(np.hstack(row))
big = np.vstack(rows)
px0 = int((x0 - tx0) * 256); py0 = int((y0 - ty0) * 256)
px1 = int((x1 - tx0) * 256); py1 = int((y1 - ty0) * 256)
dem = big[py0:py1, px0:px1].astype(np.float32)
np.save('relevo/dem.npy', dem)
meta = dict(source='AWS Terrain Tiles (terrarium) — SRTM/Mapzen, public domain-ish (see LICENSE notes)',
            zoom=Z, south=S, west=W, north=N, east=E, rows=dem.shape[0], cols=dem.shape[1],
            min=float(dem.min()), max=float(dem.max()))
json.dump(meta, open('relevo/dem-meta.json', 'w'), indent=2)
# hillshade preview
gy, gx = np.gradient(dem.astype(np.float64), 4.4)
sl = np.pi / 2 - np.arctan(np.hypot(gx, gy)); asp = np.arctan2(-gx, gy)
az, alt = math.radians(315), math.radians(45)
hs = np.sin(alt) * np.sin(sl) + np.cos(alt) * np.cos(sl) * np.cos(az - asp)
t = (dem - dem.min()) / (dem.max() - dem.min())
rgb = np.stack([0.25 + 0.6 * t, 0.45 + 0.35 * t, 0.2 + 0.3 * t], -1) * (0.35 + 0.65 * np.clip(hs, 0, 1))[..., None]
Image.fromarray((np.clip(rgb, 0, 1) * 255).astype(np.uint8)).save('relevo/relevo-sombreado.png')
print(meta)
