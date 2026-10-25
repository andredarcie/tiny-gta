// Model photo studio (dev tool, not part of the game): renders ANY model of
// src/assets/models under the game's daylight look (AgX, sun + sky fill, a grass ground)
// so a landmark rebuilt from Street View can be compared with its photos before it goes
// into the town. Driven by tools/shoot-model.ts (off-screen browser), which saves PNGs.
//   http://localhost:5173/tools/studio/model.html?m=divinolandia/cristo-redentor&opts={}
//   window.__view(az,el,dist,fov,[tx,ty,tz]) → az = degrees from the model's +z (its front)
//   toward +x, el = degrees above the horizon, dist in metres from the target (default:
//   the model's bounding-box centre); window.__ready = true once built.
import * as THREE from 'three';

const MODELS=import.meta.glob('../../src/assets/models/**/*.ts');
const q=new URLSearchParams(location.search);
const path=`../../src/assets/models/${q.get('m')||'divinolandia/cristo-redentor'}.ts`;
const opts=JSON.parse(q.get('opts')||'{}') as Record<string,unknown>;

const canvas=document.getElementById('studio') as HTMLCanvasElement;
const renderer=new THREE.WebGLRenderer({canvas,antialias:true,preserveDrawingBuffer:true});
renderer.setPixelRatio(1);renderer.setSize(innerWidth,innerHeight);
renderer.toneMapping=THREE.AgXToneMapping;renderer.toneMappingExposure=1.1;
renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
const scene=new THREE.Scene();
scene.background=new THREE.Color(0xb9c7d2);
scene.add(new THREE.HemisphereLight(0xb4cbe2,0x6b6152,1.0));
const sun=new THREE.DirectionalLight(0xfff2e0,2.8);sun.castShadow=true;sun.shadow.mapSize.set(4096,4096);
sun.shadow.bias=-.0004;sun.shadow.normalBias=.03;scene.add(sun);scene.add(sun.target);
const ground=new THREE.Mesh(new THREE.PlaneGeometry(400,400),new THREE.MeshLambertMaterial({color:0x6f7f4a}));
ground.rotation.x=-Math.PI/2;ground.position.y=-.02;ground.receiveShadow=true;scene.add(ground);

const mod=(await MODELS[path]()) as {default:{build:(o:Record<string,unknown>)=>THREE.Object3D}};
const obj=mod.default.build(opts);
obj.traverse(o=>{if((o as THREE.Mesh).isMesh){o.castShadow=true;o.receiveShadow=true;}});
scene.add(obj);obj.updateMatrixWorld(true);
const box=new THREE.Box3().setFromObject(obj),c=box.getCenter(new THREE.Vector3()),size=box.getSize(new THREE.Vector3());
const R=Math.max(size.x,size.y,size.z);
sun.position.set(c.x+R*.6,c.y+R*1.1,c.z+R*.8);sun.target.position.copy(c);
Object.assign(sun.shadow.camera,{left:-R,right:R,top:R,bottom:-R,near:.1,far:R*4});sun.shadow.camera.updateProjectionMatrix();
const camera=new THREE.PerspectiveCamera(35,innerWidth/innerHeight,.05,R*20);
(window as unknown as {__view:unknown}).__view=(az:number,el:number,dist?:number,fov=35,t?:[number,number,number]):void=>{
  const T=t?new THREE.Vector3(...t):c,a=az*Math.PI/180,e=el*Math.PI/180,d=dist??R*1.6;
  camera.fov=fov;camera.position.set(T.x+Math.sin(a)*Math.cos(e)*d,T.y+Math.sin(e)*d,T.z+Math.cos(a)*Math.cos(e)*d);
  camera.lookAt(T);camera.updateProjectionMatrix();renderer.render(scene,camera);
};
(window as unknown as {__info:unknown}).__info={centre:c.toArray(),size:size.toArray()};
(window as unknown as {__view:(a:number,e:number)=>void}).__view(30,15);
(window as unknown as {__ready:boolean}).__ready=true;
