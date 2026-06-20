import type { Racer, PrizeStreak } from '@/core/types.ts';

export const N=8, CELL=44, ROAD=14, BLOCK=30, SIDE=4, HALF=N*CELL/2;
export const GROUND=N*CELL+ROAD;
export const BEACH=38;                  // largura da faixa de areia ao redor da cidade
export const BOUND=HALF+ROAD/2+BEACH-5; // limite de NPCs: andam na areia, não entram no mar
export const WATER=HALF+ROAD/2+BEACH-3; // linha d'água: além disso é mar (nado/afundamento)
// Parede invisível no mar. Era WATER+70 (=288), só o suficiente pro anel da prova
// de lanchas. AGORA é bem maior (540) pra o jogador alcançar de barco/nadando a
// ILHA paradisíaca a oeste (centro x=-408, costa até ~-497). A prova de lanchas
// NÃO muda: seu raio é fixo (ver COAST_R em boat-race.js, antes derivado daqui).
export const SWIM_BOUND=540;
// Folga de natação da península rural (leste), independente de SWIM_BOUND: mantém
// o alcance a pé/nado da península IGUAL ao de antes (= antigo SWIM_BOUND 288 −
// BOUND 216) mesmo depois de SWIM_BOUND crescer pra ilha. Usada em physics.js.
export const RURAL_SWIM_MARGIN=72;
// Zona rural: península a leste da cidade que termina na montanha-mirante
export const RURAL_X0=HALF+ROAD/2;      // 183: onde a cidade acaba
// Afasta o conteúdo rural (fazendas/montanha) da cidade por um corredor de
// pasto: a península fica mais comprida e o fog dinâmico (daynight.js) esconde a
// zona distante. RURAL_X0 segue na borda da cidade pra manter a estrada ligada.
export const RURAL_GAP=130;
export const RURAL_X1=RURAL_X0+410+RURAL_GAP; // fim do corpo da península: a montanha E a vila rural cabem aqui (depois afunila num bico de areia)
export const RURAL_HALF=120;            // meia-largura da península em z
export const MOUNT_X=RURAL_X0+196+RURAL_GAP;   // centro da montanha, empurrada pra leste
export const MOUNT_R=62, MOUNT_H=46;    // raio da base e altura do pico
// Vila rural ("Pine Hollow"), DEPOIS da montanha: cidadezinha de interior (praça,
// igreja, mercadinho, caixa d'água, moinho). Terreno plano — nem a montanha nem as
// colinas do corredor (HILL_X1) chegam tão a leste.
export const TOWN_CX=650;               // centro da vila (x), além da base leste da montanha
export const MOUNT_BYPASS_R=MOUNT_R+30; // raio da estrada de terra que contorna a montanha pelo norte
// Traçado da estrada de terra rural: reta saindo da cidade, contorno da montanha
// pelo NORTE num arco e reta atravessando a vila. Fonte ÚNICA pro chão (world.js) e
// pro mapa (hud.js), pra estrada e radar baterem 1:1.
export function ruralRoadPath(): [number, number][] {
  const pts: [number, number][] = [], arcStart = MOUNT_X - MOUNT_BYPASS_R;
  for(let x=RURAL_X0;x<=arcStart;x+=12)pts.push([x,0]);             // reta da cidade até a montanha
  for(let a=Math.PI;a>=-1e-6;a-=Math.PI/16)                         // arco pelo norte (z>0)
    pts.push([MOUNT_X+Math.cos(a)*MOUNT_BYPASS_R,Math.sin(a)*MOUNT_BYPASS_R]);
  for(let x=MOUNT_X+MOUNT_BYPASS_R;x<=TOWN_CX+60;x+=12)pts.push([x,0]); // reta atravessando a vila
  return pts;
}
// Mountain relief — a SINGLE smooth analytic function shared by the physics
// (groundHeight) and the visual mesh (assets/models/terrain/mountain.ts), exactly
// like the island. There is NO stored height grid and NO per-node randomness: the
// old low-poly grid randomised every node, so the slope was a field of irregular
// facets and walking/driving across it POPPED from one triangle to the next (that
// was the "broken mountain collision"). A continuous radial dome has no such steps,
// so collision and visuals agree everywhere and the surface never jumps.
// MOUNT_SEG is now purely the VISUAL mesh resolution (denser → smoother silhouette).
export const MOUNT_SEG=28, MOUNT_S=MOUNT_R*2+2;
// Height of the mountain at world (x,z): 0 outside the base radius, rising on a
// smoothstep profile (zero slope at BOTH the foot and the peak — the foot flares
// gently into the plain instead of meeting it at a wall, and the summit is rounded)
// up to MOUNT_H at the centre. Pure and allocation-free — physics calls it ~4×/frame.
export function mountainH(x: number, z: number): number {
  const dx=x-MOUNT_X,d=Math.hypot(dx,z);
  if(d>=MOUNT_R)return 0;
  const t=1-d/MOUNT_R;            // 0 at the foot, 1 at the summit
  return MOUNT_H*t*t*(3-2*t);     // smoothstep: gentle flared foot, rounded top
}
// Colinas BEM suaves no corredor entre a cidade e o conteúdo rural: dão a
// sensação de separação entre as zonas sem atrapalhar a direção. Amplitude
// baixa e ondulação larga; somem nas bordas (cidade a oeste, fazendas a leste,
// mar nas laterais z) e na faixa da estrada, então o resto da península segue
// plano. Entram no groundHeight → física (carro/jogador) e visual batem 1:1.
export const HILL_X0=RURAL_X0+15, HILL_X1=RURAL_X0+150, HILL_AMP=2.4;
export function ruralHillH(x: number, z: number): number {
  if(x<=HILL_X0||x>=HILL_X1||Math.abs(z)>=RURAL_HALF)return 0;
  const ex=Math.sin(Math.PI*(x-HILL_X0)/(HILL_X1-HILL_X0)); // 0→1→0 ao longo do corredor
  const ez=Math.cos(Math.PI/2*z/RURAL_HALF);                // some nas pontas (mar)
  const road=Math.min(1,Math.abs(z)/16);                    // achata a faixa da estrada (z≈0)
  const env=ex*ez*road;
  if(env<=0)return 0;
  const h=.5+.5*Math.sin(x*.085+z*.05)*Math.cos(z*.07-x*.035+.6); // hummocks irregulares
  return env*h*HILL_AMP;
}
// ===== Ilha paradisíaca a oeste: alcançável de barco e explorável a pé ========
// Uma ilha isolada bem a oeste, em mar aberto além do anel da prova de lanchas
// (costa a leste ~x=-331, longe da reta oeste da prova em ~-273). Como a montanha,
// é fonte ÚNICA de verdade: o MESMO islandHeight monta o visual
// (assets/models/terrain/island-paradise.ts) E a física (groundHeight), e
// islandCoastR define a linha d'água tanto pro visual quanto pro isLand — então
// nunca se "nada na areia" nem se "anda no mar" na ilha.
export const ISLAND_CX=-408, ISLAND_CZ=-44; // centro (coords de mundo)
export const ISLAND_BASE_R=70;              // raio médio da costa
export const ISLAND_MAXR=92;                // raio de rejeição barata (> maior costa)
const ISLAND_MAXR2=ISLAND_MAXR*ISLAND_MAXR;
export const ISLAND_PEAK=25;                // altura do morro central
// Costa irregular (polar) da ilha: raio euclidiano por ângulo (∈ ~[51, 89]).
export function islandCoastR(th: number): number {
  return ISLAND_BASE_R+9*Math.sin(3*th+1.3)+6*Math.sin(5*th+0.2)+4*Math.sin(2*th-0.8);
}
// Relevo da ilha: 0 na linha d'água, subindo num morro central com leve ondulação
// e uma praia achatada na orla. Sem usar clamp (definido mais abaixo): min/max
// inline pra evitar a zona-morta (TDZ) do const.
export function islandHeight(x: number, z: number): number {
  const dx=x-ISLAND_CX,dz=z-ISLAND_CZ,d=Math.hypot(dx,dz);
  const cr=islandCoastR(Math.atan2(dz,dx));
  if(d>=cr)return 0;
  const t=d/cr, inner=1-t;
  const dome=inner*inner*(3-2*inner);                 // smoothstep até o pico
  let h=ISLAND_PEAK*dome;
  const shore=Math.max(0,Math.min(1,(t-0.84)/0.16));  // achata a praia na orla
  h*=1-shore*shore*0.95;
  h+=2.2*Math.max(0,inner-0.15)*Math.sin(dx*0.075+1)*Math.cos(dz*0.07-0.5); // não é um cone perfeito
  return Math.max(0,h);
}

// Terrain height. Each landform is its OWN single source of truth, shared with its
// visual mesh: the island (islandHeight), the corridor hills (ruralHillH) and the
// mountain (mountainH). The hills and the mountain never overlap in x, so summing
// them is safe — one is always 0 where the other rises.
export function groundHeight(x: number, z: number): number {
  if(x<-300){                  // ilha a oeste: relevo próprio, isolada no mar
    const dx=x-ISLAND_CX,dz=z-ISLAND_CZ;
    if(dx*dx+dz*dz<ISLAND_MAXR2){const ih=islandHeight(x,z);if(ih>0)return ih;}
  }
  return ruralHillH(x,z)+mountainH(x,z);
}
// ===== Ilha: costa irregular unificada (fonte ÚNICA de verdade) ============
// Hoje o mundo parece "dois blocos" (cidade quadrada + península retangular).
// Estas funções traçam UMA costa irregular e contínua, usada tanto pelo visual
// (assets/models/terrain/island.ts) quanto pelo gameplay (inWater em player.js).
// Se as duas não usarem a MESMA função, o jogador "nada na areia" (ou anda no mar).
//
// Princípio ADITIVO: a costa só acrescenta terra PRA FORA do conteúdo atual
// (quadrado 218 da cidade + retângulo rural), e fica DENTRO do envelope da
// corrida de lanchas (anel Chebyshev ~253, com boias em slalom até ~233 e
// stubs a |z|=142). Assim nenhum prédio/prop/fazenda/boia muda de lugar nem
// cai n'água, e a prova das lanchas continua idêntica.

// Cidade (polar, centrada na origem): raio Chebyshev da costa por ângulo.
// Base 218 (= antiga linha d'água; contém TODOS os props/prédios). A costa é
// ADITIVA e respeita o envelope da prova de lanchas:
//  - nas DIAGONAIS (±6°), a prova desliga o slalom e as boias ficam no anel
//    (Chebyshev 253), então cabe uma PONTA de areia generosa (headland, até ~244);
//  - no resto (retas onde o slalom leva boias até ~233), só uma ondulação leve e
//    segura (≤+6), sem nunca encostar nas boias.
// Resultado: quinas viram pontas/cabos em vez de um quadrado, e a lancha jamais
// encalha numa boia.
export function cityCoastCheb(th: number): number {
  const m=(((th*180/Math.PI)%90)+90)%90, dd=Math.abs(m-45); // dd: graus até a diagonal
  const spike=dd<6?(1-dd/6)*(1-dd/6)*26:0;                  // cabo só no cone sem slalom
  const wig=2+2.5*Math.sin(3*th+0.7)+1.5*Math.sin(5*th+2.3);// ondulação geral (≤+6)
  return 218+Math.max(spike,wig>0?wig:0);                   // ∈ [218, ~244] (244 só nas pontas)
}
// Raio Euclidiano da costa numa direção (pra montar o THREE.Shape polar).
export function cityCoastR(th: number): number {
  const c=Math.abs(Math.cos(th)),s=Math.abs(Math.sin(th));
  return cityCoastCheb(th)/Math.max(c,s,1e-4);
}
// Península rural (leste): meia-largura em z por x. Corpo cheio (≥120 = borda do
// gramado atual; contém pinheiros(114)/fazendas/rancho/montanha) com costa N/S
// levemente ondulada (aditiva, fica longe dos stubs da prova a |z|=142),
// afunilando numa pontinha de areia além do conteúdo (mirante da montanha).
export const RURAL_TIP=RURAL_X1+22;
export function ruralHalf(x: number): number {
  if(x<RURAL_X0-8||x>RURAL_TIP)return 0;
  // saliências só pra FORA (≥120 = borda do gramado). Pequenas perto da junção
  // (x<285, p/ não raspar os stubs da prova a |z|=142) e bem maiores no corpo
  // distante (sem boias lá) → costa com pontas/enseadas marcadas.
  const ef=Math.min(1,Math.max(0,(x-285)/55));                // 0 até x≈285, 1 a partir de x≈340
  const wig=2.5+(3+ef*9)*Math.sin(0.05*x+1.1)+(2+ef*5)*Math.sin(0.12*x+3.3);
  let w=120+(wig>0?wig:0);                                     // ∈ [120, ~141]
  if(x>RURAL_X1){const t=(x-RURAL_X1)/(RURAL_TIP-RURAL_X1);w*=(1-t)*(1-t);} // afunila num bico
  return w;
}
// Terra vs. mar. Barato (abs/max/atan2 + ~3 sin) — só o player chama (~4×/frame).
export function isLand(x: number, z: number): boolean {
  if(x<-300){                                      // ilha a oeste (rejeição barata por x)
    const dx=x-ISLAND_CX,dz=z-ISLAND_CZ;
    if(dx*dx+dz*dz<ISLAND_MAXR2&&Math.hypot(dx,dz)<islandCoastR(Math.atan2(dz,dx)))return true;
  }
  const rh=ruralHalf(x);
  if(rh>0&&Math.abs(z)<=rh)return true;           // península
  const ax=Math.abs(x),az=Math.abs(z),cheb=ax>az?ax:az;
  if(cheb>238)return false;                        // fora do alcance máx da costa
  return cheb<=cityCoastCheb(Math.atan2(z,x));     // blob da cidade
}
// Ponto de água garantido pro spawn da lancha (logo além da costa em x=24),
// usado por player.js (lancha ancorada) e boat-race.js (largada da 1ª prova) —
// assim a costa nova nunca encalha a lancha.
export const BOAT_SPAWN_X=24;
export const BOAT_SPAWN_Z=(()=>{
  let z=WATER+8;
  while(isLand(BOAT_SPAWN_X,z)&&z<SWIM_BOUND-20)z+=4;
  return z+6;
})();
export const nodeX=(i: number): number=>i*CELL-HALF;
export const rand=(a: number, b: number): number=>a+Math.random()*(b-a);
export const irand=(a: number, b: number): number=>Math.floor(rand(a,b+1));
export const pick=<T>(a: T[]): T=>a[Math.floor(Math.random()*a.length)];
export const clamp=(v: number, a: number, b: number): number=>Math.max(a,Math.min(b,v));
export const wrapA=(a: number): number=>{while(a>Math.PI)a-=2*Math.PI;while(a<-Math.PI)a+=2*Math.PI;return a};

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
