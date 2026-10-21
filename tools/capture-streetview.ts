// Reference capture from Google Street View for modelling a real Divinolândia building
// (manual tool, not a test; the images stay LOCAL — docs/divinolandia/.gitignore keeps
// referencias-streetview/ out of git). Runs headed: the image endpoint refuses headless.
//
//   npx tsx tools/capture-streetview.ts <name> <lat> <lng> [heading,heading,...]
//   (env FOV=<deg> zooms in, default 80; PITCH=<deg> looks up)
//   npx tsx tools/capture-streetview.ts --batch <jobs.json>
//
// Opens Google Maps' Street View at the point, reads the panorama id it lands on, then
// saves 1280×720 views at the given headings (degrees from north; default every 45°) to
// docs/divinolandia/referencias-streetview/<name>/. A batch file is a JSON list of jobs
// {name, lat, lng, target?:[lat,lng], offsets?:number[], headings?:number[], fov?, pitch?}
// run in ONE browser; with `target` the views look from the panorama AT that point (a
// shop's façade) — its bearing plus each offset (default [0]).
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {chromium,type Page} from 'playwright';

type Job={name:string;lat:number;lng:number;target?:[number,number];offsets?:number[];headings?:number[];fov?:number;pitch?:number};
const LAT0=-21.66209,LON0=-46.739323,MX=111320*Math.cos(LAT0*Math.PI/180),MZ=110574;

async function capture(page:Page,job:Job):Promise<string>{
  const OUT=`docs/divinolandia/referencias-streetview/${job.name}`;
  await mkdir(OUT,{recursive:true});
  const FOV=job.fov??80,PITCH=job.pitch??0;
  await page.goto(`https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${job.lat},${job.lng}`,{waitUntil:'domcontentloaded'});
  // consent screens (EU) or the panorama loading: wait for the URL to carry the pano id
  let main='';
  for(let i=0;i<40&&!main;i++){
    await page.waitForTimeout(500);
    const m=page.url().match(/!1s([A-Za-z0-9_-]{20,})!/);
    if(m)main=m[1];
  }
  if(!main)return`${job.name}: no panorama near ${job.lat},${job.lng}`;
  const log:string[]=[`point ${job.lat},${job.lng}`,`panorama ${main}`];
  // where the panorama really stands (Maps puts it in the URL as @lat,lng), and the same
  // spot in game WORLD metres (bake projection of tools/bake-divinolandia.ts + DIV_OX/OZ)
  const at=page.url().match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
  let headings=job.headings??[0,45,90,135,180,225,270,315];
  if(at){
    const plat=+at[1],plng=+at[2];
    log.push(`pano at ${plat},${plng}`,`world x=${(5000+(plng-LON0)*MX).toFixed(1)} z=${(5000+(LAT0-plat)*MZ).toFixed(1)}`);
    if(job.target){
      const dx=(job.target[1]-plng)*MX,dn=(job.target[0]-plat)*MZ;
      const b=(Math.atan2(dx,dn)*180/Math.PI+360)%360;
      headings=(job.offsets??[0]).map(o=>Math.round((b+o+360)%360));
      log.push(`target ${job.target.join(',')} bearing ${b.toFixed(1)} distance ${Math.hypot(dx,dn).toFixed(1)} m`);
    }
  }
  for(const h of headings){
    const url=`https://streetviewpixels-pa.googleapis.com/v1/thumbnail?cb_client=maps_sv.tactile&w=1280&h=720&pitch=${PITCH}&thumbfov=${FOV}&panoid=${main}&yaw=${h}`;
    const r=await page.request.get(url);
    if(r.status()!==200||!r.headers()['content-type']?.startsWith('image/')){log.push(`h${h}: HTTP ${r.status()}`);continue;}
    await writeFile(`${OUT}/${job.name}-h${String(h).padStart(3,'0')}${FOV!==80?'-f'+FOV:''}.jpg`,await r.body());
    log.push(`h${h}: ok`);
  }
  await writeFile(`${OUT}/capture.txt`,log.join('\n')+'\n');
  return log.join(' | ');
}

const args=process.argv.slice(2);
let jobs:Job[];
if(args[0]==='--batch')jobs=JSON.parse(await readFile(args[1],'utf8')) as Job[];
else{
  const[name,latS,lngS,headS]=args;
  if(!name||!latS||!lngS){console.error('usage: capture-streetview.ts <name> <lat> <lng> [h1,h2,…] | --batch <jobs.json>');process.exit(1);}
  jobs=[{name,lat:+latS,lng:+lngS,headings:headS?headS.split(',').map(Number):undefined,fov:+(process.env.FOV||80),pitch:+(process.env.PITCH||0)}];
}
const browser=await chromium.launch({headless:false});
try{
  const page=await browser.newPage({viewport:{width:1280,height:720},locale:'pt-BR'});
  for(const j of jobs)console.log(await capture(page,j));
}finally{
  await browser.close();
}
