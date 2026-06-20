import {state} from './state.js';
import {camera,sea} from './engine.js';
import {setSkyHidden} from './daynight.js';
import {player,playerPos,cameraRig} from './player.js';
import {clamp} from './constants.js';
import {message} from './hud.js';
import {arrowBob} from '../assets/models/city/door-arrow.js';
import type * as THREE from 'three';

// ============================================================================
// Classe base de AMBIENTES INTERNOS (boate, academia, hospital, presídio, ...).
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
//  fx        objeto de efeitos do modelo:
//              exitArrow anima a seta interna;
//              facade + footprint são OBRIGATÓRIOS quando o exterior tem
//              porta/marquise/placa/janela/alpendre ou qualquer detalhe solto
//              fora do corpo principal. Coloque esses detalhes em fx.facade e
//              informe a pegada do prédio em fx.footprint, porque a câmera pode
//              nascer dentro da construção ao sair e esses detalhes precisam
//              sumir junto com a fachada.
//  enterMsg/enterColor  aviso padrão ao entrar (onEnter pode trocar)
//  exterior  {x,z,r} zona da FACHADA onde gangue não pode existir (js/gangs.js)
//  mapIcon   {id,label,color,icon} blip do radar para a porta externa
//  spawnHeading  pra onde o jogador olha ao nascer dentro (padrão: +x)
//  spawnOutHeading  pra onde olha ao sair pra rua (padrão: -x)
// ============================================================================

// Shapes shared by the interior config (loose by design — each ambiente only
// fills what it needs and the fx object varies per model).
export interface InteriorBounds{x0:number;x1:number;z0:number;z1:number;y1?:number;}
export interface XZ{x:number;z:number;}
export interface InteriorMapIcon{id:string;label:string;color:string;icon:string;}
export interface InteriorExterior{x:number;z:number;r:number;}
export interface InteriorFx{
  facade?:THREE.Object3D|null;
  facadeArrow?:THREE.Object3D|null;
  footprint?:{x0:number;x1:number;z0:number;z1:number}|null;
  exitArrow?:THREE.Object3D|null;
  [k:string]:any;
}
export interface InteriorConfig{
  group:THREE.Group;
  bounds:InteriorBounds;
  center:XZ;
  door:XZ;
  spawnOut:XZ;
  intDoor:XZ;
  intSpawn:XZ;
  fx?:InteriorFx|null;
  enterMsg?:string;
  enterColor?:string;
  exterior?:InteriorExterior|null;
  mapIcon?:InteriorMapIcon|null;
  spawnHeading?:number;
  spawnOutHeading?:number;
}

// Registro de todos os interiores instanciados. js/doors.js varre por porta
// perto e js/main.js atualiza todos via updateInteriors.
export const interiors:Interior[]=[];

export class Interior{
  group:THREE.Group;
  bounds:InteriorBounds;
  center:XZ;
  door:XZ;
  spawnOut:XZ;
  intDoor:XZ;
  intSpawn:XZ;
  fx:InteriorFx|null;
  enterMsg:string;
  enterColor:string;
  exterior:InteriorExterior|null;
  spawnHeading:number;
  mapIcon:InteriorMapIcon|null;
  spawnOutHeading:number;

  constructor({group,bounds,center,door,spawnOut,intDoor,intSpawn,
    fx=null,enterMsg='',enterColor='var(--gold)',exterior=null,
    mapIcon=null,
    spawnHeading=Math.PI/2,spawnOutHeading=-Math.PI/2}:InteriorConfig){
    this.group=group;this.bounds=bounds;this.center=center;
    this.door=door;this.spawnOut=spawnOut;this.intDoor=intDoor;this.intSpawn=intSpawn;
    this.fx=fx;this.enterMsg=enterMsg;this.enterColor=enterColor;
    this.exterior=exterior;this.spawnHeading=spawnHeading;
    this.mapIcon=mapIcon;
    this.spawnOutHeading=spawnOutHeading;
    interiors.push(this);
  }

  get active():boolean{return state.interior===this;}

  // 'enter' perto da porta da rua, 'exit' perto da porta interna, senão null
  near():'enter'|'exit'|null{
    if(state.mode!=='foot')return null;
    const pp=playerPos();
    if(!this.active&&Math.hypot(pp.x-this.door.x,pp.z-this.door.z)<2.4)return 'enter';
    if(this.active&&Math.hypot(pp.x-this.intDoor.x,pp.z-this.intDoor.z)<2.4)return 'exit';
    return null;
  }

  teleport(x:number,z:number,h:number):void{
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
  enter():void{this.enterAt(this.intSpawn,this.spawnHeading);}

  // liga a sala e teleporta pra um ponto/heading quaisquer (morte/prisão usam
  // isto pra acordar no hospital/presídio — ver js/hospital.js e js/prison.js)
  enterAt(spawn:XZ,heading:number):void{
    // Se o jogador vinha de OUTRO interior (ex.: morreu/foi preso DENTRO da loja de
    // armas e é admitido no hospital/presídio), desliga o anterior PRIMEIRO — senão
    // o onExit() dele nunca roda: a arma de treino ficava equipada de graça e o
    // sistema de "uma arma só" travava ligado pra sempre.
    const prev:Interior|null=state.interior;
    if(prev&&prev!==this)prev.leave();
    state.interior=this;
    this.group.visible=true;
    setExteriorWorldHidden(true); // some com mar/céu que cortam salas off-map
    this.teleport(spawn.x,spawn.z,heading);
    this.onEnter();
  }

  exit():void{
    this.leave();
    this.teleport(this.spawnOut.x,this.spawnOut.z,this.spawnOutHeading);
  }

  // desliga o ambiente sem teleportar (saída normal e de emergência)
  leave():void{
    if(state.interior===this)state.interior=null;
    this.group.visible=false;
    setExteriorWorldHidden(false); // de volta pra rua: mar/céu reaparecem
    this.onExit();
  }

  // chamada pelo js/doors.js quando o jogador encosta numa porta
  doorInteract():boolean{
    const n=this.near();
    if(!n)return false;
    if(n==='enter')this.enter();else this.exit();
    return true;
  }

  // Some com os objetos externos destacados (porta, marquise, placa, alpendre,
  // setas, janelas decorativas...) enquanto a câmera está dentro da pegada do
  // prédio. Ao sair, as paredes principais somem por back-face culling e, sem
  // este grupo, os detalhes ficariam flutuando no ar. Todo novo Interior com
  // detalhe externo separado deve preencher fx.facade + fx.footprint.
  updateFacade():void{
    const fx=this.fx;if(!fx||!fx.facade)return;
    const c=camera.position,f=fx.footprint;
    const inside=f&&c.x>f.x0&&c.x<f.x1&&c.z>f.z0&&c.z<f.z1;
    fx.facade.visible=!inside;
    if(!inside&&fx.facadeArrow)fx.facadeArrow.position.y=1.7+arrowBob(state.time);
  }

  update(dt:number):void{
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
  onEnter():void{if(this.enterMsg)message(this.enterMsg,this.enterColor);}
  onExit():void{}
  updateFx(dt:number):void{}
}

// porta de algum interior perto agora (js/doors.js)
export function nearestDoor():Interior|null{
  for(const it of interiors)if(it.near())return it;
  return null;
}

// Correção DEFINITIVA dos "blocos" externos cortando ambientes internos:
// - o mar é um disco gigante centrado na origem;
// - o céu é uma esfera de raio 900, e interiores como a loja ficam perto dessa
//   borda, então o domo azul/roxo entrava na sala conforme o horário.
// Como enterAt()/leave() são os ÚNICOS pontos onde state.interior muda,
// esconder essas camadas aqui cobre QUALQUER ambiente interno atual ou futuro.
function setExteriorWorldHidden(hidden:boolean):void{
  sea.visible=!hidden;
  setSkyHidden(hidden);
}

// atualiza todos os interiores por frame (js/main.js)
export function updateInteriors(dt:number):void{
  for(const it of interiors)it.update(dt);
}
