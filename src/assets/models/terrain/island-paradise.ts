import * as THREE from 'three';
import {scene} from '@/core/engine.ts';
import {ISLAND_CX,ISLAND_CZ,ISLAND_MAXR,islandCoastR,islandHeight,
  clamp} from '@/core/constants.ts';
import {makeRng} from '@/core/rng.ts';
// Seeded so the paradise island's palms/rocks/props land in the same spot every
// load (the rest of the world is baked to world.json; this island is still built
// procedurally, just deterministically now — externalizing it is a follow-up).
const {random,rand,irand}=makeRng(0x15a4d);
import {matte} from '../matte.ts';
import {bakeProp} from '../props/prop-merge.ts';
import {placeNature} from '../nature/batch.ts';
import {addLighthouse} from '../props/lighthouse.ts';

// ====== ILHA PARADISÍACA (a oeste, alcançável de barco) =====================
// Tudo aqui segue a MESMA islandHeight/islandCoastR de constants.js que o gameplay
// usa (groundHeight/isLand) — o relevo visual bate 1:1 com a física, e a linha
// d'água da areia coincide com onde se começa a nadar. Empilhamento em Y p/ evitar
// z-fighting: mar -0.32 (sea.js) < raso -0.305/-0.30 < espuma -0.04 < areia/terreno.

const CX=ISLAND_CX, CZ=ISLAND_CZ;
const SEA_Y=-.32;

// ---- paleta do terreno (vertex colors) ----
const C_WET =new THREE.Color(0xcdb079); // areia molhada (orla / debaixo d'água)
const C_SAND=new THREE.Color(0xece0b0); // praia seca
const C_GRS0=new THREE.Color(0x77b85c); // grama clara (sopé)
const C_GRS =new THREE.Color(0x4f9a4a); // grama
const C_GRSD=new THREE.Color(0x356f3b); // grama escura (vales)
const C_ROCK=new THREE.Color(0x9a9082); // rocha
const C_ROKD=new THREE.Color(0x6c6357); // rocha escura (pico)
const _ca=new THREE.Color(),_cb=new THREE.Color();
function lerpC(a: THREE.Color,b: THREE.Color,t: number): THREE.Color{return _ca.copy(a).lerp(b,clamp(t,0,1));}

// ruído por vértice (hash determinístico) p/ quebrar o bandeamento das cores
function hash(x: number,z: number): number{const s=Math.sin(x*12.9898+z*78.233)*43758.5453;return s-Math.floor(s);}

// cor do terreno por altura (+ leve ruído): areia → grama → rocha
function terrainColor(h: number,x: number,z: number): THREE.Color{
  const n=(hash(x,z)-.5);
  let c;
  if(h<0)             c=lerpC(C_WET,C_WET,0);                 // saia submersa
  else if(h<1.6)      c=lerpC(C_WET,C_SAND,h/1.6);            // praia
  else if(h<3.4)      c=lerpC(C_SAND,C_GRS0,(h-1.6)/1.8);     // transição areia→grama
  else if(h<12)       c=lerpC(C_GRS0,C_GRS,(h-3.4)/8.6);      // gramado
  else if(h<18)       c=lerpC(C_GRS,C_ROCK,(h-12)/6);         // grama→rocha
  else                c=lerpC(C_ROCK,C_ROKD,(h-18)/7);        // costões altos
  _cb.copy(c);
  // tonaliza: grama ganha manchas mais escuras/claras; areia varia de grão
  const k=h>=1.6&&h<14?.12:.06;
  _cb.offsetHSL(0,n*.05,n*k);
  return _cb;
}

// altura amostrada pro VISUAL: terra (= islandHeight, bate com a física) dentro da
// costa, e uma saia que mergulha abaixo do mar pra fora (escondida pelo disco do mar)
function sampleH(x: number,z: number): number{
  const dx=x-CX,dz=z-CZ,d=Math.hypot(dx,dz);
  const cr=islandCoastR(Math.atan2(dz,dx));
  if(d<cr)return islandHeight(x,z);
  return -Math.min(7,(d-cr)*.38); // saia submersa contínua (0 na costa, desce p/ fora)
}

// ---- terreno: malha deformada com vertex colors ----
function buildTerrain(): void{
  const SPAN=ISLAND_MAXR*2+8, SEG=84;        // ~196 un, passo ~2.3
  const geo=new THREE.PlaneGeometry(SPAN,SPAN,SEG,SEG);
  const pos=geo.attributes.position;
  const colors=new Float32Array(pos.count*3);
  for(let i=0;i<pos.count;i++){
    // PlaneGeometry deita com rotation.x=-90°: x local→x mundo, y local→-z mundo
    const lx=pos.getX(i), ly=pos.getY(i);
    const wx=CX+lx, wz=CZ-ly;
    const h=sampleH(wx,wz);
    pos.setZ(i,h);                            // z local vira altura após o giro
    const c=terrainColor(h,wx,wz);
    colors[i*3]=c.r;colors[i*3+1]=c.g;colors[i*3+2]=c.b;
  }
  geo.setAttribute('color',new THREE.BufferAttribute(colors,3));
  geo.computeVertexNormals();
  const mat=matte({vertexColors:true});
  const m=new THREE.Mesh(geo,mat);
  m.rotation.x=-Math.PI/2;m.position.set(CX,0,CZ);
  // recebe sombra (palmeiras/farol/pedras se projetam nela), mas NÃO projeta: o
  // domo grande e liso ficaria com auto-sombra "blocky" no shadow map de baixa res.
  m.receiveShadow=true;m.castShadow=false;
  m.matrixAutoUpdate=false;m.updateMatrix();
  scene.add(m);
}

// faixa polar (anel com furo) seguindo a costa da ilha, a um deslocamento da linha
// d'água — pro raso turquesa e pra espuma
function coastRing(inExtra: number,outExtra: number,seg=120): THREE.ShapeGeometry{
  const sh=new THREE.Shape(),hole=new THREE.Path();
  for(let i=0;i<=seg;i++){
    const th=i/seg*Math.PI*2, cr=islandCoastR(th);
    const ro=cr+outExtra, ri=cr+inExtra;
    const co=Math.cos(th), so=-Math.sin(th);  // -sin: Y local → -Z mundo
    i?sh.lineTo(co*ro,so*ro):sh.moveTo(co*ro,so*ro);
    i?hole.lineTo(co*ri,so*ri):hole.moveTo(co*ri,so*ri);
  }
  sh.closePath();hole.closePath();sh.holes.push(hole);
  return new THREE.ShapeGeometry(sh);
}
function layRing(geo: THREE.BufferGeometry,mat: THREE.Material,y: number): THREE.Mesh{
  const m=new THREE.Mesh(geo,mat);
  m.rotation.x=-Math.PI/2;m.position.set(CX,y,CZ);
  m.matrixAutoUpdate=false;m.updateMatrix();
  scene.add(m);return m;
}

interface Foam{m: THREE.Mesh; ph: number; spd: number; amp: number;}

// raso turquesa em dois anéis (gradiente) + espuma pulsante na linha d'água
function buildWater(): Foam[]{
  const shal1=new THREE.MeshBasicMaterial({color:0x52e0d6,transparent:true,opacity:.42,depthWrite:false});
  const shal2=new THREE.MeshBasicMaterial({color:0x39bcd0,transparent:true,opacity:.26,depthWrite:false});
  layRing(coastRing(-4,16),shal1,-.305);
  layRing(coastRing(14,40),shal2,-.30);
  const foam: Foam[]=[];
  for(let k=0;k<3;k++){
    const m=layRing(coastRing(-1.5-k*.7,2.2),
      new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:.2,depthWrite:false}),
      -.04+k*.004);
    m.matrixAutoUpdate=true; // a espuma pulsa de escala
    foam.push({m,ph:k*2.0,spd:.5+k*.13,amp:.014+k*.004});
  }
  return foam;
}

export function updateIslandFoam(foam: Foam[],time: number): void{
  for(const w of foam){
    const s=1+w.amp*(.5+.5*Math.sin(time*w.spd+w.ph));
    w.m.scale.set(s,s,1); // ShapeGeometry está no plano XY local (z = altura): escala x,y
    (w.m.material as THREE.Material).opacity=.05+.30*Math.max(0,Math.sin(time*w.spd+w.ph+1.1));
  }
}

// ===================== PROPS DE ALTA QUALIDADE ==============================

// Palms/rocks/shrubs/grass now come from the Stylized Nature MegaKit (see
// nature/kit.ts). The old procedural builders were removed with the swap.
function addPalmAt(x: number,y: number,z: number): void{
  placeNature('palm',x,y,z,rand(5.8,8.2));
}

function addRockAt(x: number,y: number,z: number,scale: number,_mossy: boolean): void{
  placeNature('rock',x,y+scale*.35,z,scale*rand(1.2,1.6));
}

function addShrubAt(x: number,y: number,z: number): void{
  placeNature('bush',x,y,z,rand(1.0,1.8));
}

// ---- capim de praia: leques de lâminas finas ----
function addGrassTuftAt(x: number,y: number,z: number): void{
  placeNature('grass',x,y,z,rand(0.6,1.1));
}

// ---- cabana de praia com telhado de palha (direto na cena: poucas meshes) ----
const hutWallM=matte({color:0xb58a5a,roughness:1});
const hutPostM=matte({color:0x6e4a2c,roughness:1});
function buildHut(): THREE.Group{
  const g=new THREE.Group();
  const w=3.4,d=2.8,wallH=2.0;
  // piso elevado de tábuas
  const floor=new THREE.Mesh(new THREE.BoxGeometry(w,.2,d),hutPostM);
  floor.position.y=.4;floor.castShadow=true;floor.receiveShadow=true;g.add(floor);
  // 4 cantos (postes)
  for(const sx of[-1,1])for(const sz of[-1,1]){
    const post=new THREE.Mesh(new THREE.CylinderGeometry(.1,.1,wallH,6),hutPostM);
    post.position.set(sx*w/2*.92,.4+wallH/2,sz*d/2*.92);post.castShadow=true;g.add(post);
  }
  // parede dos fundos + lateral (frente aberta)
  const back=new THREE.Mesh(new THREE.BoxGeometry(w*.92,wallH,.12),hutWallM);
  back.position.set(0,.4+wallH/2,-d/2*.9);g.add(back);
  const sideL=new THREE.Mesh(new THREE.BoxGeometry(.12,wallH,d*.7),hutWallM);
  sideL.position.set(-w/2*.9,.4+wallH/2,-d*.1);g.add(sideL);
  // telhado de palha (pirâmide larga em duas camadas)
  for(const[ry,rs,col]of[[wallH+.5,1.25,0xcaa46a],[wallH+1.0,.8,0xb88f55]]){
    const roof=new THREE.Mesh(new THREE.ConeGeometry(w*rs,1.3,4),matte({color:col,roughness:1}));
    roof.position.set(0,.4+ry,0);roof.rotation.y=Math.PI/4;roof.castShadow=true;g.add(roof);
  }
  return g;
}

// ---- píer/dock de madeira p/ atracar a lancha (assado: funde + culling perto) ----
const dockM=matte({color:0x7a5836,roughness:1});
const dockDk=matte({color:0x8a6a44,roughness:1});
function buildDock(x0: number,z0: number,dirx: number,dirz: number,len: number): THREE.Group{
  const g=new THREE.Group();
  const segs=Math.round(len/1.5);
  const px=-dirz, pz=dirx; // perpendicular (largura)
  for(let i=0;i<=segs;i++){
    const t=i/segs, wx=x0+dirx*len*t, wz=z0+dirz*len*t;
    // tábuas do deck
    const plank=new THREE.Mesh(new THREE.BoxGeometry(2.0,.16,1.4),i%2?dockDk:dockM);
    plank.position.set(wx,.45,wz);
    plank.rotation.y=Math.atan2(dirx,dirz);
    plank.castShadow=true;plank.receiveShadow=true;g.add(plank);
    // pilares (a cada 2 segmentos) descendo até a água
    if(i%2===0)for(const s of[-1,1]){
      const post=new THREE.Mesh(new THREE.CylinderGeometry(.12,.12,1.6,6),dockM);
      post.position.set(wx+px*s*.85,-.25,wz+pz*s*.85);post.castShadow=true;g.add(post);
    }
  }
  return g;
}

// ===================== MONTAGEM ============================================
// Monta a ilha inteira. `solids` (de world.js) recebe o colisor do farol (não dá
// pra atravessar a torre). Terreno/raso/espuma/farol vão direto pra cena (marco
// visível de longe); palmeiras/pedras/arbustos/cabana/píer são ASSADOS (fundem por
// material e somem no culling de props perto — só aparecem de perto, como o resto).
export function buildIslandParadise(solids?: {x0: number; x1: number; z0: number; z1: number}[]): Foam[]{
  buildTerrain();
  const foam=buildWater();

  // posição num ângulo da costa a um deslocamento radial (positivo = mar afora,
  // negativo = ilha adentro). Retorna [x,z].
  const coastPt=(th: number,off: number): [number,number]=>{
    const r=islandCoastR(th)+off;
    return [CX+Math.cos(th)*r, CZ+Math.sin(th)*r];
  };
  const gh=(x: number,z: number): number=>islandHeight(x,z);

  // palmeiras: cinturão denso na praia/sopé (alturas variadas), seguindo o terreno
  for(let k=0;k<54;k++){
    const th=rand(0,Math.PI*2), off=rand(-30,-4);
    const [x,z]=coastPt(th,off);
    const y=gh(x,z);
    if(y>15)continue;                       // não nas cristas rochosas
    addPalmAt(x,y,z);
  }
  // bosque no platô central
  for(let k=0;k<14;k++){
    const a=rand(0,Math.PI*2),rr=rand(0,28);
    const x=CX+Math.cos(a)*rr,z=CZ+Math.sin(a)*rr,y=gh(x,z);
    if(y<3||y>16)continue;
    addPalmAt(x,y,z);
  }

  // pedras: aglomerados na orla (meia-enterradas) + matacões musgosos na encosta
  for(let k=0;k<18;k++){
    const th=rand(0,Math.PI*2),[bx,bz]=coastPt(th,rand(-2,6));
    for(let r=0;r<irand(2,4);r++){
      const x=bx+rand(-2,2),z=bz+rand(-2,2);
      addRockAt(x,Math.max(-.2,gh(x,z)),z,rand(.5,1.3),false);
    }
  }
  for(let k=0;k<10;k++){
    const a=rand(0,Math.PI*2),rr=rand(8,40);
    const x=CX+Math.cos(a)*rr,z=CZ+Math.sin(a)*rr,y=gh(x,z);
    if(y<4)continue;
    addRockAt(x,y,z,rand(.9,2.2),y>9);
  }

  // arbustos floridos + tufos de capim espalhados pelo gramado e pela orla
  for(let k=0;k<40;k++){
    const a=rand(0,Math.PI*2),rr=rand(4,52);
    const x=CX+Math.cos(a)*rr,z=CZ+Math.sin(a)*rr,y=gh(x,z);
    if(y<=0.2||y>15)continue;
    (random()<.55?addShrubAt:addGrassTuftAt)(x,y,z);
  }
  // franja de capim bem na linha da praia
  for(let k=0;k<26;k++){
    const th=rand(0,Math.PI*2),[x,z]=coastPt(th,rand(-8,-1));
    const y=gh(x,z);if(y>3)continue;
    addGrassTuftAt(x,y,z);
  }

  // FAROL no ponto mais alto (marco visível de longe) + base de pedras. A torre é
  // sólida (AABB no solids) — dá pra subir o morro mas não atravessar o farol.
  {
    const y=gh(CX,CZ);
    scene.add(addLighthouse(CX,y,CZ));
    solids?.push({x0:CX-2.6,x1:CX+2.6,z0:CZ-2.6,z1:CZ+2.6});
    for(let k=0;k<7;k++){
      const a=k/7*Math.PI*2,x=CX+Math.cos(a)*4.6,z=CZ+Math.sin(a)*4.6;
      addRockAt(x,gh(x,z),z,rand(.7,1.2),true);
    }
  }

  // CABANA de praia numa clareira plana perto da orla nordeste (assada)
  {
    const th=0.7, [x,z]=coastPt(th,-14), y=gh(x,z);
    const hut=buildHut();hut.position.set(x,y,z);hut.rotation.y=th+Math.PI;
    bakeProp(hut);
  }

  // DOCK saindo da praia leste (lado da cidade) rumo ao mar — ponto de atracar
  {
    const th=0, [bx,bz]=coastPt(th,-3); // base na areia
    bakeProp(buildDock(bx,bz,Math.cos(th),Math.sin(th),22));
  }

  return foam;
}
