import * as THREE from 'three';
import {state,input,refs} from './state.js';
import {renderer,scene,camera,clouds,dlight,sunDir} from './engine.js';
import {updateAudio} from './audio.js';
import {drawMinimap,updateHUD,hideBig,tickFps} from './hud.js';
import {player,cur,playerPos,nearestCar,idleCars,cameraRig,updateCar,updateFoot,updateCamera,getBusted,getWasted,exitCar} from './player.js';
import {traffic,trafficPos,spawnTraffic,updateTraffic} from './traffic.js';
import {updatePeds,ejectDriver,addBloodPuddle} from './pedestrians.js';
import {updateGangs,gangs,spawnInitialGangs,setGangsHidden} from './gangs.js';
import {updateBeach} from './world.js';
import {cops,heli,updateCops,updateHeli} from './police.js';
import {delivery,spawnDelivery,updatePickups} from './missions.js';
import {updateTaxi} from './taxi.js';
import {updateRace} from './race.js';
import {updateStory,storyNear,storyBlips,storyTargets} from './story.js';
import {blinkBar} from './entities.js';
import {setupInput,updateKeyboardInput,performShoot} from './input.js';
import {setupTouchControls,updateTouchControls} from './touch-controls.js';
import {canPickWeapon,updateWeapons,isWeaponHeld,canAttack,confiscateWeapon,
  switchWeapon,selectWeaponSlot,getWeaponHud} from './weapons.js';
import {updateDayNight} from './daynight.js';
import {updateInteriors,interiors} from './interior.js';
import {updateSpeech,updateStreetChatter} from './speech.js';
import {updateOverkill,overkillNear,endOverkill,getOverkillState} from './overkill.js';
import './club.js'; // efeito de registro: instancia a boate em interiors[]
import {gymTrainState} from './gym.js';
import {hospitalAdmit} from './hospital.js';
import {prisonAdmit} from './prison.js';
import {gunShopState,gunShopBuy,gunShopTargets,inGunShopRange} from './gun-shop.js';
import {recordBest} from './leaderboard.js';
import {initProperty,houseBuyState,houseEatState,houseGarageState,getHouseState} from './property.js';
import {houseTvState,updateHouseTv,getHouseTvState} from './house-tv.js';
import {updateDoors} from './doors.js';
import {updateDoorArrows} from '../assets/models/city/door-arrow.js';

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
function step(dt){
  updateKeyboardInput();
  updateTouchControls();
  if(updateHouseTv()){renderer.render(scene,camera);return;}
  if(state.paused||state.orientationBlocked){renderer.render(scene,camera);return;}
  state.time+=dt;

  for(const c of clouds){
    c.position.x+=c.userData.v*dt;
    if(c.position.x>550)c.position.x=-550;
  }
  updateBeach(state.time);
  updateDayNight(dt);
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

  if(state.mode==='cut'){
    state.cutT-=dt;
    if(state.cutT<=0){hideBig();const fn=state.cutFn;state.cutFn=null;fn&&fn();}
  }else if(state.mode==='car')updateCar(dt);
  else updateFoot(dt);

  updateTraffic(dt);
  updatePeds(dt);
  updateGangs(dt);
  if(state.mode!=='cut'&&!state.cine)updateCops(dt);
  updateHeli(dt);
  updatePickups(dt);
  updateTaxi(dt);
  updateRace(dt);
  updateWeapons(dt);
  updateInteriors(dt); // boate, academia e qualquer ambiente interno futuro
  updateStreetChatter(dt); // pedestres soltam frases aleatórias/contextuais
  updateSpeech(dt);    // segue/fade dos balões de diálogo (rua e interiores)
  updateOverkill(dt);  // modo overkill: multiplicador de heat + renda
  updateDoors(); // portas por toque: interiores e telhados dos prédios
  if(input.shootHeld)performShoot();

  if(cur)blinkBar(cur.g);
  for(const c of idleCars)blinkBar(c.g);

  updateCamera(dt);
  updateStory(dt); // depois da câmera: em cut-scene a câmera é da história
  updateHUD(dt);
  recordBest(state.money); // acompanha o maior dinheiro pro ranking global
  updateAudio();
  drawMinimap();

  const pp=playerPos();
  dlight.position.set(pp.x+sunDir.x*160,sunDir.y*160,pp.z+sunDir.z*160);
  dlight.target.position.set(pp.x,0,pp.z);

  renderer.render(scene,camera);
}

function frame(){
  requestAnimationFrame(frame);
  tickFps(); // antes dos early-returns: mede até pausado/tela de título
  step(Math.min(clock.getDelta(),.05));
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
    overkill:refs.getOverkillState?.()||null,
    delivery:delivery?{x:delivery.x,z:delivery.z}:null,
    interiorBlips:refs.interiorBlips?.()||[],
    storyBlips:refs.storyBlips?.()||[],
    house:refs.getHouseState?.()||null,
    houseTv:refs.getHouseTvState?.()||null,
  });
};
frame();
