import {clamp,BOUND,RURAL_X1,RURAL_HALF,RURAL_SWIM_MARGIN} from '@/core/constants.js';
import {solids} from '@/world/world.js';
import {state} from '@/core/state.js';
import {blip} from '@/audio/audio.js';
import {message} from '@/ui/hud.js';

// bound: NPCs param no calção da praia (BOUND); jogador pode nadar até SWIM_BOUND
export function collideStatics(p:{x:number;y:number;z:number},r:number,bound=BOUND){
  let hit=false;
  for(const b of solids){
    if(b.h!==undefined&&p.y>b.h)continue; // avião passa por cima dos prédios
    const cx=clamp(p.x,b.x0,b.x1),cz=clamp(p.z,b.z0,b.z1);
    const dx=p.x-cx,dz=p.z-cz,d2=dx*dx+dz*dz;
    if(d2<r*r){
      if(d2<1e-6){
        const pl=p.x-b.x0,pr=b.x1-p.x,pt=p.z-b.z0,pb=b.z1-p.z,m=Math.min(pl,pr,pt,pb);
        if(m===pl)p.x=b.x0-r;else if(m===pr)p.x=b.x1+r;
        else if(m===pt)p.z=b.z0-r;else p.z=b.z1+r;
      }else{
        const d=Math.sqrt(d2);p.x=cx+dx/d*r;p.z=cz+dz/d*r;
      }
      hit=true;
    }
  }
  // Dentro da boate/academia o jogador está a ~600m do mapa: o limite do mundo
  // não vale lá (senão o clamp o arrasta pro meio do mar); as paredes da sala
  // já são sólidas. NPCs (bound===BOUND) continuam presos à praia.
  if(state.interior&&bound>BOUND)return hit;
  // Jogador (bound>BOUND) pode seguir a península rural para +x até a montanha.
  // A folga da península (rext) é FIXA (RURAL_SWIM_MARGIN), não escala com `bound`:
  // SWIM_BOUND cresceu pra ilha a oeste, mas o alcance a leste fica igual ao de antes.
  const rext=bound>BOUND?RURAL_SWIM_MARGIN:0;
  const maxX=rext>0&&Math.abs(p.z)<RURAL_HALF+rext?RURAL_X1+rext:bound;
  if(p.x<-bound){p.x=-bound;hit=true} if(p.x>maxX){p.x=maxX;hit=true}
  if(p.z<-bound){p.z=-bound;hit=true} if(p.z>bound){p.z=bound;hit=true}
  return hit;
}

export function addWanted(n:number,why?:string,crime='pursuit'){
  const before=Math.floor(state.wanted);
  // cap 6 = MAX star (was 5, so the HUD's 6th star never lit). Reaching 6 stars
  // summons the army (see js/army.js).
  state.wanted=clamp(state.wanted+n,0,6);state.lastCrime=state.time;
  if(state.wanted>=6)state.sixStarT=state.time; // reached/still at max: (re)arm the 6-star hold
  if(Math.floor(state.wanted)>before){
    blip([880,660,880],0.08,'square',.14);
    message(why||('WANTED ★'+Math.floor(state.wanted)),'var(--pink)');
  }
}
