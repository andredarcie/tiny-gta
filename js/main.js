import * as THREE from 'three';
import {state,input,refs,keys} from './state.js';
import {economy} from './economy.js'; // money ledger — imported here so the genesis tx seeds at boot
import {renderer,scene,camera,clouds,dlight,sunDir,setRenderScale,getRenderScale} from './engine.js';
import {updateAudio} from './audio.js';
import {drawMinimap,updateHUD,hideBig,tickFps} from './hud.js';
import {player,cur,playerPos,nearestCar,idleCars,cameraRig,updateCar,updateFoot,updateCamera,getBusted,getWasted,exitCar,enterCar,updateDrivenShadow,updateCarFx} from './player.js';
import {groundHeight} from './constants.js';
import {MiniGame} from './minigame.js';
import {traffic,trafficPos,spawnTraffic,updateTraffic} from './traffic.js';
import {updatePeds,ejectDriver,addBloodPuddle} from './pedestrians.js';
import {updateGangs,gangs,spawnInitialGangs,setGangsHidden} from './gangs.js';
import {updateRuralFolk} from './rural-folk.js'; // smart ambient rural NPCs (rednecks) in the peninsula
import {updateRuralTraffic} from './rural-traffic.js'; // sparse country cars on the dirt road
import {updateBeach} from './world.js';
import {cops,heli,updateCops,updateHeli} from './police.js';
import {updateArmy} from './army.js';
import {delivery,spawnDelivery,updatePickups} from './missions.js';
import {updateTaxi} from './taxi.js';
import {updateRace} from './race.js';
import {updateBoatRace} from './boat-race.js';
import {updateOffroad} from './offroad.js'; // 3ª corrida: circuito off-road na pradaria rural
import {updateVigilante} from './vigilante.js'; // side-mission: viatura caça criminosos
import {updateParamedic} from './paramedic.js'; // side-mission: ambulância salva feridos
import {updateFirefighter} from './firefighter.js';        // Open-world: caminhão de bombeiros apaga incêndios
import {updateRampage} from './rampage.js';                // Open-world: caveira dá arsenal + caça por tempo
import {updateHiddenPackages} from './hidden-packages.js'; // Open-world: 24 pacotes escondidos pela cidade
import {updateStuntJumps} from './stunt-jumps.js';         // Open-world: rampas de salto insano
import {updateCarCrusher} from './car-crusher.js';         // Open-world: prensa de sucata
import {updateImportExport} from './import-export.js';     // Open-world: garagem que compra/exporta carros
import {updateBombShop} from './bomb-shop.js';             // Open-world: o artificeiro arma o carro-bomba
import {updateRcToyz} from './rc-toyz.js';                 // Open-world: carrinho de controle destrói alvos
import {updateWeaponPickups} from './weapon-pickups.js';  // Open-world: as 12 armas escondidas pelo mapa
import {updateRuralLoot} from './rural-loot.js';  // armas + dinheiro escondidos em volta da cidade rural
import {updateBloodstains} from './bloodstains.js';       // Multiplayer assíncrono: poças de morte (estilo Souls)
import {updateStory,storyNear,storyBlips,storyTargets} from './story.js';
import {updateRick,rickInteract,rickNear,getRickState} from './rick.js';
import {blinkBar} from './entities.js';
import {setupInput,updateKeyboardInput,performShoot,performInteract} from './input.js';
import {setupPauseMenu} from './pause-menu.js';
import {applySettings} from './settings.js';
import {setupTouchControls,updateTouchControls} from './touch-controls.js';
import {setupNative} from './native.js'; // Android (Capacitor) shell: back-button routing — no-op on web
import {canPickWeapon,updateWeapons,isWeaponHeld,canAttack,confiscateWeapon,
  switchWeapon,selectWeaponSlot,getWeaponHud} from './weapons.js';
import {setupWheel,updateWeaponWheel} from './weapon-wheel.js';
import {updateDayNight} from './daynight.js';
import {updateInteriors,interiors} from './interior.js';
import {updateJailBreak} from './jail-break.js';
import {updateSpeech,updateStreetChatter} from './speech.js';
import {updateOverkill,overkillNear,endOverkill,getOverkillState} from './overkill.js';
import {clubDanceState} from './club.js'; // instancia a boate em interiors[] + ação DANCE
import {updateDanceGame} from './dance-game.js';
import {gymTrainState} from './gym.js';
import {updateGymGame} from './gym-game.js';
import {updateWeedFarm} from './weed-farm.js'; // Rural: cultivo de erva (atividade no mundo, a pé)
import './general-store.js'; // Rural: instancia a General Store em interiors[] + ação BUY SEEDS
import './drug-bust.js'; // Busted carrying the delivery backpack → crooked-cop shakedown in the woods
import {modShopState,modShopInteract,updateModShop,workshopBlip} from './mod-shop.js';
import {hospitalAdmit} from './hospital.js';
import {prisonAdmit} from './prison.js';
import {gunShopState,gunShopBuy,gunShopTargets,inGunShopRange} from './gun-shop.js';
import {scheduleFlush} from './leaderboard.js';
import {initProperty,houseBuyState,houseEatState,houseGarageState,getHouseState} from './property.js';
import {houseTvState,updateHouseTv,getHouseTvState} from './house-tv.js';
import {updateDoors} from './doors.js';
import {updateDoorArrows} from '../assets/models/city/door-arrow.js';
import {updateCityCulling} from '../assets/models/city/building.js';
import {updatePropCulling} from '../assets/models/props/prop-merge.js';
import {updateLotCulling} from '../assets/models/city/abandoned-lot.js';
import * as P from './profiler.js'; // profiler embutido (tecla ` ou ?prof na URL)
import {warmupShaders} from './warmup.js'; // pré-compila shaders no boot (anti-hitch)

// Diagnóstico de hitches: anexa posição/modo/interior do jogador a cada queda de FPS.
P.setContext(()=>{const p=playerPos();return(state.interior?'INT:'+state.interior.constructor.name
  :state.mode)+' '+Math.round(p.x)+','+Math.round(p.z);});

// Populate late-binding refs so cross-module code can access these without circular imports
refs.playerPos=playerPos;
refs.getCur=()=>cur;
refs.getPlayerHeading=()=>state.mode==='car'?cur?.heading:player.heading;
refs.getRadarHeading=()=>cameraRig.yaw;
refs.traffic=traffic;
refs.cops=cops;
refs.trafficPos=trafficPos;
refs.spawnTraffic=spawnTraffic;
refs.ejectDriver=ejectDriver;
refs.addBloodPuddle=addBloodPuddle; // morte do jogador deixa poça igual NPC
refs.gangs=gangs; // hud desenha os territórios no minimapa via refs
refs.setGangsHidden=setGangsHidden; // corrida de rua esconde/restaura as gangues
refs.interiorBlips=()=>interiors
  .filter(it=>it.mapIcon&&it.door)
  .map(it=>({x:it.door.x,z:it.door.z,...it.mapIcon}));
refs.getDelivery=()=>delivery;
refs.storyNear=storyNear;
refs.storyBlips=storyBlips;
refs.storyTargets=storyTargets;
refs.rickNear=rickNear;         // HUD mostra TALK TO RICK no acampamento secreto
refs.rickInteract=rickInteract; // performInteract abre a cut-scene do Rick
refs.getRickState=getRickState; // snapshot de debug da missão secreta
refs.getBusted=getBusted;
refs.getWasted=getWasted;
refs.getHeli=()=>heli;
refs.nearestCar=nearestCar;
refs.canPickWeapon=canPickWeapon;
refs.isWeaponHeld=isWeaponHeld;
refs.canAttack=canAttack;             // botão de tiro do mobile (punho inclusive)
refs.switchWeapon=switchWeapon;       // troca cíclica de arma
refs.selectWeaponSlot=selectWeaponSlot;
refs.getWeaponHud=getWeaponHud;       // HUD lê nome/munição da arma atual
refs.confiscateWeapon=confiscateWeapon;
refs.gymTrainState=gymTrainState; // HUD mostra o botão TRAIN dentro da academia
refs.clubDanceState=clubDanceState; // HUD mostra o botão DANCE no meio da pista da boate
refs.modShopState=modShopState;   // HUD mostra CUSTOMIZE CAR na plataforma da oficina
refs.modShopInteract=modShopInteract; // performInteract abre/fecha o menu de custom
refs.workshopBlip=workshopBlip;   // radar mostra o blip da oficina
refs.hospitalAdmit=hospitalAdmit; // morrer leva o jogador pra dentro do hospital
refs.prisonAdmit=prisonAdmit;     // ser preso leva o jogador pra dentro do presídio
refs.gunShopState=gunShopState;   // HUD mostra BUY $X perto de uma arma na loja
refs.gunShopBuy=gunShopBuy;       // performInteract compra a arma do balcão
refs.gunShopTargets=gunShopTargets; // armas.js acerta os alvos da sala de treino
refs.inGunShopRange=inGunShopRange; // tiros na sala de treino não geram wanted
refs.overkillNear=overkillNear;   // HUD/interact mostram a ação no totem
refs.endOverkill=endOverkill;     // a morte do jogador encerra o modo overkill
refs.getOverkillState=getOverkillState;
refs.exitCar=exitCar;                 // a garagem manda sair do carro ao guardá-lo
refs.houseBuyState=houseBuyState;     // HUD: comprar a casa perto da placa
refs.houseEatState=houseEatState;     // HUD: comer da geladeira (cura) dentro de casa
refs.houseGarageState=houseGarageState; // HUD: guardar o carro na garagem
refs.getHouseState=getHouseState;
refs.houseTvState=houseTvState;         // HUD: usar/sair da TV dentro da casa
refs.getHouseTvState=getHouseTvState;

// Veículo salvo na garagem renasce parado dentro dela (precisa de idleCars/refs prontos)
initProperty();

// First delivery spawned here, after refs are set (spawnDelivery needs playerPos)
spawnDelivery();
// Gangues nascem só agora, com os prédios especiais já registrados em interiors[]
// (assim a zona de fachada vale desde o primeiro membro). Ver gangs.js.
spawnInitialGangs();

setupInput();
setupPauseMenu(); // in-game pause menu (leaderboard / transactions / settings / quit)
setupTouchControls();
setupNative(); // hardware back button on Android; no-op in the browser
setupWheel(); // roda de seleção de armas (overlay próprio; ver js/weapon-wheel.js)
// Apply saved graphics/FPS settings at boot (audio is re-applied after initAudio,
// from startGameFromUserGesture); the audio setters no-op until the graph exists.
applySettings();

const clock=new THREE.Clock();
let shadowTick=0;
const SHADOW_EVERY=12; // re-renderiza o shadow map 1 a cada N frames (~5fps @60)
// Minimapa: canvas2D pesado (drawImage com resample + dezenas de blips/arcos).
// Redesenhar todo frame era puro custo de CPU na main thread; a 22fps o radar
// fica visualmente idêntico e libera o orçamento do frame.
let mmAccum=0;
const MM_INTERVAL=1/22;
function step(dt){
  updateKeyboardInput();
  updateTouchControls();
  // Sombra a ~5fps: a luz direcional é fixa (só a posição segue o jogador), então
  // o shadow pass (2º render da cena inteira) roda raramente. Sombras de coisas
  // que se movem (jogador/NPC) ficam mais "atrasadas" — trade-off aceito. Antes
  // de qualquer render abaixo.
  if(shadowTick++%SHADOW_EVERY===0)renderer.shadowMap.needsUpdate=true;
  if(updateHouseTv()){renderer.render(scene,camera);return;}
  if(updateGymGame(dt)){renderer.render(scene,camera);return;} // mini-game do supino congela o mundo
  if(updateDanceGame(dt)){renderer.render(scene,camera);return;} // mini-game da dança congela o mundo
  if(updateModShop(dt)){renderer.render(scene,camera);return;} // oficina de custom congela o mundo
  if(state.mapOpen){renderer.render(scene,camera);return;} // mapa completo (tecla M) congela o mundo
  if(state.adminOpen){renderer.render(scene,camera);return;} // dashboard de admin (tecla Y) congela o mundo
  if(state.mgIntro){renderer.render(scene,camera);return;} // briefing/ranking de mini game: congela até "passar"
  if(state.paused||state.orientationBlocked){renderer.render(scene,camera);return;}
  state.time+=dt;

  for(const c of clouds){
    c.position.x+=c.userData.v*dt;
    if(c.position.x>550)c.position.x=-550;
  }
  P.begin('daynight');updateBeach(state.time);updateDayNight(dt);P.end();
  { // setinhas de porta: só aparecem nas portas perto do jogador
    const ap=playerPos();
    updateDoorArrows(state.time,ap.x,ap.z);
  }

  if(!state.started){
    const a=state.time*.07;
    camera.position.set(Math.cos(a)*140,65,Math.sin(a)*140);
    camera.lookAt(0,6,0);
    updateTraffic(dt);updatePeds(dt);updateGangs(dt);
    renderer.render(scene,camera);return;
  }

  P.begin('player');
  if(state.mode==='cut'){
    state.cutT-=dt;
    if(state.cutT<=0){hideBig();const fn=state.cutFn;state.cutFn=null;fn&&fn();}
  }else if(state.mode==='car')updateCar(dt);
  else updateFoot(dt);
  P.end();

  P.begin('traffic');updateTraffic(dt);P.end();
  P.begin('peds');updatePeds(dt);P.end();
  P.begin('gangs');updateGangs(dt);P.end();
  P.begin('rural');updateRuralFolk(dt);updateRuralTraffic(dt);P.end(); // country folk + sparse dirt-road cars
  P.begin('cops');if(state.mode!=='cut'&&!state.cine)updateCops(dt);P.end();
  P.begin('army');if(state.mode!=='cut'&&!state.cine)updateArmy(dt);P.end(); // ★6: the army
  P.begin('misc');
  updateHeli(dt);
  updatePickups(dt);
  updateTaxi(dt);
  updateVigilante(dt); // viatura: patrulha vigilante (caça aos criminosos)
  updateParamedic(dt); // ambulância: plantão de paramédico (resgate de feridos)
  updateRace(dt);
  updateBoatRace(dt);
  updateOffroad(dt); // corrida off-road (circuito de terra na zona rural)
  // Minigames estilo open-world (cada um se auto-registra em refs; ver os módulos).
  // Rodam DEPOIS do update do jogador/carro (acima), então o stunt-jumps pode
  // sobrescrever a altura do carro pra desenhar o arco do salto.
  updateFirefighter(dt);
  updateRampage(dt);
  updateHiddenPackages(dt);
  updateStuntJumps(dt);
  updateCarCrusher(dt);
  updateImportExport(dt);
  updateBombShop(dt);
  updateRcToyz(dt);
  updateWeedFarm(dt); // plantação de erva: planta/rega/cresce/colhe no mundo
  updateWeaponPickups(dt);
  updateRuralLoot(dt);   // hidden weapons + cash around the rural village
  updateBloodstains(dt); // poças de morte de outros jogadores (multiplayer assíncrono)
  P.end();
  P.begin('weapons');updateWeapons(dt);P.end();
  P.begin('misc');
  updateInteriors(dt); // boate, academia e qualquer ambiente interno futuro
  updateJailBreak(dt); // prison hole <-> escape tunnel <-> fort triggers
  updateStreetChatter(dt); // pedestres soltam frases aleatórias/contextuais
  updateSpeech(dt);    // segue/fade dos balões de diálogo (rua e interiores)
  updateOverkill(dt);  // modo overkill: multiplicador de heat + renda
  updateDoors(); // portas por toque: interiores e telhados dos prédios
  if(input.shootHeld)performShoot();

  updateCarFx(dt);      // fumaça do carro batido (emite do dirigido + anima baforadas em voo)
  updateDrivenShadow(); // sombra some do carro/moto que o jogador está dirigindo
  if(cur)blinkBar(cur.g);
  for(const c of idleCars)blinkBar(c.g);
  P.end();

  P.begin('camera');updateCamera(dt);P.end();
  P.begin('story');
  updateStory(dt); // depois da câmera: em cut-scene a câmera é da história
  updateRick(dt);  // missão secreta do Rick: fogueira + caça aos doentes (usa a cut-scene da história)
  P.end();
  P.begin('hud');updateHUD(dt);P.end();
  scheduleFlush(); // mantém o envio agendado (ranking = dinheiro atual + save)
  P.begin('audio');updateAudio();P.end();
  // Radar redesenhado a ~22fps (ver MM_INTERVAL): liberar a main thread sem
  // impacto visual perceptível.
  mmAccum+=dt;
  if(mmAccum>=MM_INTERVAL){mmAccum=0;P.begin('minimap');drawMinimap();P.end();}

  const pp=playerPos();
  P.begin('culling');
  updateCityCulling(pp.x,pp.z); // esconde chunks da cidade longe (atrás da névoa)
  updatePropCulling(pp.x,pp.z); // props pequenos: corte curto (LOD por tamanho)
  updateLotCulling(pp.x,pp.z);  // lotes/entulho: corte médio
  // Veículos parados (avião/barco/trator/bombeiro/ambulância/carro do jogador):
  // não desenha os que estão ALÉM da névoa — lá já são invisíveis, então é
  // visual-neutro. O corte acompanha a névoa (que abre na altitude). O carro
  // dirigido não está em idleCars; os parados voltam a aparecer ao se aproximar.
  {const vf=scene.fog?scene.fog.far:430,v2=vf*vf;
   for(const c of idleCars){if(!c.g)continue;
     const dx=c.g.position.x-pp.x,dz=c.g.position.z-pp.z;
     c.g.visible=dx*dx+dz*dz<v2;}}
  P.end();
  dlight.position.set(pp.x+sunDir.x*160,sunDir.y*160,pp.z+sunDir.z*160);
  dlight.target.position.set(pp.x,0,pp.z);

  P.begin('render');renderer.render(scene,camera);P.end();
}

// ----- Resolução adaptativa: REDE DE SEGURANÇA, decisão única no boot -----
// Princípio: NUNCA piorar o visual de quem já roda bem. Trocar resolução em jogo
// é proibido (setPixelRatio realoca o framebuffer → trava ~100ms em HiDPI), então
// fixamos uma única vez, após estabilizar o tempo de frame na abertura (o título
// renderiza a cidade INTEIRA sem culling = pior caso). E só reduzimos se esse
// pior caso estiver abaixo de ~45fps (22ms) — limiar tão alto que qualquer GPU
// decente (e a maioria travada no vsync) passa longe e fica em 1.0 (resolução
// cheia, ZERO mudança visual). Abaixo disso, ajuda o hardware que realmente
// engasga a recuperar fluidez. O piso de escala (.72 no engine) mantém nítido.
let _emaDt=16.7,_frames=0,_scaleLocked=false;
function adaptResolution(ms){
  if(ms<1||ms>200)return; // hitch isolado (compile de shader, aba em 2º plano): ignora
  _emaDt=_emaDt*.9+ms*.1;
  if(_scaleLocked)return;
  if(++_frames<60)return; // deixa o tempo de frame estabilizar antes de decidir
  _scaleLocked=true;
  if(_emaDt>22)setRenderScale(Math.sqrt(14/_emaDt)); // <45fps no pior caso: mira ~70fps
}
window.__renderScale=getRenderScale; // debug/profiler

// Aviso anti self-XSS no console (padrão dos grandes sites): desencoraja colar
// código de terceiros, que pode roubar/zerar a conta do jogador.
try{
  console.log('%cSTOP!','color:#ff2e88;font:900 42px sans-serif;text-shadow:2px 2px 0 #000');
  console.log("%cThis console is meant for developers. If someone told you to paste or run code here, it's almost certainly a scam — running scripts here can compromise your account and wipe your progress. Don't do it.",'color:#ffd24a;font:600 15px sans-serif');
}catch(e){}

const WHEEL_TIMESCALE=.18; // roda de armas aberta: mundo em câmera lenta (estilo open-world)
function frame(){
  requestAnimationFrame(frame);
  P.frameStart(); // marca o início do frame pro profiler (limpa acumuladores)
  tickFps(); // antes dos early-returns: mede até pausado/tela de título
  const raw=clock.getDelta();
  const dt=Math.min(raw,.05);
  step(state.wheelOpen?dt*WHEEL_TIMESCALE:dt); // câmera lenta enquanto a roda está aberta
  updateWeaponWheel(dt); // a roda anima/redesenha em tempo real (não desacelera)
  adaptResolution(raw*1000);
  P.frameEnd(); // fecha o frame: atualiza FPS/ms/overlay do profiler
}

// Hooks de debug/teste no window: SÓ em dev (ou com ?debug). Saem do build de
// produção, onde seriam "botões" prontos de cheat (acelerar o tempo pra farmar
// renda, snapshot de estado, teleporte/colocar veículo). O harness de teste roda
// no dev server (import.meta.env.DEV=true), então continua com acesso.
const DEBUG_HOOKS=(()=>{try{return !!import.meta.env?.DEV||/[?&]debug\b/.test(location.search);}catch(e){return false;}})();
if(DEBUG_HOOKS){
window.advanceTime=ms=>{
  const steps=Math.max(1,Math.round(ms/(1000/60)));
  for(let i=0;i<steps;i++)step(1/60);
};

window.render_game_to_text=()=>{
  const pp=playerPos();
  const c=cur;
  return JSON.stringify({
    coordinateSystem:'world x/z plane, y height; x and z use map meters, y up',
    started:state.started,
    paused:state.paused,
    mode:state.mode,
    firstPerson:!!state.firstPerson, // câmera em primeira pessoa (tecla C) ligada
    activeMiniGame:state.activeMiniGame, // mini game em curso (trava "um por vez")
    interior:state.interior?.constructor?.name||null,
    money:state.money,
    ledger:economy.debugLedger(), // {balance,checkpoint,window,pending,last[]} — money as a tx ledger
    wanted:state.wanted,
    player:{x:pp.x,y:pp.y,z:pp.z,heading:state.mode==='car'?c?.heading:player.heading},
    vehicle:c?{name:c.name,x:c.g.position.x,y:c.g.position.y,z:c.g.position.z,speed:c.speed,plane:!!c.plane,taxi:!!c.taxi}:null,
    taxi:refs.getTaxiState?.()||null,
    race:refs.getRaceState?.()||null,
    boatRace:refs.getBoatRaceState?.()||null,
    offroad:refs.getOffroadState?.()||null,
    vigilante:refs.getVigilanteState?.()||null,
    paramedic:refs.getParamedicState?.()||null,
    firefighter:refs.getFirefighterState?.()||null,
    rampage:refs.getRampageState?.()||null,
    hiddenPackages:refs.getHiddenPackagesState?.()||null,
    stuntJumps:refs.getStuntJumpsState?.()||null,
    carCrusher:refs.getCarCrusherState?.()||null,
    importExport:refs.getImportExportState?.()||null,
    bombShop:refs.getBombShopState?.()||null,
    rcToyz:refs.getRcToyzState?.()||null,
    weedFarm:refs.getWeedFarmState?.()||null,
    seeds:{...state.seeds}, // per-strain seed counts (bought at the General Store, spent planting)
    seedSel:state.seedSel,  // strain selected to plant next
    fertilizer:state.fertilizer|0, // plant-food charges
    generalStore:refs.getGeneralStoreState?.()||null,
    overkill:refs.getOverkillState?.()||null,
    bloodstains:refs.getBloodstainsState?.()||null, // poças de morte ativas no mundo (multiplayer)
    delivery:delivery?{x:delivery.x,z:delivery.z}:null,
    interiorBlips:refs.interiorBlips?.()||[],
    storyBlips:refs.storyBlips?.()||[],
    house:refs.getHouseState?.()||null,
    houseTv:refs.getHouseTvState?.()||null,
    rick:refs.getRickState?.()||null,
  });
};
// Test/debug hook (same spirit as advanceTime / render_game_to_text): lets the
// browser test harness in test/support/game.js reach a few live internals to set
// up scenarios deterministically (entering/placing the car, reading the current
// race checkpoint). The game itself never uses it. See test/support/game.js and
// the Testing section in CLAUDE.md / README.
window.__test={
  enterCar:()=>{
    if(state.mode!=='foot')return state.mode;
    const f=nearestCar(1e9);                 // nearest car at any distance
    if(f)player.g.position.set(f.c.g.position.x,player.g.position.y,f.c.g.position.z+2.2);
    enterCar();                              // the real entry (walk-to-door anim + seat)
    return state.mode;
  },
  exitCar:()=>{exitCar();return state.mode;},
  // Trigger the context action (same as pressing E): enter/exit car, start a race
  // under a gate, pick up, etc. Reliable regardless of OS keyboard focus.
  interact:()=>{performInteract();return state.mode;},
  // Drive by writing the SAME normalized key state a real keydown produces, so
  // gameplay reads it through the unmodified input pipeline (updateKeyboardInput).
  setKey:(code,down)=>{keys[code]=!!down;},
  clearKeys:()=>{for(const k of['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space','ShiftLeft','ShiftRight'])keys[k]=false;},
  // Place the current vehicle at (x,z) facing (fx,fz), stopped. Test scaffolding
  // to reach an activity's start without a long cross-map drive — the activity
  // itself is then played for real through the keyboard.
  placeVehicle:(x,z,fx,fz)=>{
    if(!cur)return false;
    const h=Math.atan2(fx-x,fz-z);
    cur.g.position.set(x,groundHeight(x,z),z);
    cur.heading=h;cur.g.rotation.set(0,h,0);cur.speed=0;cameraRig.yaw=h;
    return true;
  },
  // Current race checkpoint world coords (street / boat / off-road), for autopilots.
  raceTarget:()=>{
    const b=MiniGame.activeBlips?.()||[];
    if(b[0])return{x:b[0].x,z:b[0].z};
    const r=refs.raceBlips?.()||refs.boatRaceBlips?.()||[];
    return r[0]?{x:r[0].x,z:r[0].z}:null;
  },
};
} // fim do if(DEBUG_HOOKS)
// Pré-compila TODOS os shaders ANTES do loop: tanto os materiais da cena montada
// (chunks da cidade revelados ao andar) quanto os modelos que só nascem em jogo
// (efeitos de combate, arma na mão, heli, props de minigame). Sem isso o THREE
// compila o programa na 1ª aparição de cada material — síncrono no render — e o
// frame congela centenas de ms ("grandes quedas de FPS do nada"; ver warmup.js).
// O custo migra pro boot (tela de título), onde é invisível.
try{warmupShaders();}catch(e){}
frame();
