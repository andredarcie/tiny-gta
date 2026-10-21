# "Where is there really a building?" — the evidence the bake uses to keep its generated
# houses only on built ground (tools/bake-divinolandia.ts). Writes
# edificacoes/construido-1m.bin.gz (+ -meta.json): one byte per metre over the town's bake
# frame (x east, z south, centred on the Igreja Matriz), with the bits
#   1  inside a building footprint detected by Microsoft's Global ML Building Footprints
#      (edificacoes/ms-footprints.json, ODbL);
#   2  inside a building drawn on the Google Maps road map (light-grey polygons of the
#      google-mapa-z18 tiles fetched by fetch-satelite.py, kept out of git);
#   4  inside a zone traced by hand on the Google Maps satellite photo where houses stand
#      that neither map has yet (edificacoes/zonas-construidas.json: the newest
#      subdivisions), so the generated houses there stay.
# Run: python docs/divinolandia/scripts/construido.py   (needs numpy + Pillow)
import gzip,json,math,os
import numpy as np
from PIL import Image,ImageDraw,ImageFilter
ZOOM=18
here=os.path.dirname(os.path.abspath(__file__));D=os.path.join(here,'..');root=os.path.join(D,'..','..')
d=json.load(open(os.path.join(root,'src','data','divinolandia.json'),encoding='utf8'))
LAT0,LON0,MX,MZ=d['lat0'],d['lon0'],d['mx'],d['mz']
x0,z0,nx,nz=-1500,-1150,3000,3280                   # the 1 m output grid (the bake's near grid)
out=np.zeros((nz,nx),np.uint8)

# 1 — ML footprints
ms=json.load(open(os.path.join(D,'edificacoes','ms-footprints.json'),encoding='utf8'))['buildings']
fp=Image.new('L',(nx,nz),0);dr=ImageDraw.Draw(fp)
for b in ms:dr.polygon([(p[0]-x0,p[1]-z0) for p in b['p']],fill=1)
out|=np.asarray(fp)

# 2 — Google Maps buildings: the road map's building fill, holes (labels) closed
T=os.path.join(D,'referencias-satelite',f'google-mapa-z{ZOOM}')
names=os.listdir(T);txs=[int(n.split('_')[0]) for n in names];tys=[int(n.split('_')[1].split('.')[0]) for n in names]
X0,Y0=min(txs),min(tys);W=(max(txs)-X0+1)*256;H=(max(tys)-Y0+1)*256
img=np.zeros((H,W,3),np.int16)
for n,tx,ty in zip(names,txs,tys):img[(ty-Y0)*256:(ty-Y0+1)*256,(tx-X0)*256:(tx-X0+1)*256]=np.asarray(Image.open(os.path.join(T,n)).convert('RGB'))
bld=np.zeros((H,W),bool)
for c in((233,234,239),(229,230,236)):bld|=np.abs(img-np.array(c)).max(-1)<=3
bld=np.asarray(Image.fromarray(bld.astype(np.uint8)*255).filter(ImageFilter.MaxFilter(3)).filter(ImageFilter.MinFilter(3)))>0
N=2**ZOOM*256
def merc(x,z):                                       # town-local metres -> map mosaic pixel
  lat,lon=LAT0-z/MZ,LON0+x/MX
  return (lon+180)/360*N-X0*256,(1-np.arcsinh(np.tan(np.radians(lat)))/math.pi)/2*N-Y0*256
votes=np.zeros((nz,nx),np.int16)
for ox in(.25,.75):
  for oz in(.25,.75):
    gx,gz=np.meshgrid(np.arange(nx)+x0+ox,np.arange(nz)+z0+oz)
    px,py=merc(gx,gz);ok=(px>=0)&(px<W)&(py>=0)&(py<H)
    votes+=bld[np.clip(py.astype(int),0,H-1),np.clip(px.astype(int),0,W-1)]&ok
out|=((votes>=2).astype(np.uint8)<<1)

# 4 — zones traced on the satellite photo
zones=json.load(open(os.path.join(D,'edificacoes','zonas-construidas.json'),encoding='utf8'))['zonas']
zm=Image.new('L',(nx,nz),0);dr=ImageDraw.Draw(zm)
for zn in zones:dr.polygon([(p[0]-x0,p[1]-z0) for p in zn['p']],fill=1)
out|=(np.asarray(zm)<<2)

gzip.open(os.path.join(D,'edificacoes','construido-1m.bin.gz'),'wb').write(out.tobytes())
json.dump({'x0':x0,'z0':z0,'nx':nx,'nz':nz,'cell':1,
  'bits':{'1':'ML building footprint (Microsoft)','2':'building on the Google Maps road map','4':'zone traced on the Google Maps satellite photo'},
  'sources':['Microsoft Global ML Building Footprints (ODbL)','Google Maps road map + satellite z18/z19 (reference)']},
  open(os.path.join(D,'edificacoes','construido-1m-meta.json'),'w'),indent=1)
print('wrote',out.shape,'footprint m²',int((out&1).sum()),'google buildings m²',int((out&2).sum()//2),'traced zones m²',int((out&4).sum()//4))
