import {expect,test} from '@playwright/test';

const VIEWS=[
  {name:'joao-cabrera-east',camera:{x:4865,z:4830},target:{x:4885,z:4830}},
  {name:'joao-cabrera-west',camera:{x:4865,z:4830},target:{x:4845,z:4830}},
  {name:'joao-cabrera-down-street',camera:{x:4865,z:4830},target:{x:4862,z:4900}},
  {name:'school-neighbor',camera:{x:5091,z:5198},target:{x:5091,z:5098}},
  {name:'balcony-house',camera:{x:4864,z:4954},target:{x:4851,z:4959}},
];

test('residential streets render the city houses without runtime errors',async({page})=>{
  const errors:string[]=[];
  page.on('pageerror',error=>{if(!/Pointer Lock/i.test(error.message))errors.push(error.message);});
  page.on('console',message=>{if(message.type()==='error'&&!message.text().startsWith('Failed to load resource:'))errors.push(message.text());});
  await page.goto('/?map=divinolandia',{waitUntil:'load'});
  await page.waitForFunction(()=>!!(window as any).render_game_to_text
    && JSON.parse((window as any).render_game_to_text()).started===true,null,{timeout:90_000});
  for(const view of VIEWS){
    const moved=await page.evaluate(({camera,target})=>(window as any).__test.teleport(camera.x,camera.z,target.x,target.z),view);
    expect(moved).toBe(true);
    await page.waitForTimeout(500);
    await page.screenshot({path:`output/visual/houses-${view.name}.png`});
  }
  expect(errors).toEqual([]);
});
