// Top-down reference capture from the Google satellite for modelling a real Divinolândia
// lot (manual tool, not a test; the image stays LOCAL — docs/divinolandia/.gitignore keeps
// referencias-satelite/ out of git).
//
//   npx tsx tools/capture-satellite.ts <name> <lat> <lng> [half-size metres, default 40]
//   (env ZOOM=<tile zoom>, default 20 ≈ 0.14 m/px)
//
// Stitches the tiles round the point and overlays a metre grid in TOWN-LOCAL coordinates
// (the bake frame: x east, z south, origin at the Matriz — add +5000 for world), lines
// every 5 m, labelled every 10 m, so footprints can be read straight off the picture.
// Saves docs/divinolandia/referencias-satelite/<name>.png.
import {mkdir,readFile} from 'node:fs/promises';
import {chromium} from 'playwright';

const[name,latS,lngS,halfS]=process.argv.slice(2);
if(!name||!latS||!lngS){console.error('usage: capture-satellite.ts <name> <lat> <lng> [half-metres]');process.exit(1);}
const lat=+latS,lng=+lngS,half=+(halfS||40),ZOOM=+(process.env.ZOOM||20);
const d=JSON.parse(await readFile('src/data/divinolandia.json','utf8')) as {lat0:number;lon0:number;mx:number;mz:number};
const{lat0,lon0,mx,mz}=d;
// web-mercator global pixel at ZOOM
const N=256*2**ZOOM;
const gx=(lo:number)=>(lo+180)/360*N;
const gy=(la:number)=>(1-Math.asinh(Math.tan(la*Math.PI/180))/Math.PI)/2*N;
// town-local metres ↔ lat/lng (bake projection)
const toLL=(x:number,z:number):[number,number]=>[lat0-z/mz,lon0+x/mx];
const cx=(lng-lon0)*mx,cz=(lat0-lat)*mz;
const[la0,lo0]=toLL(cx-half,cz-half),[la1,lo1]=toLL(cx+half,cz+half);
const px0=Math.floor(gx(lo0)),py0=Math.floor(gy(la0)),px1=Math.ceil(gx(lo1)),py1=Math.ceil(gy(la1));
const W=px1-px0,H=py1-py0;
const tiles:string[]=[];
for(let ty=Math.floor(py0/256);ty<=Math.floor(py1/256);ty++)for(let tx=Math.floor(px0/256);tx<=Math.floor(px1/256);tx++)
  tiles.push(`<img src="https://mt${(tx+ty)%4}.google.com/vt/lyrs=s&x=${tx}&y=${ty}&z=${ZOOM}" style="position:absolute;left:${tx*256-px0}px;top:${ty*256-py0}px;width:256px;height:256px">`);
const P=(x:number,z:number)=>{const[la,lo]=toLL(x,z);return[gx(lo)-px0,gy(la)-py0];};
let svg='';
for(let v=Math.ceil((cx-half)/5)*5;v<=cx+half;v+=5){
  const[a,b]=P(v,cz-half),[c,e]=P(v,cz+half);const m=v%10===0;
  svg+=`<line x1="${a}" y1="${b}" x2="${c}" y2="${e}" stroke="${m?'#ff0':'#0ff'}" stroke-opacity="${m?.55:.3}" stroke-width="1"/>`;
  if(m)svg+=`<text x="${a+2}" y="12" fill="#ff0" font-size="11" font-family="monospace">x${v}</text>`;
}
for(let v=Math.ceil((cz-half)/5)*5;v<=cz+half;v+=5){
  const[a,b]=P(cx-half,v),[c,e]=P(cx+half,v);const m=v%10===0;
  svg+=`<line x1="${a}" y1="${b}" x2="${c}" y2="${e}" stroke="${m?'#ff0':'#0ff'}" stroke-opacity="${m?.55:.3}" stroke-width="1"/>`;
  if(m)svg+=`<text x="2" y="${b-2}" fill="#ff0" font-size="11" font-family="monospace">z${v}</text>`;
}
const[ox,oy]=P(cx,cz);
svg+=`<circle cx="${ox}" cy="${oy}" r="4" fill="none" stroke="#f0f" stroke-width="2"/>`;
const html=`<body style="margin:0"><div id="m" style="position:relative;width:${W}px;height:${H}px;overflow:hidden">${tiles.join('')}<svg width="${W}" height="${H}" style="position:absolute;left:0;top:0">${svg}</svg></div></body>`;

const OUT='docs/divinolandia/referencias-satelite';
await mkdir(OUT,{recursive:true});
const browser=await chromium.launch({headless:false});
try{
  const page=await browser.newPage({viewport:{width:Math.max(W,400),height:Math.max(H,400)}});
  await page.setContent(html,{waitUntil:'networkidle'});
  await page.locator('#m').screenshot({path:`${OUT}/${name}.png`});
  console.log(`${OUT}/${name}.png ${W}x${H}px, centre town-local x=${cx.toFixed(1)} z=${cz.toFixed(1)}`);
}finally{
  await browser.close();
}
