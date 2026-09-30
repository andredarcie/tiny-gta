// VIDEO: the story's first mission — a pay phone rings in the street, the crime boss
// hires you over it ("Bem-vindo à Cidade do Pecado"), the test is a redneck camp in the
// woods, and the boss's reaction on the second call ("você acha que isso é videogame?").
// Portuguese (pt-BR), sarcastic tone, the country radio under it.
//   npm run video -- missao-1
import { test } from '@playwright/test';
import { Director } from '../director.ts';

test('video: missao-1', async ({ page }) => {
  test.setTimeout(240_000);
  const d = await Director.start(page, 'missao-1', {
    title: 'ATENDI UM ORELHÃO',
    subtitle: 'Nunca mais faço isso.',
    outro: 'TINY CRIME',
    outroSub: 'Modo história: Missão 1',
    music: 3,                                   // country radio — fits the rednecks
    tod: .42,
  });
  const story = (cmd: string) => d.ev((c: string) => (window as any).__test.story(c), cmd) as Promise<any>;
  const tough = () => d.ev(() => (window as any).__test.setHealth(5000));
  // advance the cut-scene `n` lines (first press reveals the line, second moves on)
  const nextLines = async (n: number) => {
    for (let i = 0; i < n; i++) { await page.keyboard.press('Space'); await d.wait(60); await page.keyboard.press('Space'); await d.wait(60); }
  };
  const waitStory = (pred: string, ms = 15_000) =>
    page.waitForFunction(new Function(`const s=window.__test.story('state');return ${pred};`) as any, null, { timeout: ms });

  const s0 = await story('state');
  const booth = s0.booth, stand = s0.booth.stand;

  // 1) the hook: a pay phone ringing on the sidewalk, light column over it
  await d.teleport({ x: stand.x - 9, z: stand.z - 5 }, { x: booth.x, z: booth.z });
  await d.wait(1800);
  await d.clip('ringing', 'Um orelhão tocando no meio da rua', async () => {
    await d.hold('KeyW', 350);
    await d.wait(1600);
  }, 150);

  // 2) first person: the hand takes the receiver
  await story('toBooth');
  await d.wait(900);
  await d.clip('answer', 'Regra nº 1: nunca atenda desconhecido', async () => {
    await d.interact();
    await d.wait(1250);
  }, 0);

  // 3) the boss on the line
  await waitStory('s.cine');
  await d.clip('boss', 'Era o chefão do crime', async () => {
    await d.wait(2300);
  }, 100);

  // 4) ...and the job ("Acaba com eles. Com os seis.")
  await nextLines(6);
  await d.wait(300);
  await d.clip('job', 'A entrevista de emprego', async () => {
    await d.wait(900);
    d.cover();                                   // the booth, PHONE sign lit, the call going on
    await d.wait(1500);
  }, 100);
  await story('skipCine');
  await waitStory('s.stage==="camp"&&!s.busy');
  await d.giveGun();
  await tough();

  // 5) the camp in the woods: tents, campfire, six armed rednecks (from behind, unseen)
  await d.teleport({ x: s0.camp.x + 3, z: -68 }, { x: s0.camp.x, z: -46 });
  await d.wait(2500);
  await d.clip('camp', 'Seis caipiras armados. Moleza.', async () => {
    await d.wait(2400);
  }, 100);

  // 6) a long-range "conversation"
  await d.equip('sniper');
  await story('aim:14');
  await d.wait(400);
  await d.clip('sniper', 'Negociação à distância', async () => {
    await d.wait(300);
    await story('aim:14');
    await d.attack();
    await d.wait(1400);
  }, 100);

  // 7) they come running, guns blazing — the rocket answers (the cover)
  await tough();
  await d.equip('rocket');
  await story('aim:12');
  await d.wait(300);
  await d.clip('rocket', 'Resolvendo tudo no diálogo', async () => {
    await d.wait(250);
    await story('aim:12');
    await d.attack();
    await d.wait(1900);
  }, 100);

  // 8) the rest with the rifle
  await tough();
  await d.equip('ak47');
  await story('aim:9');
  await d.clip('spray', 'Eles não gostaram', async () => {
    for (let i = 0; i < 6; i++) { await story('aim:9'); await d.attack(); await d.wait(170); }
    await d.wait(600);
  }, 100);
  await story('killCamp');
  await waitStory('s.stage==="call2"');

  // 9) the second call: the boss is... horrified
  await story('toBooth');
  await d.wait(1200);
  await d.interact();
  await waitStory('s.cine');
  await nextLines(2);
  await d.wait(200);
  await d.clip('videogame', 'O chefão ficou chocado', async () => {
    await d.wait(3000);
  }, 100);

  // 10) ...then laughs it off: test passed
  await nextLines(4);
  await d.wait(300);
  await d.clip('passed', 'Contratado.', async () => {
    await d.wait(2200);
  }, 100);
  await story('skipCine');
  await waitStory('!s.busy&&!s.cine&&!s.burial.busy');
  await d.wait(700);
  await d.clip('card', undefined, async () => {
    await d.wait(1900);
  }, 0);

  await d.finish();
});
