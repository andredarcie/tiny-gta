import {state} from './state.js';
import {playerPos} from './player.js';
import {message} from './hud.js';
import {blip} from './audio.js';
import {animatePed} from './entities.js';
import {say} from './speech.js';
import {Interior} from './interior.js';
import {HOSP_DOOR,HOSP_SPAWN_OUT,INT_CENTER,INT_DOOR,INT_SPAWN,INT_BOUNDS,HOSP_HEAL,HOSP_BED,
  hospFx,hospInterior} from '../assets/models/city/hospital.js';

// Hospital "SANTA CASA": estende a classe base de interiores (js/interior.js).
// Particularidades: é pra onde o jogador acorda quando morre (admit(), chamada
// via refs por js/player.js) e tem um kit de cura no centro que restaura a vida
// de quem entra ferido. A saída é a porta oeste (o jogador acorda no fundo).

const HEAL_RANGE=1.9;

class HospitalInterior extends Interior{
  sayT?:number;
  override onEnter(){
    message(state.health<100
      ?'HOSPITAL - GRAB THE GREEN CROSS TO HEAL, THEN HEAD OUT'
      :'HOSPITAL - HEAD FOR THE EXIT','var(--cyan)');
  }
  override updateFx(dt:number){
    if(hospFx.heal){ // kit de cura girando/flutuando
      hospFx.heal.rotation.y+=dt*2;
      hospFx.heal.position.y=1.3+Math.sin(state.time*3)*.12;
    }
    // o paciente doente fala quando o jogador chega perto; o balão some sozinho
    // depois de um tempo (dá pra ler), e tem um cooldown antes de repetir
    this.sayT=(this.sayT||0)-dt;
    const sick=hospFx.sickPatient;
    if(sick&&this.sayT<=0&&!sick.userData.speaking){
      const pp=playerPos(),sp=sick.position;
      if(Math.hypot(pp.x-sp.x,pp.z-sp.z)<5){
        say(sick,"I remember you... you look just like the last thing I saw before I ended up in here.",
          {life:9,yOff:1.7});
        this.sayT=15; // só repete bem depois
      }
    }
    // equipe e pacientes: deitados ficam parados; parados gesticulam de leve;
    // a enfermeira de ronda vai e volta pelo corredor
    for(const p of hospFx.peds){
      if(p.kind==='lie')continue;
      p.t+=dt*p.sp;
      if(p.kind==='walk'){
        const u=(Math.sin(p.t*.5)+1)/2;          // 0..1 ida e volta
        p.g.position.x=p.x0+(p.x1-p.x0)*u;
        p.g.rotation.y=Math.cos(p.t*.5)>=0?Math.PI/2:-Math.PI/2; // olha pra onde anda (eixo x)
        animatePed(p.g,p.t*3,.6);
        p.g.position.y=Math.abs(Math.sin(p.t*3))*.05;
      }else{                                      // idle: leve balanço e gesto
        animatePed(p.g,p.t,.14);
        p.g.rotation.y=p.face+Math.sin(p.t*.4)*.22;
      }
    }
    // cura ao encostar no kit, se estiver ferido (a vida<100 já evita repetir à toa)
    if(state.health<100){
      const pp=playerPos();
      if(Math.hypot(pp.x-HOSP_HEAL.x,pp.z-HOSP_HEAL.z)<HEAL_RANGE){
        state.health=100;
        message('FULLY HEALED','var(--cyan)');
        blip([523,659,784,1047],.09,'sine',.18);
      }
    }
  }
}

export const hospital=new HospitalInterior({
  group:hospInterior,bounds:INT_BOUNDS,center:INT_CENTER,
  door:HOSP_DOOR,spawnOut:HOSP_SPAWN_OUT,intDoor:INT_DOOR,intSpawn:INT_SPAWN,
  fx:hospFx,exterior:{x:110,z:110,r:24},
  mapIcon:{id:'hospital',label:'HOSPITAL',icon:'hospital',color:'#44e6b1'},
});

// Acordar no hospital depois de morrer (js/player.js chama via refs.hospitalAdmit):
// diferente da entrada pela porta, nasce NO MEIO da sala, olhando pra saída (oeste).
export function hospitalAdmit(){hospital.enterAt(HOSP_BED,-Math.PI/2);}
