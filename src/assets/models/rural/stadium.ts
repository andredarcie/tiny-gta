import * as THREE from 'three';
import {matte} from '../matte.ts';
import {bakeProp} from '../props/prop-merge.ts';
import {groundHeight,irand} from '@/core/constants.ts';

// PARTY ARENA STADIUM — a football stadium out in the rural south (flat plain
// south-east of the mountain). The pitch inside is the parties' battle arena
// (js/activities/party-arena.ts): members-only, entered by teleport through the
// sealed front gate. Everything here is STATIC and baked; the dynamic pieces
// (towers, fighters) live in the activity module.

type Solid={x0:number;x1:number;z0:number;z1:number;h:number};

// Layout constants shared with the activity module.
export const STADIUM={x:455,z:-86};       // stadium centre (flat rural ground)
export const ARENA_W=64, ARENA_D=46;      // outer wall footprint
export const GATE={x:STADIUM.x-ARENA_W/2,z:STADIUM.z}; // sealed west gate (E to enter)
export const FIELD_W=46, FIELD_D=30;      // the pitch itself
export const BASE_X=20;                   // team bases at centre ±BASE_X (red west, blue east)

const WALL=matte({color:0xccd6d0,roughness:.95});   // faded seafoam concrete (FACADES)
const WALL_DK=matte({color:0x8d8f99,roughness:.9}); // plinth / trims (GROUND rock)
const STAND=matte({color:0xd8c5a6,roughness:.95});  // bleacher tiers (FACADES sand)
const STEEL=matte({color:0x5b5f6b,roughness:.8});   // poles / goal frames
const WHITE=matte({color:0xffe9c9,roughness:.8});   // goalposts (NEON cream)
const RED=matte({color:0xc23b4e,roughness:.85});    // party base pads
const BLUE=matte({color:0x3b7ac2,roughness:.85});

function box(g:THREE.Group,mat:THREE.Material,x:number,y:number,z:number,w:number,h:number,d:number):THREE.Mesh{
  const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);
  m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;g.add(m);
  return m;
}

// The pitch texture: grass with white football markings (halfway line, centre
// circle, boxes) — drawn once to a canvas, mapped onto one plane.
function pitchTexture():THREE.CanvasTexture{
  const W=1024,H=672;
  const c=document.createElement('canvas');c.width=W;c.height=H;
  const x=c.getContext('2d')!;
  x.fillStyle='#5fae62';x.fillRect(0,0,W,H);
  for(let i=0;i<8;i++){ // mowing stripes
    x.fillStyle=i%2?'rgba(0,0,0,.05)':'rgba(255,255,255,.04)';
    x.fillRect(i*(W/8),0,W/8,H);
  }
  for(let i=0;i<900;i++){ // grass noise
    x.fillStyle=`rgba(${irand(60,95)},${irand(130,170)},${irand(60,95)},.35)`;
    x.fillRect(Math.random()*W,Math.random()*H,3,3);
  }
  x.strokeStyle='rgba(255,255,255,.9)';x.lineWidth=6;
  x.strokeRect(24,24,W-48,H-48);                       // touchlines
  x.beginPath();x.moveTo(W/2,24);x.lineTo(W/2,H-24);x.stroke(); // halfway line
  x.beginPath();x.arc(W/2,H/2,86,0,Math.PI*2);x.stroke();       // centre circle
  for(const gx of[24,W-24]){                            // penalty boxes
    const s=gx===24?1:-1;
    x.strokeRect(Math.min(gx,gx+s*150),H/2-160,150,320);
  }
  const t=new THREE.CanvasTexture(c);
  t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=8;
  return t;
}

// Marquee over the gate: PARTY ARENA with the two party colours.
function marqueeTexture():THREE.CanvasTexture{
  const c=document.createElement('canvas');c.width=512;c.height=128;
  const x=c.getContext('2d')!;
  x.fillStyle='#14091f';x.fillRect(0,0,512,128);
  x.strokeStyle='#ffd24a';x.lineWidth=6;x.strokeRect(6,6,500,116);
  x.textAlign='center';
  x.font='900 56px "Bowlby One SC",Impact,sans-serif';
  x.fillStyle='#c23b4e';x.fillText('PARTY',160,82);
  x.fillStyle='#3b7ac2';x.fillText('ARENA',352,82);
  const t=new THREE.CanvasTexture(c);
  t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=8;
  return t;
}

export function addStadium(solids:Solid[]):void{
  const cx=STADIUM.x,cz=STADIUM.z,gy=groundHeight(cx,cz);
  const g=new THREE.Group();g.position.set(cx,gy,cz);
  const hw=ARENA_W/2,hd=ARENA_D/2,WH=9,T=1.2;

  // ---- perimeter walls (west wall split around the sealed gate) ----
  const GATE_W=6;
  box(g,WALL,0,WH/2, hd-T/2,ARENA_W,WH,T);              // north (z max)
  box(g,WALL,0,WH/2,-hd+T/2,ARENA_W,WH,T);              // south
  box(g,WALL, hw-T/2,WH/2,0,T,WH,ARENA_D);              // east
  const segD=(ARENA_D-GATE_W)/2;
  box(g,WALL,-hw+T/2,WH/2, (GATE_W+segD)/2,T,WH,segD);  // west, north of gate
  box(g,WALL,-hw+T/2,WH/2,-(GATE_W+segD)/2,T,WH,segD);  // west, south of gate
  box(g,WALL,-hw+T/2,WH-1,0,T,2,GATE_W);                // gate lintel
  box(g,WALL_DK,-hw+T/2,2.1,0,T+.3,4.2,GATE_W-.4);      // sealed gate doors (entry is by teleport)
  box(g,WALL_DK,0,.35, hd-T/2,ARENA_W+.6,.7,T+.6);      // plinth trims
  box(g,WALL_DK,0,.35,-hd+T/2,ARENA_W+.6,.7,T+.6);
  // wall + gate collision
  solids.push({x0:cx-hw,x1:cx+hw,z0:cz+hd-T,z1:cz+hd,h:WH});
  solids.push({x0:cx-hw,x1:cx+hw,z0:cz-hd,z1:cz-hd+T,h:WH});
  solids.push({x0:cx+hw-T,x1:cx+hw,z0:cz-hd,z1:cz+hd,h:WH});
  solids.push({x0:cx-hw,x1:cx-hw+T,z0:cz-hd,z1:cz+hd,h:WH}); // gate stays sealed

  // ---- marquee over the gate (outside face) ----
  const mq=new THREE.Mesh(new THREE.PlaneGeometry(9,2.2),
    new THREE.MeshBasicMaterial({map:marqueeTexture()}));
  mq.position.set(-hw-.05,WH-2,0);mq.rotation.y=-Math.PI/2;g.add(mq);

  // ---- bleacher stands along the north & south walls (3 tiers) ----
  for(const sz of[-1,1])for(let t2=0;t2<3;t2++){
    const depth=1.6,zoff=sz*(hd-T-.8-t2*depth);
    box(g,STAND,0,.5+t2*.85,zoff,ARENA_W-8,1+t2*1.7,depth);
  }
  solids.push({x0:cx-(ARENA_W-8)/2,x1:cx+(ARENA_W-8)/2,z0:cz+hd-T-5.6,z1:cz+hd-T,h:4});
  solids.push({x0:cx-(ARENA_W-8)/2,x1:cx+(ARENA_W-8)/2,z0:cz-hd+T,z1:cz-hd+T+5.6,h:4});

  // ---- floodlight poles at the four corners ----
  for(const sx of[-1,1])for(const sz of[-1,1]){
    const fx=sx*(hw-2.4),fz=sz*(hd-2.4);
    const pole=new THREE.Mesh(new THREE.CylinderGeometry(.16,.22,14,8),STEEL);
    pole.position.set(fx,7,fz);pole.castShadow=true;g.add(pole);
    box(g,WHITE,fx,14.2,fz,1.9,.9,.5).rotation.y=Math.atan2(-fx,-fz);
  }

  // ---- the pitch + goals + team base pads ----
  const pitch=new THREE.Mesh(new THREE.PlaneGeometry(FIELD_W,FIELD_D),
    matte({map:pitchTexture(),roughness:1}));
  pitch.rotation.x=-Math.PI/2;pitch.position.y=.06;pitch.receiveShadow=true;g.add(pitch);
  for(const sx of[-1,1]){ // goal frames at the pitch ends
    const gx2=sx*(FIELD_W/2-.6);
    box(g,WHITE,gx2,1.2,-3,.14,2.4,.14);
    box(g,WHITE,gx2,1.2, 3,.14,2.4,.14);
    box(g,WHITE,gx2,2.4, 0,.14,.14,6.1);
  }
  for(const[sx,mat]of[[-1,RED],[1,BLUE]] as const){ // spawn pads (red west, blue east)
    const pad=new THREE.Mesh(new THREE.CircleGeometry(3,32),mat);
    pad.rotation.x=-Math.PI/2;pad.position.set(sx*BASE_X,.08,0);pad.receiveShadow=true;g.add(pad);
  }

  bakeProp(g);
}
