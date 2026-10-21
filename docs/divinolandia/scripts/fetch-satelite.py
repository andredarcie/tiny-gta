# Downloads Google Maps tiles over the town into referencias-satelite/ (kept out of git —
# reference only, like the Street View frames):
#   google-z19/       the satellite photo (~0.28 m/px), to look at the town from above;
#   google-mapa-z18/  the road map (~0.55 m/px), whose light-grey polygons are the
#                     buildings Google knows — scripts/construido.py reads them.
# Run: python docs/divinolandia/scripts/fetch-satelite.py
import json,math,os,time,urllib.request
from concurrent.futures import ThreadPoolExecutor
here=os.path.dirname(os.path.abspath(__file__));root=os.path.join(here,'..','..','..')
d=json.load(open(os.path.join(root,'src','data','divinolandia.json'),encoding='utf8'))
LAT0,LON0,MX,MZ=d['lat0'],d['lon0'],d['mx'],d['mz']
def tile(x,z,zoom):
  lat,lon=LAT0-z/MZ,LON0+x/MX;n=2**zoom
  return int((lon+180)/360*n),int((1-math.asinh(math.tan(math.radians(lat)))/math.pi)/2*n)
def fetch(layer,zoom,folder):
  # the town's whole bake frame where houses may stand (x -1200..1500, z -750..2150)
  x0,y0=tile(-1200,-750,zoom);x1,y1=tile(1500,2150,zoom)
  out=os.path.join(here,'..','referencias-satelite',folder);os.makedirs(out,exist_ok=True)
  ext='jpg' if layer=='s' else 'png'
  def get(t):
    tx,ty=t;f=os.path.join(out,f'{tx}_{ty}.{ext}')
    if os.path.exists(f):return 0
    url=f'https://mt{(tx+ty)%4}.google.com/vt/lyrs={layer}&x={tx}&y={ty}&z={zoom}&hl=pt-BR'
    for k in range(4):
      try:
        data=urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':'Mozilla/5.0'}),timeout=30).read()
        open(f,'wb').write(data);return 1
      except Exception:time.sleep(1+k)
    raise RuntimeError('failed '+url)
  jobs=[(tx,ty) for ty in range(y0,y1+1) for tx in range(x0,x1+1)]
  with ThreadPoolExecutor(6) as ex:n=sum(ex.map(get,jobs))
  print(folder,'downloaded',n,'of',len(jobs))
fetch('s',19,'google-z19')
fetch('m',18,'google-mapa-z18')
