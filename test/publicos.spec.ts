import {expect, test} from '@playwright/test';

// The public buildings, grounds and squares rebuilt from Street View (src/assets/models/
// divinolandia/publicos.ts, pracas-centro.ts) seen from the panoramas they were modelled
// from, for a side-by-side with docs/divinolandia/referencias-streetview/pub-*/ (local).
// Screenshots go to output/visual/publicos/. Run headed (the harness rule).
const VIEWS:{name:string;camera:{x:number;z:number};heading:number}[]=[
  {name:'pub-cemiterio-e',camera:{x:4916.9,z:5306.5},heading:273},
  {name:'pub-cemiterio-n',camera:{x:4798.1,z:5206.4},heading:174},
  {name:'pub-cemiterio-w',camera:{x:4713.5,z:5292.9},heading:94},
  {name:'pub-civil-e',camera:{x:4966.4,z:5008.9},heading:265},
  {name:'pub-civil-n',camera:{x:4967.9,z:4998.5},heading:243},
  {name:'pub-civil-s',camera:{x:4937.7,z:5032.8},heading:16},
  {name:'pub-civil-w',camera:{x:4917.5,z:5028.0},heading:57},
  {name:'pub-congregacao-e',camera:{x:4612.8,z:4940.5},heading:250},
  {name:'pub-congregacao-n',camera:{x:4583.4,z:4926.4},heading:180},
  {name:'pub-congregacao-s',camera:{x:4555.2,z:4963.4},heading:67},
  {name:'pub-congregacao-w',camera:{x:4560.1,z:4954.5},heading:82},
  {name:'pub-dombosco-e',camera:{x:4906.9,z:4942.1},heading:264},
  {name:'pub-dombosco-n',camera:{x:4876.7,z:4937.6},heading:184},
  {name:'pub-dombosco-s',camera:{x:4872.9,z:4971.8},heading:7},
  {name:'pub-dombosco-w',camera:{x:4861.9,z:4943.2},heading:98},
  {name:'pub-espirita-e',camera:{x:5715.9,z:4957.7},heading:247},
  {name:'pub-espirita-n',camera:{x:5693.8,z:4953.3},heading:193},
  {name:'pub-espirita-s',camera:{x:5672.2,z:5004.5},heading:27},
  {name:'pub-espirita-w',camera:{x:5662.2,z:4971.1},heading:84},
  {name:'pub-estadio-e',camera:{x:6080.5,z:4997.4},heading:252},
  {name:'pub-estadio-n',camera:{x:5939.1,z:4993.5},heading:135},
  {name:'pub-estadio-s',camera:{x:5932.7,z:5155.3},heading:20},
  {name:'pub-estadio-w',camera:{x:5866.3,z:5027.3},heading:92},
  {name:'pub-galhano-e',camera:{x:5577.3,z:5137.9},heading:277},
  {name:'pub-galhano-n',camera:{x:5535.7,z:5107.4},heading:198},
  {name:'pub-galhano-s',camera:{x:5533.6,z:5171.8},heading:352},
  {name:'pub-galhano-w',camera:{x:5491.2,z:5133.4},heading:88},
  {name:'pub-oftalmo-e',camera:{x:4750.2,z:5758.5},heading:270},
  {name:'pub-oftalmo-n',camera:{x:4751.7,z:5748.2},heading:259},
  {name:'pub-oftalmo-s',camera:{x:4699.1,z:5800.6},heading:359},
  {name:'pub-oftalmo-w',camera:{x:4668.2,z:5804.2},heading:33},
  {name:'pub-pedroribeiro-e',camera:{x:5646.8,z:5319.3},heading:284},
  {name:'pub-pedroribeiro-n',camera:{x:5611.8,z:5273.5},heading:192},
  {name:'pub-pedroribeiro-s',camera:{x:5600.7,z:5341.4},heading:6},
  {name:'pub-pedroribeiro-w',camera:{x:5569.3,z:5315.9},heading:78},
  {name:'pub-pm-e',camera:{x:6042.7,z:4881.8},heading:264},
  {name:'pub-pm-n',camera:{x:6017.0,z:4873.4},heading:192},
  {name:'pub-pm-s',camera:{x:6007.4,z:4876.1},heading:140},
  {name:'pub-pm-w',camera:{x:5988.0,z:4882.0},heading:96},
  {name:'pub-rosario-e',camera:{x:5625.7,z:4940.0},heading:267},
  {name:'pub-rosario-n',camera:{x:5592.4,z:4930.8},heading:171},
  {name:'pub-rosario-s',camera:{x:5590.1,z:4958.9},heading:13},
  {name:'pub-rosario-w',camera:{x:5567.1,z:4943.8},heading:86},
  {name:'pub-saosebastiao-e',camera:{x:5546.6,z:5316.6},heading:291},
  {name:'pub-saosebastiao-n',camera:{x:5516.1,z:5291.4},heading:150},
  {name:'pub-saosebastiao-s',camera:{x:5532.6,z:5342.1},heading:349},
  {name:'pub-saosebastiao-w',camera:{x:5516.1,z:5291.4},heading:150},
  {name:'pub-saude3-e',camera:{x:5224.0,z:5099.7},heading:284},
  {name:'pub-saude3-n',camera:{x:5204.0,z:5080.0},heading:191},
  {name:'pub-saude3-s',camera:{x:5221.2,z:5119.3},heading:321},
  {name:'pub-saude3-w',camera:{x:5183.4,z:5075.2},heading:137},
  {name:'pub-vicentenasser-n',camera:{x:5043.4,z:5284.1},heading:185},
  {name:'pub-vicentenasser-w',camera:{x:4982.0,z:5342.9},heading:91},
  {name:'pub2-congregacao',camera:{x:4555.2,z:4963.4},heading:77},
  {name:'pub2-pm',camera:{x:6028.0,z:4872.0},heading:171},
  {name:'pub2-pm-b',camera:{x:6042.2,z:4871.8},heading:225},
  {name:'pub2-saojose-capela',camera:{x:4860.5,z:5261.1},heading:249},
];

test('the public buildings and squares match their Street View panoramas',async({page})=>{
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
    await page.screenshot({path:`output/visual/publicos/${v.name}.png`});
  }
  expect(errors).toEqual([]);
});
