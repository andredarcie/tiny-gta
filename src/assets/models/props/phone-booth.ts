import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {matte} from '../matte.ts';
import {bakeGeometry,bakedMat} from '../bake.ts';
import {NEON} from '@/core/palette.ts';

// Street PHONE BOOTH — the story's contact point (js/story/story.ts). A classic glass
// booth: metal frame, frosted-glass sides, a solid back wall carrying the pay phone,
// an open front (the folding door is swung back), a lit "PHONE" sign band on the roof
// and a small ceiling light, so it reads at night as well.
//
// It stands in the middle of the city, so it is cheap to draw: every static part is
// baked into ONE vertex-coloured mesh, the glass is one mesh, the receiver one mesh and
// the coiled cord one dynamic mesh — ~7 draw calls in all.
//
// Local frame: origin on the floor centre, the OPEN FRONT faces +z, the phone hangs on
// the back wall (z = -BACK). The caller stands at STAND (inside, facing -z).
//
// Live parts the gameplay drives (userData):
//   handset      — the receiver (a separate child). Taken off its hook for a call.
//   hookPos/hookQuat — the handset's resting transform on the hook (booth-local).
//   cordAnchor   — where the coiled cord leaves the phone box (booth-local).
//   cordEnd      — the cord's attachment on the handset (handset-local).
//   span(a,b)    — lay the coiled cord between two booth-local points.
//   setRinging(on,t) — flash the sign + ceiling light while the phone rings.

export const BOOTH_W=1.14, BOOTH_H=2.34, BACK=.56;
export const STAND=new THREE.Vector3(0,0,.12);          // where the caller stands (booth-local)

const frameM=matte({color:0x9aa3ad});
const roofM=matte({color:0x2b2f38});
const phoneM=matte({color:0x1d2027});
const chromeM=matte({color:0xc9ced6});
const keyM=matte({color:0xe8e3d2});
const cordM=matte({color:0x14151a});
const glassM=new THREE.MeshLambertMaterial({color:0xbfe6ee,transparent:true,opacity:.22,depthWrite:false,side:THREE.DoubleSide});

function signTexture(): THREE.CanvasTexture{
  const c=document.createElement('canvas');c.width=256;c.height=48;
  const x=c.getContext('2d')!;
  x.fillStyle='#14091f';x.fillRect(0,0,256,48);
  x.font='900 34px "IBM Plex Mono",monospace';x.textAlign='center';x.textBaseline='middle';
  x.fillStyle='#ffd24a';x.fillText('PHONE',128,26);
  const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;
  return t;
}

// The receiver, baked to one mesh: long axis along local Y (earpiece up, mouthpiece
// down), the cups facing -X.
function buildHandset(): THREE.Mesh{
  const h=new THREE.Group();
  h.add(new THREE.Mesh(new THREE.BoxGeometry(.045,.2,.05),phoneM));
  for(const sy of[1,-1]){
    const cup=new THREE.Mesh(new THREE.BoxGeometry(.06,.07,.075),phoneM);
    cup.position.set(-.028,sy*.105,0);h.add(cup);
  }
  const m=new THREE.Mesh(bakeGeometry(h)!,bakedMat);
  m.name='handset';m.castShadow=true;
  return m;
}

// The coiled cord: SEG short boxes written into ONE geometry, re-laid by span().
const SEG=16;
function buildCord(): {mesh: THREE.Mesh;span: (a: THREE.Vector3,b: THREE.Vector3)=>void}{
  const box=new THREE.BoxGeometry(.022,.022,1).toNonIndexed();
  const bp=box.getAttribute('position') as THREE.BufferAttribute,bn=box.getAttribute('normal') as THREE.BufferAttribute;
  const nv=bp.count;
  const pos=new Float32Array(nv*SEG*3),nor=new Float32Array(nv*SEG*3);
  const geo=new THREE.BufferGeometry();
  geo.setAttribute('position',new THREE.BufferAttribute(pos,3));
  geo.setAttribute('normal',new THREE.BufferAttribute(nor,3));
  const mesh=new THREE.Mesh(geo,cordM);
  mesh.frustumCulled=false;                               // its bounds change every lay
  const pts=Array.from({length:SEG+1},()=>new THREE.Vector3());
  const m=new THREE.Matrix4(),q=new THREE.Quaternion(),sc=new THREE.Vector3(),mid=new THREE.Vector3(),dir=new THREE.Vector3(),v=new THREE.Vector3();
  const Z=new THREE.Vector3(0,0,1);
  const span=(a: THREE.Vector3,b: THREE.Vector3)=>{
    const len=a.distanceTo(b);
    const sag=Math.max(.08,.55-len*.35);                // a slack cord hangs lower
    for(let i=0;i<=SEG;i++){
      const t=i/SEG,p=pts[i].lerpVectors(a,b,t);
      p.y-=Math.sin(t*Math.PI)*sag;
      const coil=Math.sin(t*Math.PI)*.025;               // the coils wobble around the line
      p.x+=Math.cos(t*38)*coil;p.z+=Math.sin(t*38)*coil;
    }
    for(let i=0;i<SEG;i++){
      const p0=pts[i],p1=pts[i+1],d=p0.distanceTo(p1);
      mid.addVectors(p0,p1).multiplyScalar(.5);
      if(d>1e-5)q.setFromUnitVectors(Z,dir.subVectors(p1,p0).divideScalar(d));
      sc.set(1,1,Math.max(.01,d+.01));
      m.compose(mid,q,sc);
      const o=i*nv*3;
      for(let k=0;k<nv;k++){
        v.fromBufferAttribute(bp,k).applyMatrix4(m);pos[o+k*3]=v.x;pos[o+k*3+1]=v.y;pos[o+k*3+2]=v.z;
        v.fromBufferAttribute(bn,k).applyQuaternion(q);nor[o+k*3]=v.x;nor[o+k*3+1]=v.y;nor[o+k*3+2]=v.z;
      }
    }
    geo.attributes.position.needsUpdate=true;geo.attributes.normal.needsUpdate=true;
  };
  return{mesh,span};
}

function build(): THREE.Group{
  const g=new THREE.Group();
  // ---- static parts (baked into one mesh at the end) ----
  const stat=new THREE.Group();
  const add=(geo: THREE.BufferGeometry,m: THREE.Material,x: number,y: number,z: number)=>{
    const o=new THREE.Mesh(geo,m);o.position.set(x,y,z);stat.add(o);return o;
  };
  const hw=BOOTH_W/2;
  // floor plate + roof
  add(new THREE.BoxGeometry(BOOTH_W+.06,.06,BACK*2+.06),roofM,0,.03,0);
  add(new THREE.BoxGeometry(BOOTH_W+.14,.12,BACK*2+.14),roofM,0,BOOTH_H,0);
  // corner posts
  for(const sx of[-1,1])for(const sz of[-1,1])
    add(new THREE.BoxGeometry(.07,BOOTH_H,.07),frameM,sx*hw,BOOTH_H/2,sz*BACK);
  // solid back wall (carries the phone)
  add(new THREE.BoxGeometry(BOOTH_W,BOOTH_H-.12,.04),frameM,0,(BOOTH_H-.12)/2+.06,-BACK);
  // kick panels + mid rails on the glass sides
  for(const sx of[-1,1]){
    add(new THREE.BoxGeometry(.03,.3,BACK*2),frameM,sx*hw,.2,0);
    add(new THREE.BoxGeometry(.035,.04,BACK*2),frameM,sx*hw,1.12,0);
  }
  // the pay phone on the back wall: box, keypad inset, coin slot, chrome hook, shelf
  const bz=-BACK+.02;
  add(new THREE.BoxGeometry(.28,.42,.12),phoneM,0,1.46,bz+.06);
  add(new THREE.BoxGeometry(.14,.16,.012),keyM,.03,1.42,bz+.126);
  add(new THREE.BoxGeometry(.06,.02,.014),chromeM,.03,1.6,bz+.126);
  add(new THREE.BoxGeometry(.04,.12,.05),chromeM,-.17,1.5,bz+.07);
  add(new THREE.BoxGeometry(.5,.04,.24),frameM,0,1.02,bz+.12);
  const body=new THREE.Mesh(bakeGeometry(stat)!,bakedMat);
  body.castShadow=true;body.receiveShadow=true;g.add(body);

  // ---- glass: the two sides + the folded door leaves, one transparent mesh ----
  const panes: THREE.BufferGeometry[]=[];
  for(const sx of[-1,1]){
    const p=new THREE.PlaneGeometry(BACK*2,BOOTH_H-.5);
    p.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(sx*hw,(BOOTH_H-.5)/2+.36,0),
      new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),Math.PI/2),new THREE.Vector3(1,1,1)));
    panes.push(p);
  }
  for(let i=0;i<2;i++){                                   // door swung back against the right front post
    const p=new THREE.PlaneGeometry(.26,BOOTH_H-.3);
    p.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(hw+.02+i*.03,(BOOTH_H-.3)/2+.12,BACK-.14-i*.24),
      new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),Math.PI/2+(i?-.35:.35)),new THREE.Vector3(1,1,1)));
    panes.push(p);
  }
  g.add(new THREE.Mesh(mergeGeometries(panes,false)!,glassM));

  // ---- lit parts: the sign band (all four faces) and the ceiling light ----
  const signMat=new THREE.MeshBasicMaterial({map:signTexture(),color:0xffffff});
  const band=new THREE.Mesh(new THREE.BoxGeometry(BOOTH_W+.1,.2,BACK*2+.1),[signMat,signMat,roofM,roofM,signMat,signMat]);
  band.position.y=BOOTH_H+.16;g.add(band);
  const lightMat=new THREE.MeshBasicMaterial({color:NEON.cream});
  const light=new THREE.Mesh(new THREE.BoxGeometry(.5,.03,.3),lightMat);
  light.position.y=BOOTH_H-.08;g.add(light);

  // ---- the receiver on its hook (left of the box), and its coiled cord ----
  const handset=buildHandset();
  const hookPos=new THREE.Vector3(-.19,1.45,bz+.12);
  const hookQuat=new THREE.Quaternion().setFromEuler(new THREE.Euler(0,Math.PI/2,0));
  handset.position.copy(hookPos);handset.quaternion.copy(hookQuat);
  g.add(handset);
  const cord=buildCord();g.add(cord.mesh);
  const cordAnchor=new THREE.Vector3(-.12,1.27,bz+.1);
  const cordEnd=new THREE.Vector3(0,-.12,0);
  cord.span(cordAnchor,cordEnd.clone().applyQuaternion(hookQuat).add(hookPos)); // resting on the hook

  const setRinging=(on: boolean,t: number)=>{
    const k=on?(Math.sin(t*22)>0?1:.35):1;
    signMat.color.setScalar(k);lightMat.color.set(NEON.cream).multiplyScalar(on?.4+.6*k:1);
  };
  g.userData={handset,hookPos,hookQuat,cordAnchor,cordEnd,span:cord.span,setRinging};
  return g;
}

export default {category:'Props',label:'Phone booth',build};
