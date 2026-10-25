// Renders a model from several angles with the model studio (tools/studio/model.html) and
// saves the PNGs, to compare a rebuilt landmark with its Street View photos. Needs the dev
// server (`npm run dev`, or BASE=http://localhost:<port>). The browser runs headed (WebGL
// on the GPU) but off-screen, so it never gets in the user's way.
//   npx tsx tools/shoot-model.ts <model path under src/assets/models, no .ts> <out dir> \
//     '<views JSON: [[name,az,el,dist?,fov?,[tx,ty,tz]?],…]>' ['<build opts JSON>']
import {mkdir} from 'node:fs/promises';
import {chromium} from 'playwright';

const[m,out,viewsS,optsS]=process.argv.slice(2);
if(!m||!out||!viewsS){console.error('usage: shoot-model.ts <model> <out dir> <views JSON> [opts JSON]');process.exit(1);}
const BASE=process.env.BASE||'http://localhost:5173';
const views=JSON.parse(viewsS) as [string,number,number,number?,number?,[number,number,number]?][];
await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:false,args:['--window-position=-32000,-32000']});
try{
  const page=await browser.newPage({viewport:{width:1280,height:900}});
  const errs:string[]=[];page.on('pageerror',e=>errs.push(e.message));page.on('console',c=>{if(c.type()==='error')errs.push(c.text());});
  // env LIST=<export>&I=<index>: one entry of a list of places (publicos.ts style) instead of the default model
  const extra=process.env.LIST?`&list=${process.env.LIST}&i=${process.env.I??0}`:'';
  await page.goto(`${BASE}/tools/studio/model.html?m=${encodeURIComponent(m)}&opts=${encodeURIComponent(optsS||'{}')}${extra}`);
  await page.waitForFunction(()=>(window as unknown as {__ready?:boolean}).__ready===true,null,{timeout:120000}).catch(()=>{throw new Error('studio did not load: '+errs.join(' | '));});
  console.log('info',JSON.stringify(await page.evaluate(()=>(window as unknown as {__info:unknown}).__info)));
  for(const[name,...v]of views){
    await page.evaluate(a=>(window as unknown as {__view:(...x:unknown[])=>void}).__view(...a),v);
    await page.screenshot({path:`${out}/${name}.png`});
    console.log('saved',`${out}/${name}.png`);
  }
  if(errs.length)console.log('page errors:',errs.join(' | '));
}finally{await browser.close();}
