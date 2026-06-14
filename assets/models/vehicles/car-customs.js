import * as THREE from 'three';

// Peças e materiais de CUSTOMIZAÇÃO aplicados ao carro do jogador pela oficina
// (js/mod-shop.js). Tudo aqui é PURO: recebe o Group do carro (buildCar de
// car.js) e troca material / adiciona-remove peças no próprio grupo do carro,
// guardando a seleção atual em carG.userData.mods. Geometria nasce aqui (modelo),
// a lógica de preço/menu fica no js/mod-shop.js.
//
// Convenção do carro (car.js): nariz em +z, traseira em -z, capô y~.86 z~+1.5,
// porta-malas y~.85 z~-1.8. Peças paintáveis: corpo = userData.dentable[0],
// portas = userData.doors[i].children[0]. Rodas = userData.wheels[i].children[0]
// (material em array [pneu, cubo, cubo]).

// ---------- materiais ----------
const paintCache=new Map();
export function paintMat(color){
  if(!paintCache.has(color))
    paintCache.set(color,new THREE.MeshStandardMaterial({color,roughness:.3,metalness:.5}));
  return paintCache.get(color);
}
const hubCache=new Map();
function hubMat(color){
  if(!hubCache.has(color))
    hubCache.set(color,new THREE.MeshStandardMaterial({color,roughness:.3,metalness:.85}));
  return hubCache.get(color);
}
const carbonM=new THREE.MeshStandardMaterial({color:0x1b1d22,roughness:.45,metalness:.4});

// textura de brilho suave (radial branco) reaproveitada pelo neon
let glowTex=null;
function softGlow(){
  if(glowTex)return glowTex;
  const c=document.createElement('canvas');c.width=c.height=128;
  const x=c.getContext('2d');
  const g=x.createRadialGradient(64,64,4,64,64,64);
  g.addColorStop(0,'rgba(255,255,255,1)');
  g.addColorStop(.5,'rgba(255,255,255,.5)');
  g.addColorStop(1,'rgba(255,255,255,0)');
  x.fillStyle=g;x.fillRect(0,0,128,128);
  glowTex=new THREE.CanvasTexture(c);
  return glowTex;
}

function mods(carG){return carG.userData.mods||(carG.userData.mods={
  paint:carG.userData.color??0xff2e88,rims:'stock',spoiler:'none',neon:null,hood:'stock'});}

// ---------- pintura ----------
function paintMeshes(carG){
  const out=[];
  const body=carG.userData.dentable?.[0];if(body)out.push(body);
  for(const d of carG.userData.doors||[])if(d.children[0])out.push(d.children[0]);
  return out;
}
export function applyPaint(carG,color){
  const m=paintMat(color);
  for(const mesh of paintMeshes(carG))mesh.material=m;
  carG.userData.color=color;mods(carG).paint=color;
  // re-pinta o aerofólio "body color" se houver um instalado pintável
  const sp=carG.userData.spoilerMesh;
  if(sp&&sp.userData.bodyColored)sp.traverse(o=>{if(o.userData.paintPart)o.material=m;});
}

// ---------- rodas / rims ----------
export function setRims(carG,hubColor){
  const hm=hubMat(hubColor);
  for(const wg of carG.userData.wheels||[]){
    const w=wg.children[0];if(!w)continue;
    const tire=Array.isArray(w.material)?w.material[0]:w.material;
    w.material=[tire,hm,hm]; // mantém o pneu, troca as faces (cubo/rim)
  }
  mods(carG).rims=hubColor;
}

// ---------- aerofólio ----------
function buildSpoiler(type,paint){
  const g=new THREE.Group();
  const bodyColored=type!=='lip';
  if(type==='lip'){
    const lip=new THREE.Mesh(new THREE.BoxGeometry(1.5,.06,.2),carbonM);
    lip.position.set(0,.92,-1.96);lip.rotation.x=-.32;g.add(lip);
  }else{
    const y=type==='gt'?1.2:1.0,bw=type==='gt'?.5:.4,by=type==='gt'?1.46:1.2;
    for(const sx of[-1,1]){
      const up=new THREE.Mesh(new THREE.BoxGeometry(.07,by-.86,.16),carbonM);
      up.position.set(sx*.58,(by+ .86)/2-.02,-1.95);up.rotation.x=-.12;g.add(up);
    }
    const blade=new THREE.Mesh(new THREE.BoxGeometry(1.55,.08,bw),paint);
    blade.position.set(0,by,-1.99);blade.rotation.x=-.12;
    blade.userData.paintPart=true;g.add(blade);
  }
  g.userData.bodyColored=bodyColored;
  return g;
}
export function setSpoiler(carG,type){
  const old=carG.userData.spoilerMesh;
  if(old){carG.remove(old);}
  carG.userData.spoilerMesh=null;
  if(type&&type!=='none'){
    const sp=buildSpoiler(type,paintMat(carG.userData.color??0xff2e88));
    carG.add(sp);carG.userData.spoilerMesh=sp;
  }
  mods(carG).spoiler=type;
}

// ---------- capô (scoop / vents) ----------
function buildHood(type){
  const g=new THREE.Group();
  if(type==='scoop'){
    const s=new THREE.Mesh(new THREE.BoxGeometry(.52,.16,.62),carbonM);
    s.position.set(0,.93,1.45);g.add(s);
    const mouth=new THREE.Mesh(new THREE.BoxGeometry(.46,.1,.08),
      new THREE.MeshBasicMaterial({color:0x05060a}));
    mouth.position.set(0,.93,1.78);g.add(mouth);
  }else if(type==='vents'){
    for(const sx of[-1,1]){
      const v=new THREE.Mesh(new THREE.BoxGeometry(.16,.07,.5),carbonM);
      v.position.set(sx*.34,.89,1.4);v.rotation.x=-.18;g.add(v);
    }
  }
  return g;
}
export function setHood(carG,type){
  const old=carG.userData.hoodMesh;
  if(old)carG.remove(old);
  carG.userData.hoodMesh=null;
  if(type&&type!=='stock'){
    const h=buildHood(type);carG.add(h);carG.userData.hoodMesh=h;
  }
  mods(carG).hood=type;
}

// ---------- neon (underglow) ----------
export function setNeon(carG,color){
  const old=carG.userData.neonMesh;
  if(old)carG.remove(old);
  carG.userData.neonMesh=null;
  if(color!=null){
    const mat=new THREE.MeshBasicMaterial({map:softGlow(),color,transparent:true,
      opacity:.85,blending:THREE.AdditiveBlending,depthWrite:false,fog:false});
    const glow=new THREE.Mesh(new THREE.PlaneGeometry(2.7,5.6),mat);
    glow.rotation.x=-Math.PI/2;glow.position.set(0,.05,-.1);glow.renderOrder=1;
    carG.add(glow);carG.userData.neonMesh=glow;
  }
  mods(carG).neon=color;
}

// ---------- reparo: desfaz as amassadas (ver dentCar em entities.js) ----------
export function repairCar(carG){
  let fixed=false;
  for(const m of carG.userData.dentable||[]){
    if(m.userData.dented&&m.geometry.userData?.orig){
      const p=m.geometry.attributes.position;
      p.array.set(m.geometry.userData.orig);p.needsUpdate=true;
      m.geometry.computeVertexNormals();fixed=true;
    }
  }
  return fixed;
}

// Padrão de modelo: build() puro pro model-viewer (mostra um aerofólio GT + scoop)
function buildDemo(){
  const g=new THREE.Group();
  const wing=buildSpoiler('gt',paintMat(0xff2e88));
  wing.position.set(0,-.4,2.0);g.add(wing);
  const hood=buildHood('scoop');hood.position.set(0,-.9,-1.2);g.add(hood);
  return g;
}
export default {category:'Vehicles',label:'Car Customs',build:buildDemo};
