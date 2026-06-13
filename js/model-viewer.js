import * as THREE from 'three';
import {state} from './state.js';

// Galeria de objetos do jogo: um modal com renderer/cena próprios (separados do
// jogo) que instancia cada modelo pela sua fábrica e o exibe centralizado e
// girando. As fábricas que fazem scene.add() no mundo são "reparentadas": ao
// adicionar o objeto ao pivot daqui, o THREE o remove da cena do jogo sozinho.

// Cada entrada importa o módulo sob demanda e devolve um Object3D pronto pra ver.
// `cat` é a pasta dentro de assets/models (vira a categoria do 1º combobox).
// Cores escolhidas pra combinar com a paleta neon do jogo.
const PINK=0xff2e88,CYAN=0x19e3ff,GOLD=0xffd24a;
const REGISTRY=[
  {cat:'Vehicles',  label:'Car — player (pink)',  load:async()=>(await import('../assets/models/vehicles/car.js')).makeCar(PINK,false)},
  {cat:'Vehicles',  label:'Car — police',         load:async()=>(await import('../assets/models/vehicles/car.js')).makeCar(0x1b2b4a,true)},
  {cat:'Aircraft',  label:'Plane',                load:async()=>(await import('../assets/models/aircraft/plane.js')).makePlane()},
  {cat:'Police',    label:'Helicopter',           load:async()=>(await import('../assets/models/police/helicopter.js')).makeHeli()},
  {cat:'Characters',label:'Pedestrian',           load:async()=>{const m=await import('../assets/models/characters/pedestrian.js');return m.makePed(m.shirtColors[0],0x3a3f4a);}},
  {cat:'Weapons',   label:'Pistol',               load:async()=>(await import('../assets/models/weapons/player-gun.js')).makeGunModel()},
  {cat:'Weapons',   label:'Bazooka',              load:async()=>(await import('../assets/models/weapons/bazooka.js')).makeBazookaModel()},
  {cat:'Weapons',   label:'Missile',              load:async()=>(await import('../assets/models/weapons/bazooka.js')).makeMissileModel()},
  {cat:'Weapons',   label:'Gang gun',             load:async()=>(await import('../assets/models/weapons/gang-gun.js')).makeGangGun()},
  {cat:'Missions',  label:'Money drop',           load:async()=>(await import('../assets/models/missions/money-drop.js')).makeMoneyDrop()},
  {cat:'Missions',  label:'Story arrow',          load:async()=>(await import('../assets/models/missions/story-arrow.js')).makeStoryArrow().arrow},
  {cat:'Missions',  label:'Story marker',         load:async()=>(await import('../assets/models/missions/story-marker.js')).makeStoryMarker(GOLD).marker},
  {cat:'Missions',  label:'Story beacon',         load:async()=>(await import('../assets/models/missions/story-beacon.js')).makeStoryBeacon(CYAN)},
  {cat:'Missions',  label:'Story bottle',         load:async()=>(await import('../assets/models/missions/story-bottle.js')).makeStoryBottle(CYAN)},
  {cat:'Missions',  label:'Story box',            load:async()=>(await import('../assets/models/missions/story-box.js')).makeStoryBox(GOLD)},
  {cat:'Missions',  label:'Story gem',            load:async()=>(await import('../assets/models/missions/story-gem.js')).makeStoryGem(CYAN)},
  {cat:'Missions',  label:'Story USB',            load:async()=>(await import('../assets/models/missions/story-usb.js')).makeStoryUsb(GOLD)},
  {cat:'Missions',  label:'Delivery marker',      load:async()=>{const m=(await import('../assets/models/missions/delivery-marker.js')).makeDeliveryMarker(CYAN);const g=new THREE.Group();g.add(m.ring,m.beacon);return g;}},
  {cat:'City',      label:'Door arrow',           load:async()=>(await import('../assets/models/city/door-arrow.js')).makeDoorArrow()},
  {cat:'Effects',   label:'Bullet',               load:async()=>(await import('../assets/models/effects/bullet.js')).makeBulletModel()},
  {cat:'Effects',   label:'Explosion',            load:async()=>(await import('../assets/models/effects/explosion.js')).makeExplosionModel()},
  {cat:'Effects',   label:'Blood puddle',         load:async()=>(await import('../assets/models/effects/blood-puddle.js')).makeBloodPuddle()},
  {cat:'Effects',   label:'Impact ring',          load:async()=>(await import('../assets/models/effects/impact-ring.js')).makeImpactRing(1,CYAN)},
];

// Categorias na ordem em que aparecem no registro
const CATEGORIES=[...new Set(REGISTRY.map(m=>m.cat))];

let renderer,vscene,vcamera,pivot,holder,current,raf,ready=false;
let prevPaused=false;

function el(id){return document.getElementById(id);}

function build(){
  const canvas=el('mv-canvas');
  renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:true});
  renderer.setPixelRatio(Math.min(devicePixelRatio,2));
  renderer.shadowMap.enabled=true;
  renderer.shadowMap.type=THREE.PCFShadowMap;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure=1.2;

  vscene=new THREE.Scene();
  vcamera=new THREE.PerspectiveCamera(45,1,.01,1000);

  vscene.add(new THREE.HemisphereLight(0xbfdfff,0x4a3a55,1.1));
  const key=new THREE.DirectionalLight(0xfff1d6,2.2);
  key.position.set(4,7,5);key.castShadow=true;
  key.shadow.mapSize.set(1024,1024);
  vscene.add(key);
  const rim=new THREE.DirectionalLight(0xff8fc8,.7);
  rim.position.set(-5,3,-4);vscene.add(rim);

  pivot=new THREE.Group();
  holder=new THREE.Group();
  pivot.add(holder);
  vscene.add(pivot);

  // 1º combobox: categorias (uma por pasta de assets/models)
  const catSel=el('mv-cat');
  catSel.innerHTML='';
  CATEGORIES.forEach(c=>{
    const o=document.createElement('option');
    o.value=c;o.textContent=c;catSel.appendChild(o);
  });
  catSel.addEventListener('change',()=>fillObjects(catSel.value));

  // 2º combobox: objetos da categoria escolhida
  el('mv-select').addEventListener('change',e=>select(+e.target.value));

  el('mv-close').addEventListener('click',close);
  el('modelviewer').addEventListener('pointerdown',e=>{
    if(e.target===el('modelviewer'))close(); // clique fora da caixa fecha
  });

  ready=true;
}

// Preenche o combobox de objetos com os itens da categoria e seleciona o 1º
function fillObjects(cat){
  const sel=el('mv-select');
  sel.innerHTML='';
  REGISTRY.forEach((m,i)=>{
    if(m.cat!==cat)return;
    const o=document.createElement('option');
    o.value=String(i);o.textContent=m.label;sel.appendChild(o);
  });
  if(sel.options.length)select(+sel.options[0].value);
}

function resize(){
  const wrap=el('mv-stage');
  const w=wrap.clientWidth,h=wrap.clientHeight;
  if(!w||!h)return;
  renderer.setSize(w,h,false);
  vcamera.aspect=w/h;vcamera.updateProjectionMatrix();
}

async function select(i){
  const entry=REGISTRY[i];
  if(!entry)return;
  if(current){holder.remove(current);current=null;}
  let obj;
  try{obj=await entry.load();}catch(err){console.error('model-viewer:',err);return;}
  if(!obj)return;
  if(!state.viewerOpen){ // fechou enquanto carregava
    return;
  }
  obj.position.set(0,0,0);
  obj.rotation.set(0,0,0);
  holder.add(obj);
  current=obj;

  // centraliza e enquadra pela esfera envolvente
  const box=new THREE.Box3().setFromObject(holder);
  const center=box.getCenter(new THREE.Vector3());
  holder.position.set(-center.x,-center.y,-center.z);
  const sphere=box.getBoundingSphere(new THREE.Sphere());
  const r=Math.max(sphere.radius,.2);
  const dist=r/Math.sin((vcamera.fov*Math.PI/180)/2)*1.25;
  vcamera.position.set(dist*.45,dist*.32,dist);
  vcamera.near=Math.max(dist/100,.01);vcamera.far=dist*10;
  vcamera.lookAt(0,0,0);
  vcamera.updateProjectionMatrix();
  pivot.rotation.y=0; // objeto fixo, sem girar, centralizado
}

function loop(){
  raf=requestAnimationFrame(loop);
  renderer.render(vscene,vcamera);
}

export function openModelViewer(){
  if(state.viewerOpen)return;
  if(!ready)build();
  state.viewerOpen=true;
  prevPaused=state.paused;
  state.paused=true; // congela o jogo por baixo sem mostrar o overlay PAUSED
  document.exitPointerLock?.();
  el('modelviewer').classList.add('open');
  el('modelviewer').setAttribute('aria-hidden','false');
  resize();
  el('mv-cat').value=CATEGORIES[0];
  fillObjects(CATEGORIES[0]);
  loop();
  addEventListener('resize',resize);
}

export function closeModelViewer(){
  if(!state.viewerOpen)return;
  state.viewerOpen=false;
  cancelAnimationFrame(raf);
  removeEventListener('resize',resize);
  el('modelviewer').classList.remove('open');
  el('modelviewer').setAttribute('aria-hidden','true');
  if(current){holder.remove(current);current=null;}
  state.paused=prevPaused;
}

function close(){closeModelViewer();}

export function toggleModelViewer(){
  if(state.viewerOpen)closeModelViewer();else openModelViewer();
}
