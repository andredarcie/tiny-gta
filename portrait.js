// Side-by-side portrait harness: renders the Schedule I-style PLAYER ped next to
// real Schedule I reference screenshots so we can judge how close the look is.
// Loaded by /portrait.html and screenshotted by test/portrait.spec.js.
// buildToonPlayer is pure (no scene.add), so we can render it in throwaway scenes here.
// Lives at repo root + refs in public/ because the Vite dev server doesn't serve
// files under /test/. Both are throwaway test scaffolding.
import * as THREE from 'three';
import {buildToonPlayer} from '/assets/models/characters/pedestrian.js';

// Seed Math.random so the player ped is identical every run (stable comparison).
function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
function seeded(seed,fn){const o=Math.random;Math.random=mulberry32(seed);try{return fn();}finally{Math.random=o;}}

function renderPed(view,w,h){
  const cv=document.createElement('canvas');cv.width=w;cv.height=h;
  const r=new THREE.WebGLRenderer({canvas:cv,antialias:true});
  r.setPixelRatio(1);r.setSize(w,h,false);
  r.toneMapping=THREE.ACESFilmicToneMapping;r.toneMappingExposure=1.12;
  const sc=new THREE.Scene();sc.background=new THREE.Color(0x59616b);
  sc.add(new THREE.HemisphereLight(0xdfeaff,0x33302e,1.0));
  const key=new THREE.DirectionalLight(0xfff0d8,2.1);key.position.set(3,6,5);sc.add(key);
  const rim=new THREE.DirectionalLight(0x8aa0ff,.5);rim.position.set(-4,3,-5);sc.add(rim);
  const ped=seeded(7,()=>buildToonPlayer({color:0x19e3ff}));
  sc.add(ped);
  if(view==='body'){   // natural relaxed stance (arms hang slightly out, like in-game)
    const L=ped.userData.limbs;
    L.leftArm.rotation.z=.15;L.rightArm.rotation.z=-.15;
    ped.updateMatrixWorld(true);
  }
  const cam=new THREE.PerspectiveCamera(view==='face'?24:32,w/h,.01,100);
  if(view==='face'){cam.position.set(0,1.675,.62);cam.lookAt(0,1.645,0);}
  else{cam.position.set(.85,1.3,3.1);cam.lookAt(0,0.9,0);}
  r.render(sc,cam);
  return cv;
}

function loadImg(src){return new Promise((res,rej)=>{const i=new Image();i.onload=()=>res(i);i.onerror=()=>rej(new Error('img '+src));i.src=src;});}
function drawContain(ctx,img,x,y,w,h){
  const s=Math.min(w/img.width,h/img.height),dw=img.width*s,dh=img.height*s;
  ctx.drawImage(img,x+(w-dw)/2,y+(h-dh)/2,dw,dh);
}
function label(ctx,t,x,y){
  ctx.font='16px sans-serif';
  ctx.fillStyle='rgba(0,0,0,.6)';ctx.fillRect(x,y,ctx.measureText(t).width+16,26);
  ctx.fillStyle='#fff';ctx.fillText(t,x+8,y+18);
}

addEventListener('error',e=>console.error('[winerror]',e.message));
addEventListener('unhandledrejection',e=>console.error('[unhandled]',String(e.reason&&e.reason.stack||e.reason)));

(async()=>{
 try{
  console.log('[portrait] start');
  const cmp=document.getElementById('cmp'),ctx=cmp.getContext('2d');
  ctx.fillStyle='#1a1a1a';ctx.fillRect(0,0,1200,900);
  const refFace=await loadImg('/ref/face.jpg');
  const refBody=await loadImg('/ref/body.jpg');
  console.log('[portrait] refs loaded');
  drawContain(ctx,refFace,0,0,600,450);
  drawContain(ctx,refBody,0,450,600,450);
  drawContain(ctx,renderPed('face',600,450),600,0,600,450);
  drawContain(ctx,renderPed('body',600,450),600,450,600,450);
  ctx.strokeStyle='#000';ctx.lineWidth=2;
  ctx.beginPath();ctx.moveTo(600,0);ctx.lineTo(600,900);ctx.moveTo(0,450);ctx.lineTo(1200,450);ctx.stroke();
  label(ctx,'Schedule I — rosto (referencia)',8,8);
  label(ctx,'Schedule I — corpo (referencia)',8,458);
  label(ctx,'Tiny Crime — PLAYER (estilo novo)',608,8);
  label(ctx,'Tiny Crime — PLAYER (estilo novo)',608,458);
  console.log('[portrait] done');
  window.__ready=true;
 }catch(e){
  console.error('[portrait] FAILED',String(e&&e.stack||e));
  window.__err=String(e&&e.stack||e);
 }
})();
