import {expect, test} from '@playwright/test';
import views from './lourival-piscina.views.json' with {type:'json'};

// Rua Lourival Medeiros across from the Piscina Municipal (ruas/lourival-medeiros-piscina.ts),
// each lot seen from the Street View panorama its reference was captured from, for a
// side-by-side with docs/divinolandia/referencias-streetview/lm-*/ (local).
// Screenshots go to output/visual/lm/.
const VIEWS=views as {name:string;camera:{x:number;z:number};heading:number}[];

test('the Lourival Medeiros lots across from the pool match their Street View views',async({page})=>{
  test.setTimeout(10*60_000);
  const errors:string[]=[];
  page.on('pageerror',error=>{if(!/Pointer Lock/i.test(error.message))errors.push(error.message);});
  await page.goto('/?tod=.5',{waitUntil:'load'});
  await page.waitForFunction(()=>!!(window as any).render_game_to_text
    && JSON.parse((window as any).render_game_to_text()).started===true,null,{timeout:120_000});
  await page.waitForFunction(()=>!!(window as any).__test?.teleport,{timeout:30_000});
  await page.evaluate(()=>(window as any).__test.equipWeapon('fist'));
  await page.addStyleTag({content:'#hud,#touch,#mapwrap{display:none!important}'});
  for(const v of VIEWS){
    const a=v.heading*Math.PI/180;
    const moved=await page.evaluate(({x,z,tx,tz})=>(window as any).__test.teleport(x,z,tx,tz),
      {x:v.camera.x,z:v.camera.z,tx:v.camera.x+Math.sin(a)*100,tz:v.camera.z-Math.cos(a)*100});
    expect(moved).toBe(true);
    await page.evaluate(()=>(window as any).__test.lookPitch(.05));
    await page.waitForTimeout(1500);
    await page.screenshot({path:`output/visual/lm/${v.name}.png`});
  }
  expect(errors).toEqual([]);
});
