// Fixed color-pass attribution; frame timings include normal gameplay and postprocessing.
// npx playwright test test/static-perf.spec.ts
import {mkdir,writeFile} from 'node:fs/promises';
import {test,expect} from './support/game.ts';

test.use({viewport:{width:1280,height:720},deviceScaleFactor:1});
const views=[
  {name:'centro-street',x:5110,z:4980,height:1.7,targetX:5110,targetZ:4880,targetHeight:1.7,fov:62},
  {name:'centro-elevated',x:5110,z:4980,height:180,targetX:5000,targetZ:5000,targetHeight:8,fov:62},
  {name:'serra-distance',x:5110,z:4980,height:180,targetX:5110,targetZ:7400,targetHeight:0,fov:62},
];

test('static draw-call baseline at fixed views',async({game})=>{
  test.setTimeout(180_000);
  const page=game.page;
  const errors:string[]=[];
  page.on('pageerror',e=>{if(!/Pointer Lock/i.test(e.message))errors.push(e.message);});
  const dir=process.env.PERF_OUTPUT_DIR||'output/visual/static-perf';
  await mkdir(dir,{recursive:true});
  await page.evaluate(()=>{(window as any).profilerToggle();});
  try{
    for(const {name,...view} of views){
      expect(await page.evaluate(v=>(window as any).__test.teleport(v.x,v.z,v.targetX,v.targetZ),view)).toBe(true);
      const metadata=await page.evaluate(v=>(window as any).__test.profileView(v),view);
      // Let culling, shader compilation, exposure and the FPS window settle.
      await page.waitForTimeout(5000);
      const timing=await page.evaluate(()=>new Promise<{samples:number;medianMs:number;p95Ms:number}>(resolve=>{
        const values:number[]=[];let last=0;
        const sample=(now:number)=>{
          if(last)values.push(now-last);last=now;
          if(values.length<120){requestAnimationFrame(sample);return;}
          values.sort((a,b)=>a-b);
          resolve({samples:values.length,medianMs:values[60],p95Ms:values[113]});
        };requestAnimationFrame(sample);
      }));
      const report=await page.evaluate(()=>JSON.parse((window as any).profilerReport()));
      await page.screenshot({path:`${dir}/${name}.png`});
      // Run attribution AFTER timing: the extra renders must not enter the timing sample.
      const census=await page.evaluate(()=>JSON.parse((window as any).profilerCensusStatic()));
      const materials=await page.evaluate(()=>JSON.parse((window as any).profilerMaterialCensus()));
      expect(census.__total.draws).toBeGreaterThan(0);
      for(const key of ['houses','surveyedStreets','shops','landmarks','vegetation','terrain','otherStatic','props','dynamic','__remainder']){
        expect(census[key].draws,`${name}: ${key}`).toBeGreaterThanOrEqual(0);
        expect(census[key].tris,`${name}: ${key}`).toBeGreaterThanOrEqual(0);
      }
      const sum=Object.entries(census).filter(([key])=>key!=='__total')
        .reduce((a,[,v])=>{const row=v as {draws:number;tris:number};return {draws:a.draws+row.draws,tris:a.tris+row.tris};},{draws:0,tris:0});
      expect(sum).toEqual(census.__total);
      expect(metadata.drawingBuffer).toEqual({width:1280,height:720});
      expect(metadata.renderScale).toBe(1);
      if(name!=='serra-distance'){
        expect(census.terrain.tris).toBeLessThan(150_000);
        expect(census.shops.draws).toBeLessThan(100);
        expect(census.surveyedStreets.draws).toBeLessThan(name==='centro-street'?80:300);
      }
      await writeFile(`${dir}/${name}.json`,JSON.stringify({capturedAt:new Date().toISOString(),metadata,timing,report,census,materials},null,2)+'\n');
      console.log(`\n[static perf: ${name}] ${JSON.stringify(timing)}`);
      console.table(census);
    }
    expect(errors).toEqual([]);
  }finally{
    await page.evaluate(()=>{(window as any).__test.profileView(null);});
  }
});
