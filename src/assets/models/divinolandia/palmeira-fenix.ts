import * as THREE from 'three';
import {matte} from '../matte.ts';
import {canvasTex} from './posto-kit.ts';

// Phoenix palm (tamareira-anã, Phoenix roebelenii) — the short palms of the station planters
// (Taurus and Petrobras/Passoni in Street View): a thick shaggy trunk of old leaf bases and
// a dense round crown of arching feathery fronds, the lower ones yellowing.
// build({h}) is pure; h = trunk height (m). Origin at the foot of the trunk.
const trunkM=matte({color:0x6b5a46});
let frondMats:THREE.Material[]|null=null;
function fronds():THREE.Material[]{
  // a feather leaf: the rachis down the middle, narrow leaflets angled out both sides (alpha)
  if(!frondMats)frondMats=['#5c7a3c','#7d8a40','#a39a4a'].map(c=>matte({side:THREE.DoubleSide,alphaTest:.5,
    map:canvasTex(64,256,(x,w,h)=>{
      x.clearRect(0,0,w,h);x.strokeStyle=c;x.lineWidth=3;
      for(let y=8;y<h-4;y+=6){const L=(w/2-3)*Math.sin(Math.PI*y/h)*.95+4;
        x.beginPath();x.moveTo(w/2,y);x.lineTo(w/2-L,y-10);x.moveTo(w/2,y);x.lineTo(w/2+L,y-10);x.stroke();}
      x.strokeStyle='#7d6f4a';x.lineWidth=3;x.beginPath();x.moveTo(w/2,0);x.lineTo(w/2,h);x.stroke();
    })}));
  return frondMats;
}
// one frond: a strip of `n` segments bending from up-and-out to drooping
function frondGeo(len:number,droop:number):THREE.BufferGeometry{
  const n=6,pos:number[]=[],uv:number[]=[],w=.55;
  const pt=(t:number):[number,number]=>[len*t,len*(.55*t-droop*t*t)];
  for(let i=0;i<n;i++){
    const t0=i/n,t1=(i+1)/n,[x0,y0]=pt(t0),[x1,y1]=pt(t1),w0=w*Math.sin(Math.PI*Math.max(t0,.08)),w1=w*Math.sin(Math.PI*Math.max(t1,.08));
    pos.push(x0,y0,-w0,x1,y1,-w1,x1,y1,w1, x0,y0,-w0,x1,y1,w1,x0,y0,w0);
    uv.push(0,t0,0,t1,1,t1, 0,t0,1,t1,1,t0);
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));
  g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.computeVertexNormals();return g;
}
const geos=[frondGeo(1.9,.95),frondGeo(1.7,.55),frondGeo(1.5,.25)];

function build(o:{h?:number;seed?:number}={}):THREE.Group{
  const g=new THREE.Group(),h=o.h??2.2,s=o.seed??1,mats=fronds();
  const t=new THREE.Mesh(new THREE.CylinderGeometry(.2,.26,h,9,4),trunkM);t.position.y=h/2;t.castShadow=true;g.add(t);
  for(let k=0;k<5;k++){const r=new THREE.Mesh(new THREE.TorusGeometry(.22,.06,5,9),trunkM);r.rotation.x=Math.PI/2;r.position.y=.4+k*h/5;g.add(r);}
  // three tiers of fronds: drooping old ones (yellowing) below, arching, young upright ones
  const tiers:[number,number,number][]=[[0,14,2],[1,12,0],[2,8,0]];
  for(const[tier,n,mi]of tiers)for(let i=0;i<n;i++){
    const a=(i+.37*tier+.11*s)/n*Math.PI*2,f=new THREE.Mesh(geos[tier],mats[tier===0?((i+s)%3===0?2:1):mi]);
    f.position.set(0,h+tier*.12,0);f.rotation.set(0,a,(tier-.5)*.25,'YXZ');f.castShadow=true;g.add(f);
  }
  return g;
}

export default {category:'Divinolândia',label:'Palmeira fênix',build,variants:[{label:'Baixa',opts:{h:1.4}},{label:'Alta',opts:{h:3.2}}]};
