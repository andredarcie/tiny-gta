import {state} from './state.js';
import {camera} from './engine.js';
import {player,playerPos,cameraRig} from './player.js';
import {clamp} from './constants.js';
import {message} from './hud.js';
import {arrowBob} from '../assets/models/city/door-arrow.js';

// ============================================================================
// Classe base de AMBIENTES INTERNOS (boate, academia, ...).
// Concentra TODAS as regras comuns de interior; cada ambiente novo só estende
// esta classe e sobrescreve os hooks opcionais (onEnter/onExit/updateFx).
//
// Regras embutidas:
//  - entra/sai por TOQUE na porta (sem botão), com teleporte de corte seco
//    (sem o snap, o lerp da câmera atravessaria ~600m de mapa voando);
//  - o cenário fica num THREE.Group visible=false, ligado só enquanto o
//    jogador está lá;
//  - a sala vive a ~600m do mapa: js/physics.js e js/player.js consultam
//    state.interior pra desligar o limite do mundo, tratar o piso como chão
//    seco e prender a câmera dentro de .bounds (ver os dois arquivos);
//  - saída de emergência: se o jogador for teleportado pra cidade sem passar
//    pela porta (WASTED/BUSTED), o ambiente se desliga sozinho.
//
// Config do construtor:
//  group     THREE.Group do interior (visible alternado aqui)
//  bounds    {x0,x1,z0,z1,y1} caixa onde a câmera pode ficar lá dentro
//  center    {x,z} centro da sala (saída de emergência mede a distância)
//  door      {x,z} porta da rua (entra ao encostar)
//  spawnOut  {x,z} onde o jogador nasce ao sair pra rua
//  intDoor   {x,z} porta interna (sai ao encostar)
//  intSpawn  {x,z} onde o jogador nasce ao entrar
//  fx        objeto de efeitos do modelo (lê fx.exitArrow pra animar a seta)
//  enterMsg/enterColor  aviso padrão ao entrar (onEnter pode trocar)
//  exterior  {x,z,r} zona da FACHADA onde gangue não pode existir (js/gangs.js)
//  spawnHeading  pra onde o jogador olha ao nascer dentro (padrão: +x)
// ============================================================================

// Registro de todos os interiores instanciados. js/doors.js varre por porta
// perto e js/main.js atualiza todos via updateInteriors.
export const interiors=[];

export class Interior{
  constructor({group,bounds,center,door,spawnOut,intDoor,intSpawn,
    fx=null,enterMsg='',enterColor='var(--gold)',exterior=null,spawnHeading=Math.PI/2}){
    this.group=group;this.bounds=bounds;this.center=center;
    this.door=door;this.spawnOut=spawnOut;this.intDoor=intDoor;this.intSpawn=intSpawn;
    this.fx=fx;this.enterMsg=enterMsg;this.enterColor=enterColor;
    this.exterior=exterior;this.spawnHeading=spawnHeading;
    interiors.push(this);
  }

  get active(){return state.interior===this;}

  // 'enter' perto da porta da rua, 'exit' perto da porta interna, senão null
  near(){
    if(state.mode!=='foot')return null;
    const pp=playerPos();
    if(!this.active&&Math.hypot(pp.x-this.door.x,pp.z-this.door.z)<2.4)return 'enter';
    if(this.active&&Math.hypot(pp.x-this.intDoor.x,pp.z-this.intDoor.z)<2.4)return 'exit';
    return null;
  }

  teleport(x,z,h){
    player.g.position.set(x,0,z);
    player.heading=h;player.g.rotation.y=h;
    cameraRig.yaw=h;
    camera.position.set(x-Math.sin(h)*6,3,z-Math.cos(h)*6);
    if(this.active){ // o spawn fica perto da parede: o snap não pode cair fora
      camera.position.x=clamp(camera.position.x,this.bounds.x0,this.bounds.x1);
      camera.position.z=clamp(camera.position.z,this.bounds.z0,this.bounds.z1);
    }
  }

  // entrada normal pela porta: nasce ao lado da porta, olhando pra dentro
  enter(){this.enterAt(this.intSpawn,this.spawnHeading);}

  // liga a sala e teleporta pra um ponto/heading quaisquer (a morte do jogador
  // usa isto pra acordar no meio do hospital — ver js/hospital.js)
  enterAt(spawn,heading){
    state.interior=this;
    this.group.visible=true;
    this.teleport(spawn.x,spawn.z,heading);
    this.onEnter();
  }

  exit(){
    this.leave();
    this.teleport(this.spawnOut.x,this.spawnOut.z,-Math.PI/2);
  }

  // desliga o ambiente sem teleportar (saída normal e de emergência)
  leave(){
    if(state.interior===this)state.interior=null;
    this.group.visible=false;
    this.onExit();
  }

  // chamada pelo js/doors.js quando o jogador encosta numa porta
  doorInteract(){
    const n=this.near();
    if(!n)return false;
    if(n==='enter')this.enter();else this.exit();
    return true;
  }

  // Some com os objetos da PORTA externa (porta, marquise, seta...) enquanto a
  // câmera está dentro da pegada do prédio — ao sair, as paredes somem por
  // back-face culling e, sem isso, esses objetos ficariam flutuando no ar.
  // O corpo do prédio continua sumindo sozinho pelo culling (comportamento ok).
  updateFacade(){
    const fx=this.fx;if(!fx||!fx.facade)return;
    const c=camera.position,f=fx.footprint;
    const inside=f&&c.x>f.x0&&c.x<f.x1&&c.z>f.z0&&c.z<f.z1;
    fx.facade.visible=!inside;
    if(!inside&&fx.facadeArrow)fx.facadeArrow.position.y=1.7+arrowBob(state.time);
  }

  update(dt){
    this.updateFacade(); // roda sempre (inclusive fora da sala, ao sair)
    if(!this.active)return;
    // saída de emergência: WASTED/BUSTED teleportam pra cidade sem passar pela porta
    const pp=playerPos();
    if(Math.hypot(pp.x-this.center.x,pp.z-this.center.z)>60){this.leave();return;}
    // seta de saída quicando (o mesh fundido das setas externas não alcança o interior)
    const a=this.fx&&this.fx.exitArrow;
    if(a)a.position.y=1.7+arrowBob(state.time);
    this.updateFx(dt);
  }

  // ----- hooks opcionais (sobrescritos pelos ambientes) -----
  onEnter(){if(this.enterMsg)message(this.enterMsg,this.enterColor);}
  onExit(){}
  updateFx(dt){}
}

// porta de algum interior perto agora (js/doors.js)
export function nearestDoor(){
  for(const it of interiors)if(it.near())return it;
  return null;
}

// atualiza todos os interiores por frame (js/main.js)
export function updateInteriors(dt){
  for(const it of interiors)it.update(dt);
}
