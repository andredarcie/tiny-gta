import type { Racer, PrizeStreak } from '@/core/types.ts';

// World-grid + terrain math moved VERBATIM to shared/sim/terrain.ts (pure,
// THREE-free) so the multiplayer server (server/src) reads the SAME ground the
// client walks on. Everything is re-exported here — every existing
// `@/core/constants.ts` import keeps working unchanged. What remains below is
// the impure/game-only part: RNG helpers and the shared race tuning.
export * from '../../../shared/sim/terrain.ts';

export const rand=(a: number, b: number): number=>a+Math.random()*(b-a);
export const irand=(a: number, b: number): number=>Math.floor(rand(a,b+1));
export const pick=<T>(a: T[]): T=>a[Math.floor(Math.random()*a.length)];

// ===== Rubber banding compartilhado das corridas (rua / lancha / off-road) =====
// Objetivo: manter os rivais COLADOS no jogador — idealmente um deles sempre
// visível na câmera — pra dar tensão de que qualquer erro perde a corrida.
//
// gap = progresso do jogador − progresso do rival, em "unidades de checkpoint"
// (positivo = rival ATRÁS). A chave é ANCORAR a velocidade do rival no RITMO
// ATUAL do jogador (não numa base fixa): assim um jogador rápido nunca deixa o
// pelotão pra trás, e um jogador que ERRA/PARA é ultrapassado na hora.
//   - rival ATRÁS  : anda ACIMA do ritmo do jogador (surto) pra colar de volta;
//   - rival À FRENTE: anda ABAIXO do ritmo do jogador pra ser alcançado/visto;
//   - rival LADO A LADO (gap≈0): anda no ritmo do jogador (fica grudado).
// `base` é o piso de velocidade (vale quando o jogador está lento/parado, pra o
// rival ainda passar). Surto/alívio fortes de propósito (sensação arcade).
export const RACE_CATCHUP_GAIN=0.60; // surto por checkpoint de ATRASO
export const RACE_CATCHUP_MAX=0.95;  // teto do surto de quem está atrás (+95% do ritmo)
export const RACE_LEAD_EASE=0.45;    // alívio por checkpoint de DIANTEIRA
export const RACE_LEAD_MAX=0.30;     // teto do alívio de quem está à frente (−30% do ritmo):
// um rival líder alivia o suficiente pra ser alcançável (uma corrida limpa VENCE),
// mas se você vacilar o surto de quem vem atrás (RACE_CATCHUP_MAX) ainda te pega.
// `pace` é o multiplicador PERSISTENTE de cada rival (ex.: .9 / 1.0 / 1.1): mesmo
// ancorados no mesmo ritmo do jogador, cada inimigo corre num passo diferente, o
// que os ESPALHA ao longo da pista (um na frente, outro atrás) em vez de todos
// grudados no mesmo ponto. Sem ele, anchor igual pra todos => andam por cima.
export function rubberSpeed(base: number, gap: number, playerSpeed = 0, pace = 1): number {
  // ancora no MAIOR entre a base do rival e o ritmo de REFERÊNCIA do jogador
  // (já suavizado por smoothPace — ver abaixo; NÃO use cur.speed cru aqui)
  const anchor=Math.max(base,Math.abs(playerSpeed));
  const f=gap>=0
    ? 1+Math.min(gap*RACE_CATCHUP_GAIN,RACE_CATCHUP_MAX) // atrás: surto pra colar
    : 1+Math.max(gap*RACE_LEAD_EASE,-RACE_LEAD_MAX);     // à frente: alívio pra ser pego
  return anchor*pace*f;
}

// Ritmo de REFERÊNCIA do jogador pro rubber banding, suavizado com resposta
// ASSIMÉTRICA: sobe rápido (acompanha quem acelera, rivais não ficam pra trás) e
// CAI devagar (frear/levantar o pé NÃO faz o pelotão frear junto — sem isso os
// rivais espelhavam o acelerador na hora). Cada corrida guarda seu próprio `prev`
// e passa o retorno como `playerSpeed` pro rubberSpeed, no lugar do cur.speed cru.
//   prev/target = velocidades (|cur.speed|); dt em segundos.
export function smoothPace(prev: number, target: number, dt: number): number {
  const tau=target>prev?0.35:2.5;       // s: τ curto pra subir, longo pra descer
  return prev+(target-prev)*(1-Math.exp(-dt/tau));
}

// Empurrão de separação: afasta dois corpos mais perto que `sep` (metade pra cada
// lado) mexendo só em x/z — o y é reassentado no próximo frame de movimento.
function pushApart(pa: { x: number; z: number }, pb: { x: number; z: number }, sep: number): void {
  const dx=pb.x-pa.x,dz=pb.z-pa.z,d=Math.hypot(dx,dz);
  if(d>1e-4&&d<sep){
    const push=(sep-d)/2,nx=dx/d,nz=dz/d;
    pa.x-=nx*push;pa.z-=nz*push;pb.x+=nx*push;pb.z+=nz*push;
  }
}
// Separação dos competidores: dois carros/lanchas nunca andam um por dentro do
// outro. Se `player` (o carro/lancha do jogador {g}) é passado, ele também colide
// com os rivais — o motorista é empurrado junto, então ninguém atravessa ninguém.
// Puro (sem THREE): só lê/escreve .g.position.{x,z}. Usado pelas 3 corridas.
export function separateRacers(racers: Racer[], sep: number, player: Racer | null = null): void {
  for(let a=0;a<racers.length;a++){
    const ra=racers[a];if(ra.finished)continue;
    for(let b=a+1;b<racers.length;b++){
      const rb=racers[b];if(rb.finished)continue;
      pushApart(ra.g.position,rb.g.position,sep);
    }
    if(player&&player.g)pushApart(ra.g.position,player.g.position,sep); // colide com o motorista
  }
}

// Anti-farm para PRÊMIO de corrida (rua/lancha/off-road): vitórias repetidas da
// MESMA prova pagam cada vez menos, e a penalidade se RECUPERA com o tempo — então
// pune o grind em loop (largar a prova e refazer pra ganhar $700 de novo) sem
// estragar quem corre de vez em quando. `s` é um estado {streak,last} que o módulo
// da corrida cria e passa de volta toda vez. base<=0 (sem pódio) passa direto e NÃO
// conta como tick (perder não vira anti-farm). `now` = state.time (segundos).
//   streak 0->1->2... = 100% / 55% / 30% / 17%... do prêmio; recupera 1 passo a
//   cada `recover`s longe da pista.
export function diminishPrize(s: PrizeStreak, base: number, now: number, decay = 0.55, recover = 180): number {
  if(!(base>0))return 0;
  if(Number.isFinite(s.last))
    s.streak=Math.max(0,s.streak-Math.floor((now-s.last)/recover));
  const paid=Math.round(base*Math.pow(decay,s.streak));
  s.last=now;s.streak++;
  return paid;
}
