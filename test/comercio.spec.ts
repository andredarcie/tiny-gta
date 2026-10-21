import {expect, test} from '@playwright/test';
import {LOJAS} from '../src/js/world/divinolandia/comercio/lojas.ts';
import {planLojas} from '../src/js/world/divinolandia/comercio/plan.ts';

// The town's real supermarkets, banks and shops (src/js/world/divinolandia/comercio/) each
// framed from across its street, for a side-by-side with the Street View capture it was
// modelled from (docs/divinolandia/referencias-streetview/<ref>/, local only).
// Screenshots go to output/visual/comercio/<id>.png. Run headed (the harness rule).
const DIV=5000,SHOTS=planLojas(LOJAS).map(p=>({id:p.spec.id,
  // stand on the far side of the street, 10 m out from the front, facing it
  cam:{x:DIV+p.x+p.nx*10,z:DIV+p.z+p.nz*10},look:{x:DIV+p.x,z:DIV+p.z}}));

test('the businesses match their Street View captures',async({page})=>{
  test.setTimeout(15*60_000);
  const errors:string[]=[];
  page.on('pageerror',error=>{if(!/Pointer Lock/i.test(error.message))errors.push(error.message);});
  await page.goto('/?tod=.5',{waitUntil:'load'});
  await page.waitForFunction(()=>!!(window as any).render_game_to_text
    && JSON.parse((window as any).render_game_to_text()).started===true,null,{timeout:90_000});
  await page.waitForFunction(()=>!!(window as any).__test?.teleport,{timeout:30_000});
  await page.evaluate(()=>(window as any).__test.equipWeapon('fist'));
  await page.addStyleTag({content:'#hud,#touch,#mapwrap{display:none!important}'});
  for(const s of SHOTS){
    const moved=await page.evaluate(({c,l})=>(window as any).__test.teleport(c.x,c.z,l.x,l.z),{c:s.cam,l:s.look});
    expect(moved).toBe(true);
    await page.evaluate(()=>(window as any).__test.lookPitch(.08));
    await page.waitForTimeout(900);
    await page.screenshot({path:`output/visual/comercio/${s.id}.png`});
  }
  expect(errors).toEqual([]);
});
