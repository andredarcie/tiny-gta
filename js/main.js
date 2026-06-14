import * as THREE from 'three';
import {state,input,refs} from './state.js';
import {renderer,scene,camera,clouds,dlight,sunDir,setRenderScale,getRenderScale} from './engine.js';
import {updateAudio} from './audio.js';
import {radioZone} from './radio.js';
import {drawMinimap,updateHUD,hideBig,tickFps} from './hud.js';
import {player,cur,playerPos,nearestCar,idleCars,cameraRig,updateCar,updateFoot,updateCamera,getBusted,getWasted,exitCar,updateDrivenShadow} from './player.js';
import {traffic,trafficPos,spawnTraffic,updateTraffic} from './traffic.js';
import {updatePeds,ejectDriver,addBloodPuddle} from './pedestrians.js';
import {updateGangs,gangs,spawnInitialGangs,setGangsHidden} from './gangs.js';
import {updateBeach} from './world.js';
import {cops,heli,updateCops,updateHeli} from './police.js';
import {delivery,spawnDelivery,updatePickups} from './missions.js';
import {updateTaxi} from './taxi.js';
import {updateRace} from './race.js';
import {updateBoatRace} from './boat-race.js';
import {updateStory,storyNear,storyBlips,storyTargets} from './story.js';
import {updateRick,rickInteract,rickNear,getRickState} from './rick.js';
import {blinkBar} from './entities.js';
import {setupInput,updateKeyboardInput,performShoot} from './input.js';
import {setupTouchControls,updateTouchControls} from './touch-controls.js';
import {canPickWeapon,updateWeapons,isWeaponHeld,canAttack,confiscateWeapon,
  switchWeapon,selectWeaponSlot,getWeaponHud} from './weapons.js';
import {updateDayNight} from './daynight.js';
import {updateInteriors,interiors} from './interior.js';
import {updateSpeech,updateStreetChatter} from './speech.js';
import {updateOverkill,overkillNear,endOverkill,getOverkillState} from './overkill.js';
import {clubDanceState} from './club.js'; // instancia a boate em interiors[] + ação DANCE
import {updateDanceGame} from './dance-game.js';
import {gymTrainState} from './gym.js';
import {updateGymGame} from './gym-game.js';
import {modShopState,modShopInteract,updateModShop,workshopBlip} from './mod-shop.js';
import {hospitalAdmit} from './hospital.js';
import {prisonAdmit} from './prison.js';
import {gunShopState,gunShopBuy,gunShopTargets,inGunShopRange} from './gun-shop.js';
import {recordBest} from './leaderboard.js';
import {initProperty,houseBuyState,houseEatState,houseGarageState,getHouseState} from './property.js';
import {houseTvState,updateHouseTv,getHouseTvState} from './house-tv.js';
import {updateDoors} from './doors.js';
import {updateDoorArrows} from '../assets/models/city/door-arrow.js';
import {updateCityCulling} from '../assets/models/city/building.js';
import {updatePropCulling} from '../assets/models/props/prop-merge.js';
import {updateLotCulling} from '../assets/models/city/abandoned-lot.js';
import * as P from './profiler.js'; // profiler embutido (tecla ` ou ?prof na URL)

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
setupTouchControls();

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
  P.begin('cops');if(state.mode!=='cut'&&!state.cine)updateCops(dt);P.end();
  P.begin('misc');
  updateHeli(dt);
  updatePickups(dt);
  updateTaxi(dt);
  updateRace(dt);
  updateBoatRace(dt);
  P.end();
  P.begin('weapons');updateWeapons(dt);P.end();
  P.begin('misc');
  updateInteriors(dt); // boate, academia e qualquer ambiente interno futuro
  updateStreetChatter(dt); // pedestres soltam frases aleatórias/contextuais
  updateSpeech(dt);    // segue/fade dos balões de diálogo (rua e interiores)
  updateOverkill(dt);  // modo overkill: multiplicador de heat + renda
  updateDoors(); // portas por toque: interiores e telhados dos prédios
  if(input.shootHeld)performShoot();

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
  recordBest(state.money); // acompanha o maior dinheiro pro ranking global
  P.begin('audio');updateAudio();P.end();
  // Radar redesenhado a ~22fps (ver MM_INTERVAL): liberar a main thread sem
  // impacto visual perceptível.
  mmAccum+=dt;
  if(mmAccum>=MM_INTERVAL){mmAccum=0;P.begin('minimap');drawMinimap();P.end();}

  const pp=playerPos();
  radioZone(pp.x); // troca a rádio ao cruzar entre cidade e zona rural
  P.begin('culling');
  updateCityCulling(pp.x,pp.z); // esconde chunks da cidade longe (atrás da névoa)
  updatePropCulling(pp.x,pp.z); // props pequenos: corte curto (LOD por tamanho)
  updateLotCulling(pp.x,pp.z);  // lotes/entulho: corte médio
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

function frame(){
  requestAnimationFrame(frame);
  P.frameStart(); // marca o início do frame pro profiler (limpa acumuladores)
  tickFps(); // antes dos early-returns: mede até pausado/tela de título
  const raw=clock.getDelta();
  step(Math.min(raw,.05));
  adaptResolution(raw*1000);
  P.frameEnd(); // fecha o frame: atualiza FPS/ms/overlay do profiler
}

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
    interior:state.interior?.constructor?.name||null,
    money:state.money,
    wanted:state.wanted,
    player:{x:pp.x,y:pp.y,z:pp.z,heading:state.mode==='car'?c?.heading:player.heading},
    vehicle:c?{name:c.name,x:c.g.position.x,y:c.g.position.y,z:c.g.position.z,speed:c.speed,plane:!!c.plane,taxi:!!c.taxi}:null,
    taxi:refs.getTaxiState?.()||null,
    race:refs.getRaceState?.()||null,
    boatRace:refs.getBoatRaceState?.()||null,
    overkill:refs.getOverkillState?.()||null,
    delivery:delivery?{x:delivery.x,z:delivery.z}:null,
    interiorBlips:refs.interiorBlips?.()||[],
    storyBlips:refs.storyBlips?.()||[],
    house:refs.getHouseState?.()||null,
    houseTv:refs.getHouseTvState?.()||null,
    rick:refs.getRickState?.()||null,
  });
};
// Pré-compila todos os shaders/materiais da cena montada ANTES do loop: sem
// isso, o primeiro frame que revela um material novo (andar revela chunks da
// cidade) trava ~100ms compilando o programa. Custa um pouco no boot e elimina
// esses engasgos em jogo.
try{renderer.compile(scene,camera);}catch(e){}
frame();
