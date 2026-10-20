// Reference capture from Google Street View for modelling a real Divinolândia building
// (manual tool, not a test; the images stay LOCAL — docs/divinolandia/.gitignore keeps
// referencias-streetview/ out of git). Runs headed: the image endpoint refuses headless.
//
//   npx tsx tools/capture-streetview.ts <name> <lat> <lng> [heading,heading,...]
//   (env FOV=<deg> zooms in, default 80; PITCH=<deg> looks up)
//
// Opens Google Maps' Street View at the point, reads the panorama id it lands on, then
// saves 1280×720 views at the given headings (degrees from north; default every 45°),
// plus the panoramas Maps links as neighbours, to
// docs/divinolandia/referencias-streetview/<name>/.
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';

const[name,latS,lngS,headS]=process.argv.slice(2);
if(!name||!latS||!lngS){console.error('usage: capture-streetview.ts <name> <lat> <lng> [h1,h2,…]');process.exit(1);}
const lat=+latS,lng=+lngS;
const FOV=+(process.env.FOV||80),PITCH=+(process.env.PITCH||0);
const headings=headS?headS.split(',').map(Number):[0,45,90,135,180,225,270,315];
const OUT=`docs/divinolandia/referencias-streetview/${name}`;
await mkdir(OUT,{recursive:true});

const browser=await chromium.launch({headless:false});
try{
  const page=await browser.newPage({viewport:{width:1280,height:720},locale:'pt-BR'});
  await page.goto(`https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${lat},${lng}`,{waitUntil:'domcontentloaded'});
  // consent screens (EU) or the panorama loading: wait for the URL to carry the pano id
  const panos=new Set<string>();
  for(let i=0;i<40&&!panos.size;i++){
    await page.waitForTimeout(500);
    const m=page.url().match(/!1s([A-Za-z0-9_-]{20,})!/);
    if(m)panos.add(m[1]);
  }
  if(!panos.size)throw new Error('no panorama found near '+lat+','+lng+' (url: '+page.url()+')');
  const main=[...panos][0];
  const log:string[]=[`point ${lat},${lng}`,`panorama ${main}`];
  // where the panorama really stands (Maps puts it in the URL as @lat,lng), and the same
  // spot in game WORLD metres (bake projection of tools/bake-divinolandia.ts + DIV_OX/OZ)
  const at=page.url().match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
  if(at){
    const plat=+at[1],plng=+at[2],LAT0=-21.66209,LON0=-46.739323;
    const MX=111320*Math.cos(LAT0*Math.PI/180),MZ=110574;
    log.push(`pano at ${plat},${plng}`,`world x=${(5000+(plng-LON0)*MX).toFixed(1)} z=${(5000+(LAT0-plat)*MZ).toFixed(1)}`);
  }
  for(const h of headings){
    const url=`https://streetviewpixels-pa.googleapis.com/v1/thumbnail?cb_client=maps_sv.tactile&w=1280&h=720&pitch=${PITCH}&thumbfov=${FOV}&panoid=${main}&yaw=${h}`;
    const r=await page.request.get(url);
    if(r.status()!==200||!r.headers()['content-type']?.startsWith('image/')){log.push(`h${h}: HTTP ${r.status()}`);continue;}
    await writeFile(`${OUT}/${name}-h${String(h).padStart(3,"0")}${FOV!==80?"-f"+FOV:""}.jpg`,await r.body());
    log.push(`h${h}: ok`);
  }
  await writeFile(`${OUT}/capture.txt`,log.join('\n')+'\n');
  console.log(log.join('\n'));
}finally{
  await browser.close();
}
