import * as THREE from 'three';
import {matte} from '../matte.js';
import {scene} from '@/core/engine.js';
import {RURAL_GAP} from '@/core/constants.js';
import {makeDoorArrow} from '../city/door-arrow.js';

// Casa de campo COMPRÁVEL (safehouse estilo open-world), no mesmo molde dos demais
// interiores (boate/academia/hospital/presídio): fachada no mapa + ambiente
// interno a ~600m num Group visible=false. Diferenças (ver js/property.js):
//   - só ABRE depois de comprada (placa FOR SALE na frente);
//   - dentro tem uma geladeira com comida que cura a vida;
//   - tem uma GARAGEM ao lado pra guardar um carro, que volta salvo até depois
//     de fechar o jogo (localStorage).

// ----- fachada: casa + garagem perto da montanha, no fim da zona rural -----
export const RANCH_CX=420+RURAL_GAP, RANCH_CZ=-80;   // centro do corpo da casa, longe da cidade
export const RANCH_DOOR={x:420+RURAL_GAP,z:-85.5};   // porta da frente (face norte): entra ao encostar
export const RANCH_SPAWN_OUT={x:420+RURAL_GAP,z:-88};// onde o jogador nasce ao sair pro quintal
export const RANCH_SALE={x:420+RURAL_GAP,z:-88};     // placa FOR SALE / gatilho de compra
export const GARAGE_PAD={x:409+RURAL_GAP,z:-80};     // vaga dentro da garagem (carro salvo fica aqui)

// ----- interior: sala a ~600m do mapa (z=80 fica livre entre boate(-22) e hospital(180)) -----
export const INT_CENTER={x:-800,z:80};
export const INT_DOOR={x:-807.4,z:80};          // porta de saída (parede oeste)
export const INT_SPAWN={x:-805.8,z:80};         // nasce ao lado da porta, olhando pra dentro (+x)
export const INT_BOUNDS={x0:-807.6,x1:-792.4,z0:74.4,z1:85.6,y1:4.0};
export const FOOD={x:-793,z:77};                // comida da geladeira: cura quem come
export const TV={x:INT_CENTER.x-5,z:INT_CENTER.z+1.2,y:1.2}; // tela da TV da sala
export const HOUSE_PRICE=1;                      // preço da casa (1 dólar pra teste; js/property.js importa)

const wallM=matte({color:0xf3ecd8,roughness:.95});      // tábuas claras (lambris)
const roofM=matte({color:0x7c3b2c,roughness:.85});      // telha de barro escura
const trimM=matte({color:0x5e3c24,roughness:.8});       // madeira escura (vigas)
const sidingM=matte({color:0xd8ccb2,roughness:.9});     // linhas do lambril
const whiteM=matte({color:0xfbfaf4,roughness:.7});      // acabamento branco (quinas/janelas)
const woodDoorM=matte({color:0x6e4a32,roughness:.85});
const winM=matte({color:0xbfe0ef,roughness:.25,metalness:.3,side:THREE.DoubleSide});
const shutterM=matte({color:0x4a7a52,roughness:.85});   // venezianas verdes
const brickM=matte({color:0x9a4b3a,roughness:.95});     // chaminé de tijolo
const metalM=matte({color:0xb8bec6,roughness:.45,metalness:.6});
const concreteM=matte({color:0x8d8f93,roughness:1});
const flowerM=matte({color:0xdb4d68,roughness:.75});
const leafAccentM=matte({color:0x3f8e4d,roughness:.85});
const warmLampM=new THREE.MeshBasicMaterial({color:0xffd37a});

export const ranchFx: {
  facade:THREE.Group|null,facadeArrow:THREE.Object3D|null,footprint:{x0:number;x1:number;z0:number;z1:number}|null,
  exitArrow:THREE.Object3D|null,saleSign:THREE.Group|null,soldSign:THREE.Group|null,food:THREE.Group|null,tv:THREE.Mesh|null
}={facade:null,facadeArrow:null,footprint:null,
  exitArrow:null,saleSign:null,soldSign:null,food:null,tv:null};
export const ranchInterior=new THREE.Group();
ranchInterior.visible=false;

// placa FOR SALE pintada num canvas (some depois da compra)
function saleTexture(sold: boolean): THREE.CanvasTexture{
  const c=document.createElement('canvas');c.width=256;c.height=256;
  const x=c.getContext('2d')!;
  x.fillStyle=sold?'#244d2a':'#7a2230';x.fillRect(0,0,256,256);
  x.fillStyle='#f4ecd8';x.fillRect(10,10,236,236);
  x.fillStyle=sold?'#244d2a':'#7a2230';
  x.textAlign='center';x.textBaseline='middle';
  if(sold){
    x.font='900 70px monospace';x.fillText('SOLD',128,128);
  }else{
    x.font='900 52px monospace';x.fillText('FOR',128,70);x.fillText('SALE',128,128);
    x.font='900 40px monospace';x.fillText('$'+HOUSE_PRICE,128,190);
  }
  const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return t;
}

let tvPreviewTex: THREE.CanvasTexture|null=null;
function tvPreviewTexture(): THREE.CanvasTexture{
  if(tvPreviewTex)return tvPreviewTex;
  const c=document.createElement('canvas');c.width=512;c.height=288;
  const x=c.getContext('2d')!;
  const rr=(px: number,py: number,w: number,h: number,r: number)=>{
    x.beginPath();
    x.moveTo(px+r,py);x.lineTo(px+w-r,py);x.quadraticCurveTo(px+w,py,px+w,py+r);
    x.lineTo(px+w,py+h-r);x.quadraticCurveTo(px+w,py+h,px+w-r,py+h);
    x.lineTo(px+r,py+h);x.quadraticCurveTo(px,py+h,px,py+h-r);
    x.lineTo(px,py+r);x.quadraticCurveTo(px,py,px+r,py);x.fill();
  };
  const bg=x.createLinearGradient(0,0,512,288);
  bg.addColorStop(0,'#10172b');bg.addColorStop(.55,'#1d2f5f');bg.addColorStop(1,'#071018');
  x.fillStyle=bg;x.fillRect(0,0,512,288);
  x.fillStyle='#0b1020';x.globalAlpha=.72;
  for(let y=18;y<288;y+=26)x.fillRect(0,y,512,2);
  x.globalAlpha=1;
  x.fillStyle='#e8f7ff';x.font='900 48px monospace';x.textAlign='left';x.textBaseline='top';
  x.fillText('ANDRE OS',30,26);
  x.font='700 17px monospace';x.fillStyle='#67e8f9';x.fillText('andredarcie.github.io/andre-os',32,82);
  x.fillStyle='#ff4fa3';rr(32,118,118,78,12);
  x.fillStyle='#12d6b4';rr(164,118,118,78,12);
  x.fillStyle='#f8c14a';rr(296,118,118,78,12);
  x.fillStyle='#08111f';rr(40,132,102,10,4);rr(172,132,102,10,4);rr(304,132,102,10,4);
  x.fillStyle='#fff';x.font='900 22px monospace';
  x.fillText('APP',64,154);x.fillText('WEB',196,154);x.fillText('DEV',328,154);
  x.fillStyle='rgba(255,255,255,.16)';rr(36,216,440,42,16);
  for(let i=0;i<7;i++){
    x.fillStyle=['#ff4fa3','#67e8f9','#f8c14a','#82f38f','#b78cff','#f472b6','#38bdf8'][i];
    rr(56+i*54,226,28,22,7);
  }
  x.fillStyle='#e8f7ff';x.font='900 16px monospace';x.textAlign='right';
  x.fillText('LIVE PREVIEW',478,36);
  x.fillStyle='#ffffff';x.beginPath();x.moveTo(438,182);x.lineTo(470,214);x.lineTo(452,218);x.lineTo(444,238);x.lineTo(431,232);x.lineTo(439,212);x.closePath();x.fill();
  tvPreviewTex=new THREE.CanvasTexture(c);
  tvPreviewTex.colorSpace=THREE.SRGBColorSpace;
  tvPreviewTex.minFilter=THREE.LinearFilter;
  tvPreviewTex.magFilter=THREE.LinearFilter;
  return tvPreviewTex;
}
function tvScreenMaterial(): THREE.MeshBasicMaterial{
  return new THREE.MeshBasicMaterial({map:tvPreviewTexture(),toneMapped:false});
}

// Placa de quintal: dois postes nas laterais e caixilho vazado. A tábua é
// desenhada dos dois lados, então o texto aparece chegando de qualquer direção.
function makeSign(sold: boolean): THREE.Group{
  const g=new THREE.Group();
  for(const sx of[-.85,.85]){
    const post=new THREE.Mesh(new THREE.BoxGeometry(.12,2.3,.12),trimM);
    post.position.set(sx,1.15,0);g.add(post);
  }
  for(const[x,y,w,h]of[
    [0,2.45,1.9,.12],[0,.75,1.9,.12],[-.85,1.6,.12,1.7],[.85,1.6,.12,1.7]
  ]){
    const bar=new THREE.Mesh(new THREE.BoxGeometry(w,h,.12),trimM);
    bar.position.set(x,y,0);g.add(bar);
  }
  const tex=saleTexture(sold);
  for(const[z,ry,flip]of[[.08,0,1],[-.08,Math.PI,-1]]){
    const board=new THREE.Mesh(new THREE.PlaneGeometry(1.58,1.58),
      new THREE.MeshBasicMaterial({map:tex,side:THREE.DoubleSide}));
    board.position.set(0,1.6,z);board.rotation.y=ry;board.scale.x=flip;g.add(board);
  }
  return g;
}

// ----- mobília simples do interior -----
function makeFridge(): THREE.Group{
  const g=new THREE.Group();
  const body=new THREE.Mesh(new THREE.BoxGeometry(1.1,2.2,1),
    matte({color:0xd9dde2,roughness:.4,metalness:.4}));
  body.position.y=1.1;g.add(body);
  // duas portas com puxadores cromados
  for(const[y,h]of[[1.6,1.1],[.55,.95]]){
    const door=new THREE.Mesh(new THREE.BoxGeometry(1.06,h-.06,.06),
      matte({color:0xeef1f4,roughness:.35,metalness:.5}));
    door.position.set(0,y,.5);g.add(door);
    const handle=new THREE.Mesh(new THREE.BoxGeometry(.05,h*.6,.05),metalM);
    handle.position.set(-.42,y,.56);g.add(handle);
  }
  return g;
}
// comida (prato + sanduíche) que flutua e gira (animada por js/property.js)
function makeFood(): THREE.Group{
  const g=new THREE.Group();
  const plate=new THREE.Mesh(new THREE.CylinderGeometry(.32,.28,.05,16),
    matte({color:0xf4f4f0,roughness:.5}));
  g.add(plate);
  const bun=matte({color:0xd9a14e,roughness:.8});
  const bot=new THREE.Mesh(new THREE.CylinderGeometry(.2,.2,.07,14),bun);bot.position.y=.07;g.add(bot);
  const patty=new THREE.Mesh(new THREE.CylinderGeometry(.21,.21,.06,14),
    matte({color:0x5a3826,roughness:.9}));patty.position.y=.13;g.add(patty);
  const sal=new THREE.Mesh(new THREE.CylinderGeometry(.23,.23,.03,14),
    matte({color:0x4caf50,roughness:.8}));sal.position.y=.17;g.add(sal);
  const top=new THREE.Mesh(new THREE.SphereGeometry(.2,14,8,0,Math.PI*2,0,Math.PI/2),bun);
  top.position.y=.19;g.add(top);
  return g;
}
function makeSofa(): THREE.Group{
  const g=new THREE.Group();
  const m=matte({color:0x4a6a8a,roughness:.9});
  const base=new THREE.Mesh(new THREE.BoxGeometry(2.6,.5,1),m);base.position.y=.35;g.add(base);
  const back=new THREE.Mesh(new THREE.BoxGeometry(2.6,.8,.25),m);back.position.set(0,.75,-.45);g.add(back);
  for(const sx of[-1.25,1.25]){
    const arm=new THREE.Mesh(new THREE.BoxGeometry(.25,.6,1),m);arm.position.set(sx,.55,0);g.add(arm);
  }
  for(const sx of[-.45,.45]){
    const pillow=new THREE.Mesh(new THREE.BoxGeometry(.55,.28,.16),
      matte({color:sx<0?0xf0c15d:0xce6f7b,roughness:.9}));
    pillow.position.set(sx,.78,-.28);g.add(pillow);
  }
  return g;
}
function makeTv(live: boolean): THREE.Group{
  const g=new THREE.Group();
  const media=new THREE.Mesh(new THREE.BoxGeometry(2,.55,.55),woodDoorM);media.position.y=.28;g.add(media);
  const top=new THREE.Mesh(new THREE.BoxGeometry(2.1,.06,.6),trimM);top.position.y=.57;g.add(top);
  for(const sx of[-.5,.5]){
    const cab=new THREE.Mesh(new THREE.BoxGeometry(.9,.4,.03),matte({color:0x5e3c24}));
    cab.position.set(sx,.28,.28);g.add(cab);
  }
  const frame=new THREE.Mesh(new THREE.BoxGeometry(1.7,1,.12),
    matte({color:0x14161c,roughness:.5}));frame.position.y=1.35;g.add(frame);
  const screen=new THREE.Mesh(new THREE.PlaneGeometry(1.5,.82),
    tvScreenMaterial());screen.position.set(0,1.35,.07);g.add(screen);
  if(live)ranchFx.tv=screen;
  return g;
}
function makeBed(): THREE.Group{
  const g=new THREE.Group();
  const frame=new THREE.Mesh(new THREE.BoxGeometry(2,.4,3),trimM);frame.position.y=.2;g.add(frame);
  const mat=new THREE.Mesh(new THREE.BoxGeometry(1.9,.25,2.9),
    matte({color:0xe7e2d6,roughness:.8}));mat.position.y=.5;g.add(mat);
  const blanket=new THREE.Mesh(new THREE.BoxGeometry(1.92,.12,1.8),
    matte({color:0x39507a,roughness:.85}));blanket.position.set(0,.62,.5);g.add(blanket);
  const pillow=new THREE.Mesh(new THREE.BoxGeometry(1.6,.2,.5),
    matte({color:0xf4f1ea,roughness:.8}));pillow.position.set(0,.62,-1.1);g.add(pillow);
  const headboard=new THREE.Mesh(new THREE.BoxGeometry(2.1,1,.18),trimM);
  headboard.position.set(0,.75,-1.48);g.add(headboard);
  return g;
}
function makeTable(): THREE.Group{
  const g=new THREE.Group();
  const top=new THREE.Mesh(new THREE.BoxGeometry(1.4,.1,.9),woodDoorM);top.position.y=.75;g.add(top);
  for(const[sx,sz]of[[-.6,-.35],[.6,-.35],[-.6,.35],[.6,.35]]){
    const leg=new THREE.Mesh(new THREE.BoxGeometry(.1,.75,.1),woodDoorM);leg.position.set(sx,.37,sz);g.add(leg);
  }
  return g;
}

// ===========================================================================
// Interior decor: shared textures, props and a furnishing routine used by BOTH
// the live off-map room (addRanchHouse) and the model-viewer cut-away preview,
// so the two never drift apart.
// ===========================================================================
const mkBox=(w: number,h: number,d: number,mat: THREE.Material)=>new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);
const mkCyl=(rt: number,rb: number,h: number,seg: number,mat: THREE.Material)=>new THREE.Mesh(new THREE.CylinderGeometry(rt,rb,h,seg),mat);
const P=<T extends THREE.Object3D>(m: T,x: number,y: number,z: number,ry=0): T=>{m.position.set(x,y,z);if(ry)m.rotation.y=ry;return m;};
function tex(w: number,h: number,draw: (x: CanvasRenderingContext2D, w: number, h: number) => void): THREE.CanvasTexture{
  const c=document.createElement('canvas');c.width=w;c.height=h;
  draw(c.getContext('2d')!,w,h);
  const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return t;
}

// wood plank floor (tiled)
const plankTex=tex(256,256,(x,w,h)=>{
  const cols=['#9c7850','#8f6c47','#a47e56','#946e4a'],pw=64;
  for(let i=0;i<w/pw;i++){
    x.fillStyle=cols[i%cols.length];x.fillRect(i*pw,0,pw,h);
    x.strokeStyle='rgba(60,40,24,.16)';x.lineWidth=1;
    for(let k=0;k<5;k++){const gy=((i*53+k*97)%h);x.beginPath();x.moveTo(i*pw+4,gy);x.lineTo(i*pw+pw-4,gy+((k%2)?5:-4));x.stroke();}
    x.strokeStyle='rgba(40,26,14,.5)';x.lineWidth=2;x.strokeRect(i*pw+1,1,pw-2,h-2);
  }
  x.strokeStyle='rgba(40,26,14,.4)';x.lineWidth=2;
  for(let y=128;y<h;y+=128){x.beginPath();x.moveTo(0,y);x.lineTo(w,y);x.stroke();}
});
plankTex.wrapS=plankTex.wrapT=THREE.RepeatWrapping;plankTex.repeat.set(4,3);
const floorWoodM=matte({color:0xffffff,map:plankTex});

// subtle wallpaper (tiled), shared by shell + preview walls
const wallTex=tex(128,128,(x,w,h)=>{
  x.fillStyle='#e9ddc4';x.fillRect(0,0,w,h);
  for(let i=0;i<w;i+=16){x.fillStyle=((i/16)%2)?'rgba(255,255,255,.10)':'rgba(150,130,95,.06)';x.fillRect(i,0,8,h);}
  for(let i=0;i<260;i++){x.fillStyle='rgba(120,100,70,.05)';x.fillRect((i*53)%w,(i*97)%h,2,2);}
});
wallTex.wrapS=wallTex.wrapT=THREE.RepeatWrapping;wallTex.repeat.set(6,2);

// kitchen backsplash tile
const tileTex=tex(64,64,(x,w,h)=>{
  x.fillStyle='#cfe3e6';x.fillRect(0,0,w,h);
  x.strokeStyle='rgba(120,150,155,.6)';x.lineWidth=3;
  for(let i=0;i<=w;i+=16){x.beginPath();x.moveTo(i,0);x.lineTo(i,h);x.moveTo(0,i);x.lineTo(w,i);x.stroke();}
});
tileTex.wrapS=tileTex.wrapT=THREE.RepeatWrapping;tileTex.repeat.set(8,1.4);

// patterned area rug
const rugTex=tex(96,72,(x,w,h)=>{
  x.fillStyle='#7a3b3b';x.fillRect(0,0,w,h);
  x.strokeStyle='#caa15a';x.lineWidth=5;x.strokeRect(7,7,w-14,h-14);
  x.lineWidth=2;x.strokeRect(15,15,w-30,h-30);
  x.fillStyle='#caa15a';x.beginPath();x.moveTo(w/2,h*.32);x.lineTo(w*.64,h/2);x.lineTo(w/2,h*.68);x.lineTo(w*.36,h/2);x.closePath();x.fill();
});

// faux daylight window view (sunny countryside)
const windowViewM=new THREE.MeshBasicMaterial({map:tex(200,160,(x,w,h)=>{
  const sky=x.createLinearGradient(0,0,0,h*.65);sky.addColorStop(0,'#8fc6f0');sky.addColorStop(1,'#dcefff');
  x.fillStyle=sky;x.fillRect(0,0,w,h*.65);
  x.fillStyle='rgba(255,250,210,.95)';x.beginPath();x.arc(w*.76,h*.22,16,0,Math.PI*2);x.fill();
  x.fillStyle='#86bd72';x.beginPath();x.moveTo(0,h*.65);
  for(let i=0;i<=w;i+=20)x.lineTo(i,h*.55+Math.sin(i*.05)*9);
  x.lineTo(w,h);x.lineTo(0,h);x.closePath();x.fill();
  x.fillStyle='#6aa552';x.fillRect(0,h*.8,w,h*.2);
  x.fillStyle='#5a3a22';x.fillRect(w*.22-4,h*.5,8,42);
  x.fillStyle='#4f9a44';x.beginPath();x.arc(w*.22,h*.46,22,0,Math.PI*2);x.fill();
})});

// two framed paintings
const artLandscapeM=new THREE.MeshBasicMaterial({map:tex(160,112,(x,w,h)=>{
  const sky=x.createLinearGradient(0,0,0,h);sky.addColorStop(0,'#f3c884');sky.addColorStop(1,'#e89a63');
  x.fillStyle=sky;x.fillRect(0,0,w,h);
  x.fillStyle='rgba(255,240,200,.95)';x.beginPath();x.arc(w*.78,h*.28,12,0,Math.PI*2);x.fill();
  x.fillStyle='#356b4a';x.fillRect(0,h*.62,w,h*.38);
  x.fillStyle='#274f38';x.beginPath();x.moveTo(0,h*.62);x.lineTo(w*.42,h*.34);x.lineTo(w*.72,h*.62);x.closePath();x.fill();
})});
const artAbstractM=new THREE.MeshBasicMaterial({map:tex(96,120,(x,w,h)=>{
  x.fillStyle='#22304a';x.fillRect(0,0,w,h);
  const cols=['#ff7ab0','#67e8f9','#f8c14a','#82f38f'];
  for(let i=0;i<6;i++){x.fillStyle=cols[i%4];x.fillRect(10,12+i*18,w-20,11);}
})});

const counterM=matte({color:0xcdb594,roughness:.7});
const tileM=matte({color:0xffffff,map:tileTex});
const stoveTopM=matte({color:0x232323,roughness:.45,metalness:.4});
const curtainM=matte({color:0xb8553f,roughness:.9});
const fireM=new THREE.MeshBasicMaterial({color:0xff8a2a,transparent:true,opacity:.9});
const emberM=new THREE.MeshBasicMaterial({color:0xffd060,transparent:true,opacity:.55,depthWrite:false});
const rugLivingM=matte({color:0xffffff,map:rugTex});
const rugBedM=matte({color:0x5d6b7a,roughness:.95});
const rugDiningM=matte({color:0x6f5f43,roughness:.95});

const makeRug=(mat: THREE.Material,w: number,d: number)=>{const r=new THREE.Mesh(new THREE.PlaneGeometry(w,d),mat);r.rotation.x=-Math.PI/2;return r;};
function makeWallArt(mat: THREE.Material,w=1.05,h=.66): THREE.Group{
  const g=new THREE.Group();
  g.add(mkBox(w+.2,h+.2,.08,trimM));
  g.add(P(new THREE.Mesh(new THREE.PlaneGeometry(w,h),mat),0,0,.05));
  return g;
}
function makeRangeHood(): THREE.Group{
  const g=new THREE.Group();
  g.add(P(mkBox(1.1,.3,.7,metalM),0,0,0));
  g.add(P(mkBox(.4,.7,.3,metalM),0,.5,-.15));
  return g;
}
function makePlant(): THREE.Group{
  const g=new THREE.Group();
  g.add(P(mkCyl(.2,.16,.45,10,matte({color:0xb06a3a})),0,.22,0));
  const leafM=matte({color:0x3f8e4d,roughness:.9});
  for(let i=0;i<9;i++){const a=i/9*Math.PI*2;const leaf=mkBox(.07,.8,.2,leafM);
    leaf.position.set(Math.cos(a)*.13,.85,Math.sin(a)*.13);leaf.rotation.set(Math.cos(a)*.5,a,Math.sin(a)*.5);g.add(leaf);}
  return g;
}
function makePendant(): THREE.Group{
  const g=new THREE.Group();
  g.add(P(mkCyl(.015,.015,.6,5,trimM),0,.3,0));
  g.add(P(new THREE.Mesh(new THREE.ConeGeometry(.32,.3,14,1,true),matte({color:0x2a2a2a})),0,-.05,0));
  g.add(P(new THREE.Mesh(new THREE.SphereGeometry(.1,8,6),warmLampM),0,-.12,0));
  return g;
}
function makeBookshelf(): THREE.Group{
  const g=new THREE.Group();
  g.add(P(mkBox(1.4,2.2,.1,woodDoorM),0,1.1,-.16));
  for(const sx of[-.7,.7])g.add(P(mkBox(.1,2.2,.42,woodDoorM),sx,1.1,0));
  g.add(P(mkBox(1.4,.1,.42,woodDoorM),0,2.2,0));
  const cols=[0x8a3b3b,0x33506e,0x4a7a52,0xd8995f,0x6b5440,0x85a7c9];
  for(let i=0;i<4;i++){
    const sy=.4+i*.5;g.add(P(mkBox(1.4,.08,.42,woodDoorM),0,sy,0));
    for(let j=0;j<11;j++){const bh=.3+((i*5+j)%3)*.05;
      g.add(P(mkBox(.1,bh,.3,matte({color:cols[(i*3+j)%6]})),-.62+j*.115,sy+.04+bh/2,.04));}
  }
  return g;
}
function makeDresser(): THREE.Group{
  const g=new THREE.Group();
  g.add(P(mkBox(1.4,1.1,.6,woodDoorM),0,.55,0));
  for(let i=0;i<3;i++){
    g.add(P(mkBox(1.3,.3,.04,matte({color:0x7a5236})),0,.28+i*.33,.31));
    for(const sx of[-.35,.35])g.add(P(mkBox(.08,.08,.06,metalM),sx,.28+i*.33,.34));
  }
  g.add(P(mkBox(1.5,.06,.66,trimM),0,1.13,0));
  return g;
}
function makeHutch(): THREE.Group{
  const g=new THREE.Group();
  g.add(P(mkBox(1.6,1,.5,woodDoorM),0,.5,0));
  g.add(P(mkBox(1.6,1.4,.36,woodDoorM),0,1.7,-.06));
  for(const sx of[-.4,.4])g.add(P(mkBox(.7,1.2,.03,winM),sx,1.7,.16));
  for(let i=0;i<3;i++)g.add(P(new THREE.Mesh(new THREE.CircleGeometry(.18,14),whiteM),0,1.3+i*.35,.14));
  g.add(P(mkBox(1.7,.08,.42,trimM),0,2.42,0));
  return g;
}
function makeWindow(): THREE.Group{
  const g=new THREE.Group();
  g.add(P(new THREE.Mesh(new THREE.PlaneGeometry(1.3,1.1),windowViewM),0,0,.02));
  for(const[x,y,w,h]of[[-.72,0,.12,1.3],[.72,0,.12,1.3],[0,.66,1.56,.12],[0,-.66,1.56,.12]])
    g.add(P(mkBox(w,h,.1,whiteM),x,y,.05));
  g.add(P(mkBox(.05,1.1,.06,whiteM),0,0,.07));
  g.add(P(mkBox(1.3,.05,.06,whiteM),0,0,.07));
  g.add(P(mkBox(1.7,.12,.22,trimM),0,-.72,.08));
  g.add(P(mkBox(1.8,.24,.1,curtainM),0,.82,.14));
  for(const sx of[-.75,.75])g.add(P(mkBox(.32,1.5,.08,curtainM),sx,.05,.13));
  return g;
}
function makeFireplace(): THREE.Group{
  const g=new THREE.Group();
  g.add(P(mkBox(2.2,2.4,.5,brickM),0,1.2,-.15));
  g.add(P(mkBox(1.2,1.2,.42,matte({color:0x141210})),0,.75,.02));
  g.add(P(mkBox(2.6,.2,.72,woodDoorM),0,1.78,.02));
  g.add(P(mkBox(2.0,.18,.72,concreteM),0,.09,.18));
  for(const lx of[-.28,.02,.3]){const log=mkCyl(.08,.08,.7,7,woodDoorM);log.rotation.z=Math.PI/2;log.position.set(lx,.42,.06);g.add(log);}
  g.add(P(mkBox(.8,.5,.18,fireM),0,.6,.06));
  g.add(P(new THREE.Mesh(new THREE.PlaneGeometry(1.1,.9),emberM),0,.7,.2));
  g.add(P(mkBox(1.3,1.2,.4,brickM),0,2.6,-.1));
  g.add(P(makeWallArt(artLandscapeM,.7,.5),0,2.05,.04));
  return g;
}

// Adds ALL the furniture into `g` relative to room center (ix,iz). `live` wires
// the gameplay refs (ranchFx.food/tv); the preview passes false.
function furnishInterior(g: THREE.Object3D,ix: number,iz: number,live: boolean): void{
  // --- kitchen (north-east) ---
  g.add(P(mkBox(5,1,1,counterM),ix+3,.5,iz-5));
  g.add(P(mkBox(5.2,.12,1.2,trimM),ix+3,1.06,iz-5));
  g.add(P(mkBox(5,.85,.05,tileM),ix+3,1.62,iz-5.9));
  for(const ox of[1.6,2.6,3.6,4.6]){
    g.add(P(mkBox(.8,.8,.22,woodDoorM),ix+ox,2.55,iz-5.86));
    g.add(P(mkBox(.05,.32,.04,metalM),ix+ox+.28,2.55,iz-5.72));
  }
  g.add(P(mkBox(.78,.08,.46,metalM),ix+2.15,1.14,iz-4.92));
  g.add(P(mkBox(.9,.12,.58,stoveTopM),ix+3.45,1.16,iz-4.9));
  for(const dx of[-.22,.22])for(const dz of[-.13,.13]){
    const b=new THREE.Mesh(new THREE.TorusGeometry(.1,.015,6,12),metalM);
    b.rotation.x=Math.PI/2;b.position.set(ix+3.45+dx,1.24,iz-4.9+dz);g.add(b);
  }
  g.add(P(makeRangeHood(),ix+3.45,2.0,iz-5.6));
  const fridge=makeFridge();fridge.position.set(ix+7,0,iz-4.4);fridge.rotation.y=-Math.PI/2;g.add(fridge);
  g.add(P(mkBox(.5,.32,.34,matte({color:0x2a2c30})),ix+1.3,1.28,iz-5));      // microwave
  g.add(P(mkCyl(.1,.12,.22,10,metalM),ix+1.95,1.23,iz-5.2));                 // kettle
  g.add(P(mkCyl(.16,.1,.12,12,matte({color:0xbf6a3a})),ix+4.4,1.18,iz-5));   // fruit bowl
  for(const[fx,fc]of[[-.05,0xd0444a],[.05,0xe0a030],[0,0x6aae3a]])
    g.add(P(new THREE.Mesh(new THREE.SphereGeometry(.06,8,6),matte({color:fc})),ix+4.4+fx,1.28,iz-5));
  const food=makeFood();food.position.set(ix+7,1.2,iz-3);g.add(food);
  if(live)ranchFx.food=food;

  // --- living room (south-west) ---
  g.add(P(makeRug(rugLivingM,3.2,2.4),ix-5,.03,iz+3));
  const sofa=makeSofa();sofa.position.set(ix-5,0,iz+5);sofa.rotation.y=Math.PI;g.add(sofa);
  const ctable=makeTable();ctable.scale.set(.8,.6,.8);ctable.position.set(ix-5,0,iz+3.3);g.add(ctable);
  g.add(P(mkBox(.5,.06,.3,matte({color:0x33506e})),ix-5.2,.83,iz+3.3));
  g.add(P(makeTv(live),ix-5,0,iz+1.2));
  g.add(P(makeBookshelf(),ix-7.6,0,iz+3.2,Math.PI/2));
  g.add(P(makePlant(),ix-7.1,0,iz+5.1));
  g.add(P(mkCyl(.04,.04,1.05,8,metalM),ix-2.9,.55,iz+4.7));
  g.add(P(new THREE.Mesh(new THREE.ConeGeometry(.34,.42,12),warmLampM),ix-2.9,1.22,iz+4.7));

  // --- bedroom (north-west) ---
  const bed=makeBed();bed.position.set(ix-5,0,iz-4);g.add(bed);
  g.add(P(makeRug(rugBedM,2.6,1.6),ix-5,.03,iz-2.3));
  const ns=makeTable();ns.scale.set(.38,.45,.38);ns.position.set(ix-2.9,0,iz-4.4);g.add(ns);
  g.add(P(mkCyl(.05,.05,.3,8,metalM),ix-2.9,.5,iz-4.4));
  g.add(P(new THREE.Mesh(new THREE.ConeGeometry(.16,.22,12),warmLampM),ix-2.9,.78,iz-4.4));
  g.add(P(makeDresser(),ix-7.4,0,iz-4,Math.PI/2));

  // --- dining (south-east) ---
  g.add(P(makeRug(rugDiningM,2.8,2.4),ix+5,.03,iz+4));
  const dining=makeTable();dining.position.set(ix+5,0,iz+4);g.add(dining);
  g.add(P(mkBox(1.5,.04,1.0,matte({color:0xe8dcc4})),ix+5,.81,iz+4));
  g.add(P(mkCyl(.07,.1,.26,10,matte({color:0x33506e})),ix+5,.94,iz+4));
  for(let k=0;k<3;k++)g.add(P(new THREE.Mesh(new THREE.SphereGeometry(.06,8,6),flowerM),ix+5+(k-1)*.08,1.1,iz+4));
  for(const[dx,dz,ry]of[[0,-.9,0],[0,.9,Math.PI],[-1,0,-Math.PI/2],[1,0,Math.PI/2]]){
    const chair=new THREE.Group();
    chair.add(P(mkBox(.55,.12,.55,woodDoorM),0,.48,0));
    chair.add(P(mkBox(.55,.7,.1,woodDoorM),0,.84,.27));
    for(const sx of[-.2,.2])for(const sz of[-.2,.2])chair.add(P(mkBox(.06,.48,.06,woodDoorM),sx,.24,sz));
    chair.position.set(ix+5+dx,0,iz+4+dz);chair.rotation.y=ry;g.add(chair);
  }
  g.add(P(makeHutch(),ix+6.6,0,iz+5.4,Math.PI));
  g.add(P(makePendant(),ix+5,3.3,iz+4));

  // --- fireplace (east wall), faux windows, wall art ---
  g.add(P(makeFireplace(),ix+7.7,0,iz,-Math.PI/2));
  g.add(P(makeWindow(),ix-5,2.4,iz+5.9,Math.PI));   // living, south
  g.add(P(makeWindow(),ix+3.2,2.4,iz+5.9,Math.PI)); // dining, south
  g.add(P(makeWindow(),ix-5,2.6,iz-5.9));           // bedroom, north
  g.add(P(makeWallArt(artLandscapeM),ix-7.9,2.6,iz,Math.PI/2));
  g.add(P(makeWallArt(artAbstractM,.8,1.0),ix+7.9,2.4,iz+3,-Math.PI/2));
}

// monta tudo no mapa (chamado por js/world.js). Empurra colisões em `solids`.
export function addRanchHouse(solids: {x0:number;x1:number;z0:number;z1:number;h:number}[]): void{
  const cx=RANCH_CX,cz=RANCH_CZ;

  // ===== EXTERIOR: casa de fazenda tradicional (lambris claros, telhado de
  // duas águas, alpendre, chaminé, venezianas e quinas brancas) =====
  const W=12,H=4.6,D=10;               // largura(x), pé-direito, profundidade(z)
  const fz=cz-D/2;                     // face da frente (norte, z menor)
  // alicerce de pedra um pouco mais largo
  const base=new THREE.Mesh(new THREE.BoxGeometry(W+.5,.7,D+.5),concreteM);
  base.position.set(cx,.35,cz);base.receiveShadow=true;scene.add(base);
  // corpo de tábuas
  const body=new THREE.Mesh(new THREE.BoxGeometry(W,H,D),wallM);
  body.position.set(cx,.7+H/2,cz);body.castShadow=true;body.receiveShadow=true;scene.add(body);
  // Tudo que é detalhe preso na casa entra neste grupo. Interior.updateFacade()
  // esconde o grupo quando a câmera fica dentro da pegada da casa ao sair,
  // evitando porta/janelas/alpendre/telhado flutuando sobre a casa invisível.
  const facade=new THREE.Group();scene.add(facade);
  ranchFx.facade=facade;
  ranchFx.footprint={x0:cx-W/2-.4,x1:cx+W/2+.4,z0:cz-D/2-.4,z1:cz+D/2+.4};
  const eaveY=.7+H;                    // altura do beiral (topo da parede)
  // linhas finas de lambril: dão leitura de casa rural sem transformar a
  // fachada em uma caixa lisa.
  for(let y=1.15;y<eaveY-.25;y+=.42){
    for(const z of[fz-.08,cz+D/2+.08]){
      const strip=new THREE.Mesh(new THREE.BoxGeometry(W+.08,.035,.05),sidingM);
      strip.position.set(cx,y,z);facade.add(strip);
    }
    for(const x of[cx-W/2-.08,cx+W/2+.08]){
      const strip=new THREE.Mesh(new THREE.BoxGeometry(.05,.035,D+.08),sidingM);
      strip.position.set(x,y,cz);facade.add(strip);
    }
  }

  // ---- telhado de duas águas (cumeeira no eixo z, frontões à frente/atrás) ----
  const RISE=2.4, OVER=.6;            // altura da cumeeira acima do beiral, beiral saliente
  const half=W/2+OVER, slope=Math.hypot(half,RISE), ang=Math.atan2(RISE,half);
  for(const side of[-1,1]){
    const pane=new THREE.Mesh(new THREE.BoxGeometry(slope,.22,D+OVER*2),roofM);
    pane.position.set(cx+side*half/2,eaveY+RISE/2,cz);
    pane.rotation.z=-side*ang;        // +x para baixo no lado direito; sobe até a cumeeira
    pane.castShadow=true;facade.add(pane);
  }
  // frontões triangulares (fecham o vão sob o telhado, frente e fundo)
  const gable=new THREE.Shape();
  gable.moveTo(-W/2,0);gable.lineTo(W/2,0);gable.lineTo(0,RISE);gable.closePath();
  const gableGeo=new THREE.ShapeGeometry(gable);
  for(const[z,ry]of[[cz-D/2,Math.PI],[cz+D/2,0]]){
    const tri=new THREE.Mesh(gableGeo,wallM);
    tri.position.set(cx,eaveY,z);tri.rotation.y=ry;facade.add(tri);
  }
  const attic=new THREE.Group();
  const atticGlass=new THREE.Mesh(new THREE.CircleGeometry(.42,18),winM);
  atticGlass.position.z=.04;attic.add(atticGlass);
  const atticFrame=new THREE.Mesh(new THREE.TorusGeometry(.46,.045,8,18),whiteM);
  atticFrame.position.z=.07;attic.add(atticFrame);
  attic.position.set(cx,eaveY+1.02,fz-.1);facade.add(attic);
  // tábua de cumeeira escura
  const ridge=new THREE.Mesh(new THREE.BoxGeometry(.18,.18,D+OVER*2),trimM);
  ridge.position.set(cx,eaveY+RISE,cz);facade.add(ridge);

  // ---- chaminé de tijolo numa das águas ----
  const chim=new THREE.Mesh(new THREE.BoxGeometry(1,2.6,1),brickM);
  chim.position.set(cx+3.2,eaveY+1.4,cz+2.5);chim.castShadow=true;facade.add(chim);
  const chimCap=new THREE.Mesh(new THREE.BoxGeometry(1.2,.2,1.2),trimM);
  chimCap.position.set(cx+3.2,eaveY+2.7,cz+2.5);facade.add(chimCap);

  // ---- quinas brancas (cantos verticais) e faixa do beiral ----
  for(const sx of[-1,1])for(const sz of[-1,1]){
    const corner=new THREE.Mesh(new THREE.BoxGeometry(.22,H,.22),whiteM);
    corner.position.set(cx+sx*(W/2-.02),.7+H/2,cz+sz*(D/2-.02));facade.add(corner);
  }
  const fascia=new THREE.Mesh(new THREE.BoxGeometry(W+.1,.2,D+.1),whiteM);
  fascia.position.set(cx,eaveY+.02,cz);facade.add(fascia);

  // ---- porta da frente com moldura e dois degraus ----
  const door=new THREE.Mesh(new THREE.BoxGeometry(1.1,2.4,.14),woodDoorM);
  door.position.set(cx,.7+1.2,fz-.02);facade.add(door);
  for(const[ox,oy,w,h]of[[-.72,1.35,.12,2.72],[.72,1.35,.12,2.72],[0,2.72,1.56,.12]]){
    const dframe=new THREE.Mesh(new THREE.BoxGeometry(w,h,.12),whiteM);
    dframe.position.set(cx+ox,.7+oy,fz-.11);facade.add(dframe);
  }
  const knob=new THREE.Mesh(new THREE.SphereGeometry(.09,10,8),metalM);
  knob.position.set(cx+.36,.7+1.15,fz-.15);facade.add(knob);
  const lantern=new THREE.Mesh(new THREE.SphereGeometry(.13,10,8),warmLampM);
  lantern.position.set(cx-1.0,.7+2.25,fz-.18);facade.add(lantern);
  const lanternCap=new THREE.Mesh(new THREE.BoxGeometry(.22,.08,.12),metalM);
  lanternCap.position.set(cx-1.0,.7+2.43,fz-.18);facade.add(lanternCap);
  for(let s=0;s<2;s++){
    const step=new THREE.Mesh(new THREE.BoxGeometry(2.2-s*.6,.22,.5-s*.0),concreteM);
    step.position.set(cx,.22+s*.24,fz-.55-s*.45);facade.add(step);
  }

  // ---- janelas com moldura branca, cruzeta e venezianas verdes ----
  const addWindow=(wx: number,wz: number,ry: number)=>{
    const pane=new THREE.Mesh(new THREE.PlaneGeometry(1.18,1.05),winM);
    const barV=new THREE.Mesh(new THREE.BoxGeometry(.08,1.1,.07),whiteM);
    const barH=new THREE.Mesh(new THREE.BoxGeometry(1.2,.08,.07),whiteM);
    const g=new THREE.Group();
    pane.position.z=.055;g.add(pane);
    for(const[x,y,w,h]of[[-.68,0,.1,1.32],[.68,0,.1,1.32],[0,.66,1.46,.1],[0,-.66,1.46,.1]]){
      const fr=new THREE.Mesh(new THREE.BoxGeometry(w,h,.08),whiteM);
      fr.position.set(x,y,.075);g.add(fr);
    }
    barV.position.z=.06;barH.position.z=.06;g.add(barV,barH);
    for(const sx of[-.92,.92]){       // venezianas dos lados
      const sh=new THREE.Mesh(new THREE.BoxGeometry(.3,1.3,.08),shutterM);
      sh.position.set(sx,0,0);g.add(sh);
    }
    const box=new THREE.Mesh(new THREE.BoxGeometry(1.35,.16,.22),trimM);
    box.position.set(0,-.88,.12);g.add(box);
    for(const sx of[-.42,0,.42]){
      const fl=new THREE.Mesh(new THREE.SphereGeometry(.08,8,6),flowerM);
      fl.position.set(sx,-.78,.24);g.add(fl);
      const lf=new THREE.Mesh(new THREE.SphereGeometry(.07,8,6),leafAccentM);
      lf.position.set(sx+.08,-.86,.23);g.add(lf);
    }
    g.position.set(wx,.7+2,wz);g.rotation.y=ry;facade.add(g);
  };
  addWindow(cx-3.4,fz-.02,Math.PI);addWindow(cx+3.4,fz-.02,Math.PI); // frente
  addWindow(cx-W/2+.02,cz-2.6,-Math.PI/2);                       // laterais
  addWindow(cx-W/2+.02,cz+2.6,-Math.PI/2);
  addWindow(cx+W/2-.02,cz+2.6,Math.PI/2);

  // ---- alpendre coberto na frente (assoalho, colunas, telhado e guarda-corpo) ----
  const pz=fz-2;                       // profundidade do alpendre pra fora
  const pfloor=new THREE.Mesh(new THREE.BoxGeometry(8,.2,2.4),trimM);
  pfloor.position.set(cx,.7,pz);pfloor.receiveShadow=true;facade.add(pfloor);
  for(const sx of[-3.4,3.4]){
    const col=new THREE.Mesh(new THREE.CylinderGeometry(.12,.14,2.75,10),whiteM);
    col.position.set(cx+sx,.7+1.375,fz-3);col.castShadow=true;facade.add(col);
    // guarda-corpo baixo entre a coluna e a borda
    const rail=new THREE.Mesh(new THREE.BoxGeometry(.1,.7,2.2),whiteM);
    rail.position.set(cx+sx,.7+.5,pz);facade.add(rail);
  }
  for(const sx of[-2.25,2.25]){
    const topRail=new THREE.Mesh(new THREE.BoxGeometry(2.2,.12,.12),whiteM);
    topRail.position.set(cx+sx,.7+1.0,fz-3.08);facade.add(topRail);
    const lowRail=new THREE.Mesh(new THREE.BoxGeometry(2.2,.08,.1),whiteM);
    lowRail.position.set(cx+sx,.7+.48,fz-3.08);facade.add(lowRail);
    for(const bx of[-.8,-.4,0,.4,.8]){
      const bal=new THREE.Mesh(new THREE.BoxGeometry(.07,.52,.08),whiteM);
      bal.position.set(cx+sx+bx,.7+.68,fz-3.08);facade.add(bal);
    }
  }
  const bench=new THREE.Mesh(new THREE.BoxGeometry(1.5,.18,.45),trimM);
  bench.position.set(cx+2.15,1.05,fz-2.25);facade.add(bench);
  for(const lx of[-.55,.55]){
    const leg=new THREE.Mesh(new THREE.BoxGeometry(.1,.45,.1),trimM);
    leg.position.set(cx+2.15+lx,.78,fz-2.25);facade.add(leg);
  }
  // telhadinho inclinado do alpendre
  const proof=new THREE.Mesh(new THREE.BoxGeometry(8.4,.16,3),roofM);
  proof.position.set(cx,.7+2.85,fz-1.55);proof.rotation.x=-.26;proof.castShadow=true;facade.add(proof);
  const ledger=new THREE.Mesh(new THREE.BoxGeometry(8.6,.22,.16),trimM);
  ledger.position.set(cx,.7+2.72,fz-.12);facade.add(ledger);
  const walk=new THREE.Mesh(new THREE.PlaneGeometry(2.4,3.2),concreteM);
  walk.rotation.x=-Math.PI/2;walk.position.set(cx,.035,fz-3.55);walk.receiveShadow=true;scene.add(walk);

  // garagem ao lado oeste (open front pro norte), centrada em (cx-11, cz)
  const gx=GARAGE_PAD.x,gz=GARAGE_PAD.z;
  const gWall=matte({color:0xe7d9bb,roughness:.95});
  // três paredes (fundo + duas laterais), frente aberta pro carro entrar
  const back=new THREE.Mesh(new THREE.BoxGeometry(6,3.4,.3),gWall);
  back.position.set(gx,1.7,gz+3.5);back.castShadow=true;scene.add(back);
  for(const sx of[-3,3]){
    const sw=new THREE.Mesh(new THREE.BoxGeometry(.3,3.4,7),gWall);
    sw.position.set(gx+sx,1.7,gz);sw.castShadow=true;scene.add(sw);
  }
  // verga/lintel no topo da abertura + telhado da garagem
  const lintel=new THREE.Mesh(new THREE.BoxGeometry(6.6,.6,.6),trimM);
  lintel.position.set(gx,3.1,gz-3.5);scene.add(lintel);
  const gRoof=new THREE.Mesh(new THREE.BoxGeometry(7,.3,7.8),roofM);
  gRoof.position.set(gx,3.55,gz);gRoof.castShadow=true;scene.add(gRoof);
  // piso de concreto da garagem (marca a vaga)
  const slab=new THREE.Mesh(new THREE.PlaneGeometry(5.4,7),concreteM);
  slab.rotation.x=-Math.PI/2;slab.position.set(gx,.03,gz);slab.receiveShadow=true;scene.add(slab);

  // placa FOR SALE no quintal, bem onde o gatilho de compra fica (RANCH_SALE).
  // Depois da compra ela some por completo (js/property.js).
  ranchFx.saleSign=makeSign(false);
  ranchFx.saleSign.position.set(RANCH_SALE.x,0,RANCH_SALE.z);scene.add(ranchFx.saleSign);
  ranchFx.soldSign=null;
  // seta quicando na porta (só visível quando comprada — js/property.js)
  ranchFx.facadeArrow=makeDoorArrow();
  ranchFx.facadeArrow.position.set(cx,1.7,cz-6);ranchFx.facadeArrow.visible=false;facade.add(ranchFx.facadeArrow);

  // colisões: corpo da casa + três paredes da garagem (frente aberta)
  solids.push(
    {x0:cx-6,x1:cx+6,z0:cz-5,z1:cz+5,h:5.3},        // casa
    {x0:gx-3,x1:gx+3,z0:gz+3.35,z1:gz+3.65,h:3.4},  // fundo da garagem
    {x0:gx-3.15,x1:gx-2.85,z0:gz-3.5,z1:gz+3.5,h:3.4}, // lateral oeste
    {x0:gx+2.85,x1:gx+3.15,z0:gz-3.5,z1:gz+3.5,h:3.4}, // lateral leste
  );

  // ===== INTERIOR (sala a ~600m, no Group liga/desliga) =====
  const ix=INT_CENTER.x,iz=INT_CENTER.z;
  const shell=new THREE.Mesh(new THREE.BoxGeometry(16,4.4,12),
    matte({color:0xffffff,map:wallTex,side:THREE.BackSide}));
  shell.position.set(ix,2.2,iz);ranchInterior.add(shell);
  const floor=new THREE.Mesh(new THREE.PlaneGeometry(15.6,11.6),floorWoodM);
  floor.rotation.x=-Math.PI/2;floor.position.set(ix,.02,iz);ranchInterior.add(floor);
  const ceil=new THREE.Mesh(new THREE.BoxGeometry(15.7,.08,11.7),
    matte({color:0xf0e6d2,roughness:.95}));
  ceil.position.set(ix,4.36,iz);ranchInterior.add(ceil);
  // vigas aparentes + sanca no topo das paredes (clima de fazenda)
  for(const bz of[iz-4,iz-1.3,iz+1.3,iz+4])
    ranchInterior.add(P(mkBox(15.4,.2,.24,trimM),ix,4.18,bz));
  for(const[x,z,w,d]of[[ix,iz-5.9,15.5,.14],[ix,iz+5.9,15.5,.14],[ix-7.9,iz,.14,11.5],[ix+7.9,iz,.14,11.5]])
    ranchInterior.add(P(mkBox(w,.16,d,whiteM),x,4.05,z));
  // rodapés de madeira nas quatro paredes
  for(const[x,z,w,d]of[
    [ix,iz-5.92,15.6,.12],[ix,iz+5.92,15.6,.12],
    [ix-7.92,iz,.12,11.6],[ix+7.92,iz,.12,11.6],
  ]){
    const baseboard=new THREE.Mesh(new THREE.BoxGeometry(w,.16,d),trimM);
    baseboard.position.set(x,.18,z);ranchInterior.add(baseboard);
  }
  // backstop: se a câmera escapar da casca por um frame, vê escuridão
  const outer=new THREE.Mesh(new THREE.BoxGeometry(20,7,16),
    new THREE.MeshBasicMaterial({color:0x05060a,side:THREE.BackSide}));
  outer.position.set(ix,3.2,iz);ranchInterior.add(outer);

  // toda a mobília (cozinha/sala/quarto/copa, lareira, janelas, quadros, tapetes)
  furnishInterior(ranchInterior,ix,iz,true);

  // luminária central + duas luzes quentes (só existem com a casa visível)
  ranchInterior.add(P(new THREE.Mesh(new THREE.CylinderGeometry(.4,.5,.12,16),whiteM),ix,4.28,iz));
  ranchInterior.add(P(new THREE.Mesh(new THREE.SphereGeometry(.16,10,8),warmLampM),ix,4.12,iz));
  const light=new THREE.PointLight(0xffe6c0,40,38,1.6);
  light.position.set(ix,3.6,iz);ranchInterior.add(light);
  const light2=new THREE.PointLight(0xffe9cc,28,30,1.8); // realça cozinha/lareira
  light2.position.set(ix+4.5,3.4,iz-2);ranchInterior.add(light2);

  // porta de saída (parede oeste) + seta de saída (animada por js/interior.js)
  const exitDoor=new THREE.Mesh(new THREE.BoxGeometry(.16,2.8,1.4),woodDoorM);
  exitDoor.position.set(ix-7.95,1.4,iz);ranchInterior.add(exitDoor);
  ranchFx.exitArrow=makeDoorArrow();
  ranchFx.exitArrow.position.set(ix-7,1.7,iz);ranchInterior.add(ranchFx.exitArrow);

  scene.add(ranchInterior);

  // paredes sólidas do interior (o jogador não atravessa nem sai da sala a pé)
  solids.push(
    {x0:ix-8.3,x1:ix-7.95,z0:iz-6,z1:iz+6,h:4},   // oeste
    {x0:ix+7.95,x1:ix+8.3,z0:iz-6,z1:iz+6,h:4},   // leste
    {x0:ix-8,x1:ix+8,z0:iz-6.3,z1:iz-5.95,h:4},   // norte
    {x0:ix-8,x1:ix+8,z0:iz+5.95,z1:iz+6.3,h:4},   // sul
  );
  // colisão da mobília: o jogador esbarra, não atravessa (corredores ficam livres;
  // spawn, porta e a comida da geladeira ficam em piso aberto)
  solids.push(
    {x0:ix+.4,x1:ix+5.6,z0:iz-5.6,z1:iz-4.4,h:1.1},   // bancada da cozinha
    {x0:ix+6.4,x1:ix+7.95,z0:iz-5,z1:iz-3.8,h:2.2},   // geladeira
    {x0:ix-6.3,x1:ix-3.7,z0:iz+4.4,z1:iz+5.6,h:.9},   // sofá
    {x0:ix-5.6,x1:ix-4.4,z0:iz+2.9,z1:iz+3.7,h:.6},   // mesa de centro
    {x0:ix-5.8,x1:ix-4.2,z0:iz+.7,z1:iz+1.7,h:1.1},   // rack da TV
    {x0:ix-6.1,x1:ix-3.9,z0:iz-5.6,z1:iz-2.5,h:.9},   // cama
    {x0:ix-3.3,x1:ix-2.5,z0:iz-4.8,z1:iz-4,h:.7},     // criado-mudo
    {x0:ix-7.95,x1:ix-7.1,z0:iz-4.8,z1:iz-3.2,h:1.2}, // cômoda
    {x0:ix-7.95,x1:ix-7.3,z0:iz+2.2,z1:iz+4.2,h:2.2}, // estante de livros
    {x0:ix+3.8,x1:ix+6.2,z0:iz+2.8,z1:iz+5.2,h:.9},   // mesa de jantar + cadeiras
    {x0:ix+5.8,x1:ix+7.4,z0:iz+5,z1:iz+5.9,h:2.4},    // cristaleira
    {x0:ix+7.2,x1:ix+7.95,z0:iz-.8,z1:iz+.8,h:1.5},   // lareira
  );
}

// Padrão de modelo: descriptor pro model-viewer (descoberta automática).
// Preview fiel ao exterior: fundação, gable roof, varanda, janelas e garagem.
function buildExteriorPreview(): THREE.Group{
  const g=new THREE.Group(),W=12,H=4.6,D=10,RISE=2.4,OVER=.6,fz=-D/2,eaveY=.7+H;
  const base=new THREE.Mesh(new THREE.BoxGeometry(W+.5,.7,D+.5),concreteM);
  base.position.y=.35;g.add(base);
  const body=new THREE.Mesh(new THREE.BoxGeometry(W,H,D),wallM);
  body.position.y=.7+H/2;g.add(body);
  for(let y=1.15;y<eaveY-.25;y+=.42){
    for(const z of[fz-.08,D/2+.08]){
      const strip=new THREE.Mesh(new THREE.BoxGeometry(W+.08,.035,.05),sidingM);
      strip.position.set(0,y,z);g.add(strip);
    }
  }
  const half=W/2+OVER,slope=Math.hypot(half,RISE),ang=Math.atan2(RISE,half);
  for(const s of[-1,1]){
    const p=new THREE.Mesh(new THREE.BoxGeometry(slope,.22,D+OVER*2),roofM);
    p.position.set(s*half/2,eaveY+RISE/2,0);p.rotation.z=-s*ang;g.add(p);
  }
  const gable=new THREE.Shape();
  gable.moveTo(-W/2,0);gable.lineTo(W/2,0);gable.lineTo(0,RISE);gable.closePath();
  for(const[z,ry]of[[-D/2,Math.PI],[D/2,0]]){
    const tri=new THREE.Mesh(new THREE.ShapeGeometry(gable),wallM);
    tri.position.set(0,eaveY,z);tri.rotation.y=ry;g.add(tri);
  }
  const ridge=new THREE.Mesh(new THREE.BoxGeometry(.18,.18,D+OVER*2),trimM);
  ridge.position.set(0,eaveY+RISE,0);g.add(ridge);
  const chim=new THREE.Mesh(new THREE.BoxGeometry(1,2.6,1),brickM);
  chim.position.set(3.2,eaveY+1.4,2.5);g.add(chim);
  const door=new THREE.Mesh(new THREE.BoxGeometry(1.1,2.4,.14),woodDoorM);
  door.position.set(0,.7+1.2,fz-.1);g.add(door);
  for(const[ox,oy,w,h]of[[-.72,1.35,.12,2.72],[.72,1.35,.12,2.72],[0,2.72,1.56,.12]]){
    const fr=new THREE.Mesh(new THREE.BoxGeometry(w,h,.12),whiteM);
    fr.position.set(ox,.7+oy,fz-.18);g.add(fr);
  }
  const addWin=(x: number)=>{
    const wg=new THREE.Group();
    const pane=new THREE.Mesh(new THREE.PlaneGeometry(1.18,1.05),winM);pane.position.z=.055;wg.add(pane);
    for(const[wx,wy,w,h]of[[-.68,0,.1,1.32],[.68,0,.1,1.32],[0,.66,1.46,.1],[0,-.66,1.46,.1]]){
      const fr=new THREE.Mesh(new THREE.BoxGeometry(w,h,.08),whiteM);fr.position.set(wx,wy,.075);wg.add(fr);
    }
    const shL=new THREE.Mesh(new THREE.BoxGeometry(.3,1.3,.08),shutterM);shL.position.x=-.92;wg.add(shL);
    const shR=new THREE.Mesh(new THREE.BoxGeometry(.3,1.3,.08),shutterM);shR.position.x=.92;wg.add(shR);
    wg.position.set(x,.7+2,fz-.02);wg.rotation.y=Math.PI;g.add(wg);
  };
  addWin(-3.4);addWin(3.4);
  const porch=new THREE.Mesh(new THREE.BoxGeometry(8,.2,2.4),trimM);
  porch.position.set(0,.7,fz-2);g.add(porch);
  for(const sx of[-3.4,3.4]){
    const col=new THREE.Mesh(new THREE.CylinderGeometry(.12,.14,2.75,10),whiteM);
    col.position.set(sx,2.075,fz-3);g.add(col);
  }
  const proof=new THREE.Mesh(new THREE.BoxGeometry(8.4,.16,3),roofM);
  proof.position.set(0,3.55,fz-1.55);proof.rotation.x=-.26;g.add(proof);
  const ledger=new THREE.Mesh(new THREE.BoxGeometry(8.6,.22,.16),trimM);
  ledger.position.set(0,3.42,fz-.12);g.add(ledger);
  const garage=new THREE.Group();
  for(const[sx,sz,w,d]of[[0,3.5,6,.3],[-3,0,.3,7],[3,0,.3,7]]){
    const wall=new THREE.Mesh(new THREE.BoxGeometry(w,3.4,d),wallM);
    wall.position.set(sx,1.7,sz);garage.add(wall);
  }
  const gr=new THREE.Mesh(new THREE.BoxGeometry(7,.3,7.8),roofM);
  gr.position.set(0,3.55,0);garage.add(gr);
  garage.position.set(-11,0,0);g.add(garage);
  return g;
}

// Preview do interior em corte aberto: mostra a sala sem depender da sala real
// off-map, e deixa o model-viewer girar sem paredes bloqueando tudo.
function buildInteriorPreview(): THREE.Group{
  const g=new THREE.Group(),ix=0,iz=0;
  const floor=new THREE.Mesh(new THREE.PlaneGeometry(15.6,11.6),floorWoodM);
  floor.rotation.x=-Math.PI/2;floor.position.set(ix,.02,iz);g.add(floor);
  const wallMat=matte({color:0xffffff,map:wallTex});
  for(const[x,z,w,d]of[
    [ix,iz-5.95,15.6,.18],
    [ix-7.9,iz,.18,11.6],
    [ix,iz+5.95,15.6,.18],
  ]){
    const wall=new THREE.Mesh(new THREE.BoxGeometry(w,3.6,d),wallMat);
    wall.position.set(x,1.8,z);g.add(wall);
  }
  for(const[x,z,w,d]of[
    [ix,iz-5.78,15.5,.12],
    [ix-7.78,iz,.12,11.3],
    [ix,iz+5.78,15.5,.12],
  ]){
    const baseboard=new THREE.Mesh(new THREE.BoxGeometry(w,.16,d),trimM);
    baseboard.position.set(x,.18,z);g.add(baseboard);
  }

  furnishInterior(g,ix,iz,false);
  const exitDoor=new THREE.Mesh(new THREE.BoxGeometry(.16,2.8,1.4),woodDoorM);
  exitDoor.position.set(ix-7.92,1.4,iz);g.add(exitDoor);
  return g;
}

export default {category:'Rural',label:'Ranch house',build:buildExteriorPreview,
  variants:[
    {label:'Ranch house - exterior',build:buildExteriorPreview,zoom:.58,yaw:Math.PI},
    {label:'Ranch house - interior',build:buildInteriorPreview,zoom:.62},
  ]};
