import * as THREE from 'three';
import {scene} from '../../../js/engine.js';
import {rand} from '../../../js/constants.js';
import {makePed} from '../characters/pedestrian.js';
import {makeDoorArrow} from './door-arrow.js';
import {ARSENAL} from '../../../js/weapon-catalog.js';

// Loja de armas "AMMO DEPOT": prédio num quarteirão reservado pelo world.js
// (mesmo molde da academia/boate/hospital/presídio) e um interior separado a
// ~600m do mapa, num Group visible=false ligado só enquanto o jogador está lá.
// Dentro há 3 BALCÕES com TODAS as armas do jogo menos o punho (as 12 do
// arsenal), cada uma girando sobre o balcão com uma ETIQUETA do nome em cima.
// O jogador chega perto e compra (ver js/gun-shop.js). A lista de armas e os
// preços vêm do catálogo (js/weapon-catalog.js), então a vitrine se monta
// sozinha conforme o arsenal cresce.

export const GUNSHOP_I=1,GUNSHOP_J=5; // quarteirão reservado (oeste/centro-sul)
const CX=44*GUNSHOP_I-154, CZ=44*GUNSHOP_J-154; // centro do prédio = (-110,66)

// porta externa (fachada oeste) e spawn de saída pra rua
export const GUNSHOP_DOOR={x:CX-8.6,z:CZ};
export const GUNSHOP_SPAWN_OUT={x:CX-10.6,z:CZ};
// interior: centro da loja, porta de saída e spawn de entrada
export const SHOP_CENTER={x:-800,z:-380};
export const RANGE_CENTER={x:-700,z:-430};
export const INT_CENTER={...SHOP_CENTER};
export const INT_DOOR={x:-813.2,z:-377};
export const INT_SPAWN={x:-811.3,z:-377};
// área onde a câmera pode ficar lá dentro (sala menos a margem das paredes)
export const SHOP_BOUNDS={x0:-814,x1:-786,z0:-390,z1:-370,y1:5};
export const RANGE_BOUNDS={x0:-725,x1:-675,z0:-444,z1:-416,y1:5};
export const INT_BOUNDS={...SHOP_BOUNDS};
export const RANGE_ENTRY={x:-786.2,z:-373.2};
export const RANGE_RETURN={x:-788.8,z:-373.2};
export const RANGE_SPAWN={x:-721.5,z:-420.2};
export const RANGE_EXIT={x:-724.3,z:-420.2};
export const RANGE_ROOM={...RANGE_BOUNDS,door:RANGE_ENTRY};

// Onde cada arma fica no balcão (preenchido no addGunShop). js/gun-shop.js usa
// isto pra detectar proximidade e cobrar a compra.
export const GUN_SHOP_ITEMS=[]; // {id,name,price,x,z}
export const GUN_RANGE_ITEMS=[]; // {id,name,x,z,pivot}
export const GUN_RANGE_TARGETS=[]; // {x,z,r,g,hit(),hitT}

export const gunShopFx={keeper:null,exitArrow:null,facade:null,facadeArrow:null,
  footprint:null,displays:[],labels:[],rangeDoor:null,rangeExitArrow:null,
  rangeEntryArrow:null,rangePickups:[],rangeTargets:[]};
export const gunShopInterior=new THREE.Group();
gunShopInterior.visible=false;
export const gunRangeInterior=new THREE.Group();
gunRangeInterior.visible=false;

function canvasTexture(w,h,draw){
  const c=document.createElement('canvas');c.width=w;c.height=h;
  draw(c.getContext('2d'),w,h);
  const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;
  return t;
}
function repeatTex(t,x,y){t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(x,y);return t;}

const floorTex=repeatTex(canvasTexture(128,128,(x,w,h)=>{
  x.fillStyle='#171411';x.fillRect(0,0,w,h);
  x.fillStyle='#211d18';x.fillRect(0,0,w/2,h/2);x.fillRect(w/2,h/2,w/2,h/2);
  x.strokeStyle='#3a3127';x.lineWidth=3;
  x.strokeRect(0,0,w,h);x.beginPath();x.moveTo(w/2,0);x.lineTo(w/2,h);
  x.moveTo(0,h/2);x.lineTo(w,h/2);x.stroke();
  for(let k=0;k<30;k++){
    x.fillStyle=`rgba(255,220,150,${Math.random()*.07})`;
    x.fillRect(Math.random()*w,Math.random()*h,1,1);
  }
}),8,6);
const pegTex=repeatTex(canvasTexture(128,128,(x,w,h)=>{
  x.fillStyle='#7a5738';x.fillRect(0,0,w,h);
  x.fillStyle='#8f6a44';
  for(let y=8;y<h;y+=16)for(let xx=8;xx<w;xx+=16){
    x.beginPath();x.arc(xx,y,2.2,0,Math.PI*2);x.fill();
  }
  x.strokeStyle='rgba(40,24,12,.35)';x.strokeRect(1,1,w-2,h-2);
}),4,3);
const rubberTex=repeatTex(canvasTexture(96,96,(x,w,h)=>{
  x.fillStyle='#111';x.fillRect(0,0,w,h);
  x.strokeStyle='#292929';x.lineWidth=3;
  for(let i=-w;i<w*2;i+=18){x.beginPath();x.moveTo(i,0);x.lineTo(i+w,h);x.stroke();}
}),2,2);

const wallM=new THREE.MeshStandardMaterial({color:0x2b2622,roughness:.96});
const darkM=new THREE.MeshStandardMaterial({color:0x16140f,roughness:.85});
const steelM=new THREE.MeshStandardMaterial({color:0x6b7079,metalness:.85,roughness:.35});
const accentM=new THREE.MeshBasicMaterial({color:0xf5c518}); // amarelo do AMMO DEPOT
const counterBodyM=new THREE.MeshStandardMaterial({color:0x20242b,roughness:.82});
const counterTopM=new THREE.MeshStandardMaterial({color:0x3a2c20,roughness:.6});
const floorM=new THREE.MeshStandardMaterial({map:floorTex,roughness:.94});
const pegM=new THREE.MeshStandardMaterial({map:pegTex,roughness:.86,side:THREE.DoubleSide});
const glassM=new THREE.MeshStandardMaterial({color:0x9fdaf1,roughness:.05,metalness:.05,
  transparent:true,opacity:.24,depthWrite:false});
const rubberM=new THREE.MeshStandardMaterial({map:rubberTex,roughness:.9});
const shelfM=new THREE.MeshStandardMaterial({color:0x35291c,roughness:.72});
const brassM=new THREE.MeshStandardMaterial({color:0xc89536,metalness:.35,roughness:.34});
const greenM=new THREE.MeshStandardMaterial({color:0x29412f,roughness:.82});
const redM=new THREE.MeshBasicMaterial({color:0xff3030});
const glowM=new THREE.MeshBasicMaterial({color:0xffe5a5});

function signTexture(){
  const c=document.createElement('canvas');c.width=512;c.height=128;
  const x=c.getContext('2d');
  x.textAlign='center';x.textBaseline='middle';
  x.font='900 46px monospace';
  x.shadowColor='#f5c518';x.shadowBlur=22;
  x.fillStyle='#fff3c4';
  for(let k=0;k<3;k++)x.fillText('AMMO DEPOT',256,64); // passadas extras = glow
  const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;
  return t;
}

// Etiqueta do nome da arma (canvas -> textura num plano). A fonte encolhe pra
// caber nomes longos ("MOLOTOV COCKTAIL") na mesma plaquinha.
function labelTexture(text){
  const c=document.createElement('canvas');c.width=256;c.height=64;
  const x=c.getContext('2d');
  x.textAlign='center';x.textBaseline='middle';
  let fs=30;x.font=`900 ${fs}px monospace`;
  while(x.measureText(text).width>236&&fs>10){fs-=2;x.font=`900 ${fs}px monospace`;}
  x.lineWidth=6;x.strokeStyle='#000';x.strokeText(text,128,34);
  x.fillStyle='#ffe9b0';x.fillText(text,128,34);
  const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;
  return t;
}
function makeLabel(text){
  return new THREE.Mesh(new THREE.PlaneGeometry(2.2,.55),
    new THREE.MeshBasicMaterial({map:labelTexture(text),transparent:true,depthWrite:false}));
}
function panelTexture(lines,{bg='#17130f',fg='#ffe7b0',sub='#f5c518'}={}){
  const arr=String(lines).split('\n');
  const c=document.createElement('canvas');c.width=512;c.height=256;
  const x=c.getContext('2d');
  x.fillStyle=bg;x.fillRect(0,0,512,256);
  x.strokeStyle=sub;x.lineWidth=10;x.strokeRect(8,8,496,240);
  x.textAlign='center';x.textBaseline='middle';
  arr.forEach((line,i)=>{
    const fs=i===0?46:28;
    x.font=`900 ${fs}px monospace`;
    x.lineWidth=7;x.strokeStyle='#000';
    const y=92+i*58-(arr.length-1)*22;
    x.strokeText(line,256,y);
    x.fillStyle=i===0?fg:sub;x.fillText(line,256,y);
  });
  const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;
  return t;
}
function makePanel(lines,w,h,opts){
  return new THREE.Mesh(new THREE.PlaneGeometry(w,h),
    new THREE.MeshBasicMaterial({map:panelTexture(lines,opts),transparent:true,side:THREE.DoubleSide}));
}

// Escala a arma pra um tamanho de vitrine e a apoia centrada sobre o balcão,
// dentro de um pivô (pra girar no lugar, sem orbitar).
function displayWeapon(w,x,topY,z){
  const model=w.makeModel();
  model.updateMatrixWorld(true);
  let box=new THREE.Box3().setFromObject(model);
  const size=new THREE.Vector3();box.getSize(size);
  const s=.95/(Math.max(size.x,size.y,size.z)||1);
  model.scale.setScalar(s);
  model.updateMatrixWorld(true);
  box=new THREE.Box3().setFromObject(model);
  const c=new THREE.Vector3();box.getCenter(c);
  model.position.set(-c.x,-box.min.y,-c.z); // centro no pivô, base no chão do pivô
  model.traverse(o=>{o.castShadow=false;});
  const pivot=new THREE.Group();
  pivot.position.set(x,topY,z);
  pivot.add(model);
  return pivot;
}
function wallWeapon(w,x,y,z,rotY=Math.PI/2,scale=.92){
  const model=w.makeModel();
  model.updateMatrixWorld(true);
  let box=new THREE.Box3().setFromObject(model);
  const size=new THREE.Vector3();box.getSize(size);
  const s=scale/(Math.max(size.x,size.y,size.z)||1);
  model.scale.setScalar(s);
  model.updateMatrixWorld(true);
  box=new THREE.Box3().setFromObject(model);
  const c=new THREE.Vector3();box.getCenter(c);
  model.position.set(-c.x,-c.y,-c.z);
  model.traverse(o=>{o.castShadow=false;});
  const g=new THREE.Group();
  g.position.set(x,y,z);g.rotation.y=rotY;g.add(model);
  const rail=new THREE.Mesh(new THREE.BoxGeometry(1.25,.06,.08),steelM);
  rail.position.set(0,-.42,.08);g.add(rail);
  gunShopInterior.add(g);
}
function addDisplayCase(z){
  const front=new THREE.Mesh(new THREE.BoxGeometry(20.2,.66,.05),glassM);
  front.position.set(-800,1.38,z+.73);gunShopInterior.add(front);
  const back=front.clone();back.position.z=z-.73;gunShopInterior.add(back);
  const top=new THREE.Mesh(new THREE.BoxGeometry(20.2,.05,1.46),glassM);
  top.position.set(-800,1.72,z);gunShopInterior.add(top);
  const rail=new THREE.Mesh(new THREE.BoxGeometry(20.4,.06,.06),brassM);
  rail.position.set(-800,1.76,z+.76);gunShopInterior.add(rail);
  const rail2=rail.clone();rail2.position.z=z-.76;gunShopInterior.add(rail2);
}
function makeAmmoBox(label,color=0x6b4b26){
  const g=new THREE.Group();
  const b=new THREE.Mesh(new THREE.BoxGeometry(.68,.42,.48),
    new THREE.MeshStandardMaterial({color,roughness:.75}));
  b.castShadow=true;g.add(b);
  const tag=makePanel(label,.58,.24,{bg:'#1a130b',fg:'#f7d36d',sub:'#000'});
  tag.position.set(0,.03,.246);g.add(tag);
  return g;
}
function addAmmoShelf(x,z,rotY,label){
  const g=new THREE.Group();g.position.set(x,0,z);g.rotation.y=rotY;
  const back=new THREE.Mesh(new THREE.BoxGeometry(4.8,3.2,.18),shelfM);
  back.position.set(0,2.25,0);g.add(back);
  const sign=makePanel(label,3.6,.55,{bg:'#20140c',fg:'#fff1c0',sub:'#f5c518'});
  sign.position.set(0,3.55,.1);g.add(sign);
  for(const y of[1.18,2.02,2.86]){
    const shelf=new THREE.Mesh(new THREE.BoxGeometry(4.9,.09,.72),darkM);
    shelf.position.set(0,y,.32);g.add(shelf);
  }
  const cols=[0x4b6f35,0x8b3d2d,0x6b5b2e,0x394f72];
  for(let row=0;row<3;row++)for(let i=0;i<5;i++){
    const box=makeAmmoBox(i%2?'9MM':'12GA',cols[(row+i)%cols.length]);
    box.position.set(-1.75+i*.86,1.45+row*.84,.38);
    g.add(box);
  }
  gunShopInterior.add(g);
}
function addSecurityCamera(x,y,z,rotY){
  const g=new THREE.Group();g.position.set(x,y,z);g.rotation.y=rotY;
  const arm=new THREE.Mesh(new THREE.BoxGeometry(.55,.08,.08),steelM);
  arm.position.set(0,0,.18);g.add(arm);
  const cam=new THREE.Mesh(new THREE.BoxGeometry(.52,.28,.36),darkM);
  cam.position.set(0,0,.55);g.add(cam);
  const lens=new THREE.Mesh(new THREE.CylinderGeometry(.08,.08,.04,12),redM);
  lens.rotation.x=Math.PI/2;lens.position.set(0,0,.75);g.add(lens);
  gunShopInterior.add(g);
}
function addWallBox(x,y,z,w,h,d,mat=wallM,group=gunShopInterior){
  const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);
  m.position.set(x,y,z);m.receiveShadow=true;m.castShadow=true;
  group.add(m);
  return m;
}
function addRangeTarget(x,z,lane,group=gunRangeInterior){
  const tex=canvasTexture(256,256,(c,w,h)=>{
    c.fillStyle='#e9e5d8';c.fillRect(0,0,w,h);
    c.strokeStyle='#161616';c.lineWidth=9;c.strokeRect(8,8,w-16,h-16);
    for(const[r,col]of[[88,'#161616'],[64,'#f3f3f0'],[42,'#161616'],[20,'#d02525']]){
      c.fillStyle=col;c.beginPath();c.arc(w/2,h/2,r,0,Math.PI*2);c.fill();
    }
    c.font='900 28px monospace';c.fillStyle='#161616';c.textAlign='center';
    c.fillText(String(lane),w/2,38);
  });
  const mat=new THREE.MeshBasicMaterial({map:tex,side:THREE.DoubleSide});
  const g=new THREE.Mesh(new THREE.PlaneGeometry(1.55,1.55),mat);
  g.position.set(x,2.15,z);g.rotation.y=-Math.PI/2;
  group.add(g);
  const target={x,z,r:.82,g,hitT:0,hit(){
    this.hitT=.22;
    g.material.color.setHex(0xffd24a);
  }};
  GUN_RANGE_TARGETS.push(target);
  gunShopFx.rangeTargets.push(target);
  return target;
}
function floorWeapon(w,x,z,rotY=0,group=gunRangeInterior){
  const model=w.makeModel();
  model.updateMatrixWorld(true);
  let box=new THREE.Box3().setFromObject(model);
  const size=new THREE.Vector3();box.getSize(size);
  const s=.7/(Math.max(size.x,size.y,size.z)||1);
  model.scale.setScalar(s);
  model.updateMatrixWorld(true);
  box=new THREE.Box3().setFromObject(model);
  const c=new THREE.Vector3();box.getCenter(c);
  model.position.set(-c.x,-box.min.y,-c.z);
  model.rotation.x=.06;model.traverse(o=>{o.castShadow=false;});
  const pivot=new THREE.Group();
  pivot.position.set(x,.07,z);pivot.rotation.y=rotY;pivot.add(model);
  group.add(pivot);
  const marker=new THREE.Mesh(new THREE.RingGeometry(.62,.74,20),
    new THREE.MeshBasicMaterial({color:0xf5c518,transparent:true,opacity:.55,side:THREE.DoubleSide}));
  marker.rotation.x=-Math.PI/2;marker.position.set(x,.035,z);group.add(marker);
  gunShopFx.rangePickups.push({id:w.id,pivot,marker});
  GUN_RANGE_ITEMS.push({id:w.id,name:w.name,x,z,pivot,marker});
}
function addLaneNumber(n,x,z,group=gunRangeInterior){
  const p=makePanel(String(n),.72,.52,{bg:'#111',fg:'#fff6d0',sub:'#f5c518'});
  p.position.set(x,3.55,z);p.rotation.y=-Math.PI/2;
  group.add(p);
}
function addShootingRange(solids){
  const group=gunRangeInterior;
  const cX=(RANGE_BOUNDS.x0+RANGE_BOUNDS.x1)/2,cZ=(RANGE_BOUNDS.z0+RANGE_BOUNDS.z1)/2;
  const width=RANGE_BOUNDS.x1-RANGE_BOUNDS.x0;
  const depth=RANGE_BOUNDS.z1-RANGE_BOUNDS.z0;

  const floor=new THREE.Mesh(new THREE.PlaneGeometry(width-.5,depth-.5),rubberM);
  floor.rotation.x=-Math.PI/2;floor.position.set(cX,.035,cZ);group.add(floor);
  addWallBox(cX,5.92,cZ,width,.22,depth,darkM,group);
  addWallBox(RANGE_BOUNDS.x1-.2,3,cZ,.42,6,depth+.6,darkM,group); // bullet trap
  addWallBox(RANGE_BOUNDS.x0+.18,3,cZ,.36,6,depth+.6,wallM,group);
  addWallBox(cX,3,RANGE_BOUNDS.z0+.18,width+.6,6,.36,wallM,group);
  addWallBox(cX,3,RANGE_BOUNDS.z1-.18,width+.6,6,.36,wallM,group);

  const exitDoor=new THREE.Mesh(new THREE.BoxGeometry(.16,2.75,2.25),darkM);
  exitDoor.position.set(RANGE_BOUNDS.x0+.34,1.38,RANGE_EXIT.z);
  exitDoor.castShadow=true;exitDoor.receiveShadow=true;group.add(exitDoor);
  const exitSign=makePanel('EXIT',1.15,.42,{bg:'#17130f',fg:'#ffe7b0',sub:'#f5c518'});
  exitSign.position.set(RANGE_BOUNDS.x0+.45,2.85,RANGE_EXIT.z);
  exitSign.rotation.y=Math.PI/2;group.add(exitSign);
  gunShopFx.rangeExitArrow=makeDoorArrow();
  gunShopFx.rangeExitArrow.position.set(RANGE_EXIT.x,1.7,RANGE_EXIT.z);
  group.add(gunShopFx.rangeExitArrow);

  const weaponMat=new THREE.Mesh(new THREE.PlaneGeometry(14.4,11.2),new THREE.MeshBasicMaterial({
    color:0x7a6848,transparent:true,opacity:.94,side:THREE.DoubleSide
  }));
  weaponMat.rotation.x=-Math.PI/2;weaponMat.position.set(-716.7,.052,-435.8);group.add(weaponMat);
  const weaponSign=makePanel('TRAINING WEAPONS',4.4,.7,{bg:'#17130f',fg:'#fff1c0',sub:'#f5c518'});
  weaponSign.position.set(RANGE_BOUNDS.x0+.42,3.7,-435.8);
  weaponSign.rotation.y=Math.PI/2;group.add(weaponSign);
  const weaponRail=new THREE.Mesh(new THREE.BoxGeometry(.12,2.2,14.0),steelM);
  weaponRail.position.set(RANGE_BOUNDS.x0+.55,2.05,-435.8);group.add(weaponRail);

  const safety=new THREE.Mesh(new THREE.BoxGeometry(.14,.04,depth-2.2),accentM);
  safety.position.set(-707.4,.08,cZ);group.add(safety);
  const bench=new THREE.Mesh(new THREE.BoxGeometry(1.05,.18,depth-2.4),counterTopM);
  bench.position.set(-706.4,.96,cZ);group.add(bench);
  const benchBase=new THREE.Mesh(new THREE.BoxGeometry(.34,1.0,depth-2.5),counterBodyM);
  benchBase.position.set(-706.7,.5,cZ);group.add(benchBase);

  const lanes=[-440.5,-433.5,-426.5,-419.5];
  lanes.forEach((z,i)=>{
    const n=i+1;
    addLaneNumber(n,-704.5,z,group);
    addRangeTarget(RANGE_BOUNDS.x1-.9,z,n,group);
    const mat=new THREE.Mesh(new THREE.PlaneGeometry(28,4.6),rubberM);
    mat.rotation.x=-Math.PI/2;mat.position.set(-691.4,.05,z);group.add(mat);
    if(i<lanes.length-1){
      const div=new THREE.Mesh(new THREE.BoxGeometry(26,.08,.08),steelM);
      div.position.set(-690.2,1.55,(z+lanes[i+1])/2);group.add(div);
      const glass=new THREE.Mesh(new THREE.BoxGeometry(24.8,1.4,.05),glassM);
      glass.position.set(-690.2,1.45,(z+lanes[i+1])/2);group.add(glass);
    }
  });

  for(const x of[-716,-704,-692,-680]){
    const bar=new THREE.Mesh(new THREE.BoxGeometry(5.2,.08,.22),glowM);
    bar.position.set(x,5.65,cZ);group.add(bar);
    const l=new THREE.PointLight(0xfff1c8,15,13,1.7);
    l.position.set(x,5.35,cZ);group.add(l);
  }

  const rangeRules=makePanel('SAFETY LINE\nEYE AND EAR PROTECTION',4.5,1.1,
    {bg:'#16140f',fg:'#fff1c0',sub:'#f5c518'});
  rangeRules.position.set(-707.1,4.15,RANGE_BOUNDS.z0+.45);
  rangeRules.rotation.y=Math.PI;group.add(rangeRules);

  const xs=[-721.0,-717.8,-714.6,-711.4],zs=[-440.0,-436.4,-432.8];
  ARSENAL.forEach((w,i)=>floorWeapon(w,xs[i%4],zs[Math.floor(i/4)],i*.55,group));

  solids.push(
    {x0:RANGE_BOUNDS.x1-.45,x1:RANGE_BOUNDS.x1+.25,z0:RANGE_BOUNDS.z0-.35,z1:RANGE_BOUNDS.z1+.35,h:6},
    {x0:RANGE_BOUNDS.x0-.25,x1:RANGE_BOUNDS.x0+.55,z0:RANGE_BOUNDS.z0-.35,z1:RANGE_BOUNDS.z1+.35,h:6},
    {x0:RANGE_BOUNDS.x0-.35,x1:RANGE_BOUNDS.x1+.35,z0:RANGE_BOUNDS.z0-.35,z1:RANGE_BOUNDS.z0+.55,h:6},
    {x0:RANGE_BOUNDS.x0-.35,x1:RANGE_BOUNDS.x1+.35,z0:RANGE_BOUNDS.z1-.55,z1:RANGE_BOUNDS.z1+.35,h:6},
    {x0:-707.05,x1:-705.65,z0:RANGE_BOUNDS.z0+1.1,z1:RANGE_BOUNDS.z1-1.1,h:1.1}
  );
}

export function addGunShop(solids){
  // ----- exterior: loja com faixa amarela, marquise e letreiro AMMO DEPOT ----
  const bld=new THREE.Mesh(new THREE.BoxGeometry(16,7,16),wallM);
  bld.position.set(CX,3.5,CZ);bld.castShadow=true;bld.receiveShadow=true;scene.add(bld);
  const roof=new THREE.Mesh(new THREE.BoxGeometry(16.2,.25,16.2),darkM);
  roof.position.set(CX,7.1,CZ);scene.add(roof);
  const band=new THREE.Mesh(new THREE.BoxGeometry(16.3,.5,16.3),accentM);
  band.position.set(CX,5.4,CZ);scene.add(band);

  const facade=new THREE.Group();
  const door=new THREE.Mesh(new THREE.BoxGeometry(.18,3.2,2.6),darkM);
  door.position.set(CX-8.02,1.6,CZ);facade.add(door);
  for(const dz of[-2.2,2.2]){
    const bar=new THREE.Mesh(new THREE.BoxGeometry(.14,4.4,.14),steelM);
    bar.position.set(CX-8.05,2.4,CZ+dz);facade.add(bar);
  }
  const canopy=new THREE.Mesh(new THREE.BoxGeometry(2.6,.18,4.4),
    new THREE.MeshStandardMaterial({color:0x3a352a,roughness:.8}));
  canopy.position.set(CX-9.3,3.3,CZ);canopy.castShadow=true;facade.add(canopy);
  for(const dz of[-1.9,1.9]){
    const pole=new THREE.Mesh(new THREE.CylinderGeometry(.06,.06,3.2,6),steelM);
    pole.position.set(CX-10.4,1.6,CZ+dz);facade.add(pole);
  }
  const sign=new THREE.Mesh(new THREE.PlaneGeometry(9,2.3),
    new THREE.MeshBasicMaterial({map:signTexture(),transparent:true}));
  sign.position.set(CX-8.12,6,CZ);sign.rotation.y=-Math.PI/2;facade.add(sign);
  gunShopFx.facadeArrow=makeDoorArrow();
  gunShopFx.facadeArrow.position.set(CX-9.3,1.7,CZ);facade.add(gunShopFx.facadeArrow);
  scene.add(facade);
  gunShopFx.facade=facade;
  gunShopFx.footprint={x0:CX-8.2,x1:CX+8.2,z0:CZ-8.2,z1:CZ+8.2};
  solids.push({x0:CX-8.2,x1:CX+8.2,z0:CZ-8.2,z1:CZ+8.2,h:7.2});

  // ----- interior: sala 30x22 a ~600m do mapa, num grupo liga/desliga -----
  addWallBox(-800,5.92,-380,30.4,.22,22.4,darkM);
  addWallBox(-815.08,3,-380,.36,6,22.7,wallM);
  addWallBox(-784.92,3,-380,.36,6,22.7,wallM);
  addWallBox(-800,3,-391.08,30.5,6,.36,wallM);
  addWallBox(-800,3,-368.92,30.5,6,.36,wallM);
  const floor=new THREE.Mesh(new THREE.PlaneGeometry(29.4,21.4),
    floorM);
  floor.rotation.x=-Math.PI/2;floor.position.set(-800,.02,-380);gunShopInterior.add(floor);
  const outer=new THREE.Mesh(new THREE.BoxGeometry(32,10,24),
    new THREE.MeshBasicMaterial({color:0x05060a,side:THREE.BackSide}));
  outer.position.set(-800,3.8,-380);gunShopInterior.add(outer);

  // faixa amarela em volta das paredes (clima da fachada)
  for(const z of[-390.9,-369.1]){
    const s=new THREE.Mesh(new THREE.BoxGeometry(29.6,.1,.1),accentM);
    s.position.set(-800,3.2,z);gunShopInterior.add(s);
  }
  for(const x of[-814.9,-785.1]){
    const s=new THREE.Mesh(new THREE.BoxGeometry(.1,.1,21.6),accentM);
    s.position.set(x,3.2,-380);gunShopInterior.add(s);
  }

  // Pegboards e placas de parede: a sala passa a ler como loja de armas, não
  // como uma sala vazia com balcões.
  for(const[x,z,w]of[[-805.2,-390.86,8.2],[-795,-390.86,8.2]]){
    const p=new THREE.Mesh(new THREE.PlaneGeometry(w,3.1),pegM);
    p.position.set(x,2.65,z);gunShopInterior.add(p);
  }
  const eastPeg=new THREE.Mesh(new THREE.PlaneGeometry(11.6,3.1),pegM);
  eastPeg.position.set(-785.18,2.65,-383.6);eastPeg.rotation.y=Math.PI/2;gunShopInterior.add(eastPeg);
  const rangePortalFrame=addWallBox(-785.22,2.42,RANGE_ENTRY.z,.24,3.25,3.2,darkM);
  rangePortalFrame.castShadow=false;
  const rangeDoorPivot=new THREE.Group();
  rangeDoorPivot.position.set(-785.42,1.35,RANGE_ENTRY.z-1.12);
  const rangeDoor=new THREE.Mesh(new THREE.BoxGeometry(.14,2.7,2.25),darkM);
  rangeDoor.position.set(0,0,1.12);rangeDoor.castShadow=true;rangeDoor.receiveShadow=true;
  rangeDoorPivot.add(rangeDoor);gunShopInterior.add(rangeDoorPivot);
  const rangeDoorSign=makePanel('RANGE',1.1,.42,{bg:'#17130f',fg:'#ffe7b0',sub:'#f5c518'});
  rangeDoorSign.position.set(-785.5,3.25,RANGE_ENTRY.z);
  rangeDoorSign.rotation.y=Math.PI/2;gunShopInterior.add(rangeDoorSign);
  gunShopFx.rangeEntryArrow=makeDoorArrow();
  gunShopFx.rangeEntryArrow.position.set(RANGE_ENTRY.x-.85,1.7,RANGE_ENTRY.z);
  gunShopInterior.add(gunShopFx.rangeEntryArrow);
  gunShopFx.rangeDoor={pivot:rangeDoorPivot,open:0};
  const rules=makePanel('ID REQUIRED\nNO REFUNDS',3.5,1.55,{bg:'#211813',fg:'#fff4cf',sub:'#f5c518'});
  rules.position.set(-813.85,3.4,-385.2);rules.rotation.y=Math.PI/2;gunShopInterior.add(rules);
  const wallLogo=makePanel('AMMO DEPOT\nLICENSED DEALER',5.2,1.55,
    {bg:'#1b1209',fg:'#fff3c4',sub:'#f5c518'});
  wallLogo.position.set(-800,4.55,-390.88);gunShopInterior.add(wallLogo);

  // Iluminação de loja: tubos fluorescentes no teto e luz quente geral.
  for(const x of[-807,-800,-793]){
    const bar=new THREE.Mesh(new THREE.BoxGeometry(5.4,.08,.28),glowM);
    bar.position.set(x,5.72,-380);gunShopInterior.add(bar);
    const l=new THREE.PointLight(0xfff1c8,18,13,1.7);
    l.position.set(x,5.45,-380);gunShopInterior.add(l);
  }
  const light=new THREE.PointLight(0xffe9c0,95,54,1.55);
  light.position.set(-800,4.7,-380);gunShopInterior.add(light);

  // Parede de mostruário e estoque: rifles nas placas perfuradas, prateleiras
  // de munição e um canto de teste/inspeção.
  const rackWeapons=ARSENAL.filter(w=>['pistol','uzi','shotgun','ak47','m16','sniper','rocket','flame'].includes(w.id));
  rackWeapons.slice(0,4).forEach((w,i)=>wallWeapon(w,-808+i*2.1,3.15,-390.45,Math.PI/2,.95));
  rackWeapons.slice(4).forEach((w,i)=>wallWeapon(w,-785.52,3.1,-388+i*2.15,0,.95));
  addAmmoShelf(-790.6,-390.35,0,'AMMO');
  addAmmoShelf(-808.5,-369.35,Math.PI,'GEAR');
  addShootingRange(solids);
  addSecurityCamera(-813.9,5.1,-389.9,Math.PI/2);
  addSecurityCamera(-785.55,5.1,-370.2,-Math.PI/2);

  // Caixa/atendimento atrás dos balcões: registradora, vidro de segurança e
  // munição empilhada deixam o vendedor parecer parte da loja.
  const serviceBase=new THREE.Mesh(new THREE.BoxGeometry(8,.9,1.2),counterBodyM);
  serviceBase.position.set(-802,.45,-389.25);serviceBase.castShadow=true;serviceBase.receiveShadow=true;
  gunShopInterior.add(serviceBase);
  const serviceTop=new THREE.Mesh(new THREE.BoxGeometry(8.2,.12,1.3),counterTopM);
  serviceTop.position.set(-802,1,-389.25);gunShopInterior.add(serviceTop);
  const safetyGlass=new THREE.Mesh(new THREE.BoxGeometry(7.8,2.05,.06),glassM);
  safetyGlass.position.set(-802,2.18,-388.62);gunShopInterior.add(safetyGlass);
  const slot=new THREE.Mesh(new THREE.BoxGeometry(4.6,.08,.08),steelM);
  slot.position.set(-802,1.42,-388.55);gunShopInterior.add(slot);
  const register=new THREE.Group();
  register.position.set(-805.05,1.18,-388.85);
  const regBody=new THREE.Mesh(new THREE.BoxGeometry(.9,.38,.62),darkM);
  regBody.position.y=.1;register.add(regBody);
  const screen=new THREE.Mesh(new THREE.BoxGeometry(.62,.36,.08),greenM);
  screen.position.set(0,.42,-.18);screen.rotation.x=-.35;register.add(screen);
  const keys=new THREE.Mesh(new THREE.BoxGeometry(.68,.04,.38),steelM);
  keys.position.set(0,.31,.13);register.add(keys);
  gunShopInterior.add(register);
  for(let i=0;i<4;i++){
    const box=makeAmmoBox(i%2?'9MM':'556',i%2?0x5c3f25:0x3a5a34);
    box.position.set(-799.5+i*.72,1.25,-388.86);gunShopInterior.add(box);
  }
  solids.push({x0:-806.2,x1:-797.8,z0:-390,z1:-388.45,h:1.25});

  // ----- 3 balcões + as 12 armas do arsenal -----
  const zRows=[-374,-380,-386];   // os 3 balcões (norte/centro/sul)
  const xs=[-808,-802.7,-797.3,-792]; // 4 posições de arma por balcão
  const TOP_Y=1.06;               // tampo do balcão (arma apoia aqui)
  for(const z of zRows){
    const body=new THREE.Mesh(new THREE.BoxGeometry(20,.9,1.2),counterBodyM);
    body.position.set(-800,.45,z);body.castShadow=true;body.receiveShadow=true;
    gunShopInterior.add(body);
    const top=new THREE.Mesh(new THREE.BoxGeometry(20.4,.12,1.5),counterTopM);
    top.position.set(-800,1,z);gunShopInterior.add(top);
    const trim=new THREE.Mesh(new THREE.BoxGeometry(20.4,.08,1.54),accentM);
    trim.position.set(-800,.62,z);gunShopInterior.add(trim);
    addDisplayCase(z);
    solids.push({x0:-810,x1:-790,z0:z-.75,z1:z+.75,h:1.05});
  }

  // Cada arma do arsenal (12) vai num slot. island = qual balcão, col = coluna.
  ARSENAL.forEach((w,i)=>{
    const island=Math.min(zRows.length-1,Math.floor(i/4));
    const col=i%4;
    const x=xs[col], z=zRows[island];
    const pivot=displayWeapon(w,x,TOP_Y,z);
    gunShopInterior.add(pivot);
    gunShopFx.displays.push(pivot);
    const label=makeLabel(w.name);
    label.position.set(x,TOP_Y+1.15,z);
    gunShopInterior.add(label);
    gunShopFx.labels.push(label);
    GUN_SHOP_ITEMS.push({id:w.id,name:w.name,price:w.price,x,z});
  });

  // vendedor junto à parede dos fundos (animação idle no js/gun-shop.js)
  const keeper=makePed(0x394b63,0x20242c);
  keeper.position.set(-802,0,-390.45);keeper.rotation.y=0;
  gunShopInterior.add(keeper);
  gunShopFx.keeper={g:keeper,t:rand(0,6)};

  // porta de saída (parede oeste) + seta quicando
  const exitDoor=new THREE.Mesh(new THREE.BoxGeometry(.16,3,2.4),darkM);
  exitDoor.position.set(-814.85,1.5,-377);gunShopInterior.add(exitDoor);
  const exitNeon=new THREE.Mesh(new THREE.BoxGeometry(.1,.3,1.6),accentM);
  exitNeon.position.set(-814.8,3.3,-377);gunShopInterior.add(exitNeon);
  gunShopFx.exitArrow=makeDoorArrow();
  gunShopFx.exitArrow.position.set(-813.6,1.7,-377);gunShopInterior.add(gunShopFx.exitArrow);

  scene.add(gunShopInterior);
  scene.add(gunRangeInterior);

  // paredes sólidas (o jogador não atravessa nem sai da sala sem a porta)
  solids.push(
    {x0:-815,x1:-813.9,z0:-391.5,z1:-368.5,h:6},   // parede oeste
    {x0:-786.1,x1:-785.0,z0:-391.5,z1:-368.5,h:6},  // parede leste
    {x0:-815.5,x1:-784.5,z0:-391.6,z1:-390.9,h:6}, // parede norte
    {x0:-815.5,x1:-784.5,z0:-369.1,z1:-368.4,h:6}, // parede sul
  );
}
