import {expect, test} from '@playwright/test';

// The Igreja Matriz and its two squares (Praça Prof. Ladislau Rodrigues Pinto around the
// church, Praça Dr. Alcindo Cardoso de Paiva across the street with the fountain and the
// bandstand) seen from the Street View panoramas they were modelled from, for a
// side-by-side with docs/divinolandia/referencias-streetview/pm-*/ (local images, captured
// with tools/capture-streetview.ts; capture.txt holds each panorama's world position).
// Street View heading 0 = north = world -z.
const P={
  front3:{x:5036.3,z:5039.3},front:{x:5038.5,z:5019.9},front2:{x:5046.1,z:4977.7},s2:{x:5003.4,z:5042.9},
  e:{x:5142.3,z:5016.6},s1:{x:5082.3,z:5056.5},n2:{x:5089.5,z:4972.2},nw:{x:4970.8,z:4950.1},
  w:{x:4967.9,z:4998.5},n1:{x:5001.0,z:4956.8},
};
const VIEWS:{name:string;camera:{x:number;z:number};heading:number}[]=[
  {name:'pm-front3-h315',camera:P.front3,heading:315},
  {name:'pm-front-h315',camera:P.front,heading:315},
  {name:'pm-front-h090',camera:P.front,heading:90},
  {name:'pm-front2-h135',camera:P.front2,heading:135},
  {name:'pm-s2-h000',camera:P.s2,heading:0},
  {name:'pm-e-h270',camera:P.e,heading:270},
  {name:'pm-s1-h000',camera:P.s1,heading:0},
  {name:'pm-n2-h180',camera:P.n2,heading:180},
  {name:'pm-nw-h135',camera:P.nw,heading:135},
  {name:'pm-w-h090',camera:P.w,heading:90},
  {name:'pm-n1-h180',camera:P.n1,heading:180},
  {name:'pm-n1-h135',camera:P.n1,heading:135},
];

test('Praça da Matriz matches its Street View panoramas',async({page})=>{
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
    await page.waitForTimeout(1500);
    await page.screenshot({path:`output/visual/praca-${v.name}.png`});
  }
  expect(errors).toEqual([]);
});
