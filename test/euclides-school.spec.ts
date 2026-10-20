import {expect, test} from '@playwright/test';

// November 2024 Street View panorama on Rua São Vicente de Paula, facing the façade.
const VIEWS=[
  {name:'',camera:{x:5091,z:5198},target:{x:5091,z:5298}},
  {name:'-east',camera:{x:5103,z:5198},target:{x:5103,z:5298}},
  {name:'-west',camera:{x:5080,z:5198},target:{x:5080,z:5298}},
  {name:'-facade',camera:{x:5091,z:5198},target:{x:5078,z:5218}},
];

test('EMEB Euclides da Cunha loads at its mapped Divinolândia location',async({page})=>{
  const errors:string[]=[];
  page.on('pageerror',error=>{if(!/Pointer Lock/i.test(error.message))errors.push(error.message);});
  page.on('console',message=>{if(message.type()==='error'&&!message.text().startsWith('Failed to load resource:'))errors.push(message.text());});
  page.on('response',response=>{if(response.status()>=400)errors.push(`${response.status()}: ${response.url()}`);});
  await page.goto('/?map=divinolandia',{waitUntil:'load'});
  await page.waitForFunction(()=>!!(window as any).render_game_to_text
    && JSON.parse((window as any).render_game_to_text()).started===true,null,{timeout:90_000});
  await page.waitForFunction(()=>!!(window as any).__test?.teleport,{timeout:30_000});
  for(const view of VIEWS){
    const moved=await page.evaluate(({camera,target})=>(window as any).__test.teleport(camera.x,camera.z,target.x,target.z),view);
    expect(moved).toBe(true);
    await page.waitForTimeout(750);
    await page.screenshot({path:`output/visual/euclides-school${view.name}.png`});
  }
  const state=await page.evaluate(()=>JSON.parse((window as any).render_game_to_text()));
  expect(state.started).toBe(true);
  expect(errors).toEqual([]);
});
