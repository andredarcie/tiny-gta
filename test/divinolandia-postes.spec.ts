import {expect,test} from '@playwright/test';

const VIEWS=[
  {name:'residential',camera:{x:4865,z:4830},target:{x:4862,z:4900}},
  {name:'main-street',camera:{x:4922,z:4943},target:{x:5010,z:4955}},
  {name:'school-front',camera:{x:5080,z:5198},target:{x:5080,z:5270}},
];

test('utility poles follow town streets without rendering errors',async({page})=>{
  const errors:string[]=[];
  page.on('pageerror',error=>{if(!/Pointer Lock/i.test(error.message))errors.push(error.message);});
  page.on('console',message=>{if(message.type()==='error'&&!message.text().startsWith('Failed to load resource:'))errors.push(message.text());});
  await page.goto('/?map=divinolandia',{waitUntil:'load'});
  await page.waitForFunction(()=>!!(window as any).__test?.teleport
    && JSON.parse((window as any).render_game_to_text()).started===true,null,{timeout:90_000});
  for(const view of VIEWS){
    expect(await page.evaluate(({camera,target})=>(window as any).__test.teleport(camera.x,camera.z,target.x,target.z),view)).toBe(true);
    await page.waitForTimeout(600);
    await page.screenshot({path:`output/visual/postes-${view.name}.png`});
  }
  expect(errors).toEqual([]);
});
