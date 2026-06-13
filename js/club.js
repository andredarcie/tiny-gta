import {radioRandom,radioOn,radioOff} from './radio.js';
import {animatePed} from './entities.js';
import {Interior} from './interior.js';
import {CLUB_DOOR,CLUB_SPAWN_OUT,INT_CENTER,INT_DOOR,INT_SPAWN,INT_BOUNDS,clubFx,clubInterior}
  from '../assets/models/city/nightclub.js';

// Boate "THE FLAMINGO": só estende a classe base de interiores (js/interior.js),
// que já cuida de porta/teleporte/limite do mundo/câmera/saída de emergência.
// Aqui ficam só as particularidades: o som da casa (rádio) ao entrar/sair e a
// animação da pista (globo, ladrilhos piscando, dançarinos).
const PAL=[0xff2e88,0x19e3ff,0xffd24a,0x9dff2e];

class ClubInterior extends Interior{
  onEnter(){
    super.onEnter();          // aviso de boas-vindas padrão
    radioRandom();radioOn();  // som da casa por conta do sistema de rádio
  }
  onExit(){radioOff();}
  updateFx(dt){
    clubFx.ball.rotation.y+=dt*1.4;
    this.fxT=(this.fxT||0)+dt;
    if(this.fxT>=.24){ // pista pisca trocando as cores dos 4 materiais compartilhados
      this.fxT=0;this.step=(this.step||0)+1;
      clubFx.tileMats.forEach((m,i)=>m.color.setHex(PAL[(i+this.step)%PAL.length]));
    }
    for(const d of clubFx.dancers){
      d.t+=dt*d.sp;
      animatePed(d.g,d.t,.9);
      d.g.position.y=Math.abs(Math.sin(d.t))*.09;
      d.g.rotation.y=d.face+Math.sin(d.t*.45)*.6;
    }
  }
}

export const club=new ClubInterior({
  group:clubInterior,bounds:INT_BOUNDS,center:INT_CENTER,
  door:CLUB_DOOR,spawnOut:CLUB_SPAWN_OUT,intDoor:INT_DOOR,intSpawn:INT_SPAWN,
  fx:clubFx,enterMsg:'WELCOME TO THE FLAMINGO',enterColor:'var(--pink)',
  exterior:{x:-154,z:-22,r:24}, // fachada: gangue não chega perto
});
