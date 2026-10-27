// The Hospital Regional's frontage on the Av. Leonor Mendes de Barros, from the Street View
// survey (hl-S-*, hl-N-*, local): along the grounds the kerb opens onto an asphalt apron
// of nose-in parking bays painted yellow, then a narrow cement sidewalk, then the low stone
// kerb carrying the chain-link fence on concrete posts; behind it the grass climbs toward
// the sanatorium among palms and old trees. Across the avenue: the picnic tables of the
// park and the SABESP plant's white tanks. The lots themselves (gatehouse, eye clinic,
// SABESP wall, snack stalls) are ordinary lots in avenida-leonor-mendes-de-barros.ts.
import * as THREE from 'three';
import {matte} from '../../../../assets/models/matte.ts';
import {makeSidewalks} from '../../../../assets/models/divinolandia/calcada.ts';
import Palmeira from '../../../../assets/models/divinolandia/palmeira-imperial.ts';
import ArvorePraca from '../../../../assets/models/divinolandia/arvore-praca.ts';
import {addObb} from '../collide.ts';
import {addSurfacePolygon} from '../../surface-lift.ts';
import type {ExtrasCtx} from './extras.ts';

export const BAYS:[number,number]=[22,150];   // the stretch of parking + fence (side S)
const APRON=5.2,WALK=1.6,ROAD=.15;             // bay depth, sidewalk width, road lift over the terrain

const asphaltM=matte({color:0x4c4c4e}),paintM=matte({color:0xd8b23a}),stoneM=matte({color:0xb8b0a0}),
  postM=matte({color:0xd6d2c8}),meshM=matte({color:0x8a8e90,transparent:true,opacity:.32,side:THREE.DoubleSide,depthWrite:false}),
  concreteM=matte({color:0xbcb8b0}),tankM=matte({color:0xf2f2f0}),blueM=matte({color:0x2a5ab0});

function rng(seed:number):()=>number{let a=seed>>>0;return()=>{a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}

// a point `off` metres out from the centreline on `side`, at arc length s
function at(ctx:ExtrasCtx,s:number,side:'N'|'S',off:number):{x:number;z:number;nx:number;nz:number;ux:number;uz:number}{
  const f=ctx.along(s),[nx,nz]=ctx.normal(f,side);
  return{x:f.x+nx*off,z:f.z+nz*off,nx,nz,ux:f.ux,uz:f.uz};
}
function box(w:number,h:number,d:number,m:THREE.Material,x:number,y:number,z:number,ry:number):THREE.Mesh{
  const b=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m);b.position.set(x,y,z);b.rotation.y=ry;b.castShadow=true;b.receiveShadow=true;return b;
}


// a chain-link fence on concrete posts along [s0,s1] of `side`, `off` metres out, on a
// low kerb of `kerbM` (stone on the Leonor, plain concrete along the Adhemar)
function fence(ctx:ExtrasCtx,g:THREE.Group,side:'N'|'S',s0:number,s1:number,off:number,kerbM:THREE.Material):void{
  const{H}=ctx;
  for(let s=s0;s<s1;s+=2){
    const a=at(ctx,s,side,off),b=at(ctx,Math.min(s1,s+2),side,off),mx=(a.x+b.x)/2,mz=(a.z+b.z)/2,L=Math.hypot(b.x-a.x,b.z-a.z),ph=Math.atan2(-(b.z-a.z),b.x-a.x);   // local +x along the fence
    const y=Math.min(H(a.x,a.z),H(b.x,b.z));
    g.add(box(L+.02,.5,.32,kerbM,mx,y+.15,mz,ph));
    const mesh=new THREE.Mesh(new THREE.PlaneGeometry(L,1.7),meshM);mesh.position.set(mx,y+1.25,mz);mesh.rotation.y=ph;g.add(mesh);
    addObb(mx,mz,L+.05,.4,-ph,y+2.2);
  }
  for(let s=s0;s<=s1;s+=2.5){const a=at(ctx,s,side,off),y=H(a.x,a.z);g.add(box(.12,2.3,.12,postM,a.x,y+1.15,a.z,0));}
}
// palms and old trees on the grass behind a fence, `deep` metres of scatter
function grove(ctx:ExtrasCtx,side:'N'|'S',s0:number,s1:number,off:number,deep:number,seed:number):void{
  const r=rng(seed);let k=0;
  for(let s=s0;s<s1;s+=6+r()*5,k++){
    const t=at(ctx,s,side,off+r()*deep),y=ctx.H(t.x,t.z);
    const tree=k%3===1?Palmeira.build({jeriva:true,h:7+r()*4,seed:k+seed}):ArvorePraca.build({kind:'copa',r:2.6+r()*2.2,seed:k+seed+30});
    tree.position.set(t.x,y,t.z);tree.rotation.y=r()*6;ctx.place(tree);addObb(t.x,t.z,.6,.6,0,y+3);
  }
}

export function hospitalLeonor(ctx:ExtrasCtx):number{
  const{hw,H,place}=ctx,[s0,s1]=BAYS,g=new THREE.Group();
  // --- the asphalt apron, draped on the terrain in 2 m steps
  const pos:number[]=[],idx:number[]=[];
  for(let s=s0,i=0;;s=Math.min(s1,s+2),i++){
    const a=at(ctx,s,'S',hw),b=at(ctx,s,'S',hw+APRON);
    pos.push(a.x,H(a.x,a.z)+ROAD+.01,a.z,b.x,H(b.x,b.z)+ROAD+.01,b.z);
    if(i){const k=i*2;idx.push(k-2,k,k-1,k-1,k,k+1);}
    if(i)addSurfacePolygon([[a.x,a.z],[b.x,b.z],[pos[pos.length-9],pos[pos.length-7]],[pos[pos.length-12],pos[pos.length-10]]],ROAD+.01);
    if(s>=s1)break;
  }
  const ag=new THREE.BufferGeometry();ag.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));ag.setIndex(idx);ag.computeVertexNormals();
  const apron=new THREE.Mesh(ag,asphaltM);apron.receiveShadow=true;g.add(apron);
  // --- the yellow bay lines (nose-in, a little skewed) and the line along the kerb
  for(let s=s0+1.4;s<s1-1;s+=2.6){
    const m=at(ctx,s,'S',hw+.3+APRON*.45),th=Math.atan2(m.nx,m.nz)+.22;
    g.add(box(.12,.02,APRON*.86,paintM,m.x,H(m.x,m.z)+ROAD+.03,m.z,th));
  }
  // --- the cement sidewalk behind the bays (its own kerb)
  const P:[number,number][]=[],NX:number[]=[],NZ:number[]=[];
  for(let s=s0;;s=Math.min(s1,s+2)){const a=at(ctx,s,'S',hw+APRON);P.push([a.x,a.z]);NX.push(a.nx);NZ.push(a.nz);if(s>=s1)break;}
  place(makeSidewalks([{pts:P,nx:NX,nz:NZ,w:WALK,k:'cimento'}],H));
  for(let i=1;i<P.length;i++)addSurfacePolygon([P[i-1],P[i],[P[i][0]+NX[i]*WALK,P[i][1]+NZ[i]*WALK],[P[i-1][0]+NX[i-1]*WALK,P[i-1][1]+NZ[i-1]*WALK]],ROAD+.17);
  // --- the stone kerb, concrete posts and chain-link along the grounds; trees behind
  const off=hw+APRON+WALK+.2;
  fence(ctx,g,'S',s0,s1,off,stoneM);
  grove(ctx,'S',s0+3,s1-2,off+2.5,7,1945);
  // --- across the avenue: the park's concrete picnic tables, the SABESP plant's white tanks
  for(const s of[8,15,22]){
    const t=at(ctx,s,'N',hw+2.2+5+((s*7)%3)),y=H(t.x,t.z),th=Math.atan2(t.nx,t.nz);
    g.add(box(1.8,.12,.9,concreteM,t.x,y+.78,t.z,th),box(.3,.75,.3,concreteM,t.x,y+.37,t.z,th));
    for(const sd of[-1,1]){const bx=t.x+t.ux*0+t.nx*sd*.9,bz=t.z+t.nz*sd*.9;g.add(box(1.8,.08,.35,concreteM,bx,y+.45,bz,th));}
    addObb(t.x,t.z,1.9,2.2,-th,y+.9);
  }
  for(const s of[71,79]){
    const t=at(ctx,s,'N',hw+2.2+6.5),y=H(t.x,t.z);
    const c=new THREE.Mesh(new THREE.CylinderGeometry(1.8,1.8,6.5,20),tankM);c.position.set(t.x,y+3.25,t.z);c.castShadow=true;g.add(c);
    const cap=new THREE.Mesh(new THREE.SphereGeometry(1.8,20,8,0,Math.PI*2,0,Math.PI/2),tankM);cap.scale.y=.35;cap.position.set(t.x,y+6.5,t.z);g.add(cap);
    addObb(t.x,t.z,3.6,3.6,0,y+7);
  }
  place(g);
  return 1;
}

// The Av. Adhemar de Barros along the hospital's south edge (ha-N-*, local): the same
// chain-link on bent concrete posts on a concrete kerb, the grass and palms behind it; the
// hospital's blue water tanks and white water tower by the vehicle gate. FENCES are the
// fenced stretches of side N.
export const FENCES:[number,number][]=[[96,196],[196,236],[252,328]];
export function hospitalAdhemar(ctx:ExtrasCtx):number{
  const{hw,H}=ctx,g=new THREE.Group(),off=hw+2.4,kerbM=concreteM;
  for(const[a,b]of FENCES)fence(ctx,g,'N',a,b,off,kerbM);
  // the annex's levelled lot starts ~8 m behind the kerb up to s 180: a single row there
  grove(ctx,'N',100,180,off+3,1.6,1987);
  grove(ctx,'N',182,194,off+3,8,1988);
  grove(ctx,'N',256,326,off+2,4,2005);
  // the blue water tanks in a row and the white water tower on its column
  for(const s of[203,206,209]){
    const t=at(ctx,s,'N',off+2.6),y=H(t.x,t.z);
    const c=new THREE.Mesh(new THREE.CylinderGeometry(1.1,1.2,2.6,16),blueM);c.position.set(t.x,y+1.3,t.z);c.castShadow=true;g.add(c);
    addObb(t.x,t.z,2.4,2.4,0,y+2.6);
  }
  {const t=at(ctx,215,'N',off+2.2),y=H(t.x,t.z);
    const col=new THREE.Mesh(new THREE.CylinderGeometry(.9,1,9,16),tankM);col.position.set(t.x,y+4.5,t.z);col.castShadow=true;g.add(col);
    const tk=new THREE.Mesh(new THREE.CylinderGeometry(2.2,1.6,3,20),tankM);tk.position.set(t.x,y+10.4,t.z);tk.castShadow=true;g.add(tk);
    addObb(t.x,t.z,2,2,0,y+12);}
  ctx.place(g);
  return 1;
}
