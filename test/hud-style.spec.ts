import {test} from '@playwright/test';

// HUD / menu look review: saves the title screen, the in-game HUD (on foot and in a car)
// and the pause menu to output/visual/hud/ — judging the pictures is the owner's call.
test('HUD and menus screenshots',async({page})=>{
  test.setTimeout(120_000);
  await page.setViewportSize({width:1280,height:720});
  await page.goto('/?tod=.5',{waitUntil:'load'});
  await page.waitForFunction(()=>!!(window as any).render_game_to_text
    && JSON.parse((window as any).render_game_to_text()).started===true,null,{timeout:90_000});
  // localhost skips the title screen: show it again over the running game for the picture
  await page.evaluate(()=>{document.getElementById('title')!.style.display='flex';});
  await page.waitForTimeout(600);
  await page.screenshot({path:'output/visual/hud/title.png'});
  await page.evaluate(()=>{document.getElementById('title')!.style.display='none';});
  await page.waitForTimeout(2500);
  await page.evaluate(()=>(window as any).__test.teleport(5060,5030,5000,5000));
  await page.waitForTimeout(2500);
  await page.screenshot({path:'output/visual/hud/foot.png'});
  await page.evaluate(()=>(window as any).__test.enterCar?.());
  await page.waitForTimeout(2000);
  await page.screenshot({path:'output/visual/hud/car.png'});
  await page.keyboard.press('p');
  await page.waitForTimeout(800);
  await page.screenshot({path:'output/visual/hud/pause.png'});
});
