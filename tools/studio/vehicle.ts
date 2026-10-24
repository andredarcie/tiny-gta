// Vehicle photo studio (dev tool, not part of the game): renders one vehicle model under
// the game's daylight look (AgX, sun + sky fill, asphalt ground) from the camera angles of
// the reference photos, so model and photos can be compared side by side.
//   http://localhost:5173/tools/studio/vehicle.html?model=uno&color=b9bcbf
//   window.__view('front34') → frames that view; window.__ready = true once built.
// Used by test/uno-studio.spec.ts (headed), which saves output/visual/uno/<view>.png.
import * as THREE from 'three';
import uno from '../../src/assets/models/vehicles/fiat-uno.ts';
import hilux from '../../src/assets/models/vehicles/hilux.ts';

const q=new URLSearchParams(location.search);
const MODELS={uno,hilux};
const model=MODELS[(q.get('model')||'uno') as keyof typeof MODELS]||uno;
const color=parseInt(q.get('color')||'b9bcbf',16);
const canvas=document.getElementById('studio') as HTMLCanvasElement;
const renderer=new THREE.WebGLRenderer({canvas,antialias:true,preserveDrawingBuffer:true});
renderer.setPixelRatio(1);renderer.setSize(innerWidth,innerHeight);
renderer.toneMapping=THREE.AgXToneMapping;renderer.toneMappingExposure=1.15;
renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
const scene=new THREE.Scene();
scene.background=new THREE.Color(0xb7c6d3);
scene.add(new THREE.HemisphereLight(0xa9c4e0,0x6b6152,.9));
const sun=new THREE.DirectionalLight(0xfff4e4,3.0);sun.position.set(6,9,7);sun.castShadow=true;
sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-6,right:6,top:6,bottom:-6});sun.shadow.bias=-.0004;sun.shadow.normalBias=.02;scene.add(sun);
const ground=new THREE.Mesh(new THREE.PlaneGeometry(60,60),new THREE.MeshStandardMaterial({color:0x7a7874,roughness:.95}));
ground.rotation.x=-Math.PI/2;ground.receiveShadow=true;scene.add(ground);
// a simple environment so paint and glass reflect a sky
const pm=new THREE.PMREMGenerator(renderer);
const env=new THREE.Scene();env.background=new THREE.Color(0x9fb6c9);
const envGround=new THREE.Mesh(new THREE.SphereGeometry(10,16,8,0,Math.PI*2,Math.PI/2,Math.PI/2),new THREE.MeshBasicMaterial({color:0x6d6a64,side:THREE.BackSide}));env.add(envGround);
scene.environment=pm.fromScene(env).texture;

const car=model.build({color});
car.traverse(o=>{if((o as THREE.Mesh).isMesh){o.castShadow=true;o.receiveShadow=true;}});
scene.add(car);
// frame the body only: the night headlight beam (a plane ~5 m ahead) would inflate the box
const box=new THREE.Box3();car.updateMatrixWorld(true);
car.traverse(o=>{const m=o as THREE.Mesh;if(m.isMesh&&m.visible&&m.position.z<3)box.expandByObject(m);});
const c=box.getCenter(new THREE.Vector3());
const camera=new THREE.PerspectiveCamera(30,innerWidth/innerHeight,.1,200);
const span=Math.max(1,(box.max.z-box.min.z)/4.4);   // longer vehicles: step the camera back
// views: [azimuth from the car's front (deg, + to the car's driver side -x), elevation (deg), distance, fov]
const VIEWS:Record<string,[number,number,number,number]>={
  front:[0,6,11,28],front34:[38,10,10,30],side:[90,4,13,28],rear34:[140,10,10,30],rear:[180,6,11,28],
  front34R:[-38,10,10,30],rear34R:[-140,10,10,30],top:[90,88,14,30],
};
(window as any).__view=(name:string)=>{
  const [az,el,d0,fov]=VIEWS[name];const d=d0*span;const a=az*Math.PI/180,e=el*Math.PI/180;
  camera.fov=fov;camera.position.set(c.x-Math.sin(a)*Math.cos(e)*d,c.y+Math.sin(e)*d,c.z+Math.cos(a)*Math.cos(e)*d);
  camera.up.set(0,1,0);if(name==='top')camera.up.set(0,0,1);
  camera.lookAt(c.x,c.y*.8,c.z);camera.updateProjectionMatrix();renderer.render(scene,camera);
};
// orthographic elevations for overlays on measured photos: 300 px per rig unit, frame
// centred on (z=.2, y=.8) for the side, (x=0, y=.8) front/rear; the page must be 1500×1050
const ortho=new THREE.OrthographicCamera(-2.5*span,2.5*span,1.75*span,-1.75*span,.1,100);
(window as any).__ortho=(name:'side'|'front'|'rear'|'top')=>{
  ground.visible=false;scene.background=new THREE.Color(0xffffff);
  if(name==='side'){ortho.position.set(20,.8,.2);ortho.up.set(0,1,0);ortho.lookAt(0,.8,.2);}
  if(name==='front'){ortho.position.set(0,.8,20);ortho.up.set(0,1,0);ortho.lookAt(0,.8,0);}
  if(name==='rear'){ortho.position.set(0,.8,-20);ortho.up.set(0,1,0);ortho.lookAt(0,.8,0);}
  if(name==='top'){ortho.position.set(0,20,.2);ortho.up.set(-1,0,0);ortho.lookAt(0,0,.2);}
  ortho.updateProjectionMatrix();renderer.render(scene,ortho);
  ground.visible=true;scene.background=new THREE.Color(0xb7c6d3);
};
(window as any).__view('front34');
(window as any).__ready=true;
addEventListener('resize',()=>{renderer.setSize(innerWidth,innerHeight);camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();});
