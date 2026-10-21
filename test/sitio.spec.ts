import {expect, test} from '@playwright/test';

// The west entrance on the Rua São Paulo and the sítio (src/assets/models/divinolandia/
// sitio-maconaria.ts): the masonic monument, the palm drive, the verge across the road from
// the Street View panoramas they were modelled from (docs/divinolandia/referencias-streetview/
// sitio-*/, local), plus two views of the sede and the casinha (no Street View there: compare
// with the satellite, referencias-satelite/sat21-sitio-*.png). Screenshots go to
// output/visual/sitio/. Run headed (the harness rule).
const A={x:3684.1,z:4443.7},M={x:3694.4,z:4403.8},N={x:3691.6,z:4413.8};
const VIEWS:{name:string;camera:{x:number;z:number};heading:number}[]=[
  {name:'sitio-a-h270',camera:A,heading:270},{name:'sitio-a-h315',camera:A,heading:315},{name:'sitio-a-h000',camera:A,heading:0},
  {name:'sitio-a-h045',camera:A,heading:45},{name:'sitio-a-h090',camera:A,heading:90},{name:'sitio-a-h225',camera:A,heading:225},
  {name:'sitio-m-h260',camera:M,heading:260},{name:'sitio-m-h290',camera:M,heading:290},{name:'sitio-n-h200',camera:N,heading:200},
  {name:'sede-portao',camera:{x:3496,z:4402},heading:5},{name:'sede-lado',camera:{x:3460,z:4390},heading:60},
  {name:'casinha',camera:{x:3430,z:4425},heading:225},
];

test('the sítio entrance matches its Street View panoramas',async({page})=>{
  test.setTimeout(10*60_000);
  const errors:string[]=[];
  page.on('pageerror',error=>{if(!/Pointer Lock/i.test(error.message))errors.push(error.message);});
  await page.goto('/?tod=.5',{waitUntil:'load'});
  await page.waitForFunction(()=>!!(window as any).render_game_to_text
    && JSON.parse((window as any).render_game_to_text()).started===true,null,{timeout:90_000});
  await page.waitForFunction(()=>!!(window as any).__test?.teleport,{timeout:30_000});
  await page.evaluate(()=>(window as any).__test.equipWeapon('fist'));
  await page.addStyleTag({content:'#hud,#touch,#mapwrap{display:none!important}'});
  for(const v of VIEWS){
    const a=v.heading*Math.PI/180;
    const moved=await page.evaluate(({x,z,tx,tz})=>(window as any).__test.teleport(x,z,tx,tz),
      {x:v.camera.x,z:v.camera.z,tx:v.camera.x+Math.sin(a)*100,tz:v.camera.z-Math.cos(a)*100});
    expect(moved).toBe(true);
    await page.evaluate(()=>(window as any).__test.lookPitch(.05));
    await page.waitForTimeout(1200);
    await page.screenshot({path:`output/visual/sitio/${v.name}.png`});
  }
  expect(errors).toEqual([]);
});
