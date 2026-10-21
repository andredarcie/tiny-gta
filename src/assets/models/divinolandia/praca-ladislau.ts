import * as THREE from 'three';
import {SQUARES} from '@/world/divinolandia/sites-table.ts';
import {matte} from '../matte.ts';
import {lawnM,walkEdgeM,stoneM,stepsM,soilM,drape,sidewalkRing,strip,kerb,put,type GroundAt,type P2} from './praca-chao.ts';
import Banco from './banco-praca.ts';
import Arvore from './arvore-praca.ts';
import ArvoreRua from './arvore-rua.ts';

// Praça Prof. Ladislau Rodrigues Pinto — the block of the Igreja Matriz, laid out 1:1 from
// the Google z20 satellite and the Street View panoramas (pm-front*, pm-s2, pm-w, pm-nw,
// pm-n1): the church stands on a paved terrace (its own levelled lot, sites-table.ts
// `matriz`) with a broad flight of steps down to the NORTH GARDEN, a lawn crossed by two
// grey paver paths from the north corners, a palm and two big trees; on the WEST lawn a row
// of Italian cypresses ringed with flowers; to the SOUTH, clipped hedges and blue
// hydrangeas along the aisle wall under a dense grove; at the FRONT a paved forecourt, the
// white fence round the little lawn by the portal and the saint on his pedestal. The church
// itself is igreja-matriz.ts (placed by the town build at the terrace floor).
// build({groundAt}) is pure; frame u = east along the street grid, v = south, origin the
// middle of the block (town-local (3.65, -1.3), turned 0.1658 rad).
export const LADISLAU=SQUARES.ladislau;
// the church's origin and its terrace in this frame (the terrace is the `matriz` lot)
export const MATRIZ_AT={u:1.5,v:2.5},TERRACE={u0:-20,u1:27,v0:-12,v1:16};
const W0=2.4;
// the street in front of the church: from this block's east kerb to the Praça Dr. Alcindo's
// west kerb (u 31.5 → 45.6 in this frame)
const FRONT_ST=14.1;
const hedgeM=matte({color:0x3a6630,flatShading:true}),hydM=matte({color:0x7f93d6,flatShading:true});
const marigoldM=matte({color:0xe59a2c,flatShading:true}),fenceM=matte({color:0xf1efe9}),saintM=matte({color:0xf4f2ec});
const poleM=matte({color:0x8d9296}),lampM=matte({color:0xf2efe2,emissive:0x5a4c2c});

function box(g:THREE.Object3D,m:THREE.Material,w:number,h:number,d:number,x:number,y:number,z:number):THREE.Mesh{
  const b=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m);b.position.set(x,y+h/2,z);b.castShadow=true;b.receiveShadow=true;g.add(b);return b;
}
// white tubular fence along a polyline (posts every 1.5 m, two rails, close bars)
function fence(g:THREE.Group,at:GroundAt,pts:P2[]):void{
  for(let i=0;i<pts.length-1;i++){
    const[au,av]=pts[i],[bu,bv]=pts[i+1],L=Math.hypot(bu-au,bv-av),ry=-Math.atan2(bv-av,bu-au),y=at(au,av)+.15;
    const f=new THREE.Group();f.position.set(au,y,av);f.rotation.y=ry;g.add(f);
    box(f,fenceM,L,.05,.05,L/2,.12,0);box(f,fenceM,L,.06,.06,L/2,1.15,0);
    for(let t=0;t<=L+1e-3;t+=1.5)box(f,fenceM,.08,1.2,.08,t,0,0);
    for(let t=.12;t<L;t+=.12)box(f,fenceM,.025,1.03,.025,t,.12,0);
  }
}
function streetLamp():THREE.Group{
  const g=new THREE.Group();
  const p=new THREE.Mesh(new THREE.CylinderGeometry(.06,.09,4.2,8),poleM);p.position.y=2.1;g.add(p);
  box(g,poleM,.9,.06,.06,.42,4.15,0);box(g,lampM,.45,.12,.28,.8,4.02,0);
  return g;
}
function saint():THREE.Group{
  const g=new THREE.Group();
  box(g,saintM,.7,1.1,.7,0,0,0);
  const body=new THREE.Mesh(new THREE.CylinderGeometry(.16,.3,1.25,10),saintM);body.position.y=1.72;g.add(body);
  const head=new THREE.Mesh(new THREE.SphereGeometry(.13,10,8),saintM);head.position.y=2.45;g.add(head);
  for(const s of[-1,1]){const a=new THREE.Mesh(new THREE.BoxGeometry(.5,.1,.1),saintM);a.position.set(s*.25,2.05,.05);a.rotation.z=s*.6;g.add(a);}
  return g;
}

function build(o:{groundAt?:GroundAt}={}):THREE.Group{
  const at=o.groundAt??((): number=>0),g=new THREE.Group();
  const {u0,u1,v0,v1}=LADISLAU,iu0=u0+W0,iu1=u1-W0,iv0=v0+W0,iv1=v1-W0,T=TERRACE;
  // ---- the block: lawn, the sidewalk ring, kerbs ----
  const inner=sidewalkRing(g,at,u0,u1,v0,v1,W0);
  g.add(drape(inner,at,.08,lawnM));
  // the street in front of the church, out to the Praça Dr. Alcindo: grey hexagonal pavers
  g.add(drape([[u1,v0-8],[u1+FRONT_ST,v0-8],[u1+FRONT_ST,v1+8],[u1,v1+8]],at,.16,walkEdgeM));
  // ---- the terrace round the church, the forecourt, the west walk, the north steps ----
  g.add(drape([[T.u0-3.5,T.v0],[iu1,T.v0],[iu1,T.v1],[T.u0-3.5,T.v1]],at,.12,stoneM));

  g.add(drape([[T.u0,T.v0-4],[T.u1,T.v0-4],[T.u1,T.v0],[T.u0,T.v0]],at,.13,stepsM,[],1));
  kerb(g,at,[[T.u0-3.5,T.v0-4],[T.u0-3.5,T.v1]],false,.25,.25);kerb(g,at,[[T.u1,T.v0-4],[T.u1,T.v0]],false,.25,.25);
  // ---- the north garden: two paver paths up from the north corners ----
  for(const[a,b]of[[[-4,iv0],[-15,T.v0-4]],[[6,iv0],[17,T.v0-4]]] as [P2,P2][]){
    g.add(drape(strip(a,b,2.4),at,.12,walkEdgeM,[],1.5,Math.atan2(b[1]-a[1],b[0]-a[0])));
  }
  put(g,ArvoreRua.build({kind:'palmeira'}),at,5,-30);
  for(const[u,v,r,k,s]of[[-18,-31,9.5,'copa',3],[21,-25,7,'copa',4],[-3,-23,2.4,'ipe',5],[9,-21,2,'ipe',6],[-25,-34,4,'copa',7]] as [number,number,number,'copa'|'ipe',number][])
    put(g,Arvore.build({kind:k,r,seed:s}),at,u,v);
  // ---- the west lawn: Italian cypresses ringed with marigolds ----
  for(const v of[-8,1,10]){
    put(g,Arvore.build({kind:'cipreste',h:8+(v%3),seed:Math.abs(v)}),at,-26,v);
    for(let i=0;i<10;i++){const a=i/10*Math.PI*2,u=-26+Math.cos(a)*1.2,vv=v+Math.sin(a)*1.2;
      const f=new THREE.Mesh(new THREE.IcosahedronGeometry(.28,0),marigoldM);f.position.set(u,at(u,vv)+.25,vv);g.add(f);}
  }
  // ---- south: hedge and hydrangeas along the aisle, then the grove ----
  {
    const y=(u:number):number=>at(u,T.v1+1.2);
    for(let u=T.u0+1;u<T.u1-6;u+=2.2){
      const h=new THREE.Mesh(new THREE.BoxGeometry(2.1,.7,.8),hedgeM);h.position.set(u,y(u)+.4,T.v1+2.2);h.castShadow=true;g.add(h);
      const b=new THREE.Mesh(new THREE.IcosahedronGeometry(.45,0),hydM);b.position.set(u+.5,y(u)+.45,T.v1+1.1);g.add(b);
    }
    g.add(drape([[T.u0,T.v1+.3],[T.u1-5,T.v1+.3],[T.u1-5,T.v1+1.6],[T.u0,T.v1+1.6]],at,.1,soilM));
  }
  for(const[u,v,r,s]of[[-27,24,7,11],[-13,31,10,12],[5,31,11,13],[22,30,8,14],[-26,36,5,15],[27,22,4,16],[26,37,4.5,17],[-6,22,3,18]] as [number,number,number,number][])
    put(g,Arvore.build({kind:'copa',r,seed:s}),at,u,v,s);
  // ---- the front: little lawn by the portal behind the white fence, the saint ----
  g.add(drape([[22.8,-10.5],[25.4,-10.5],[25.4,-4.6],[22.8,-4.6]],at,.14,lawnM));
  fence(g,at,[[22.6,-10.6],[25.6,-10.6],[25.6,-4.4],[22.6,-4.4]]);
  put(g,saint(),at,25.6,-3.6,-Math.PI/2,.12);
  // ---- benches and lamps ----
  for(const[u,v,ry]of[[-8,iv1-1.2,Math.PI],[3,iv1-1.2,Math.PI],[14,iv1-1.2,Math.PI],[-22,iv1-1.2,Math.PI],[iu0+1.2,-25,Math.PI/2],
    [iu0+1.2,24,Math.PI/2],[-9,-30,.5],[12,-30,-.5],[iu1-1.2,24,-Math.PI/2],[iu1-1.2,-26,-Math.PI/2]] as [number,number,number][])
    put(g,Banco.build(),at,u,v,ry,.1);
  for(const[u,v,ry]of[[iu0+.5,-14,0],[iu0+.5,18,0],[0,iv1+.3,-Math.PI/2],[18,iv1+.3,-Math.PI/2],[-14,iv0+.3,Math.PI/2],[14,iv0+.3,Math.PI/2],[iu1-.3,-18,Math.PI],[iu1-.3,24,Math.PI]] as [number,number,number][])
    put(g,streetLamp(),at,u,v,ry,.12);
  return g;
}
export default {category:'Divinolândia',label:'Praça Prof. Ladislau (adro da Matriz)',build};
