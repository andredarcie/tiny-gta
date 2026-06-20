import * as THREE from 'three';
import {state,refs} from './state.js';
import {groundHeight,rand,irand} from './constants.js';
import {addWanted} from './physics.js';
import {spawnDrop} from './missions.js';
import {setOpacity} from './entities.js';

// ============================================================================
// BASE de TODOS os NPCs do jogo. Centraliza os COMPORTAMENTOS COMUNS — levar
// tiro / porrada / explosão / fogo, MORRER (cambalhota + poça de sangue +
// espólio + procurado) e FUGIR de perigo — pra que qualquer NPC novo (a roça,
// por exemplo) já nasça com tudo isso só ESTENDENDO esta classe, sem precisar
// reimplementar dano/morte em cada sistema.
//
// O segredo é o REGISTRO global `npcs`: o sistema de armas (js/weapons.js) varre
// esse array UMA vez e acerta QUALQUER instância de Npc, em vez de enumerar cada
// tipo na mão (era por isso que os roceiros nasciam "à prova de bala" — não
// estavam em nenhuma das listas que o combate olhava).
//
// Cada tipo concreto (pedestre, gangue, roceiro, ...) estende Npc e roda sua
// PRÓPRIA IA no update; o dano/morte é herdado daqui. Ver js/rural-folk.js.
// ============================================================================

// Registro global de todos os NPCs vivos. O combate itera isto.
export const npcs=[];

export class Npc{
  constructor(g,{kind='npc',hp=1,drop=null,wanted=0,wantedMsg='SHOT FIRED!',crime='npc_shot'}={}){
    this.g=g;                 // o Object3D (modelo) do NPC
    this.kind=kind;           // rótulo do tipo (ped/gang/rural/...)
    this.hp=hp;this.maxHp=hp; // vida (1 = morre num tiro, como o pedestre)
    this.dead=false;          // morto: cai em cambalhota e não reage mais
    this.deadT=0;             // tempo desde a morte
    this.grounded=false;      // o corpo já caiu/parou de tombar
    this.vel=new THREE.Vector3();
    this.bloodDropped=false;
    this.punchHits=0;this.lastPunchT=-99; // contador de socos (arma não-letal)
    this.drop=drop;           // [min,max] dólares que o corpo larga, ou null
    this.wanted=wanted;       // estrelas ao matar (civil=1), 0 = nenhuma
    this.wantedMsg=wantedMsg;this.crime=crime;
    npcs.push(this);
  }
  get position(){return this.g.position;}

  // Levou dano (bala/porrada/explosão/fogo). `dir` = direção do impacto (knockback).
  takeDamage(dir,dmg=1){
    if(this.dead)return;
    this.hp-=dmg;
    if(this.hp<=0)this.kill(dir);
    else this.onHurt?.(dir); // sobreviveu: a sub-classe pode reagir (fugir/encolher)
  }

  // Morte padrão: arremessa em cambalhota, deixa poça de sangue, larga o espólio e
  // soma procurado — a MESMA sensação do killPed do pedestre, agora compartilhada.
  kill(dir){
    if(this.dead)return;
    this.dead=true;this.deadT=0;this.grounded=false;
    state.kills++;
    const d=dir||new THREE.Vector3();
    this.vel.set(d.x,0,d.z).multiplyScalar(9).add(new THREE.Vector3(rand(-1.5,1.5),rand(5,7),rand(-1.5,1.5)));
    if(!this.bloodDropped){this.bloodDropped=true;refs.addBloodPuddle?.(this.g.position.x,this.g.position.z);}
    if(this.drop)spawnDrop(this.g.position.x,this.g.position.z,irand(this.drop[0],this.drop[1]));
    if(this.wanted)addWanted(this.wanted,this.wantedMsg,this.crime);
    this.onDeath?.(dir);
  }

  // Anima a cambalhota da morte. Chamado pelo update do tipo enquanto `this.dead`.
  // Retorna true quando o corpo já jazeu o suficiente (a sub-classe decide então
  // se some, recicla ou ressuscita).
  updateRagdoll(dt){
    this.deadT+=dt;
    const gy=groundHeight(this.g.position.x,this.g.position.z);
    if(!this.grounded){
      this.g.position.addScaledVector(this.vel,dt);
      this.vel.y-=22*dt;this.g.rotation.x+=9*dt;
      if(this.g.position.y<gy+.35&&this.vel.y<0){
        this.g.position.y=gy+.35;this.grounded=true;
        this.g.rotation.set(-Math.PI/2,this.g.rotation.y,0); // tombado
      }
    }else if(this.deadT>5){                 // jazeu um tempo: começa a sumir
      setOpacity(this.g,Math.max(0,1-(this.deadT-5)/1));
    }
    return this.deadT>6;
  }

  // Tira do mundo e do registro (corpo sumiu de vez).
  despawn(){
    const i=npcs.indexOf(this);if(i>=0)npcs.splice(i,1);
    this.g.parent?.remove(this.g);
  }

  // Foge de um ponto no plano (carro veloz, tiro) e olha pra onde corre.
  fleeFrom(px,pz,spd,dt){
    let ax=this.g.position.x-px,az=this.g.position.z-pz;
    const m=Math.hypot(ax,az)||1;ax/=m;az/=m;
    this.g.position.x+=ax*spd*dt;this.g.position.z+=az*spd*dt;
    this.g.rotation.y=Math.atan2(ax,az);
    return[ax,az];
  }
}
