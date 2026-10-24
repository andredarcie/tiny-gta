import {test} from '@playwright/test';

// Fiat Uno Mille Fire photo studio: renders the model from the reference photos' angles
// (tools/studio/vehicle.html) to output/visual/<model>/<view>.png for the side-by-side with
// docs/divinolandia/referencias-uno (local photos). Judging the likeness is the owner's call.
// STUDIO_MODEL=hilux shoots the Hilux instead (output/visual/hilux/, refs in referencias-hilux).
const VIEWS=['front','front34','side','rear34','rear','front34R','rear34R','top'];
test('Uno studio views',async({page})=>{
  test.setTimeout(120_000);
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.setViewportSize({width:1200,height:800});
  const model=process.env.STUDIO_MODEL||'uno';
  const color=process.env.UNO_COLOR||process.env.STUDIO_COLOR||(model==='hilux'?'aeb2b5':'b9bcbf');
  await page.goto(`/tools/studio/vehicle.html?model=${model}&color=${color}`,{waitUntil:'load'});
  await page.waitForFunction(()=>(window as any).__ready===true,null,{timeout:60_000});
  for(const v of VIEWS){
    await page.evaluate(n=>(window as any).__view(n),v);
    await page.waitForTimeout(150);
    await page.screenshot({path:`output/visual/${model}/${color}-${v}.png`});
  }
  await page.setViewportSize({width:1500,height:1050});
  for(const o of['side','front','rear','top']){
    await page.evaluate(n=>(window as any).__ortho(n),o);
    await page.waitForTimeout(150);
    await page.screenshot({path:`output/visual/${model}/${color}-ortho-${o}.png`});
  }
  if(errors.length)throw new Error(errors.join('\n'));
});
