import {expect, test} from '@playwright/test';

// Rua XV de Novembro, surveyed lot by lot (src/js/world/divinolandia/ruas/xv-de-novembro.ts),
// each lot seen from the Street View panorama its reference was captured from, for a
// side-by-side with docs/divinolandia/referencias-streetview/xv-*/ (local).
// Screenshots go to output/visual/xv/. Run headed (the harness rule).
const VIEWS:{name:string;camera:{x:number;z:number};heading:number}[]=[
  {name:'xv-N-001',camera:{x:4766.1,z:4920.2},heading:1},
  {name:'xv-N-011',camera:{x:4776.3,z:4922.3},heading:2},
  {name:'xv-N-022',camera:{x:4786.6,z:4923.7},heading:343},
  {name:'xv-N-025',camera:{x:4786.6,z:4923.7},heading:16},
  {name:'xv-N-034',camera:{x:4796.5,z:4925.3},heading:11},
  {name:'xv-N-043',camera:{x:4806.5,z:4926.7},heading:15},
  {name:'xv-N-056',camera:{x:4816.5,z:4928.1},heading:14},
  {name:'xv-N-063',camera:{x:4826.7,z:4929.6},heading:1},
  {name:'xv-N-072',camera:{x:4836.6,z:4931.1},heading:346},
  {name:'xv-N-077',camera:{x:4846.0,z:4932.4},heading:346},
  {name:'xv-N-102',camera:{x:4866.5,z:4936.0},heading:10},
  {name:'xv-N-136',camera:{x:4896.9,z:4940.7},heading:0},
  {name:'xv-N-140',camera:{x:4896.9,z:4940.7},heading:29},
  {name:'xv-N-147',camera:{x:4906.9,z:4942.1},heading:3},
  {name:'xv-N-150',camera:{x:4917.1,z:4943.5},heading:342},
  {name:'xv-N-234',camera:{x:4995.2,z:4952.5},heading:28},
  {name:'xv-N-234a',camera:{x:5011.2,z:4958.6},heading:317},
  {name:'xv-N-234b',camera:{x:4975.4,z:4949.5},heading:80},
  {name:'xv-N-248',camera:{x:5011.2,z:4958.6},heading:356},
  {name:'xv-N-257',camera:{x:5011.2,z:4958.6},heading:26},
  {name:'xv-N-260',camera:{x:5021.3,z:4960.4},heading:3},
  {name:'xv-N-269',camera:{x:5021.3,z:4960.4},heading:31},
  {name:'xv-N-272',camera:{x:5031.1,z:4962.1},heading:25},
  {name:'xv-N-326',camera:{x:5079.3,z:4970.5},heading:30},
  {name:'xv-N-332',camera:{x:5089.5,z:4972.2},heading:19},
  {name:'xv-N-342',camera:{x:5099.9,z:4973.9},heading:11},
  {name:'xv-N-350',camera:{x:5110.2,z:4974.9},heading:359},
  {name:'xv-N-399',camera:{x:5154.9,z:4980.2},heading:34},
  {name:'xv-N-440',camera:{x:5195.5,z:4989.9},heading:22},
  {name:'xv-N-462',camera:{x:5215.2,z:4993.4},heading:20},
  {name:'xv-N-466',camera:{x:5225.2,z:4995.2},heading:24},
  {name:'xv-N-496',camera:{x:5259.3,z:5000.6},heading:356},
  {name:'xv-N-512',camera:{x:5269.7,z:5002.5},heading:9},
  {name:'xv-N-523',camera:{x:5279.4,z:5003.3},heading:356},
  {name:'xv-N-527',camera:{x:5279.4,z:5003.3},heading:25},
  {name:'xv-N-553',camera:{x:5309.4,z:5008.9},heading:20},
  {name:'xv-N-566',camera:{x:5319.6,z:5010.6},heading:11},
  {name:'xv-N-570',camera:{x:5329.2,z:5012.3},heading:7},
  {name:'xv-N-596',camera:{x:5358.7,z:5015.0},heading:347},
  {name:'xv-N-611',camera:{x:5368.9,z:5016.5},heading:352},
  {name:'xv-N-619',camera:{x:5378.7,z:5017.9},heading:350},
  {name:'xv-N-630',camera:{x:5388.6,z:5019.6},heading:348},
  {name:'xv-N-648',camera:{x:5399.6,z:5022.3},heading:29},
  {name:'xv-N-678',camera:{x:5428.7,z:5026.1},heading:30},
  {name:'xv-N-685',camera:{x:5439.8,z:5027.5},heading:358},
  {name:'xv-S-001',camera:{x:4766.1,z:4920.2},heading:176},
  {name:'xv-S-018',camera:{x:4786.6,z:4923.7},heading:203},
  {name:'xv-S-034',camera:{x:4796.5,z:4925.3},heading:188},
  {name:'xv-S-042',camera:{x:4806.5,z:4926.7},heading:189},
  {name:'xv-S-054',camera:{x:4816.5,z:4928.1},heading:185},
  {name:'xv-S-064',camera:{x:4826.7,z:4929.6},heading:194},
  {name:'xv-S-072',camera:{x:4836.6,z:4931.1},heading:209},
  {name:'xv-S-079',camera:{x:4846.0,z:4932.4},heading:210},
  {name:'xv-S-102',camera:{x:4866.5,z:4936.0},heading:219},
  {name:'xv-S-148',camera:{x:4906.9,z:4942.1},heading:164},
  {name:'xv-S-171',camera:{x:4927.1,z:4944.9},heading:169},
  {name:'xv-S-175',camera:{x:4937.1,z:4946.5},heading:194},
  {name:'xv-S-184',camera:{x:4947.1,z:4947.7},heading:202},
  {name:'xv-S-192',camera:{x:4960.9,z:4949.8},heading:228},
  {name:'xv-S-202',camera:{x:4960.9,z:4949.8},heading:171},
  {name:'xv-S-408',camera:{x:5165.2,z:4983.2},heading:193},
  {name:'xv-S-414a',camera:{x:5165.7,z:4990.8},heading:107},
  {name:'xv-S-414b',camera:{x:5185.2,z:4988.2},heading:253},
  {name:'xv-S-424',camera:{x:5185.2,z:4988.2},heading:223},
  {name:'xv-S-431',camera:{x:5185.2,z:4988.2},heading:181},
  {name:'xv-S-460',camera:{x:5215.2,z:4993.4},heading:170},
  {name:'xv-S-469',camera:{x:5225.2,z:4995.2},heading:158},
  {name:'xv-S-496',camera:{x:5248.8,z:4998.1},heading:168},
  {name:'xv-S-511',camera:{x:5269.7,z:5002.5},heading:224},
  {name:'xv-S-515',camera:{x:5269.7,z:5002.5},heading:184},
  {name:'xv-S-522',camera:{x:5279.4,z:5003.3},heading:216},
  {name:'xv-S-534',camera:{x:5289.6,z:5004.8},heading:180},
  {name:'xv-S-544',camera:{x:5300.0,z:5007.5},heading:170},
  {name:'xv-S-557',camera:{x:5309.4,z:5008.9},heading:175},
  {name:'xv-S-596',camera:{x:5358.7,z:5015.0},heading:208},
  {name:'xv-S-612',camera:{x:5368.9,z:5016.5},heading:201},
  {name:'xv-S-619',camera:{x:5378.7,z:5017.9},heading:207},
  {name:'xv-S-629',camera:{x:5388.6,z:5019.6},heading:212},
  {name:'xv-S-638',camera:{x:5388.6,z:5019.6},heading:179},
  {name:'xv-S-651',camera:{x:5409.4,z:5023.8},heading:215},
  {name:'xv-S-658',camera:{x:5418.3,z:5024.7},heading:218},
  {name:'xv-S-667',camera:{x:5418.3,z:5024.7},heading:179},
  {name:'xv-S-686',camera:{x:5439.8,z:5027.5},heading:198},
];

test('the Rua XV de Novembro lots match their Street View views',async({page})=>{
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
    await page.screenshot({path:`output/visual/xv/${v.name}.png`});
  }
  expect(errors).toEqual([]);
});
