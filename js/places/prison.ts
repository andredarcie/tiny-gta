import type * as THREE from 'three';
import {state} from '@/core/state.ts';
import {playerPos} from '@/actors/player.ts';
import {message} from '@/ui/hud.ts';
import {animatePed} from '@/core/entities.ts';
import {blip} from '@/audio/audio.ts';
import {say} from '@/ui/speech.ts';
import {Interior} from '@/world/interior.ts';
import {PRISON_DOOR,PRISON_SPAWN_OUT,INT_CENTER,INT_DOOR,INT_SPAWN,INT_BOUNDS,
  PRISON_RELEASE,prisonFx,prisonInterior} from '../../assets/models/city/prison.ts';
import {nameInteriorNpc} from '@/actors/npc.ts';

// Presidio / County Jail. The player is taken here after BUSTED, just like
// WASTED wakes the player inside the hospital.

class PrisonInterior extends Interior{
  sayT?:number;
  override onEnter(){
    message('COUNTY JAIL - WALK TO THE EXIT','var(--cyan)');
    blip([220,180,140],.08,'square',.12);
  }
  override updateFx(dt:number){
    if(prisonFx.warning){
      prisonFx.warning.rotation.y+=dt*2.2;
      (prisonFx.warning.material as THREE.Material).opacity=.65+.25*Math.sin(state.time*5);
    }
    this.sayT=(this.sayT||0)-dt;
    const pp=playerPos();
    for(const guard of prisonFx.guards){
      guard.t+=dt*guard.sp;
      if(guard.kind==='walk'){
        const u=Math.sin(guard.t*.55);
        guard.g.position.z=329.2+u*3.6;
        guard.g.rotation.y=u>=0?0:Math.PI;
        animatePed(guard.g,guard.t*3,.55);
      }else{
        animatePed(guard.g,guard.t,.12);
        guard.g.rotation.y=guard.face+Math.sin(guard.t*.5)*.18;
      }
      if(this.sayT<=0&&!guard.g.userData.speaking&&
        Math.hypot(pp.x-guard.g.position.x,pp.z-guard.g.position.z)<4.5){
        say(guard.g,'The crime king paid to get you out.',{life:5,yOff:1.7});
        this.sayT=12;
      }
    }
    for(const inmate of prisonFx.inmates){
      inmate.t+=dt*inmate.sp;
      animatePed(inmate.g,inmate.t,.1);
      inmate.g.rotation.y=inmate.face+Math.sin(inmate.t*.35)*.25;
    }
  }
}

export const prison=new PrisonInterior({
  group:prisonInterior,bounds:INT_BOUNDS,center:INT_CENTER,
  door:PRISON_DOOR,spawnOut:PRISON_SPAWN_OUT,intDoor:INT_DOOR,intSpawn:INT_SPAWN,
  fx:prisonFx,enterMsg:'COUNTY JAIL',enterColor:'var(--cyan)',
  exterior:{x:-66,z:-66,r:26},
  mapIcon:{id:'prison',label:'COUNTY JAIL',icon:'prison',color:'#19e3ff'},
});

// Name the jail's guards and inmates (women get the female look); they keep their
// patrol/idle animation from updateFx.
for(const g of prisonFx.guards)nameInteriorNpc(g.g,'guard','County Jail');
for(const i of prisonFx.inmates)nameInteriorNpc(i.g,'inmate','County Jail');

export function prisonAdmit(){prison.enterAt(PRISON_RELEASE,-Math.PI/2);}
