import * as THREE from 'three';
import {matte} from '../matte.ts';
import {calcadaTexture} from './texturas.ts';

// Calçada — the raised sidewalk of a surveyed Divinolândia street: a slab ~15 cm above the
// road behind a concrete kerb (meio-fio), each lot's stretch in its owner's paving (ceramic
// tiles, irregular stone, plain cement, black-and-white mosaic, red hydraulic tiles), as
// seen in Street View. Strips follow the kerb line and read the ground height per vertex.
export type Paving='ceramica'|'pedra'|'cimento'|'mosaico'|'ladrilho';
const mats=new Map<Paving,THREE.Material>();
const pav=(k:Paving):THREE.Material=>{let m=mats.get(k);if(!m){m=matte({map:calcadaTexture(k),polygonOffset:true,polygonOffsetFactor:-3,polygonOffsetUnits:-3});mats.set(k,m);}return m;};
const kerbM=matte({color:'#bdb8ad'});
export const KERB_H=.17;

// strip: kerb-line points (world x,z), the side normal (toward the lots), width, paving
export function makeSidewalks(strips:{pts:[number,number][];nx:number[];nz:number[];w:number;k:Paving}[],hAt:(x:number,z:number)=>number,roadLift=.15):THREE.Group{
  const by=new Map<Paving,{p:number[];uv:number[]}>(),kerb:number[]=[];
  for(const s of strips){
    let a=by.get(s.k);if(!a){a={p:[],uv:[]};by.set(s.k,a);}
    for(let i=1;i<s.pts.length;i++){
      const q=[i-1,i].map(j=>{
        const[x,z]=s.pts[j],ox=x+s.nx[j]*s.w,oz=z+s.nz[j]*s.w;
        return{k:[x,hAt(x,z)+roadLift+KERB_H,z],o:[ox,hAt(ox,oz)+roadLift+KERB_H,oz],r:[x,hAt(x,z)+roadLift-.02,z]};
      });
      const[A,B]=q;
      // every triangle wound counter-clockwise seen from above: with a DoubleSide material the
      // shader turns a back face's normal down, and the strips on one side of a street (built
      // in the other direction) came out dark
      const up=(B.k[2]-A.k[2])*(B.o[0]-A.k[0])-(B.k[0]-A.k[0])*(B.o[2]-A.k[2])>0;
      const tri=up?[A.k,B.k,B.o,A.k,B.o,A.o]:[A.k,B.o,B.k,A.k,A.o,B.o];
      for(const v of tri){a.p.push(...v);a.uv.push(v[0],v[2]);}              // planar world uv (1 tile = 1 m)
      // kerb face (road side), its front toward the road (away from the lots: -n)
      const ex=B.r[0]-A.r[0],ey=B.r[1]-A.r[1],ez=B.r[2]-A.r[2],fx=B.k[0]-A.r[0],fy=B.k[1]-A.r[1],fz=B.k[2]-A.r[2];
      const cx=ey*fz-ez*fy,cz=ex*fy-ey*fx,toRoad=cx*s.nx[i]+cz*s.nz[i]<0;
      kerb.push(...(toRoad?[...A.r,...B.r,...B.k,...A.r,...B.k,...A.k]:[...A.r,...B.k,...B.r,...A.r,...A.k,...B.k]));
    }
  }
  const g=new THREE.Group();
  for(const[k,a]of by){
    const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(a.p,3));
    geo.setAttribute('uv',new THREE.Float32BufferAttribute(a.uv,2));geo.computeVertexNormals();
    const nrm=geo.getAttribute('normal') as THREE.BufferAttribute;for(let i=0;i<nrm.count;i++)nrm.setXYZ(i,0,1,0);
    const m=new THREE.Mesh(geo,pav(k));(m.material as THREE.Material).side=THREE.DoubleSide;m.receiveShadow=true;g.add(m);
  }
  const kg=new THREE.BufferGeometry();kg.setAttribute('position',new THREE.Float32BufferAttribute(kerb,3));kg.computeVertexNormals();
  const km=new THREE.Mesh(kg,kerbM);(km.material as THREE.Material).side=THREE.DoubleSide;g.add(km);
  return g;
}

function build(o:{k?:Paving}={}):THREE.Group{
  const pts:[number,number][]=[[-5,0],[5,0]];
  return makeSidewalks([{pts,nx:[0,0],nz:[-1,-1],w:2.2,k:o.k||'ceramica'}],()=>0);
}
export default {category:'Divinolândia',label:'Calçada (meio-fio + piso)',build,variants:(['ceramica','pedra','cimento','mosaico','ladrilho'] as Paving[]).map(k=>({label:k,opts:{k}}))};
