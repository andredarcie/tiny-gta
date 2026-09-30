// VIDEO: the story's second mission — the boss wants the six rednecks buried "com
// respeito": the shovel in first person (dig, drag the body in, fill, the little
// cross), "algumas horas depois", a cigarette on the mountain top, and the report
// to the boss. Portuguese (pt-BR), sarcastic tone, the country radio under it.
//   npm run video -- missao-2
import { test } from '@playwright/test';
import { Director } from '../director.ts';

test('video: missao-2', async ({ page }) => {
  test.setTimeout(300_000);
  const d = await Director.start(page, 'missao-2', {
    title: 'PROMOVIDO A COVEIRO',
    subtitle: 'Missão 2: Do pó ao pó',
    outro: 'TINY CRIME',
    outroSub: 'Modo história: Missão 2',
    music: 3,                                   // country radio
    tod: .42,
  });
  const story = (cmd: string) => d.ev((c: string) => (window as any).__test.story(c), cmd) as Promise<any>;
  const nextLines = async (n: number) => {
    for (let i = 0; i < n; i++) { await page.keyboard.press('Space'); await d.wait(60); await page.keyboard.press('Space'); await d.wait(60); }
  };
  const waitStory = (pred: string, ms = 20_000) =>
    page.waitForFunction(new Function(`const s=window.__test.story('state');return ${pred};`) as any, null, { timeout: ms });
  const idle = () => waitStory('!s.busy&&!s.cine&&!s.burial.busy');
  const takeShovel = async () => {
    const sh = (await story('state')).burial.shovel;
    await d.teleport({ x: sh.x - 1.6, z: sh.z - 1.2 }, sh);
    await d.wait(500);
    await d.interact();
    await idle();
  };
  const toBody = async () => {
    const b = (await story('state')).burial.bodies[0];
    await d.teleport({ x: b.x - 1.2, z: b.z - 1.2 }, b);
    await d.wait(500);
  };

  // 1) the hook: the end of the second call — "Seis corpos, seis covas. Faz direito."
  await story('stage:call2');
  await story('toBooth');
  await d.wait(1000);
  await d.interact();
  await waitStory('s.cine');
  await nextLines(8);
  await d.wait(300);
  await d.clip('order', 'Missão 2: plano de carreira', async () => { await d.wait(2500); }, 100);
  await story('skipCine');
  await waitStory('s.stage==="burial"&&!s.busy', 20_000);
  await d.wait(5600);                            // the mission-passed card goes by

  // 2) the shovel by the woodpile
  const sh = (await story('state')).burial.shovel;
  await d.teleport({ x: sh.x - 1.6, z: sh.z - 1.2 }, sh);
  await d.wait(1500);
  await d.clip('shovel', 'Equipamento de trabalho', async () => {
    await d.interact();
    await d.wait(1100);
  }, 100);
  await idle();

  // 3-5) the first grave, filmed in three beats (the clip keeps running between them)
  await toBody();
  await d.interact();
  await d.clip('dig', 'Terapia ocupacional', async () => { await d.wait(2300); }, 0);   // step in + 3 strokes
  await d.wait(800);                                                                  // shovel planted (cut)
  await d.clip('drag', 'Com licença, Cletus', async () => { await d.wait(2000); }, 0);  // into the pit
  await d.wait(2200);                                                                 // take the shovel back (cut)
  await d.clip('fill', 'Descanse em paz. Ou não.', async () => { await d.wait(2300); }, 200); // fill, pat, cross
  await idle();

  // two more graves off camera
  for (let n = 0; n < 2; n++) { await takeShovel(); await toBody(); await d.interact(); await d.wait(1500); if (n < 1) await idle(); }

  // 6) the time skip — black screen, "ALGUMAS HORAS DEPOIS..."
  await waitStory('s.cine', 30_000);
  await d.wait(150);
  await d.clip('later', 'Hora extra não remunerada', async () => { await d.wait(1200); }, 0);

  // 7) the summit: the cigarette to the lips, the lighter (the cover)
  await d.wait(1050);                            // until the scene has faded in (cut)
  await d.clip('lighter', 'O cigarro da vitória', async () => {
    await d.wait(1850);
    d.cover();
    await d.wait(550);
  }, 0);

  // 8) the drag and the smoke, over the woods
  await d.wait(700);
  await d.clip('smoke', 'Vista de quem cavou 6 covas', async () => { await d.wait(1800); }, 0);

  // 9) the line
  await waitStory('s.cine', 5000);
  await d.wait(1300);
  await d.clip('talk', 'Reflexão profunda', async () => { await d.wait(2500); }, 100);
  await story('skipCine');
  await waitStory('s.stage==="call3"&&!s.busy');

  // 10) the report — "Você fez o serviço sujo e ainda limpou a sujeira"
  await story('toBooth');
  await d.wait(1200);
  await d.interact();
  await waitStory('s.cine');
  await nextLines(2);
  await d.wait(300);
  await d.clip('report', 'Promovido a coveiro', async () => { await d.wait(2700); }, 100);
  await story('skipCine');
  await waitStory('!s.busy&&!s.cine&&!s.burial.busy');
  await d.wait(700);
  await d.clip('card', undefined, async () => { await d.wait(1900); }, 0);

  await d.finish();
});
