import * as THREE from 'three';
import {matte} from '../matte.ts';
import {bakeProp} from '../props/prop-merge.ts';
import {groundHeight,irand} from '@/core/constants.ts';

// PARTY ARENA STADIUM - compact municipal stadium portal in the rural world,
// with the real football arena isolated off the open-world landmass for perf.

type Solid={x0:number;x1:number;z0:number;z1:number;h:number};

// Layout constants shared with the activity module.
export const STADIUM={x:455,z:-86};        // small exterior portal in the rural world
export const PORTAL_W=34, PORTAL_D=24;     // compact opaque stadium facade; it only teleports
export const ARENA_STAGE={x:0,y:0,z:620};  // isolated battle field, off the open-world landmass
export const ARENA_W=132, ARENA_D=90;      // outer wall footprint around a real-scale pitch
export const GATE={x:STADIUM.x-PORTAL_W/2,z:STADIUM.z}; // sealed west gate (E to enter)
export const FIELD_W=105, FIELD_D=68;      // real football pitch scale (roughly 105m x 68m)
export const BASE_X=48;                    // team bases at centre +/-BASE_X (red west, blue east)
export const ARENA_PAD=12;                 // soft margin inside the isolated stage
export const ARENA_BARRIERS=[
  {x:-32,z:-22,w:14,d:2.4,h:2.4,side:'red'},
  {x:-32,z: 22,w:14,d:2.4,h:2.4,side:'red'},
  {x: 32,z:-22,w:14,d:2.4,h:2.4,side:'blue'},
  {x: 32,z: 22,w:14,d:2.4,h:2.4,side:'blue'},
  {x:-14,z: -8,w:2.4,d:18,h:2.2,side:'neutral'},
  {x: 14,z:  8,w:2.4,d:18,h:2.2,side:'neutral'},
  {x:  0,z:-29,w:24,d:2.4,h:2.0,side:'neutral'},
  {x:  0,z: 29,w:24,d:2.4,h:2.0,side:'neutral'},
  {x:-44,z:  0,w:2.4,d:15,h:2.2,side:'red'},
  {x: 44,z:  0,w:2.4,d:15,h:2.2,side:'blue'},
] as const;
export function arenaGroundY(_x:number,_z:number):number{return ARENA_STAGE.y;}
export function inStadiumClearing(x:number,z:number,pad=24):boolean{
  return x>STADIUM.x-PORTAL_W/2-pad&&x<STADIUM.x+PORTAL_W/2+pad
    &&z>STADIUM.z-PORTAL_D/2-pad&&z<STADIUM.z+PORTAL_D/2+pad;
}

const WALL_DK=matte({color:0x8d8f99,roughness:.9});
const STAND=matte({color:0xd8c5a6,roughness:.95});
const STEEL=matte({color:0x5b5f6b,roughness:.8});
const WHITE=matte({color:0xffe9c9,roughness:.8});
const RED=matte({color:0xc23b4e,roughness:.85});
const BLUE=matte({color:0x3b7ac2,roughness:.85});
const CONCRETE=matte({color:0xb9b7ad,roughness:.95});
const CONCRETE_DK=matte({color:0x6f746f,roughness:.95});
const ASPHALT=matte({color:0x383a3f,roughness:1});
const ROOF=matte({color:0x2d3437,roughness:.9});
const GREEN=matte({color:0x0f7f4b,roughness:.9});
const YELLOW=matte({color:0xf0c541,roughness:.85});
const SEAT_BLUE=matte({color:0x2670b8,roughness:.9});
const ORANGE=matte({color:0xe56b2f,roughness:.9});
const DARK=matte({color:0x171b1f,roughness:.95});
const NET=matte({color:0xffffff,transparent:true,opacity:.34,side:THREE.DoubleSide});

function box(g:THREE.Group,mat:THREE.Material,x:number,y:number,z:number,w:number,h:number,d:number):THREE.Mesh{
  const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);
  m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;g.add(m);
  return m;
}
function cyl(g:THREE.Group,mat:THREE.Material,x:number,y:number,z:number,r:number,h:number,seg=12):THREE.Mesh{
  const m=new THREE.Mesh(new THREE.CylinderGeometry(r,r,h,seg),mat);
  m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;g.add(m);
  return m;
}
function signTexture(title:string,sub='',bg='#064b2f',accent='#ffd24a'):THREE.CanvasTexture{
  const c=document.createElement('canvas');c.width=512;c.height=160;
  const x=c.getContext('2d')!;
  x.fillStyle=bg;x.fillRect(0,0,512,160);
  x.fillStyle='rgba(255,255,255,.08)';
  for(let i=0;i<11;i++)x.fillRect(i*54-18,0,16,160);
  x.strokeStyle=accent;x.lineWidth=8;x.strokeRect(8,8,496,144);
  x.textAlign='center';x.textBaseline='middle';
  x.fillStyle='#ffe9c9';x.font='900 45px "Bowlby One SC",Impact,sans-serif';
  x.fillText(title,256,68,470);
  if(sub){x.font='800 24px "IBM Plex Mono",monospace';x.fillStyle=accent;x.fillText(sub,256,118,460);}
  const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=8;
  return t;
}
function scoreboardTexture():THREE.CanvasTexture{
  const c=document.createElement('canvas');c.width=768;c.height=384;
  const x=c.getContext('2d')!;
  x.fillStyle='#101418';x.fillRect(0,0,768,384);
  x.fillStyle='#063f2a';x.fillRect(20,20,728,344);
  x.strokeStyle='#f0c541';x.lineWidth=12;x.strokeRect(20,20,728,344);
  x.textAlign='center';x.textBaseline='middle';
  x.fillStyle='#ffe9c9';x.font='900 58px "Bowlby One SC",Impact,sans-serif';x.fillText('PLACAR',384,74,680);
  x.font='900 72px "IBM Plex Mono",monospace';
  x.fillStyle='#c23b4e';x.fillText('RED',170,185,210);
  x.fillStyle='#ffe9c9';x.fillText('0 x 0',384,185,220);
  x.fillStyle='#3b7ac2';x.fillText('BLUE',600,185,220);
  x.font='800 34px "IBM Plex Mono",monospace';x.fillStyle='#f0c541';x.fillText('ARENA DOS PARTIDOS',384,292,680);
  const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=8;
  return t;
}
function sign(g:THREE.Group,title:string,sub:string,x:number,y:number,z:number,w:number,h:number,rotY:number,bg='#064b2f',accent='#ffd24a'):THREE.Mesh{
  const m=new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshBasicMaterial({map:signTexture(title,sub,bg,accent),side:THREE.DoubleSide}));
  m.position.set(x,y,z);m.rotation.y=rotY;g.add(m);return m;
}
function addFlag(g:THREE.Group,x:number,z:number,color:number,h=7,rotY=0):void{
  cyl(g,STEEL,x,h/2,z,.07,h,8);
  const f=new THREE.Mesh(new THREE.PlaneGeometry(1.45,.88),new THREE.MeshBasicMaterial({color,side:THREE.DoubleSide}));
  f.position.set(x+.68*Math.cos(rotY),h-.78,z-.68*Math.sin(rotY));f.rotation.y=rotY;g.add(f);
}
function addTurnstile(g:THREE.Group,x:number,z:number):void{
  cyl(g,STEEL,x,.55,z,.09,1.1,8);
  for(let k=0;k<3;k++){
    const a=k*Math.PI*2/3;
    const arm=box(g,STEEL,x+.28*Math.cos(a),.8,z+.28*Math.sin(a),.56,.06,.06);
    arm.rotation.y=-a;
  }
}
function addGoalNet(g:THREE.Group,sx:number):void{
  const gx=sx*(FIELD_W/2-.75);
  box(g,WHITE,gx,1.2,-3.75,.14,2.4,.14);
  box(g,WHITE,gx,1.2, 3.75,.14,2.4,.14);
  box(g,WHITE,gx,2.4, 0,.14,.14,7.65);
  const backX=gx-sx*1.8;
  const net=new THREE.Mesh(new THREE.PlaneGeometry(7.7,2.35),NET);
  net.position.set(backX,1.22,0);net.rotation.y=Math.PI/2;g.add(net);
  for(let k=-3;k<=3;k++)box(g,WHITE,backX,1.2,k*1.1,.035,2.25,.035);
  box(g,WHITE,backX,.08,-3.75,.08,.16,.14);
  box(g,WHITE,backX,.08, 3.75,.08,.16,.14);
}
function adBoard(g:THREE.Group,title:string,x:number,z:number,w:number,rotY:number,bg:string):void{
  sign(g,title,'',x,.86,z,w,1.08,rotY,bg,'#ffe9c9');
}
function addSeatBlockNS(g:THREE.Group,side:number,halfDepth:number):void{
  const w=ARENA_W-18;
  const mats=[GREEN,YELLOW,SEAT_BLUE,WHITE,ORANGE];
  for(let i=0;i<8;i++){
    const z=side*(FIELD_D/2+3.1+i*1.14);
    const y=.48+i*.43;
    box(g,CONCRETE,0,y,z,w,.42,.92);
    box(g,mats[i%mats.length],0,y+.32,z-side*.1,w-3,.18,.34);
  }
  for(const x of[-w*.38,0,w*.38])box(g,CONCRETE_DK,x,2.15,side*(FIELD_D/2+7.2),1.1,3.2,8.6);
  box(g,ROOF,0,7.85,side*(halfDepth-5.2),ARENA_W-10,.42,7.4);
  for(const x of[-54,-34,-14,14,34,54])cyl(g,STEEL,x,4.05,side*(halfDepth-8.2),.11,8.1,8);
}
function addSeatBlockEnds(g:THREE.Group,side:number,halfWidth:number):void{
  const d=FIELD_D+7;
  const mats=[YELLOW,GREEN,SEAT_BLUE,WHITE];
  for(let i=0;i<6;i++){
    const x=side*(FIELD_W/2+3.1+i*1.12);
    const y=.48+i*.42;
    box(g,CONCRETE,x,y,0,.9,.42,d);
    box(g,mats[(i+1)%mats.length],x-side*.11,y+.32,0,.34,.18,d-2);
  }
  box(g,ROOF,side*(halfWidth-4.8),7.35,0,7.2,.42,ARENA_D-18);
  for(const z of[-30,-15,0,15,30])cyl(g,STEEL,side*(halfWidth-8.2),3.8,z,.1,7.6,8);
}
function addFloodlightTower(g:THREE.Group,x:number,z:number):void{
  cyl(g,STEEL,x,6,z,.15,12,8);
  box(g,STEEL,x,11.7,z,3.2,.18,.18);
  for(let i=-1;i<=1;i++){
    const head=box(g,WHITE,x+i*1.05,12.2,z,1.0,.55,.42);
    head.rotation.y=Math.atan2(-x,-z);
  }
}
function addBench(g:THREE.Group,team:'red'|'blue',x:number,z:number,rotY:number):void{
  const mat=team==='red'?RED:BLUE;
  const bg=team==='red'?'#5d1420':'#123f77';
  box(g,DARK,x,.12,z,9.2,.24,2.1).rotation.y=rotY;
  const roof=box(g,ROOF,x,1.95,z,9.8,.24,2.4);roof.rotation.y=rotY;
  const back=box(g,CONCRETE_DK,x,1.05,z,9.6,1.5,.18);back.rotation.y=rotY;
  for(let i=-3;i<=3;i++){
    const seat=box(g,mat,x+i*1.2*Math.cos(rotY),.55,z-i*1.2*Math.sin(rotY),.9,.22,.72);
    seat.rotation.y=rotY;
  }
  sign(g,team==='red'?'BANCO RED':'BANCO BLUE','',x,1.25,z+.96,5.8,.65,rotY,bg,'#ffe9c9');
}
function addCornerFlags(g:THREE.Group):void{
  for(const sx of[-1,1])for(const sz of[-1,1]){
    const x=sx*FIELD_W/2,z=sz*FIELD_D/2;
    cyl(g,STEEL,x,.85,z,.035,1.7,6);
    const f=new THREE.Mesh(new THREE.PlaneGeometry(.75,.48),new THREE.MeshBasicMaterial({color:0xf0c541,side:THREE.DoubleSide}));
    f.position.set(x+sx*.32,1.38,z);f.rotation.y=Math.PI/2;g.add(f);
  }
}

// The pitch texture: grass with white football markings.
function pitchTexture():THREE.CanvasTexture{
  const W=1024,H=672;
  const c=document.createElement('canvas');c.width=W;c.height=H;
  const x=c.getContext('2d')!;
  x.fillStyle='#5fae62';x.fillRect(0,0,W,H);
  for(let i=0;i<8;i++){
    x.fillStyle=i%2?'rgba(0,0,0,.05)':'rgba(255,255,255,.04)';
    x.fillRect(i*(W/8),0,W/8,H);
  }
  for(let i=0;i<900;i++){
    x.fillStyle=`rgba(${irand(60,95)},${irand(130,170)},${irand(60,95)},.35)`;
    x.fillRect(Math.random()*W,Math.random()*H,3,3);
  }
  x.strokeStyle='rgba(255,255,255,.9)';x.lineWidth=6;
  x.strokeRect(24,24,W-48,H-48);
  x.beginPath();x.moveTo(W/2,24);x.lineTo(W/2,H-24);x.stroke();
  x.beginPath();x.arc(W/2,H/2,86,0,Math.PI*2);x.stroke();
  for(const gx of[24,W-24]){
    const s=gx===24?1:-1;
    x.strokeRect(Math.min(gx,gx+s*150),H/2-160,150,320);
    x.strokeRect(Math.min(gx,gx+s*62),H/2-70,62,140);
    x.beginPath();x.arc(gx+s*112,H/2,18,0,Math.PI*2);x.stroke();
  }
  const t=new THREE.CanvasTexture(c);
  t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=8;
  return t;
}

export function addStadium(solids:Solid[]):void{
  const cx=STADIUM.x,cz=STADIUM.z,gy=groundHeight(cx,cz);
  const g=new THREE.Group();g.position.set(cx,gy,cz);
  const hw=PORTAL_W/2,hd=PORTAL_D/2,WH=8,T=1.1;

  const plaza=new THREE.Mesh(new THREE.PlaneGeometry(PORTAL_W+22,PORTAL_D+18),ASPHALT);
  plaza.rotation.x=-Math.PI/2;plaza.position.set(-2,.025,0);plaza.receiveShadow=true;g.add(plaza);

  // Opaque compact portal. The full arena lives in buildArenaStage().
  box(g,WALL_DK,0,.16,0,PORTAL_W+5,.32,PORTAL_D+5);
  box(g,CONCRETE,0,WH/2, hd-T/2,PORTAL_W,WH,T);
  box(g,CONCRETE,0,WH/2,-hd+T/2,PORTAL_W,WH,T);
  box(g,CONCRETE, hw-T/2,WH/2,0,T,WH,PORTAL_D);
  box(g,CONCRETE,-hw+T/2,WH/2,0,T,WH,PORTAL_D);
  box(g,ROOF,0,WH+.18,0,PORTAL_W+1.4,.5,PORTAL_D+1.4);
  box(g,DARK,-hw+T/2,2.6,0,T+.28,5.2,6.0);
  box(g,WALL_DK,0,.45, hd-T/2,PORTAL_W+.8,.9,T+.55);
  box(g,WALL_DK,0,.45,-hd+T/2,PORTAL_W+.8,.9,T+.55);

  solids.push({x0:cx-hw,x1:cx+hw,z0:cz+hd-T,z1:cz+hd,h:WH});
  solids.push({x0:cx-hw,x1:cx+hw,z0:cz-hd,z1:cz-hd+T,h:WH});
  solids.push({x0:cx+hw-T,x1:cx+hw,z0:cz-hd,z1:cz+hd,h:WH});
  solids.push({x0:cx-hw,x1:cx-hw+T,z0:cz-hd,z1:cz+hd,h:WH});

  sign(g,'ESTADIO MUNICIPAL','ARENA DOS PARTIDOS',-hw-.08,WH-1.35,0,10.8,2.45,-Math.PI/2,'#063f2a','#f0c541');
  sign(g,'PORTAO A','APERTE E PARA ENTRAR',-hw-.09,3.9,0,4.7,1.2,-Math.PI/2,'#161b20','#ffe9c9');
  sign(g,'BILHETERIA','VISITANTE',-hw-.1,2.25,8.2,4.2,1.0,-Math.PI/2,'#123f77','#ffe9c9');
  sign(g,'BILHETERIA','MANDANTE',-hw-.1,2.25,-8.2,4.2,1.0,-Math.PI/2,'#5d1420','#ffe9c9');

  for(const z of[-10.6,-6.2,6.2,10.6])box(g,CONCRETE_DK,-hw-.35,3.3,z,.7,6.6,.7);
  for(const z of[-8.2,8.2]){
    box(g,CONCRETE,-hw-2.4,1.4,z,3.1,2.8,3.1);
    box(g,ROOF,-hw-2.4,3.0,z,3.6,.25,3.6);
  }
  for(const z of[-3.2,-1.05,1.05,3.2])addTurnstile(g,-hw-1.55,z);
  for(const sz of[-1,1]){
    box(g,STAND,0,1.0,sz*(hd+1.0),PORTAL_W-5,1.2,.55);
    box(g,sz<0?RED:BLUE,0,1.82,sz*(hd+1.35),PORTAL_W-8,.28,.38);
  }
  for(const x of[-13,-7,7,13]){
    box(g,GREEN,x,WH+.52,hd+.15,2.4,.35,.4);
    box(g,YELLOW,x,WH+.52,-hd-.15,2.4,.35,.4);
  }
  addFlag(g,-hw-3.2,-10.2,0x0f7f4b,6.4,-Math.PI/2);
  addFlag(g,-hw-3.2, 10.2,0xf0c541,6.4,-Math.PI/2);
  addFlag(g, hw-2.2,-hd+2.2,0xc23b4e,7.2,Math.PI/2);
  addFlag(g, hw-2.2, hd-2.2,0x3b7ac2,7.2,Math.PI/2);
  for(const sx of[-1,1])for(const sz of[-1,1])addFloodlightTower(g,sx*(hw+2.1),sz*(hd+2.1));
  bakeProp(g);
}

// Isolated, hidden-by-default battle stage. It is not baked into the open-world
// chunks because the whole group toggles on only while a round is live.
export function buildArenaStage():THREE.Group{
  const g=new THREE.Group();
  g.visible=false;
  g.position.set(ARENA_STAGE.x,ARENA_STAGE.y,ARENA_STAGE.z);
  const hw=ARENA_W/2,hd=ARENA_D/2,WH=8,T=1.2;

  const apron=new THREE.Mesh(new THREE.PlaneGeometry(ARENA_W+24,ARENA_D+20),ASPHALT);
  apron.rotation.x=-Math.PI/2;apron.position.y=-.02;apron.receiveShadow=true;g.add(apron);
  const base=new THREE.Mesh(new THREE.PlaneGeometry(ARENA_W+12,ARENA_D+10),matte({color:0x4d8750,roughness:1}));
  base.rotation.x=-Math.PI/2;base.position.y=-.015;base.receiveShadow=true;g.add(base);

  // High opaque concrete bowl: no open-world scenery or vegetation leaks inside.
  box(g,CONCRETE,0,WH/2, hd-T/2,ARENA_W,WH,T);
  box(g,CONCRETE,0,WH/2,-hd+T/2,ARENA_W,WH,T);
  box(g,CONCRETE, hw-T/2,WH/2,0,T,WH,ARENA_D);
  box(g,CONCRETE,-hw+T/2,WH/2,0,T,WH,ARENA_D);
  box(g,CONCRETE_DK,0,.55, hd-T/2,ARENA_W,1.1,T+.4);
  box(g,CONCRETE_DK,0,.55,-hd+T/2,ARENA_W,1.1,T+.4);
  box(g,CONCRETE_DK, hw-T/2,.55,0,T+.4,1.1,ARENA_D);
  box(g,CONCRETE_DK,-hw+T/2,.55,0,T+.4,1.1,ARENA_D);

  addSeatBlockNS(g,1,hd);
  addSeatBlockNS(g,-1,hd);
  addSeatBlockEnds(g,1,hw);
  addSeatBlockEnds(g,-1,hw);
  for(const sx of[-1,1])for(const sz of[-1,1])addFloodlightTower(g,sx*(hw-4),sz*(hd-4));

  const pitch=new THREE.Mesh(new THREE.PlaneGeometry(FIELD_W,FIELD_D),matte({map:pitchTexture(),roughness:1}));
  pitch.rotation.x=-Math.PI/2;pitch.position.y=.05;pitch.receiveShadow=true;g.add(pitch);

  addGoalNet(g,-1);
  addGoalNet(g,1);
  addCornerFlags(g);

  for(const[sx,mat]of[[-1,RED],[1,BLUE]] as const){
    const pad=new THREE.Mesh(new THREE.CircleGeometry(5.2,40),mat);
    pad.rotation.x=-Math.PI/2;pad.position.set(sx*BASE_X,.08,0);pad.receiveShadow=true;g.add(pad);
  }

  const board=new THREE.Mesh(new THREE.PlaneGeometry(17,8.5),new THREE.MeshBasicMaterial({map:scoreboardTexture(),side:THREE.DoubleSide}));
  board.position.set(0,9.4,hd-.72);board.rotation.y=Math.PI;g.add(board);
  sign(g,'GERAL','MANDANTE',0,5.45,-hd+.72,20,3.0,0,'#063f2a','#f0c541');
  sign(g,'ARQUIBANCADA','VISITANTE',0,5.45,hd-.72,20,3.0,Math.PI,'#123f77','#ffe9c9');
  sign(g,'TUNEL','VESTIARIOS',-hw+.72,2.75,0,4.6,1.45,-Math.PI/2,'#161b20','#f0c541');
  box(g,DARK,-hw+.64,1.6,0,.18,3.2,8.0);

  addBench(g,'red',-20,FIELD_D/2+1.35,0);
  addBench(g,'blue',20,FIELD_D/2+1.35,0);
  const ads=[
    ['POSTO RURAL','#063f2a'],['LANCHES DO ZE','#5d1420'],['RADIO 97','#123f77'],['MERCADO POPULAR','#6b4b12'],
    ['AUTO PECAS','#161b20'],['FARMACIA CENTRAL','#0f596a'],['REFRI GUARANA','#0f7f4b'],['CHURRASCO','#7b2f16'],
  ] as const;
  for(let i=0;i<ads.length;i++){
    const [txt,bg]=ads[i];
    const x=-45+i*13;
    adBoard(g,txt,x,-FIELD_D/2-1.2,10,0,bg);
    adBoard(g,txt,x, FIELD_D/2+1.2,10,Math.PI,bg);
  }

  for(const b of ARENA_BARRIERS){
    const mat=b.side==='red'?RED:b.side==='blue'?BLUE:WALL_DK;
    const main=box(g,mat,b.x,b.h/2+.07,b.z,b.w,b.h,b.d);
    box(g,DARK,b.x,b.h+.2,b.z,b.w+.12,.2,b.d+.12);
    if(b.w>b.d){
      for(let i=-1;i<=1;i++)box(g,WHITE,b.x+i*b.w*.28,b.h+.43,b.z,.45,.28,b.d+.2);
    }else{
      for(let i=-1;i<=1;i++)box(g,WHITE,b.x,b.h+.43,b.z+i*b.d*.28,b.w+.2,.28,.45);
    }
    main.userData.arenaBarrier=true;
  }
  return g;
}
