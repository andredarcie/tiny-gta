// Saldo inicial de uma run nova — FONTE ÚNICA (js/save.js importa daqui pra medir
// o que o jogador ganhou antes do restore async chegar). Mudou aqui, muda lá.
export const INITIAL_MONEY=250;

export const state={
  started:false,paused:false,mode:'foot',money:INITIAL_MONEY,wanted:0,health:100,lastCrime:-99,
  sixStarT:-999, // time of the last crime that reached/held 6 stars (max-star hold; see police.js)
  deliveries:0,taxiFares:0,taxiEarnings:0,bustT:0,cutT:0,cutFn:null,shake:0,time:0,comboN:0,lastHit:-99,dlgActive:false,cine:false,
  kills:0, // contador monotônico de inimigos/pedestres mortos (usado pelo Rampage)
  hasGun:false,weaponHeld:false,ammo:0,maxAmmo:0,
  crosshairKick:0,crosshairTarget:false,
  mobile:false,orientationBlocked:false,controlsLocked:false,
  swimming:false,swimAir:1, // nadando agora? / fôlego restante (1→0); ver js/player.js updateSwim
  interior:null, // ambiente interno ativo (instância de Interior) ou null — ver js/interior.js
  armScale:1,armTarget:1,gymDay:-1, // academia: tamanho do braço, alvo e dia do último treino
  viewerOpen:false, // galeria de objetos (tecla I) aberta
  tvActive:false,   // iframe da TV da safehouse aberto
  gymActive:false,  // mini-game do supino aberto (ver js/gym-game.js)
  danceActive:false, // mini-game da dança aberto (ver js/dance-game.js)
  modShopActive:false, // menu da oficina de custom aberto (ver js/mod-shop.js)
  mapOpen:false, // mapa completo (tecla M) aberto — congela o mundo enquanto visível
  firstPerson:false, // first-person camera (key C) — see js/player.js updateCamera
  wheelOpen:false, // roda de seleção de armas (js/weapon-wheel.js) aberta — câmera lenta
  activeMiniGame:null, // id (MiniGameId) do mini game em curso, ou null — trava "um por vez"
                       // (ver js/minigame.js); enquanto setado o mapa fica sem outros
                       // POIs/atividades e não dá pra entrar noutro mini game
  mgIntro:null,        // id do mini game cujo briefing/ranking está aberto (congela o
                       // mundo até o jogador "passar"); ver js/minigame-leaderboard.js
  onRoof:null, // registro da porta do prédio em cujo telhado o jogador está
  mgDays:{} // {minigameId: último dia in-game concluído} — regra "1x por dia" (ver js/minigame.js)
};

export const input={
  moveX:0,moveY:0,lookX:0,lookY:0,
  run:false,brake:false,horn:false,shootHeld:false,
  touchActive:false,moveActive:false,lookActive:false,
  brakeActive:false,hornActive:false,lastInput:'keyboard'
};

export let best={money:0,deliveries:0};
try{best=JSON.parse(localStorage.getItem('tinygta_best'))||best;}catch(e){}

export function saveBest(){
  let ch=false;
  if(state.money>best.money){best.money=state.money;ch=true;}
  if(state.deliveries>best.deliveries){best.deliveries=state.deliveries;ch=true;}
  if(ch)try{localStorage.setItem('tinygta_best',JSON.stringify(best));}catch(e){}
}

export const keys={};
export const carNames=['TUNED BUG','COMPANY SEDAN','RUSTY PICKUP','SLOW TURBO','BLUE SHARK','GRANDPA COUPE','BUDGET ROCKET','GOLDEN BOAT'];
export const carColors=[0xc23b4e,0x3b7ac2,0xcf9a3a,0x5b5f6b,0x7a4f9e,0x3aa06b,0xd96fae,0xc4c8cf];

// Late-binding cross-module refs populated by main.js after all modules initialize.
// Used only where direct imports would create circular dependencies.
//
// REGISTRIES GENÉRICOS (arrays preenchidos pelos próprios módulos de minigame, p/
// não duplicar bloco a bloco em hud.js/input.js a cada novo minigame):
//   refs.miniBlips      []  funções ()=>blip[]    — blips no radar e no mapa (M)
//                            blip={x,z,icon,color,label?,current?,reveal?}
//                            reveal!==false → POI fixo (aparece perto); reveal===false → alvo ativo (sempre na borda)
//   refs.zoneActions    []  funções ()=>action|null — ação do botão E numa zona/no chão
//                            action={label,prompt,enabled,run} e DEVE checar state.mode internamente
//   refs.carEnterLabels []  funções (c)=>action|null — rótulo do E ao lado de um veículo especial parado
export const refs={};
