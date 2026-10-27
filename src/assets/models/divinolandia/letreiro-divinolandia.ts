import * as THREE from 'three';
import {matte} from '../matte.ts';

// The town-name letters at the west entrance — the white DIVINOLÂNDIA block capitals on the
// grass island where the Rua São Paulo meets the highway (Rodovia Lourival Lindório de
// Faria), by the royal palms (Street View letras-j1 / -z1 / -f1, local): thick sans-serif
// capitals about 1.3 m tall standing on a low dark-blue base, read from the highway. No
// circumflex shows on the A in the photos. Each letter is one extruded outline (counters as
// holes), so no two faces overlap. build() is pure; origin at the middle of the base on the
// ground, letters along +x, faces toward +z.
const H=1.3,T=.24,DEPTH=.3,GAP=.2,BASE_H=.22;
const white=matte({color:0xf4f4f0}),blue=matte({color:0x1f3f8a});

type Glyph={w:number;shape:()=>THREE.Shape};
const poly=(p:[number,number][]):THREE.Shape=>new THREE.Shape(p.map(([x,y])=>new THREE.Vector2(x,y)));
const GLYPHS:Record<string,Glyph>={
  I:{w:T,shape:()=>poly([[0,0],[T,0],[T,H],[0,H]])},
  L:{w:.66,shape:()=>poly([[0,0],[.66,0],[.66,T],[T,T],[T,H],[0,H]])},
  V:{w:.86,shape:()=>{const w=.86,c=w/2;return poly([[0,H],[T*1.05,H],[c,T*1.7],[w-T*1.05,H],[w,H],[c+T*.6,0],[c-T*.6,0]]);}},
  N:{w:.82,shape:()=>{const w=.82,ty=T*2.3;return poly([[0,0],[0,H],[T,H],[w-T,ty],[w-T,H],[w,H],[w,0],[w-T,0],[T,H-ty],[T,0]]);}},
  O:{w:.86,shape:()=>{const w=.86,s=new THREE.Shape();s.absellipse(w/2,H/2,w/2,H/2,0,Math.PI*2,false,0);
    const h=new THREE.Path();h.absellipse(w/2,H/2,w/2-T,H/2-T,0,Math.PI*2,true,0);s.holes.push(h);return s;}},
  D:{w:.82,shape:()=>{const w=.82,rx=w*.6,cx=w-rx,s=new THREE.Shape();
    s.moveTo(0,0);s.lineTo(cx,0);s.absellipse(cx,H/2,rx,H/2,-Math.PI/2,Math.PI/2,false,0);s.lineTo(0,H);s.lineTo(0,0);
    const h=new THREE.Path();h.moveTo(T,T);h.lineTo(T,H-T);h.lineTo(cx,H-T);h.absellipse(cx,H/2,rx-T,H/2-T,Math.PI/2,-Math.PI/2,true,0);h.lineTo(T,T);
    s.holes.push(h);return s;}},
  A:{w:.9,shape:()=>{const w=.9,c=w/2,a=T*.62,apex=H-T*1.75,yb=H*.24,yc=yb+T*.85;
    const xin=(y:number):number=>T+(c-T)*(y/apex);                       // the inner left edge at height y
    const s=poly([[0,0],[c-a,H],[c+a,H],[w,0],[w-T,0],[w-xin(yb),yb],[xin(yb),yb],[T,0]]);
    s.holes.push(new THREE.Path([new THREE.Vector2(xin(yc),yc),new THREE.Vector2(c,apex),new THREE.Vector2(w-xin(yc),yc)]));
    return s;}},
};

function build(o:{text?:string}={}):THREE.Group{
  const text=o.text??'DIVINOLANDIA';
  const g=new THREE.Group();
  const gl=[...text].map(ch=>GLYPHS[ch]??GLYPHS.I);
  const total=gl.reduce((s,q)=>s+q.w,0)+GAP*(gl.length-1);
  // the low dark-blue base the letters stand on
  const base=new THREE.Mesh(new THREE.BoxGeometry(total+.5,BASE_H+.15,DEPTH+.3),blue);
  base.position.y=(BASE_H-.15)/2;base.castShadow=base.receiveShadow=true;g.add(base);
  let x=-total/2;
  for(const q of gl){
    const m=new THREE.Mesh(new THREE.ExtrudeGeometry(q.shape(),{depth:DEPTH,bevelEnabled:false,curveSegments:14}),white);
    m.position.set(x,BASE_H,-DEPTH/2);m.castShadow=m.receiveShadow=true;g.add(m);
    x+=q.w+GAP;
  }
  return g;
}
export const LETREIRO_W=10.9;                                   // base length (for collision)

export default {category:'Divinolândia',label:'Letreiro DIVINOLÂNDIA (entrada oeste)',build};
