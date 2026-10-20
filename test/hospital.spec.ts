import {expect, test} from '@playwright/test';

// The Hospital Regional seen from where its references were taken, for a side-by-side with
// docs/divinolandia/referencias-streetview/hosp-*/ (local images): the Street View
// panoramas on Av. Leonor Mendes de Barros to the SE (BPh-DXXWFkFXAkepKIvuwg) and NE
// (meihIjfxKNEXbSPk1R6U3Q), the one on the road below the annex (bNbFYXBmmu_BBNq5FqNL4A),
// plus the veranda front head-on and from the west like the 2005 photo, the entrance
// porch, and the back wings from the south. Positions in world
// metres: the panoramas' own (capture-streetview.ts logs them), the rest from the model
// frame (origin 4656.6, 5678.5, facing 335.2°). Street View heading 0 = north = world -z.
type View={name:string;camera:{x:number;z:number};heading?:number;target?:{x:number;z:number}};
const VIEWS:View[]=[
  {name:'front',camera:{x:4628.6,z:5627.5},target:{x:4654.1,z:5673.1}},
  {name:'photo2005',camera:{x:4622.1,z:5665.8},target:{x:4666.2,z:5670.7}},
  {name:'se-h284',camera:{x:4763.9,z:5698.0},heading:284},
  {name:'se-h298',camera:{x:4763.9,z:5698.0},heading:298},
  {name:'ne-h258',camera:{x:4782.6,z:5642.5},heading:258},
  {name:'annex-h000',camera:{x:4542.2,z:5757.6},heading:0},
  {name:'back',camera:{x:4644.3,z:5759.1},target:{x:4662.9,z:5692.1}},
  {name:'porch',camera:{x:4647.4,z:5658.5},target:{x:4653.2,z:5671.2}},
];

test('Hospital Regional matches its references',async({page})=>{
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
    let tx=v.target?.x??0,tz=v.target?.z??0;
    if(v.heading!==undefined){const a=v.heading*Math.PI/180;tx=v.camera.x+Math.sin(a)*100;tz=v.camera.z-Math.cos(a)*100;}
    const moved=await page.evaluate(({x,z,tx,tz})=>(window as any).__test.teleport(x,z,tx,tz),{x:v.camera.x,z:v.camera.z,tx,tz});
    expect(moved).toBe(true);
    await page.waitForTimeout(1500);
    await page.screenshot({path:`output/visual/hospital-${v.name}.png`});
  }
  expect(errors).toEqual([]);
});
