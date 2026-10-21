import {expect, test} from '@playwright/test';

// The town's four fuel stations (src/assets/models/divinolandia/posto-*.ts), the Monumento
// ao Ciclista and its surroundings (monumento-ciclista.ts, entorno-ciclista.ts,
// concessionaria-mahindra.ts) seen from the
// Street View panoramas they were modelled from, for a side-by-side with
// docs/divinolandia/referencias-streetview/posto-*/, monumento-ciclista*/ and entorno-*/ (local images, captured with
// tools/capture-streetview.ts; capture.txt holds each panorama's world position).
// Street View heading 0 = north = world -z. Screenshots go to output/visual/postos/.
const P={
  tri:{x:5533.9,z:4987.7},triN:{x:5503.6,z:4969.3},triS:{x:5506.5,z:5000.9},
  pas:{x:6134.8,z:4837.2},pasE:{x:6165.5,z:4828.8},pasW:{x:6115.4,z:4843.2},
  lur:{x:6288.9,z:4797.1},lurW:{x:6247.7,z:4805.1},
  tau:{x:5040.3,z:4513.4},tauN:{x:5043.8,z:4493.5},tauS:{x:5035.9,z:4533.3},
  mon:{x:6481.4,z:4820.8},monW:{x:6454.7,z:4835.0},monNW:{x:6461.9,z:4816.2},monS:{x:6465.4,z:4852.3},monE:{x:6517.0,z:4830.7},
  jw:{x:6444.7,z:4801.7},s2:{x:6474.9,z:4870.4},av:{x:6495.0,z:4817.2},mah:{x:6514.4,z:4852.6},
};
const VIEWS:{name:string;camera:{x:number;z:number};heading:number}[]=[
  {name:'triangulo-h270',camera:P.tri,heading:270},{name:'triangulo-h315',camera:P.tri,heading:315},
  {name:'triangulo-n-h135',camera:P.triN,heading:135},{name:'triangulo-n-h180',camera:P.triN,heading:180},
  {name:'triangulo-s-h045',camera:P.triS,heading:45},{name:'triangulo-s-h000',camera:P.triS,heading:0},
  {name:'petrobras-h135',camera:P.pas,heading:135},{name:'petrobras-h180',camera:P.pas,heading:180},
  {name:'petrobras-h225',camera:P.pas,heading:225},{name:'petrobras-e-h225',camera:P.pasE,heading:225},
  {name:'petrobras-w-h135',camera:P.pasW,heading:135},
  {name:'lurain-h000',camera:P.lur,heading:0},{name:'lurain-h315',camera:P.lur,heading:315},
  {name:'lurain-h045',camera:P.lur,heading:45},{name:'lurain-w-h045',camera:P.lurW,heading:45},
  {name:'taurus-h090',camera:P.tau,heading:90},{name:'taurus-h135',camera:P.tau,heading:135},
  {name:'taurus-h180',camera:P.tau,heading:180},{name:'taurus-n-h135',camera:P.tauN,heading:135},
  {name:'taurus-s-h045',camera:P.tauS,heading:45},
  {name:'monumento-h180',camera:P.mon,heading:180},{name:'monumento-h225',camera:P.mon,heading:225},
  {name:'monumento-w-h090',camera:P.monW,heading:90},{name:'monumento-w-h045',camera:P.monW,heading:45},
  {name:'monumento-nw-h135',camera:P.monNW,heading:135},{name:'monumento-s-h000',camera:P.monS,heading:0},
  {name:'monumento-e-h270',camera:P.monE,heading:270},
  {name:'entorno-jw-h180',camera:P.jw,heading:180},{name:'entorno-jw-h225',camera:P.jw,heading:225},{name:'entorno-jw-h135',camera:P.jw,heading:135},
  {name:'entorno-s-h270',camera:P.monS,heading:270},{name:'entorno-s-h225',camera:P.monS,heading:225},{name:'entorno-s-h090',camera:P.monS,heading:90},
  {name:'entorno-s2-h090',camera:P.s2,heading:90},{name:'entorno-av-h135',camera:P.av,heading:135},{name:'entorno-av-h180',camera:P.av,heading:180},
  {name:'entorno-mah-h180',camera:P.mah,heading:180},{name:'entorno-mah-h270',camera:P.mah,heading:270},
];

test('the fuel stations match their Street View panoramas',async({page})=>{
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
    await page.evaluate(()=>(window as any).__test.lookPitch(0));
    await page.waitForTimeout(1500);
    await page.screenshot({path:`output/visual/postos/${v.name}.png`});
  }
  expect(errors).toEqual([]);
});
