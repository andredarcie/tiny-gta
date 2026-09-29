// VIDEO: the game's violence — headshots, dismemberment, explosive gibs, blood everywhere.
// Portuguese (pt-BR), sarcastic tone, the game's funk radio under the gunfire.
//   npm run video -- gore
import { test } from '@playwright/test';
import { Director } from '../director.ts';

test('video: gore', async ({ page }) => {
  const d = await Director.start(page, 'gore', {
    title: 'TERAPIA URBANA',
    subtitle: 'Relaxante. Educativo. Ilegal.',
    outro: 'TINY CRIME',
    outroSub: 'Jogue com moderação (ou não)',
    music: 0,                                   // BOOMBEAT RADIO — funk under the carnage
    tod: .42,
  });
  await d.giveGun();
  // downtown: busy sidewalks, plenty of volunteers
  await d.teleport({ x: 10, z: 22 }, { x: 10, z: 60 });
  await d.wait(1500);

  // 1) the arsenal flicks through the hand
  await d.clip('arsenal', 'Escolha seus argumentos', async () => {
    for (const w of ['pistol', 'shotgun', 'rocket']) { await d.equip(w); await d.wait(420); }
  }, 100);

  // 2) one bullet to the head — close, the victim fills the frame
  await d.equip('pistol');
  if (!(await d.aimAtNpc(3.2, 'head'))) throw new Error('no pedestrian to film');
  await d.wait(200);
  await d.clip('headshot', 'Ele perdeu a cabeça. Literalmente.', async () => {
    await d.wait(300);
    await d.aimAtNpc(3.2, 'head');
    await d.attack();
    await d.wait(1800);
  });

  // 3) body shots take limbs
  await d.equip('shotgun');
  await d.aimAtNpc(3, 'body');
  await d.wait(200);
  await d.clip('limbs', 'Precisa de uma mão? Não tem mais.', async () => {
    await d.wait(250);
    await d.aimAtNpc(3, 'body');
    await d.attack();
    await d.wait(650);
    await d.aimAtNpc(3, 'legs');
    await d.attack();
    await d.wait(1300);
  });

  // 4) or blow them apart — the blast is the cover
  await d.equip('rocket');
  await d.aimAtNpc(8, 'body');
  await d.wait(200);
  await d.clip('rocket', 'Resolvendo conflitos com diálogo', async () => {
    await d.wait(250);
    await d.aimAtNpc(8, 'body');
    await d.attack();
    await d.wait(260);
    d.cover();
    await d.wait(1700);
  });

  // 5) the aftermath: walk up to the carnage
  await d.clip('aftermath', 'Alguém chama a faxina', async () => {
    await d.key('KeyW', true); await d.wait(260); await d.key('KeyW', false);
    await d.wait(1000);
  }, 300);

  await d.finish();
});
