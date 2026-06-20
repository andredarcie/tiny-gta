import * as THREE from 'three';
import {matte} from '../matte.js';
import {scene} from '@/core/engine.js';
import {rand} from '@/core/constants.js';
import {makePed} from '../characters/pedestrian.js';
import {makeDoorArrow} from './door-arrow.js';

// Hospital "SANTA CASA", no mesmo molde da boate/academia: prédio num quarteirão
// reservado pelo world.js, interior separado a ~600m do mapa num Group
// visible=false. É pra onde o jogador é levado quando morre (js/player.js), e
// tem um kit de cura no centro pra quando ele entrar ferido. Ver js/hospital.js.

export const HOSP_I=6,HOSP_J=6; // quarteirão reservado (sudeste da cidade)

// porta externa (fachada oeste, de frente pra rua) e spawn de saída
export const HOSP_DOOR={x:101.4,z:110};
export const HOSP_SPAWN_OUT={x:99.4,z:110};
// interior: centro da sala, porta de saída e spawn (leito) de entrada/acordar.
// z=180 (não -380): mantém a sala BEM dentro do domo do céu (esfera raio 900
// na origem). Em z=-380 a parede oeste ficava em raio ~897 e o céu (azul,
// fog:false) atravessava a porta de saída. As outras salas ficam em z=-22/-200.
export const INT_CENTER={x:-800,z:180};
export const INT_DOOR={x:-812.2,z:180};
export const INT_SPAWN={x:-810.4,z:180};  // entrada normal: ao lado da porta, olhando pra dentro
export const HOSP_BED={x:-800,z:180};     // morte: acorda no meio da sala (ver js/hospital.js)
export const INT_BOUNDS={x0:-812.3,x1:-787.7,z0:172.7,z1:187.3,y1:4.9};
// kit de cura no meio da sala (cruz verde): cura quem entra ferido
export const HOSP_HEAL={x:-801,z:176};

// ---------------------------------------------------------------------------
// Material palette (all matte/Lambert except the unlit glows/screens). Shared
// at module scope so re-entering the room never re-allocates.
// ---------------------------------------------------------------------------
const whiteM=matte({color:0xeef2f4,roughness:.92});       // exterior block
const greenM=new THREE.MeshBasicMaterial({color:0x35d47a});// crosses / signage glow / floor guide
const tealM=matte({color:0x2aa6a0,roughness:.6});          // accent teal
const darkM=matte({color:0x1a2226,roughness:.85});         // dark trim / casters
const metalM=matte({color:0xb8c0c6,metalness:.6,roughness:.4});
const chromeM=matte({color:0xd2dade,roughness:.3});        // bed rails / bright metal
const bedM=matte({color:0xf4f6f7,roughness:.7});           // mattress / linen
const sheetM=matte({color:0x6fb8c9,roughness:.85});        // teal blanket
const wallM=matte({color:0xe9eef0,roughness:1});           // interior wall
const wainM=matte({color:0xd2e0e3,roughness:1});           // lower wainscot band
const baseM=matte({color:0x9aa7ad,roughness:1});           // baseboard
const cartM=matte({color:0xd23b3b,roughness:.5});          // crash cart red
const cartTrimM=matte({color:0x8f2626,roughness:.6});
const yellowM=matte({color:0xf2c200,roughness:.5});        // defibrillator
const plasticM=matte({color:0x232c31,roughness:.6});       // monitor / wheelchair shells
const glassM=matte({color:0xbfe0e6,transparent:true,opacity:.4});
const curtM=matte({color:0x9fd0cf,transparent:true,opacity:.55,roughness:.9});
const screenM=new THREE.MeshBasicMaterial({color:0x35d47a});
const panelM=new THREE.MeshBasicMaterial({color:0xf0fbff}); // emissive ceiling light panel
const glowM=new THREE.MeshBasicMaterial({color:0x35d47a,transparent:true,opacity:.16,depthWrite:false});

const mkBox=(w:number,h:number,d:number,mat:THREE.Material):THREE.Mesh=>new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);
const mkCyl=(rt:number,rb:number,h:number,seg:number,mat:THREE.Material):THREE.Mesh=>new THREE.Mesh(new THREE.CylinderGeometry(rt,rb,h,seg),mat);

// ---------------------------------------------------------------------------
// Canvas textures (drawn once, sRGB like the rest of the project's textures).
// ---------------------------------------------------------------------------
function tex(w:number,h:number,draw:(x:CanvasRenderingContext2D,w:number,h:number)=>void):THREE.CanvasTexture{
  const c=document.createElement('canvas');c.width=w;c.height=h;
  draw(c.getContext('2d')!,w,h);
  const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;
  return t;
}

function signTexture():THREE.CanvasTexture{
  return tex(512,128,(x,w,h)=>{
    x.textAlign='center';x.textBaseline='middle';
    x.font='900 50px monospace';
    x.shadowColor='#35d47a';x.shadowBlur=22;
    x.fillStyle='#dffbe9';
    for(let k=0;k<3;k++)x.fillText('HOSPITAL',256,64); // extra passes = glow
  });
}

// Clinical vinyl floor: speckled tiles with grout lines (tiled via repeat).
const floorTex=tex(256,256,(x,w,h)=>{
  x.fillStyle='#ccd7da';x.fillRect(0,0,w,h);
  for(let i=0;i<1600;i++){
    const g=120+((i*53)%90);
    x.fillStyle=`rgba(${g},${g+10},${g+12},.35)`;
    x.fillRect((i*97)%w,(i*131)%h,2,2);
  }
  x.strokeStyle='rgba(108,124,130,.55)';x.lineWidth=2;
  for(let i=0;i<=w;i+=64){x.beginPath();x.moveTo(i,0);x.lineTo(i,h);x.moveTo(0,i);x.lineTo(w,i);x.stroke();}
});
floorTex.wrapS=floorTex.wrapT=THREE.RepeatWrapping;floorTex.repeat.set(8,5);
const floorM=matte({color:0xffffff,map:floorTex});

// Heart monitor screen: green ECG trace + vitals on a faint grid.
const ekgM=new THREE.MeshBasicMaterial({map:tex(256,128,(x,w,h)=>{
  x.fillStyle='#04140c';x.fillRect(0,0,w,h);
  x.strokeStyle='rgba(60,200,120,.16)';x.lineWidth=1;
  for(let i=0;i<w;i+=16){x.beginPath();x.moveTo(i,0);x.lineTo(i,h);x.stroke();}
  for(let j=0;j<h;j+=16){x.beginPath();x.moveTo(0,j);x.lineTo(w,j);x.stroke();}
  const base=h*0.62;
  x.strokeStyle='#46f08a';x.lineWidth=3;x.shadowColor='#46f08a';x.shadowBlur=8;
  x.beginPath();x.moveTo(0,base);
  for(let bx=0;bx<2;bx++){
    const o=bx*128;
    x.lineTo(o+40,base);x.lineTo(o+48,base-6);x.lineTo(o+54,base+4); // P
    x.lineTo(o+62,base);x.lineTo(o+70,base+10);x.lineTo(o+76,base-48); // QRS
    x.lineTo(o+82,base+18);x.lineTo(o+90,base);x.lineTo(o+104,base-12);x.lineTo(o+116,base); // T
    x.lineTo(o+128,base);
  }
  x.stroke();x.shadowBlur=0;
  x.fillStyle='#7fffb0';x.font='bold 18px monospace';x.textAlign='left';x.fillText('HR 72',8,20);
  x.fillStyle='#9fd2ff';x.fillText('SpO2 98',w-92,20);
})});

// Reusable poster/sign: bold title (+optional subtitle) framed on a flat panel.
// Canvas is sized per-sign (W,H); text is clamped with maxWidth so it never
// bleeds past the frame, and each is rendered on a plane of the SAME aspect
// ratio (W:H) so nothing stretches.
function poster(title:string,sub:string,bg:string,fg:string,W=256,H=160):THREE.MeshBasicMaterial{
  return new THREE.MeshBasicMaterial({map:tex(W,H,(x,w,h)=>{
    x.fillStyle=bg;x.fillRect(0,0,w,h);
    x.strokeStyle=fg;x.lineWidth=Math.max(6,h*.05);x.strokeRect(8,8,w-16,h-16);
    x.fillStyle=fg;x.textAlign='center';x.textBaseline='middle';
    x.font=`900 ${Math.floor(h*(sub?.30:.42))}px sans-serif`;
    x.fillText(title,w/2,sub?h*.4:h/2,w-40);          // maxWidth clamps overflow
    if(sub){x.font=`700 ${Math.floor(h*.16)}px sans-serif`;x.fillText(sub,w/2,h*.72,w-40);}
  })});
}
const emergM=poster('EMERGENCY','THIS WAY','#d23b3b','#ffffff',256,160);
const pharmM=poster('PHARMACY','','#1f7a76','#eafcf6',256,160);
const recepM=poster('RECEPTION','','#0e2b2a','#7fe9df',512,160);
const exitSignM=poster('EXIT','','#0d1a10','#35d47a',384,128);

// Snellen eye chart for the wall.
const eyeChartM=new THREE.MeshBasicMaterial({map:tex(180,256,(x,w,h)=>{
  x.fillStyle='#f6f8f6';x.fillRect(0,0,w,h);
  x.fillStyle='#15202a';x.textAlign='center';x.textBaseline='middle';
  const rows:[string,number][]=[['E',58],['F P',42],['T O Z',30],['L P E D',22],['F E C F D',16],['E D F C Z P',12]];
  let y=36;
  for(const[s,sz]of rows){x.font=`900 ${sz}px monospace`;x.fillText(s,w/2,y,w-16);y+=sz+12;}
})});

// Analog wall clock face (~10:10).
const clockM=new THREE.MeshBasicMaterial({map:tex(128,128,(x)=>{
  x.fillStyle='#f4f7f8';x.beginPath();x.arc(64,64,60,0,Math.PI*2);x.fill();
  x.strokeStyle='#1a2226';x.lineWidth=4;x.stroke();
  x.fillStyle='#1a2226';
  for(let i=0;i<12;i++){const a=i/12*Math.PI*2;x.beginPath();x.arc(64+Math.cos(a)*50,64+Math.sin(a)*50,3,0,Math.PI*2);x.fill();}
  x.lineWidth=4;x.beginPath();x.moveTo(64,64);x.lineTo(64+Math.cos(-2.2)*30,64+Math.sin(-2.2)*30);x.stroke();
  x.lineWidth=3;x.beginPath();x.moveTo(64,64);x.lineTo(64+Math.cos(-1.1)*42,64+Math.sin(-1.1)*42);x.stroke();
  x.fillStyle='#d23b3b';x.beginPath();x.arc(64,64,4,0,Math.PI*2);x.fill();
})});

// Cruz médica (dois braços), reutilizada na fachada e como kit de cura
function makeCross(s=1,mat:THREE.Material=greenM):THREE.Group{
  const g=new THREE.Group();
  const a=new THREE.Mesh(new THREE.BoxGeometry(.9*s,.3*s,.12*s),mat);
  const b=new THREE.Mesh(new THREE.BoxGeometry(.3*s,.9*s,.12*s),mat);
  g.add(a,b);
  return g;
}

export const hospFx:{sign:THREE.Mesh|null,exitArrow:THREE.Mesh|null,heal:THREE.Group|null,peds:any[],sickPatient:any,facade:THREE.Group|null,facadeArrow:THREE.Mesh|null,footprint:{x0:number,x1:number,z0:number,z1:number}|null}={sign:null,exitArrow:null,heal:null,peds:[],sickPatient:null,
  facade:null,facadeArrow:null,footprint:null};

// IV drip stand (pole, bag, drip chamber, tube)
function makeIvStand():THREE.Group{
  const g=new THREE.Group();
  const pole=mkCyl(.025,.025,2,8,metalM);pole.position.y=1;g.add(pole);
  const hook=mkBox(.18,.03,.03,metalM);hook.position.set(.08,1.95,0);g.add(hook);
  const foot=mkCyl(.22,.22,.04,10,metalM);foot.position.y=.02;g.add(foot);
  const bag=mkBox(.16,.32,.05,matte({color:0xe8f4d8,transparent:true,opacity:.85}));
  bag.position.set(.12,1.7,0);g.add(bag);
  const tube=mkCyl(.008,.008,.9,5,matte({color:0xcfe6ee,transparent:true,opacity:.7}));
  tube.position.set(.12,1.2,0);g.add(tube);
  return g;
}
// Rolling heart monitor with an ECG screen
function makeMonitor():THREE.Group{
  const g=new THREE.Group();
  const pole=mkCyl(.04,.04,1.1,8,metalM);pole.position.y=.55;g.add(pole);
  const foot=mkCyl(.18,.2,.05,12,metalM);foot.position.y=.03;g.add(foot);
  const box=mkBox(.5,.4,.18,plasticM);box.position.y=1.3;g.add(box);
  const bezel=mkBox(.44,.34,.02,matte({color:0x0a0f12}));bezel.position.set(0,1.3,.09);g.add(bezel);
  const screen=new THREE.Mesh(new THREE.PlaneGeometry(.38,.28),ekgM);screen.position.set(0,1.3,.101);g.add(screen);
  for(let i=0;i<3;i++){const b=mkBox(.04,.04,.02,greenM);b.position.set(-.15+i*.08,1.07,.09);g.add(b);}
  return g;
}
// Waiting-room chair
function makeChair():THREE.Group{
  const g=new THREE.Group();
  const seat=mkBox(.5,.1,.5,tealM);seat.position.y=.45;g.add(seat);
  const back=mkBox(.5,.55,.1,tealM);back.position.set(0,.72,-.2);g.add(back);
  for(const[sx,sz]of[[-.2,-.2],[.2,-.2],[-.2,.2],[.2,.2]]){
    const leg=mkBox(.06,.45,.06,metalM);leg.position.set(sx,.22,sz);g.add(leg);
  }
  return g;
}
// Crash cart with stacked drawers + defibrillator on top
function makeCrashCart():THREE.Group{
  const g=new THREE.Group();
  const body=mkBox(.6,.86,.45,cartM);body.position.y=.5;g.add(body);
  for(let i=0;i<4;i++){
    const d=mkBox(.58,.02,.46,cartTrimM);d.position.set(0,.28+i*.18,0);g.add(d);
    const handle=mkBox(.22,.02,.02,metalM);handle.position.set(0,.33+i*.18,.23);g.add(handle);
  }
  const top=mkBox(.66,.04,.5,metalM);top.position.y=.95;g.add(top);
  const defib=mkBox(.34,.16,.26,yellowM);defib.position.set(0,1.05,0);g.add(defib);
  const dscreen=new THREE.Mesh(new THREE.PlaneGeometry(.18,.1),screenM);dscreen.position.set(0,1.1,.131);g.add(dscreen);
  for(const[sx,sz]of[[-.25,-.18],[.25,-.18],[-.25,.18],[.25,.18]]){
    const c=mkCyl(.05,.05,.05,8,darkM);c.rotation.z=Math.PI/2;c.position.set(sx,.05,sz);g.add(c);
  }
  return g;
}
// Wheelchair
function makeWheelchair():THREE.Group{
  const g=new THREE.Group();
  const seat=mkBox(.5,.06,.5,plasticM);seat.position.y=.5;g.add(seat);
  const back=mkBox(.5,.55,.06,plasticM);back.position.set(0,.78,-.22);g.add(back);
  for(const sx of[-.3,.3]){
    const w=mkCyl(.3,.3,.04,16,darkM);w.rotation.z=Math.PI/2;w.position.set(sx,.3,-.05);g.add(w);
    const rim=mkCyl(.24,.24,.05,16,chromeM);rim.rotation.z=Math.PI/2;rim.position.set(sx*1.06,.3,-.05);g.add(rim);
  }
  for(const sx of[-.22,.22]){const w=mkCyl(.09,.09,.04,10,darkM);w.rotation.z=Math.PI/2;w.position.set(sx,.09,.28);g.add(w);}
  for(const sx of[-.27,.27]){const a=mkBox(.04,.05,.5,metalM);a.position.set(sx,.66,0);g.add(a);}
  const foot=mkBox(.4,.04,.12,metalM);foot.position.set(0,.16,.34);g.add(foot);
  return g;
}
// Potted plant for the corners
function makePlant():THREE.Group{
  const g=new THREE.Group();
  const pot=mkCyl(.18,.14,.4,10,matte({color:0x6b5440}));pot.position.y=.2;g.add(pot);
  const soil=mkCyl(.16,.16,.04,10,darkM);soil.position.y=.4;g.add(soil);
  const leafM=matte({color:0x2f8f4e,roughness:.9});
  for(let i=0;i<8;i++){
    const a=i/8*Math.PI*2;
    const leaf=mkBox(.06,.7,.18,leafM);
    leaf.position.set(Math.cos(a)*.12,.78,Math.sin(a)*.12);
    leaf.rotation.set(Math.cos(a)*.5,a,Math.sin(a)*.5);
    g.add(leaf);
  }
  return g;
}
// Water cooler
function makeWaterCooler():THREE.Group{
  const g=new THREE.Group();
  const body=mkBox(.4,1,.4,bedM);body.position.y=.5;g.add(body);
  const bottle=mkCyl(.18,.2,.45,12,matte({color:0x9fd4ea,transparent:true,opacity:.7}));bottle.position.y=1.25;g.add(bottle);
  const tap=mkBox(.12,.12,.08,tealM);tap.position.set(0,.7,.22);g.add(tap);
  return g;
}
// Supply shelving with colored bins
function makeShelf():THREE.Group{
  const g=new THREE.Group();
  const back=mkBox(1.6,2,.06,wallM);back.position.set(0,1,-.18);g.add(back);
  const binCol=[0x35d47a,0x4aa3e0,0xe0a83a,0xd23b3b];
  for(let i=0;i<4;i++){
    const sh=mkBox(1.6,.05,.44,bedM);sh.position.set(0,.4+i*.5,0);g.add(sh);
    for(let j=0;j<3;j++){
      const bin=mkBox(.42,.28,.34,matte({color:binCol[(i+j)%4]}));
      bin.position.set(-.5+j*.5,.58+i*.5,0);g.add(bin);
    }
  }
  return g;
}
// Overbed rolling tray table
function makeOverbedTable():THREE.Group{
  const g=new THREE.Group();
  const top=mkBox(.7,.04,.4,bedM);top.position.y=1;g.add(top);
  const post=mkCyl(.03,.03,1,6,metalM);post.position.set(-.26,.5,0);g.add(post);
  const base=mkBox(.5,.04,.42,metalM);base.position.set(-.26,.04,.18);g.add(base);
  const cup=mkCyl(.05,.04,.1,8,bedM);cup.position.set(.12,1.07,0);g.add(cup);
  return g;
}
// Wall poster mesh (a framed plane flush to a wall)
function wallPoster(mat:THREE.Material,w:number,h:number,x:number,y:number,z:number,ry:number):THREE.Mesh{
  const p=new THREE.Mesh(new THREE.PlaneGeometry(w,h),mat);
  p.position.set(x,y,z);p.rotation.y=ry;return p;
}

export const hospInterior=new THREE.Group();
hospInterior.visible=false;

export function addHospital(solids:{x0:number,x1:number,z0:number,z1:number,h:number}[]):void{
  const cx=110,cz=110; // centro do prédio no quarteirão (6,6)

  // ----- exterior: bloco branco com faixa teal, marquise e cruz verde -----
  const bld=new THREE.Mesh(new THREE.BoxGeometry(16,7,16),whiteM);
  bld.position.set(cx,3.5,cz);bld.castShadow=true;bld.receiveShadow=true;scene.add(bld);
  const roof=new THREE.Mesh(new THREE.BoxGeometry(16.2,.25,16.2),darkM);
  roof.position.set(cx,7.1,cz);scene.add(roof);
  const band=new THREE.Mesh(new THREE.BoxGeometry(16.3,.5,16.3),tealM);
  band.position.set(cx,5.4,cz);scene.add(band);

  // Objetos da PORTA num grupo 'facade' que js/interior.js esconde quando a
  // câmera entra na pegada do prédio (senão flutuam ao sair). O corpo (caixa)
  // some sozinho por culling. Ver hospFx.facade/footprint/facadeArrow.
  const facade=new THREE.Group();
  // porta dupla na fachada oeste (x menor)
  const door=new THREE.Mesh(new THREE.BoxGeometry(.18,3.2,2.6),
    matte({color:0x2a3338,roughness:.7}));
  door.position.set(cx-8.02,1.6,cz);facade.add(door);
  // marquise sobre a entrada com colunas
  const canopy=new THREE.Mesh(new THREE.BoxGeometry(2.6,.18,4.4),tealM);
  canopy.position.set(cx-9.3,3.3,cz);canopy.castShadow=true;facade.add(canopy);
  for(const dz of[-1.9,1.9]){
    const pole=new THREE.Mesh(new THREE.CylinderGeometry(.06,.06,3.2,6),whiteM);
    pole.position.set(cx-10.4,1.6,cz+dz);facade.add(pole);
  }
  // cruz verde grande de fachada acima da porta
  const logo=makeCross(3.2,greenM);
  logo.position.set(cx-8.12,4.5,cz);logo.rotation.y=-Math.PI/2;facade.add(logo);
  // letreiro virado pra rua
  hospFx.sign=new THREE.Mesh(new THREE.PlaneGeometry(9,2.3),
    new THREE.MeshBasicMaterial({map:signTexture(),transparent:true}));
  hospFx.sign.position.set(cx-8.13,6,cz);hospFx.sign.rotation.y=-Math.PI/2;facade.add(hospFx.sign);
  // seta quicando na entrada (mesh próprio, no grupo; animada por js/interior.js)
  hospFx.facadeArrow=makeDoorArrow();
  hospFx.facadeArrow.position.set(cx-9.3,1.7,cz);facade.add(hospFx.facadeArrow);
  scene.add(facade);
  hospFx.facade=facade;
  hospFx.footprint={x0:cx-8.2,x1:cx+8.2,z0:cz-8.2,z1:cz+8.2};
  solids.push({x0:cx-8.2,x1:cx+8.2,z0:cz-8.2,z1:cz+8.2,h:7.2});

  // ======================================================================
  // INTERIOR — sala 26x16 a ~600m do mapa, num grupo liga/desliga.
  // Room spans x[-813..-787], z[172..188]; floor y=0; ceiling shell at y=5.5.
  // ======================================================================
  const shell=new THREE.Mesh(new THREE.BoxGeometry(26,5.5,16),
    matte({color:0xeef3f5,side:THREE.BackSide}));
  shell.position.set(-800,2.75,180);hospInterior.add(shell);
  const floor=new THREE.Mesh(new THREE.PlaneGeometry(25.4,15.4),floorM);
  floor.rotation.x=-Math.PI/2;floor.position.set(-800,.02,180);hospInterior.add(floor);
  // drop ceiling + recessed light panels (the panels read as fixtures, no cost)
  const ceil=new THREE.Mesh(new THREE.PlaneGeometry(25.4,15.4),matte({color:0xeaf0f2}));
  ceil.rotation.x=Math.PI/2;ceil.position.set(-800,4.7,180);hospInterior.add(ceil);
  for(const px of[-806,-800,-794])for(const pz of[177,183]){
    const p=new THREE.Mesh(new THREE.PlaneGeometry(2.6,1.3),panelM);
    p.rotation.x=Math.PI/2;p.position.set(px,4.66,pz);hospInterior.add(p);
    const fr=mkBox(2.8,.06,1.5,metalM);fr.position.set(px,4.72,pz);hospInterior.add(fr);
  }
  // backstop: se a câmera escapar da casca por um frame, vê escuridão
  const outer=new THREE.Mesh(new THREE.BoxGeometry(30,9,20),
    new THREE.MeshBasicMaterial({color:0x05060a,side:THREE.BackSide}));
  outer.position.set(-800,3.5,180);hospInterior.add(outer);

  // ----- wall trim: baseboard, wainscot band, teal stripe -----
  const place=(mesh:THREE.Object3D,x:number,y:number,z:number):void=>{mesh.position.set(x,y,z);hospInterior.add(mesh);};
  for(const z of[172.25,187.75]){
    place(mkBox(25.4,.18,.04,baseM),-800,.1,z);
    place(mkBox(25.4,1,.03,wainM),-800,.7,z);
    place(mkBox(25.6,.12,.05,tealM),-800,2.2,z);
  }
  for(const x of[-812.7,-787.3]){
    place(mkBox(.04,.18,15.4,baseM),x,.1,180);
    place(mkBox(.03,1,15.4,wainM),x,.7,180);
  }

  // ----- floor wayfinding line: green guide toward the heal kit -----
  // starts east of the waiting chairs so it never runs under them
  const gx=mkBox(7,.02,.16,greenM);gx.position.set(-804.5,.03,180);hospInterior.add(gx);
  const gz=mkBox(.16,.02,4.2,greenM);gz.position.set(-801,.03,178);hospInterior.add(gz);

  // ----- three beds against the south wall: rails, head/footboard, blanket -----
  const bedX=[-806,-801,-796];
  for(let k=0;k<3;k++){
    const x=bedX[k];
    for(const[dx,dz]of[[-.5,-1.05],[.5,-1.05],[-.5,1.05],[.5,1.05]]){
      const c=mkCyl(.06,.06,.06,8,darkM);c.rotation.z=Math.PI/2;c.position.set(x+dx,.08,185.6+dz);hospInterior.add(c);
    }
    const frame=mkBox(1.2,.5,2.4,metalM);frame.position.set(x,.5,185.6);hospInterior.add(frame);
    const mat=mkBox(1.1,.18,2.2,bedM);mat.position.set(x,.78,185.6);hospInterior.add(mat);
    const blanket=mkBox(1.14,.13,1.05,sheetM);blanket.position.set(x,.95,184.95);hospInterior.add(blanket);
    const pillow=mkBox(.9,.18,.5,bedM);pillow.position.set(x,.95,186.5);hospInterior.add(pillow);
    const headboard=mkBox(1.18,.7,.08,bedM);headboard.position.set(x,1,186.85);hospInterior.add(headboard);
    const footboard=mkBox(1.18,.45,.08,metalM);footboard.position.set(x,.75,184.42);hospInterior.add(footboard);
    for(const sx of[-.6,.6]){
      const rail=mkBox(.04,.04,1.5,chromeM);rail.position.set(x+sx,1.02,185.5);hospInterior.add(rail);
      for(const rz of[-.7,.7]){const post=mkBox(.04,.28,.04,chromeM);post.position.set(x+sx,.92,185.5+rz);hospInterior.add(post);}
    }
    // cortina divisória entre os leitos (trilho + pano)
    if(k<2){
      const curtain=mkBox(.05,2,2.2,curtM);curtain.position.set(x+2,2,185.6);hospInterior.add(curtain);
      const rail=mkBox(.06,.06,2.4,metalM);rail.position.set(x+2,3,185.6);hospInterior.add(rail);
    }
    if(k!==1){ // leitos das pontas: soro + monitor + mesa de apoio
      const iv=makeIvStand();iv.position.set(x-.7,0,184.4);hospInterior.add(iv);
      const mon=makeMonitor();mon.position.set(x+.7,0,184.4);hospInterior.add(mon);
      const tbl=makeOverbedTable();tbl.position.set(x,0,183.4);hospInterior.add(tbl);
    }
  }

  // ----- reception desk (north wall): counter, monitor, chair, lamp, sign -----
  const desk=mkBox(6,1.1,1.2,tealM);desk.position.set(-800,.55,174.6);hospInterior.add(desk);
  const deskTop=mkBox(6.2,.1,1.4,bedM);deskTop.position.set(-800,1.12,174.6);hospInterior.add(deskTop);
  const deskCross=makeCross(.8,greenM);deskCross.position.set(-800,2.2,172.4);hospInterior.add(deskCross);
  const mon=mkBox(.5,.34,.05,plasticM);mon.position.set(-800.6,1.45,174.3);hospInterior.add(mon);
  const monScr=new THREE.Mesh(new THREE.PlaneGeometry(.42,.26),screenM);monScr.position.set(-800.6,1.45,174.23);monScr.rotation.y=Math.PI;hospInterior.add(monScr);
  const kbd=mkBox(.46,.03,.16,darkM);kbd.position.set(-800.6,1.18,174.9);hospInterior.add(kbd);
  const lamp=mkCyl(.02,.02,.4,6,darkM);lamp.position.set(-802.4,1.35,174.4);lamp.rotation.z=.5;hospInterior.add(lamp);
  const lampHead=mkBox(.14,.08,.14,tealM);lampHead.position.set(-802.55,1.5,174.4);hospInterior.add(lampHead);
  // office chair behind the desk
  const chSeat=mkBox(.5,.08,.5,plasticM); chSeat.position.set(-800,.5,173.6);hospInterior.add( chSeat);
  const chBack=mkBox(.5,.55,.07,plasticM);chBack.position.set(-800,.8,173.35);hospInterior.add( chBack);
  const chStem=mkCyl(.04,.04,.5,6,metalM);chStem.position.set(-800,.25,173.6);hospInterior.add(chStem);
  hospInterior.add(wallPoster(recepM,3.2,1,-800,2.9,172.32,0));

  // ----- east wall: medicine cabinet + supply shelf -----
  const cabinet=mkBox(.5,2.2,2.6,wallM);cabinet.position.set(-787.6,1.1,182);hospInterior.add(cabinet);
  const cabCross=makeCross(.5,greenM);cabCross.position.set(-787.3,1.6,182);cabCross.rotation.y=Math.PI/2;hospInterior.add(cabCross);
  const shelf=makeShelf();shelf.position.set(-787.6,0,176.5);shelf.rotation.y=-Math.PI/2;hospInterior.add(shelf);
  hospInterior.add(wallPoster(pharmM,1.4,.88,-787.28,3.1,179,-Math.PI/2));

  // ----- waiting area near the entrance (west): chairs, plant, wheelchair -----
  for(let k=0;k<3;k++){
    const ch=makeChair();ch.position.set(-809.5,0,177+k*1.4);ch.rotation.y=Math.PI/2;hospInterior.add(ch);
  }
  const wc=makeWheelchair();wc.position.set(-810.3,0,182.4);wc.rotation.y=Math.PI/2;hospInterior.add(wc);
  const plant1=makePlant();plant1.position.set(-811.4,0,173.2);hospInterior.add(plant1);
  const plant2=makePlant();plant2.position.set(-789,0,186.6);hospInterior.add(plant2);
  const cooler=makeWaterCooler();cooler.position.set(-789.4,0,173.3);hospInterior.add(cooler);
  const cart=makeCrashCart();cart.position.set(-798.4,0,183.4);cart.rotation.y=.3;hospInterior.add(cart);

  // ----- wall posters / clock -----
  hospInterior.add(wallPoster(eyeChartM,.9,1.28,-793.5,2.1,172.3,0));
  hospInterior.add(wallPoster(emergM,1.6,1,-803,3,187.7,Math.PI));
  const clock=new THREE.Mesh(new THREE.CircleGeometry(.5,24),clockM);
  clock.position.set(-806.5,3.6,172.32);hospInterior.add(clock);

  // ---- NPCs: equipe e pacientes (animados por js/hospital.js) ----
  const DOCTOR=0xf4f6f7,DOCPANTS=0x33424a,NURSE=0x2aa6a0,NPANTS=0x1f7a76,GOWN=0xbcd6dc;
  // adiciona um ped ao interior e registra pra animação
  const addPed=(shirt:number,pants:number,x:number,z:number,faceYaw:number,kind:string,extra:Record<string,unknown>={}):void=>{
    const g=makePed(shirt,pants);
    g.position.set(x,0,z);g.rotation.y=faceYaw;
    hospInterior.add(g);
    hospFx.peds.push({g,t:rand(0,6),sp:rand(.8,1.3),kind,face:faceYaw,...extra});
  };
  // paciente deitado no leito (pose de costas, rosto pra cima), centrado no colchão
  const addLying=(x:number):any=>{
    const g=makePed(GOWN,GOWN);
    g.position.set(x,.98,186.4);g.rotation.set(-Math.PI/2,0,0);
    hospInterior.add(g);
    hospFx.peds.push({g,kind:'lie'});
    return g;
  };
  hospFx.sickPatient=addLying(-806); // este fala quando o jogador chega perto (js/hospital.js)
  addLying(-796);                    // segundo paciente internado
  addPed(NURSE,NPANTS,-800,173.4,0,'idle');    // enfermeira na recepção (olha pra sala)
  addPed(DOCTOR,DOCPANTS,-797.5,181,-Math.PI/2,'idle'); // médico examinando o leito da ponta
  addPed(DOCTOR,DOCPANTS,-804,181,Math.PI/2,'idle');    // outro médico
  addPed(NURSE,NPANTS,-803,179,0,'walk',{x0:-808,x1:-794,z:179}); // enfermeira de ronda
  addPed(GOWN,GOWN,-808,182.5,Math.PI/2,'idle'); // paciente em pé perto da espera

  // ----- kit de cura: cruz verde flutuando no centro, com anel/halo no chão -----
  // (a cruz é animada por js/hospital.js; o anel/halo/coluna são decoração estática)
  const ring=new THREE.Mesh(new THREE.TorusGeometry(1.05,.06,8,32),greenM);
  ring.rotation.x=Math.PI/2;ring.position.set(HOSP_HEAL.x,.05,HOSP_HEAL.z);hospInterior.add(ring);
  const disc=new THREE.Mesh(new THREE.CircleGeometry(1,28),glowM);
  disc.rotation.x=-Math.PI/2;disc.position.set(HOSP_HEAL.x,.04,HOSP_HEAL.z);hospInterior.add(disc);
  const col=new THREE.Mesh(new THREE.CylinderGeometry(.5,.72,2.4,16,1,true),glowM);
  col.position.set(HOSP_HEAL.x,1.2,HOSP_HEAL.z);hospInterior.add(col);
  hospFx.heal=makeCross(2,greenM);
  hospFx.heal.position.set(HOSP_HEAL.x,1.3,HOSP_HEAL.z);hospInterior.add(hospFx.heal);

  // ----- luz da sala: dois pontos frios (cobre os 24m) -----
  for(const lx of[-806,-794]){
    const light=new THREE.PointLight(0xeaf4ff,42,26,1.5);
    light.position.set(lx,4.4,180);hospInterior.add(light);
  }

  // ----- porta de saída (parede oeste) -----
  // Camadas ESCALONADAS em x (moldura atrás, vidro na frente, placa/cruz por
  // cima) pra nenhuma face ficar coplanar com a parede/backstop nem entre si —
  // faces coladas em z é o que causava o "piscar" (z-fighting). Vidro OPACO
  // (fosco) evita a ordenação de transparência, e a porta vai até o chão (y=0)
  // pra não ficar cortada embaixo.
  const frostM=matte({color:0xcfe6ec,roughness:.5});
  const exitFrame=mkBox(.1,3,2.8,matte({color:0x2a3338,roughness:.7}));
  exitFrame.position.set(-812.7,1.5,180);hospInterior.add(exitFrame);
  for(const dz of[-.62,.62]){
    const gp=mkBox(.06,2.6,1.18,frostM);gp.position.set(-812.6,1.45,180+dz);hospInterior.add(gp);
  }
  const mull=mkBox(.07,2.6,.08,matte({color:0x2a3338}));mull.position.set(-812.58,1.45,180);hospInterior.add(mull);
  hospInterior.add(wallPoster(exitSignM,1.5,.5,-812.52,3.25,180,Math.PI/2));
  const exitCross=makeCross(.8,greenM);
  exitCross.position.set(-812.62,3.95,180);exitCross.rotation.y=Math.PI/2;hospInterior.add(exitCross);
  hospFx.exitArrow=makeDoorArrow();
  hospFx.exitArrow.position.set(-811.9,1.7,180);
  hospInterior.add(hospFx.exitArrow);

  scene.add(hospInterior);

  // paredes são sólidas (o jogador não atravessa nem sai da sala)
  solids.push(
    {x0:-814,x1:-812.9,z0:171.5,z1:188.5,h:6},   // parede oeste
    {x0:-787.1,x1:-786,z0:171.5,z1:188.5,h:6},   // parede leste
    {x0:-813.5,x1:-786.5,z0:171.4,z1:172.1,h:6}, // parede norte
    {x0:-813.5,x1:-786.5,z0:187.9,z1:188.6,h:6}, // parede sul
  );

  // ----- furniture collision -----
  // The big props get solid AABBs (x0,x1,z0,z1,h) so the player bumps them
  // instead of walking through. collideStatics() (js/physics.js) only skips a
  // solid when p.y>h, and the on-foot player sits at y≈0, so even low items
  // block. These live 600m off-map and never touch city movement. Aisles
  // between the beds/props stay clear; spawns + the heal kit sit in open floor.
  for(const bx of[-806,-801,-796]) // each bed + its IV/monitor/tray cluster
    solids.push({x0:bx-.95,x1:bx+.95,z0:183,z1:187,h:1.1});
  solids.push(
    {x0:-803.1,x1:-796.9,z0:173.9,z1:175.3,h:1.2}, // reception desk
    {x0:-787.95,x1:-787.3,z0:180.6,z1:183.4,h:2.2},// medicine cabinet
    {x0:-788.1,x1:-787.4,z0:175.6,z1:177.4,h:2},   // supply shelf
    {x0:-799,x1:-797.8,z0:182.7,z1:184.1,h:1.1},   // crash cart
    {x0:-789.7,x1:-789.1,z0:173,z1:173.6,h:1.2},   // water cooler
    {x0:-810.7,x1:-809.9,z0:181.9,z1:182.9,h:.9},  // wheelchair
    {x0:-809.85,x1:-809.15,z0:176.5,z1:179.9,h:.9},// waiting chairs row
    {x0:-811.6,x1:-811.2,z0:173,z1:173.4,h:1.1},   // plant (entrance corner)
    {x0:-789.2,x1:-788.8,z0:186.4,z1:186.8,h:1.1}, // plant (SE corner)
  );
}
