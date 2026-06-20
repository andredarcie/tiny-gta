import * as THREE from 'three';
import {state,refs} from '@/core/state.js';
import {economy} from '@/core/economy.js';
import {scene} from '@/core/engine.js';
import {playerPos} from '@/actors/player.js';
import {message,bigText,hideBig} from '@/ui/hud.js';
import {blip} from '@/audio/audio.js';
import {N,nodeX,irand,groundHeight} from '@/core/constants.js';
import {grantWeapon,snapshotArsenal,restoreArsenal} from '@/combat/weapons.js';
import {makeRampageSkull} from '../../assets/models/props/rampage-skull.js';
import {inGangTerritory} from '@/actors/gangs.js';
import {MiniGame,MiniGameId} from '@/activities/minigame.js';
import {reportMiniGameResult} from '@/activities/minigame-leaderboard.js';

// ============================================================================
// MINIGAME FRENZY (clássico do open-world)
//  - espalha caveiras vermelhas em interseções aleatórias da cidade;
//  - o jogador A PÉ encosta numa caveira -> ganha arsenal cheio e começa uma
//    chacina cronometrada: matar N inimigos/pedestres em 30s;
//  - mede o progresso pelo contador monotônico state.kills (sobe a cada morte
//    por tiro, atropelamento ou explosão);
//  - sucesso = dinheiro grande + sobe de nível (meta maior na próxima);
//  - a caveira usada some e reaparece depois de um cooldown (rejogável);
//  - morrer/ser preso DURANTE a chacina encerra o rampage como falha (uma vez só).
// ============================================================================

const PICKUP_COUNT=6;   // quantas caveiras espalhar
const RANGE=3;          // distância de contato pra pegar (m)
const DURATION=30;      // segundos por rampage
const COOLDOWN=90;      // segundos até a caveira usada reaparecer
const BASE_GOAL=12;     // meta base de kills

interface Pad{x:number;z:number;g:THREE.Object3D;alive:boolean;cooldown:number;}
let pads: Pad[]=[];            // {x,z,g,alive,cooldown}
let active=false, timeLeft=0, startKills=0, killed=0, goal=0;
let arsenalSnapshot: any=null; // pre-rampage inventory, restored on every end path
let lastKilled=-1, lastSec=-1; // guardas anti-spam do message() (kills E segundos)
let endFlash=0;        // animação curta de flourish no fim (verde=sucesso, vermelho=falha)
let endOk=false;
let level=1;            // sobe a cada rampage concluído -> meta maior

// mini game (sessão): trava o mundo durante a chacina cronometrada. Não tem um
// alvo único no radar (é "matar N"), então não expõe blips de alvo — o mapa só
// fica limpo enquanto roda.
const game=new MiniGame({id:MiniGameId.RAMPAGE,name:'Frenzy'});

// ---------- cria os pickups no carregamento -------------------------------
// interseções da grade: (nodeX(i),nodeX(j)) com i,j em 0..N. Sorteia posições
// DISTINTAS e longe do spawn (evita o quadrado central [-20,20]).
(function spawnPads(){
  const used=new Set<string>();
  let guard=0;
  while(pads.length<PICKUP_COUNT&&guard++<400){
    const i=irand(0,N), j=irand(0,N);
    const key=i+'_'+j;
    if(used.has(key))continue;
    const x=nodeX(i), z=nodeX(j);
    if(Math.abs(x)<20&&Math.abs(z)<20)continue; // longe do spawn
    if(inGangTerritory(x,z))continue;           // nunca em território de gangue
    used.add(key);
    const g=makeRampageSkull();
    g.position.set(x,groundHeight(x,z),z);
    scene.add(g);
    pads.push({x,z,g,alive:true,cooldown:0});
  }
})();

// ---------- registries (radar/mapa + debug) -------------------------------
// POI fixo: as caveiras vivas aparecem no radar e no mapa quando o jogador chega
// perto. (refs.miniBlips é consumido por hud.js)
(refs.miniBlips||(refs.miniBlips=[])).push(()=>
  pads.filter(p=>p.alive).map(p=>({x:p.x,z:p.z,icon:'skull',color:'#ff3b3b',label:'FRENZY'})));

// snapshot pro render_game_to_text / debug
refs.getRampageState=()=>({active,timeLeft:+timeLeft.toFixed(1),killed,goal,level,
  pickups:pads.filter(p=>p.alive).length});

// ---------- helpers --------------------------------------------------------
function startRampage(pad: Pad){
  if(!game.begin())return;             // outra sessão de mini game rolando: não começa
  arsenalSnapshot=snapshotArsenal();   // guarda o inventário pré-rampage (restaurado no fim)
  grantWeapon();                       // arsenal completo + munição cheia (temporário)
  active=true;
  timeLeft=DURATION;
  goal=BASE_GOAL+level;
  startKills=state.kills;
  killed=0;
  lastKilled=-1;lastSec=-1;            // força o 1º HUD update no próximo frame
  pad.alive=false;                     // esconde a caveira usada...
  pad.cooldown=COOLDOWN;               // ...reaparece depois do cooldown
  pad.g.visible=false;
  bigText('FRENZY!','var(--pink)');
  setTimeout(hideBig,1100);
  message(`KILL ${goal} IN ${DURATION}s`,'var(--pink)');
  blip([220,330,440,660,880],.12,'square',.22);
}

// Encerra o rampage. `success` decide prêmio/flourish. `silent` (morte/prisão)
// pula o letreiro grande pra não atropelar o banner WASTED/BUSTED da cut-scene.
function finishRampage(success: boolean,silent=false){
  if(!active)return;                   // guarda: nunca finaliza duas vezes
  active=false;
  // arsenal concedido era só da sessão: devolve o inventário pré-rampage em TODA
  // saída (sucesso, tempo esgotado, abortar, morte/prisão). Sem isto o jogador
  // mantinha o arsenal e munição cheia de graça após uma única chacina.
  restoreArsenal(arsenalSnapshot);
  arsenalSnapshot=null;
  // ranking: cada chacina é UMA sessão; vitória = meta batida, score = kills feitas
  reportMiniGameResult(game.id,{won:success,score:killed});
  game.end();                          // libera a trava do mundo (idempotente)
  endFlash=success?1.4:.9;             // dispara o flourish (halo pulsa no fim)
  endOk=success;
  if(success){
    // Harder levels (bigger goal) pay more, but the payout is CAPPED at a race
    // win ($700, the game's ceiling): a repeatable melee frenzy must never out-pay
    // a race, and the per-level growth no longer climbs without bound.
    const reward=Math.min(700,250+30*goal);
    economy.earn(reward,'rampage');
    bigText('FRENZY COMPLETE','var(--gold)');
    setTimeout(hideBig,1300);
    message(`FRENZY COMPLETE - +$${reward.toLocaleString('en-US')}`,'var(--gold)');
    blip([523,659,784,1047,1319],.13,'square',.22); // fanfarra de vitória
    level++;                            // próxima chacina é mais difícil
  }else if(silent){
    // morreu/foi preso: a cut-scene já mostra WASTED/BUSTED. Só registra o status
    // discreto no rodapé, sem letreiro grande nem fanfarra concorrente.
    message(`FRENZY ENDED - ${killed}/${goal}`,'var(--pink)');
  }else{
    bigText('FRENZY FAILED','var(--pink)');
    setTimeout(hideBig,1300);
    message(`FRENZY FAILED - ${killed}/${goal}`,'var(--pink)');
    blip([330,220,160],.2,'sawtooth',.2);
  }
}

// ---------- loop -----------------------------------------------------------
export function updateRampage(dt: number){
  // anima as caveiras vivas (gira + flutua + halo pulsando + olhos brilhando) e
  // toca o cooldown das escondidas pra devolvê-las (jogo rejogável).
  for(const p of pads){
    if(p.alive){
      const g=p.g;
      const ic=g.userData.icon;
      if(ic){
        const baseY=ic.userData.baseY??1.4;
        ic.rotation.y+=dt*2.4;
        ic.position.y=baseY+Math.sin(state.time*3+p.x)*.14;
        // olhos "respiram" (escala leve) — leem como brilho sem transparência
        const eb=1+Math.sin(state.time*6+p.x)*.25;
        for(const e of ic.userData.eyes||[])e.scale.setScalar(eb);
      }
      // halo no chão respira (mais forte enquanto um rampage está rolando perto)
      const halo=g.userData.halo;
      if(halo)halo.material.opacity=.3+Math.sin(state.time*4+p.z)*.14;
      continue;
    }
    // escondida: conta o cooldown e devolve quando zera
    if(p.cooldown>0){
      p.cooldown-=dt;
      if(p.cooldown<=0){p.alive=true;p.g.visible=true;}
    }
  }

  if(active){
    // morte/prisão no meio da chacina: a cut-scene roda em mode==='cut' mas este
    // loop continua tickando. Encerra como falha AGORA (uma vez), sem mexer no
    // letreiro WASTED/BUSTED. Sem isso o rampage seguiria "ativo" após a cut-scene
    // (jogador volta sem arsenal, trava do mundo presa) ou poderia falso-vencer
    // com kills resolvidas pela explosão durante o corte.
    if(state.mode==='cut'){finishRampage(false,true);return;}

    timeLeft-=dt;
    killed=state.kills-startKills;
    const sec=Math.ceil(Math.max(0,timeLeft));
    // feedback no rodapé: atualiza a CADA kill nova E a cada segundo do relógio
    // (antes só atualizava na kill, então a contagem regressiva ficava congelada).
    if(killed!==lastKilled||sec!==lastSec){
      const newKill=killed!==lastKilled&&killed>0;
      lastKilled=killed;lastSec=sec;
      const left=Math.max(0,goal-killed);
      message(`FRENZY ${killed}/${goal} - ${sec}s`,
        sec<=5?'var(--pink)':'var(--cream)');
      if(newKill)blip([660,880],.05,'square',.12);        // tique curto por kill
      else if(sec<=5&&sec>0)blip([300+sec*40],.06,'square',.1); // tique-tique final
      // troca pra dourado nos últimos golpes (quase lá)
      if(left>0&&left<=2&&newKill)message(`FRENZY ${killed}/${goal} - ${left} TO GO!`,'var(--gold)');
    }
    if(killed>=goal){finishRampage(true);return;}
    if(timeLeft<=0){finishRampage(false);return;}
    return; // com rampage rolando, não dá pra pegar outra caveira
  }

  // flourish do fim: pulsa o halo de TODAS as caveiras vivas por um instante
  // (verde no sucesso, vermelho na falha) — feedback satisfatório sem custo extra.
  if(endFlash>0){
    endFlash=Math.max(0,endFlash-dt);
    const col=endOk?0x46e06a:0xff2e2e;
    const op=.3+endFlash*.5;
    for(const p of pads){
      if(!p.alive)continue;
      const halo=p.g.userData.halo;
      if(halo){halo.material.color.setHex(col);halo.material.opacity=op;}
    }
    if(endFlash<=0)for(const p of pads){ // restaura a cor padrão do halo
      const halo=p.g.userData.halo;
      if(halo)halo.material.color.setHex(0xff2e2e);
    }
  }

  // só a pé, com o jogo rodando, dá pra iniciar (pickup por contato)
  if(!state.started||state.mode!=='foot'||state.interior)return;
  const pp=playerPos();
  for(const p of pads){
    if(!p.alive)continue;
    if(Math.hypot(pp.x-p.x,pp.z-p.z)<RANGE){startRampage(p);return;}
  }
}
