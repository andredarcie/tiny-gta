import {test} from '@playwright/test';
import {GALPOES} from '../src/js/world/divinolandia/galpoes.ts';

// A print of every place added to the town in the Oct/2026 survey: the Cristo Redentor,
// the two neighbourhood churches, the sheds and large buildings (galpoes.ts), and the
// surveyed streets — each framed by the cinematic drone camera (window.__test.cineShot)
// at noon, the player parked beside it so the town around streams in. Screenshots go to
// output/visual/novos-lugares/; a contact sheet is made from them afterwards.
// The window opens off-screen so the user can keep using the computer.
test.use({launchOptions:{args:['--window-position=-32000,-32000','--disable-background-timer-throttling','--disable-renderer-backgrounding','--disable-backgrounding-occluded-windows','--ignore-gpu-blocklist']}});

const OX=5000,OZ=5000;
type Shot={name:string;x:number;z:number;h:number;tx:number;tz:number;th:number;fov?:number};
// a camera at town-local (x,z) h m over the ground looking at (tx,tz) th m up
const S=(name:string,x:number,z:number,h:number,tx:number,tz:number,th:number,fov=50):Shot=>({name,x:x+OX,z:z+OZ,h,tx:tx+OX,tz:tz+OZ,th,fov});
// a shed seen from in front of its street side, a little off-axis and raised
const galpao=(id:string,name:string,back=1.2,up=.35):Shot=>{
  const g=GALPOES.find(q=>q.id===id)!,fx=-Math.sin(g.rot),fz=Math.cos(g.rot),sx=Math.cos(g.rot),sz=Math.sin(g.rot);
  const dist=Math.max(g.w,g.d)*back+10;
  return S(name,g.c[0]+fx*dist+sx*dist*.35,g.c[1]+fz*dist+sz*dist*.35,Math.max(4,dist*up),g.c[0],g.c[1],g.o.h*.45);
};
const SHOTS:Shot[]=[
  S('01-cristo-redentor',906,-452,7,937.5,-474,9,45),
  S('02-cristo-redentor-alto',880,-420,40,937.5,-474,6,45),
  S('03-igreja-santa-luzia',-523,88,4,-499,105,4),
  S('04-paroquia-aparecida',1160,-168,5,1176,-198,7),
  galpao('g0','05-galpao-industrial',1,.45),
  galpao('g1a','06-galpao-placas-solares',.9,.45),
  galpao('g2','07-barracao-encosta',.9,.4),
  galpao('g5','08-galpoes-em-arco',1),
  galpao('g8','09-ginasio-de-esportes',1),
  galpao('g9','10-oficina-bandeira-quadriculada',.8,.2),
  galpao('g19','11-bilica-pneus',.8,.2),
  galpao('g21','12-quadra-coberta',1),
  galpao('g27','13-salao-de-eventos',.8,.25),
  galpao('g28','14-martinelli',.8,.2),
  galpao('g51','15-centro-pastoral',.8,.2),
  galpao('g20','16-escola-azul',.8,.25),
  galpao('g44','17-viveiro-de-mudas',1),
  galpao('g11','18-armazem-agricola',.9),
  galpao('g6','19-galpao-transportadora',.9),
  // Rua Sete de Setembro (surveyed lot by lot): from the opposite kerb toward the lots
  S('20-sete-de-setembro-persona-mega',181.4,79.3,3.2,193.8,68.6,2.2,55),
  S('21-sete-de-setembro-bar-recomeco',226.6,88.4,3.2,238.7,77.4,2.2,55),
  S('22-sete-de-setembro-techmize-prevfacil',283.6,98.8,3.2,295.8,87.8,2.2,55),
  S('23-sete-de-setembro-el-barbero',134.0,61.7,3.2,141.2,76.4,2.2,55),
  S('24-sete-de-setembro-condutran',100.3,55.8,3.2,108.0,70.3,2.2,55),
  S('25-sete-de-setembro-morena-flor',257.5,85.9,3.2,265.0,100.5,2.2,55),
  S('26-sete-de-setembro-cras',-103.7,26.5,3.2,-91.4,15.6,2.2,55),
  S('27-sete-de-setembro-casa-verde',163.8,75.8,3.2,176.1,65.0,2.2,55),
];

test('prints of the new places', async ({page}) => {
  test.setTimeout(600_000);
  await page.setViewportSize({width:1280,height:720});
  await page.goto('/?tod=0.5',{waitUntil:'load'});
  await page.waitForFunction(() => !!(window as any).render_game_to_text
    && JSON.parse((window as any).render_game_to_text()).started === true, null, {timeout: 90_000});
  await page.waitForTimeout(3000);
  for(const s of SHOTS){
    // park the player beside the place (the town culls far groups), then frame it
    await page.evaluate(([x,z,tx,tz]) => (window as any).__test.teleport(x,z,tx,tz),[s.x,s.z,s.tx,s.tz]);
    await page.evaluate((v) => (window as any).__test.cineShot({a:{x:v.x,z:v.z,h:v.h,tx:v.tx,tz:v.tz,th:v.th},fov:v.fov,tod:.5}),s);
    await page.waitForTimeout(2200);
    await page.screenshot({path:`output/visual/novos-lugares/${s.name}.png`});
  }
  await page.evaluate(() => (window as any).__test.cineShot(null));
});
