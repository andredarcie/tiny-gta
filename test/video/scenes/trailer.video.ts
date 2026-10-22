// VIDEO: the GTA-style trailer of Divinolândia — drone shots of the town's landmarks with a
// female narrator (trailer.vo.json, voiced through VoiceStudio), the game's groove radio
// under it, and a car blowing up at night in front of the Matriz as the payoff (and the cover).
//   npm run video -- trailer
import { test } from '@playwright/test';
import { Director, type CamKey } from '../director.ts';

// town-local metres (the bake frame, centred on the Igreja Matriz) → world
const W = (x: number, z: number) => ({ x: x + 5000, z: z + 5000 });
/** A camera key in town-local coords: eye (x,z) `h` m up, looking at (tx,tz) `th` m up. */
const K = (x: number, z: number, h: number, tx: number, tz: number, th: number): CamKey => {
  const e = W(x, z), t = W(tx, tz);
  return { x: e.x, z: e.z, h, tx: t.x, tz: t.z, th };
};

test('video: trailer', async ({ page }) => {
  test.setTimeout(420_000);
  const d = await Director.start(page, 'trailer', {
    title: 'DIVINOLÂNDIA',
    subtitle: 'O trailer oficial',
    outro: 'TINY CRIME',
    outroSub: 'Divinolândia te espera',
    outroVo: 'final',
    music: 2,                                   // the groove station under the whole trailer
    tod: .42,
    hide: ['#hud', '#npc-labels', '#police-radio', '#cine-sub', '#cine-hint'],
  });

  /** One drone shot: frame `a` (unfilmed, lets the streets around it load), then glide to `b`. */
  const drone = async (label: string, caption: string, vo: string, a: CamKey, b: CamKey, ms: number, tod: number, fov = 50) => {
    await d.shot(a, a, 1, { tod, fov });
    await d.wait(1800);
    await d.clip(label, caption, async () => {
      await d.shot(a, b, ms, { tod, fov });
      await d.wait(ms * .8);
    }, 0, vo);
  };

  // 1) the town from the sky in the morning
  await drone('abertura', 'Divinolândia, SP', 'abertura',
    K(330, 260, 150, 0, 0, 10), K(250, 195, 115, 0, 0, 10), 4200, .30, 55);
  // 2) the Igreja Matriz from its square, craning up
  await drone('matriz', 'Igreja Matriz', 'matriz',
    K(80, 12, 2, 7, 2, 15), K(64, 12, 4.5, 7, 2, 15), 3200, .34);
  // 3) the Prefeitura, gliding down Rua XV toward its porch
  await drone('prefeitura', 'Prefeitura', 'prefeitura',
    K(-82, -50, 6, -48, -68, 5), K(-68, -51, 4.5, -48, -68, 5), 3000, .40);
  // 4) the shops of Rua XV de Novembro
  await drone('comercio', 'Rua XV de Novembro', 'comercio',
    K(55, -36, 4, 160, -18, 3), K(90, -31, 4, 195, -12, 3), 3000, .45);
  // 5) the Hospital Regional on the hill
  await drone('hospital', 'Hospital Regional', 'hospital',
    K(-366, 610, 10, -328, 692, 10), K(-354, 636, 22, -328, 692, 10), 3400, .50);
  // 6) the Rio do Peixe, over the trees on its banks
  await drone('rio', 'Rio do Peixe', 'rio',
    K(1035, 115, 24, 1100, 0, 0), K(1062, 65, 19, 1115, -60, 0), 3200, .58);
  // 7) the Monumento ao Ciclista at the east entrance, circling over it at sunset
  await drone('ciclista', 'Monumento ao Ciclista', 'ciclista',
    K(1508, -148, 13, 1480, -171, 3), K(1508, -196, 13, 1480, -171, 3), 3000, .70);
  // 8) the royal-palm drive at the west entrance, golden hour
  await drone('palmeiras', 'Entrada Oeste', 'palmeiras',
    K(-1303, -556, 3, -1420, -556, 4), K(-1328, -556, 3.5, -1420, -556, 4), 3200, .73);

  // 9) night at the Matriz: a car in front of the church goes up — and nobody saw a thing
  // (the cover). The camera frames the car with the church behind it.
  await d.endShot();
  await d.teleport(W(45, -10), W(7, 2));
  await d.setTod(.92);
  await d.wait(2000);
  const car = await d.ev((p: { x: number; z: number }) => (window as any).__test.carNear(p.x, p.z), W(40, -8)) as { x: number; z: number } | null;
  if (!car) throw new Error('no car near the Matriz to film');
  const church = W(7, 2), dx = car.x - church.x, dz = car.z - church.z, n = Math.hypot(dx, dz);
  // eye behind the car, looking past it at the church (the car sits in the middle of the frame)
  const eye = (r: number, h: number): CamKey => ({ x: car.x + dx / n * r, z: car.z + dz / n * r, h, tx: car.x - dx * .35, tz: car.z - dz * .35, th: 4 });
  await d.shot(eye(20, 4), eye(20, 4), 1, { tod: .92 });
  await d.wait(1500);
  await d.clip('noite', 'Sem testemunhas', async () => {
    await d.shot(eye(20, 4), eye(15, 3.2), 3400, { tod: .92 });
    await d.wait(900);
    await d.ev((p: { x: number; z: number }) => (window as any).__test.explodeNear(p.x, p.z), car);
    await d.wait(170);
    d.cover();
    await d.wait(2000);
  }, 200, 'noite');

  await d.finish();
});
