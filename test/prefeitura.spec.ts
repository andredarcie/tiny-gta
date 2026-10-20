import {expect, test} from '@playwright/test';

// The Prefeitura (Rua XV de Novembro) seen from the Street View panorama it was modelled
// from (SGqi-j3SSfA-ri1jDv0C5A, in the street in front of it): the same headings, for a
// side-by-side with docs/divinolandia/referencias-streetview/prefeitura*/ (local images).
// Street View heading 0 = north = world -z.
const P={x:4946.5,z:4946.5};                       // the panorama: Rua XV de Novembro, in front of the pavilion
const VIEWS=[
  {name:'h000',camera:P,heading:0},
  {name:'h015',camera:P,heading:15},
  {name:'h345',camera:P,heading:-15},
  {name:'h045',camera:P,heading:45},
];

test('Prefeitura matches its Street View panorama',async({page})=>{
  const errors:string[]=[];
  page.on('pageerror',error=>{if(!/Pointer Lock/i.test(error.message))errors.push(error.message);});
  await page.goto('/?tod=.5',{waitUntil:'load'});
  await page.waitForFunction(()=>!!(window as any).render_game_to_text
    && JSON.parse((window as any).render_game_to_text()).started===true,null,{timeout:90_000});
  await page.waitForFunction(()=>!!(window as any).__test?.teleport,{timeout:30_000});
  // a clean frame: bare hands (no gun in view) and no HUD
  await page.evaluate(()=>(window as any).__test.equipWeapon('fist'));
  await page.addStyleTag({content:'#hud,#touch,#mapwrap{display:none!important}'});
  for(const v of VIEWS){
    const a=v.heading*Math.PI/180;
    const moved=await page.evaluate(({x,z,tx,tz})=>(window as any).__test.teleport(x,z,tx,tz),
      {x:v.camera.x,z:v.camera.z,tx:v.camera.x+Math.sin(a)*100,tz:v.camera.z-Math.cos(a)*100});
    expect(moved).toBe(true);
    await page.waitForTimeout(1200);
    await page.screenshot({path:`output/visual/prefeitura-${v.name}.png`});
  }
  expect(errors).toEqual([]);
});
