// Divinolândia (SP) — builds the real town into the scene and drops the player in it.
// Loaded LAZILY by main.ts only when the Divinolândia map is on (?map=divinolandia), so
// the ~1 MB of baked town data never weighs on the classic map. Everything visual comes
// from the model files in src/assets/models/divinolandia/ (this module only places them);
// the layout comes from src/data/divinolandia.json (tools/bake-divinolandia.ts).
//
// v1 scope: the whole real street grid on the real relief, ~3800 houses, the Matriz and
// its plazas, the Rio do Peixe, the Hospital Regional on the hill, the Morro da Torre
// mirante, stadium, cemetery, Prefeitura, coffee rows and riparian forest, parked cars,
// collision, radar, fog and the hospital respawn. Traffic/peds/police/missions still live
// in the classic map and migrate to the town step by step.
import * as THREE from 'three';
import {scene} from '@/core/engine.ts';
import {refs} from '@/core/state.ts';
import {setDivinoTerrain} from '@/core/terrain.ts';
import {player,playerCar,idleCars,cameraRig} from '@/actors/player.ts';
import {message} from '@/ui/hud.ts';
import {HOSP_SPAWN_OUT} from '../../../assets/models/city/hospital.ts';
import {mergeStatic} from '../../../assets/models/props/prop-merge.ts';
import {divData as D,divinoHeight,nearGrid,farGrid,PLAY,DIV_OX,DIV_OZ,altitudeAt} from './data.ts';
import {addObb,setPlayBounds} from './collide.ts';
import {makeTerrainMesh,farTerrainMat} from '../../../assets/models/divinolandia/terreno.ts';
import {makeStreets,makeWater,type StreetLine} from '../../../assets/models/divinolandia/rua.ts';
import {addCasa,finalizeCasas,casaTop} from '../../../assets/models/divinolandia/casa.ts';
import {makeTrees,makeCoffee} from '../../../assets/models/divinolandia/vegetacao.ts';
import {makeSurface,makeWall,makeTomb,makeGoal,makeGardenBed,type Surface} from '../../../assets/models/divinolandia/praca.ts';
import {makePostes} from '../../../assets/models/divinolandia/poste.ts';
import Hospital,{HOSP_FOOT} from '../../../assets/models/divinolandia/hospital-regional.ts';
import Torre from '../../../assets/models/divinolandia/torre-mirante.ts';
import Placa from '../../../assets/models/divinolandia/placa.ts';
import Predio from '../../../assets/models/divinolandia/predio-publico.ts';
import Igreja from '../../../assets/models/rural/igreja-divino.ts';
import Coreto from '../../../assets/models/rural/coreto.ts';
import Bench from '../../../assets/models/props/park-bench.ts';
import {makeFiatUno} from '../../../assets/models/vehicles/fiat-uno.ts';
import {makeKombi} from '../../../assets/models/vehicles/kombi.ts';

type P2=[number,number];
const H=divinoHeight;
const w=(p:number[]):P2=>[p[0]+DIV_OX,p[1]+DIV_OZ];

// Static landmark group → identity parent → merged by material (few draw calls).
function placeStatic(obj:THREE.Object3D):THREE.Group{
  const root=new THREE.Group();root.add(obj);
  root.updateMatrixWorld(true);
  root.traverse(o=>{if(o!==root){o.matrixAutoUpdate=false;o.updateMatrix();}});
  mergeStatic(root);
  root.matrixAutoUpdate=false;scene.add(root);
  return root;
}
// world-space footprint box of a model-frame box (cx,cz,w,d) under yaw θ (THREE rotation.y)
function obbFromModel(px:number,pz:number,theta:number,cx:number,cz:number,bw:number,bd:number,top:number):void{
  const c=Math.cos(theta),s=Math.sin(theta);
  addObb(px+cx*c+cz*s,pz-cx*s+cz*c,bw,bd,-theta,top);
}
const yawTo=(fx:number,fz:number,tx:number,tz:number):number=>Math.atan2(tx-fx,tz-fz);

const cullGroups:{g:THREE.Group;r:number}[]=[];
let built=false;

export function buildDivinolandia():void{
  if(built)return;built=true;
  setDivinoTerrain(divinoHeight);
  setPlayBounds(PLAY);

  // ---------- "town" mask (coarse grid around the houses) for ground colour ----------
  const TC=16,tx0=nearGrid.x0,tz0=nearGrid.z0,tnx=Math.ceil((nearGrid.nx*nearGrid.cell)/TC),tnz=Math.ceil((nearGrid.nz*nearGrid.cell)/TC);
  const town=new Float32Array(tnx*tnz);
  for(const h of D.houses){const[x,z]=w(h);const i=Math.floor((x-tx0)/TC),j=Math.floor((z-tz0)/TC);
    for(let b=-1;b<=1;b++)for(let a=-1;a<=1;a++){const k=(j+b)*tnx+i+a;if(k>=0&&k<town.length)town[k]=Math.max(town[k],a||b?.5:1);}}
  const townAt=(x:number,z:number):number=>{const i=Math.floor((x-tx0)/TC),j=Math.floor((z-tz0)/TC);return i<0||j<0||i>=tnx||j>=tnz?0:town[j*tnx+i];};

  // ---------- terrain: near (playable, 8 m) + far serras (48 m, hole under the near) ----------
  scene.add(makeTerrainMesh(nearGrid,{town:townAt}));
  const nx1=nearGrid.x0+(nearGrid.nx-1)*nearGrid.cell,nz1=nearGrid.z0+(nearGrid.nz-1)*nearGrid.cell,m=farGrid.cell*1.5;
  scene.add(makeTerrainMesh(farGrid,{skip:{x0:nearGrid.x0+m,x1:nx1-m,z0:nearGrid.z0+m,z1:nz1-m},drop:1.2,mat:farTerrainMat}));

  // ---------- streets, sidewalks, water ----------
  const lines:StreetLine[]=D.roads.map(r=>{
    const pts=r.pts.map(p=>w(p));
    const mid=pts[Math.floor(pts.length/2)];
    return{pts,hw:r.hw,paved:!!r.p,sidewalk:!!r.p&&r.k!=='primary'&&r.k!=='primary_link'&&townAt(mid[0],mid[1])>0};
  });
  scene.add(makeStreets(lines,H));
  scene.add(makeWater(D.waters.map(x=>({hw:x.hw,pts:x.pts.map(p=>[p[0]+DIV_OX,p[1]+DIV_OZ,p[2]] as [number,number,number])}))));

  // ---------- plazas, greens, pitches, cemetery, schools ----------
  const ground=new THREE.Group();
  const trees:{x:number;y:number;z:number;s:number;r:number}[]=[];
  const deco=new THREE.Group();
  for(const p of [...D.plazas,...D.areas]){
    const pts=p.pts.map(q=>w(q)) as P2[];
    const k=p.k as Surface|'hospital'|'torre';
    if(k==='hospital'||k==='torre')continue;
    ground.add(makeSurface(k,pts,H));
    let cx=0,cz=0;for(const q of pts){cx+=q[0];cz+=q[1];}cx/=pts.length;cz/=pts.length;
    if(k==='praca'||k==='verde'){
      // a ring of shade trees + benches around the middle of each plaza
      let r=1e9;for(const q of pts)r=Math.min(r,Math.hypot(q[0]-cx,q[1]-cz));
      const n=Math.max(4,Math.min(10,Math.floor(r/4)));
      for(let i=0;i<n;i++){const a=i/n*Math.PI*2,rr=r*.62;const x=cx+Math.cos(a)*rr,z=cz+Math.sin(a)*rr;trees.push({x,y:H(x,z),z,s:.75,r:a});}
      if(k==='praca'&&r>8)for(let i=0;i<4;i++){
        const a=i*Math.PI/2+.4,x=cx+Math.cos(a)*r*.38,z=cz+Math.sin(a)*r*.38;
        const b=Bench.build();b.position.set(x,H(x,z)+.15,z);b.rotation.y=-a+Math.PI/2;deco.add(b);
      }
    }else if(k==='cemiterio'){
      deco.add(makeWall(pts,H));
      for(let a=-60;a<=60;a+=3.2)for(let b=-60;b<=60;b+=4.6){
        const x=cx+a,z=cz+b;
        if(!pointIn([x,z],pts,3))continue;
        const t=makeTomb();t.position.set(x,H(x,z),z);deco.add(t);
      }
    }else if(k==='campo'||k==='estadio'){
      const o=longAxis(pts);
      for(const s of[-1,1]){
        const gx=cx+Math.cos(o.a)*(o.len/2-3)*s,gz=cz+Math.sin(o.a)*(o.len/2-3)*s;
        const g=makeGoal();g.position.set(gx,H(gx,gz)+.16,gz);g.rotation.y=Math.atan2(-Math.cos(o.a)*s,-Math.sin(o.a)*s);deco.add(g);
      }
    }else if(k==='escola'){
      const o=longAxis(pts),bw=Math.min(40,o.len*.55),th=Math.atan2(-Math.sin(o.a),Math.cos(o.a));
      const b=Predio.build({w:bw,d:11,floors:2,color:0xdfe6cf});b.position.set(cx,H(cx,cz),cz);b.rotation.y=th;deco.add(b);
      obbFromModel(cx,cz,th,0,0,bw,11,H(cx,cz)+8);
    }
  }
  for(const g of ground.children){(g as THREE.Mesh).matrixAutoUpdate=false;}
  scene.add(ground);
  placeStatic(deco);

  // ---------- Igreja Matriz (Paróquia do Divino Espírito Santo) + Praça Dr. Alcindo ----------
  const L=D.landmarks;
  const [mx,mz]=w([L.matriz.cx,L.matriz.cz]);
  const S=1.9,church=Igreja.build();church.scale.setScalar(S);
  church.position.set(mx,H(mx,mz)-.05,mz);church.rotation.y=L.matriz.face;placeStatic(church);
  obbFromModel(mx,mz,L.matriz.face,0,0,11.4*S,12.4*S,H(mx,mz)+30);
  const [px,pz]=w([L.pracaMatriz.x,L.pracaMatriz.z]);
  const coreto=Coreto.build();coreto.position.set(px,H(px,pz)+.12,pz);placeStatic(coreto);
  addObb(px,pz,7,7,0,H(px,pz)+6);
  for(const[a,r]of[[0,9],[1.6,9],[3.2,9],[4.8,9]]){const bed=makeGardenBed(2.2);const x=px+Math.cos(a)*r,z=pz+Math.sin(a)*r;bed.position.set(x,H(x,z)+.12,z);placeStatic(bed);}

  // ---------- Prefeitura and the other mapped public buildings ----------
  for(const b of D.buildings){
    const [bx,bz]=w([b.cx,b.cz]),th=-b.rot,isPref=b.kind==='townhall';
    const fl=isPref?2:b.kind==='church'||b.kind==='place_of_worship'?1:2;
    const pr=Predio.build({w:Math.max(8,b.w),d:Math.max(8,b.d),floors:fl,flag:isPref,color:isPref?0xefe6cf:0xe7e1d3});
    pr.position.set(bx,H(bx,bz),bz);pr.rotation.y=th;placeStatic(pr);
    obbFromModel(bx,bz,th,0,0,Math.max(8,b.w),Math.max(8,b.d),H(bx,bz)+fl*3.4+1);
  }

  // ---------- Hospital Regional (up on the hill, façade toward the town) ----------
  {
    const [hx,hz]=w(L.hospital),th=yawTo(hx,hz,DIV_OX,DIV_OZ),y=H(hx,hz);
    const hosp=Hospital.build();hosp.position.set(hx,y,hz);hosp.rotation.y=th;placeStatic(hosp);
    for(const[cx,cz,bw,bd,ht]of HOSP_FOOT)obbFromModel(hx,hz,th,cx,cz,bw,bd,y+ht);
    // waking up after WASTED: step out at the hospital door (the classic-map hospital
    // interior is reused; its exit point is redirected here)
    const ox=Math.sin(th)*16,oz=Math.cos(th)*16;
    HOSP_SPAWN_OUT.x=hx+ox;HOSP_SPAWN_OUT.z=hz+oz;
  }

  // ---------- Morro da Torre: the tower + the mirante deck facing the town ----------
  {
    const [tx,tz]=w(L.torre),th=yawTo(tx,tz,DIV_OX,DIV_OZ),y=H(tx,tz);
    const t=Torre.build();t.position.set(tx,y,tz);t.rotation.y=th;placeStatic(t);
    obbFromModel(tx,tz,th,0,0,5.6,5.6,y+80);
    obbFromModel(tx,tz,th,-6.5,-5,4,3,y+3);
    const sg=Placa.build({lines:['MIRANTE','MORRO DA TORRE · 1380 m'],bg:'#6b4a2a',w:4.6,h:1.5});
    const sx=tx+Math.sin(th)*20+Math.cos(th)*-6,sz=tz+Math.cos(th)*20-Math.sin(th)*-6;
    sg.position.set(sx,H(sx,sz),sz);sg.rotation.y=th;placeStatic(sg);
  }

  // ---------- welcome sign on the highway at the east entrance (by the Petrobras station) ----------
  {
    const [ex,ez]=w(L.posto);let best:[number,number,number]|null=null,bd=1e9;
    for(const r of D.roads){if(r.k!=='primary')continue;for(let i=1;i<r.pts.length;i++){
      const[x,z]=w(r.pts[i]),d=Math.hypot(x-ex-120,z-ez);if(d<bd){bd=d;const[x0,z0]=w(r.pts[i-1]);best=[x,z,Math.atan2(x-x0,z-z0)];}}}
    if(best){
      const[x,z,hd]=best,nx=Math.cos(hd)*7,nz=-Math.sin(hd)*7;
      const sg=Placa.build({lines:['DIVINOLÂNDIA','ALT. 1058 m'],w:5.2,h:1.8});
      sg.position.set(x+nx,H(x+nx,z+nz),z+nz);sg.rotation.y=hd+Math.PI;placeStatic(sg);
    }
  }

  // ---------- houses ----------
  for(let i=0;i<D.houses.length;i++){
    const[hx0,hz0,hw,hd,rot,fl,c,roof,shop]=D.houses[i];
    const[x,z]=w([hx0,hz0]),cs=Math.cos(rot),sn=Math.sin(rot);
    const corner=(u:number,v:number):number=>H(x+u*hw/2*cs-v*hd/2*sn,z+u*hw/2*sn+v*hd/2*cs);
    const hs=[corner(-1,-1),corner(1,-1),corner(1,1),corner(-1,1)];
    const front=H(x-sn*hd/2,z+cs*hd/2);
    const floor=Math.max(front,Math.max(...hs)-2.4)+.15,base=Math.min(...hs)-.6;
    const spec={x,z,w:hw,d:hd,rot,floor,base,floors:fl,color:c,flat:!!roof,shop,seed:i+1};
    addCasa(spec);
    addObb(x,z,hw,hd,rot,floor+casaTop(spec));
  }
  for(const g of finalizeCasas()){scene.add(g);cullGroups.push({g,r:1100});}

  // ---------- street lamps along the paved town streets ----------
  const lamps:{x:number;y:number;z:number;r:number}[]=[];
  for(const r of lines){
    if(!r.sidewalk)continue;
    let acc=12,side=1;
    for(let i=1;i<r.pts.length;i++){
      const[ax,az]=r.pts[i-1],[bx,bz]=r.pts[i],Lg=Math.hypot(bx-ax,bz-az);if(Lg<1)continue;
      const ux=(bx-ax)/Lg,uz=(bz-az)/Lg;
      for(let s=acc;s<Lg;s+=34){
        const nx=-uz*side,nz=ux*side,o=r.hw+1.5;
        const x=ax+ux*s+nx*o,z=az+uz*s+nz*o;
        lamps.push({x,y:H(x,z),z,r:Math.atan2(-nx,-nz)});side=-side;acc=s+34-Lg;
      }
      if(acc<0)acc=0;
    }
  }
  scene.add(makePostes(lamps));

  // ---------- vegetation ----------
  for(let i=0;i<D.trees.length;i+=3){const[x,z]=w([D.trees[i],D.trees[i+1]]);trees.push({x,y:H(x,z)-.1,z,s:D.trees[i+2],r:i});}
  for(const g of makeTrees(trees)){scene.add(g);cullGroups.push({g,r:900});}
  const cof:{x:number;y:number;z:number;s:number;r:number}[]=[];
  for(let i=0;i<D.coffee.length;i+=3){const[x,z]=w([D.coffee[i],D.coffee[i+1]]);cof.push({x,y:H(x,z)-.15,z,s:1,r:D.coffee[i+2]});}
  for(const g of makeCoffee(cof)){scene.add(g);cullGroups.push({g,r:650});}

  // ---------- parked cars on the streets around the Matriz (enter with E) ----------
  const parked:{k:'uno'|'kombi';c:number}[]=[{k:'uno',c:0xc23b4e},{k:'kombi',c:0},{k:'uno',c:0xe8e6df},{k:'uno',c:0x3b7ac2},{k:'uno',c:0x5b5f6b},{k:'kombi',c:0}];
  const spots=streetSpots(lines,px,pz,parked.length+1);
  // the pink hero car waits right next to the plaza
  if(spots[0]){const s=spots[0];playerCar.g.position.set(s.x,H(s.x,s.z),s.z);playerCar.heading=s.h;playerCar.g.rotation.y=s.h;}
  parked.forEach((p,i)=>{
    const s=spots[i+1];if(!s)return;
    const g=p.k==='uno'?makeFiatUno(p.c):makeKombi();
    g.position.set(s.x,H(s.x,s.z),s.z);g.rotation.y=s.h;
    idleCars.push({g,heading:s.h,speed:0,name:p.k==='uno'?'FIAT UNO':'KOMBI',police:false});
  });

  // ---------- the player: in the Praça, facing the Matriz ----------
  const sx=px+(mx-px)*.35,sz=pz+(mz-pz)*.35+6;
  player.g.position.set(sx,H(sx,sz),sz);
  player.heading=yawTo(sx,sz,mx,mz);cameraRig.yaw=player.heading;

  // ---------- radar ----------
  refs.divinoMinimap=drawRadar;
  refs.divinoFullMap=drawFullMap;
  refs.divinoPlace=placeName;
  refs.divinoAltitude=altitudeAt;
  refs.divinoWelcome=():void=>message('DIVINOLÂNDIA · SP — '+Math.round(altitudeAt(player.g.position.x,player.g.position.z))+' m','var(--gold)');
}

// distance culling for the big batched groups (houses, woods, coffee)
export function updateDivinolandia(px:number,pz:number):void{
  for(const{g,r}of cullGroups){const dx=g.userData.cx-px,dz=g.userData.cz-pz;g.visible=dx*dx+dz*dz<r*r;}
}

// ---------- helpers ----------
function pointIn(p:P2,poly:P2[],inset:number):boolean{
  let ins=false;
  for(let i=0,j=poly.length-1;i<poly.length;j=i++){
    const[xi,zi]=poly[i],[xj,zj]=poly[j];
    if((zi>p[1])!==(zj>p[1])&&p[0]<(xj-xi)*(p[1]-zi)/(zj-zi)+xi)ins=!ins;
  }
  if(!ins)return false;
  for(let i=0,j=poly.length-1;i<poly.length;j=i++){
    const[ax,az]=poly[j],[bx,bz]=poly[i],dx=bx-ax,dz=bz-az,l2=dx*dx+dz*dz||1;
    let t=((p[0]-ax)*dx+(p[1]-az)*dz)/l2;t=t<0?0:t>1?1:t;
    if(Math.hypot(p[0]-ax-t*dx,p[1]-az-t*dz)<inset)return false;
  }
  return true;
}
function longAxis(pts:P2[]):{a:number;len:number}{
  let best={a:0,len:0};
  for(let i=0;i<pts.length;i++)for(let j=i+1;j<pts.length;j++){
    const d=Math.hypot(pts[j][0]-pts[i][0],pts[j][1]-pts[i][1]);
    if(d>best.len)best={a:Math.atan2(pts[j][1]-pts[i][1],pts[j][0]-pts[i][0]),len:d};
  }
  return best;
}
// Kerbside parking spots on paved streets nearest to (cx,cz), spaced ≥14 m apart.
function streetSpots(lines:StreetLine[],cx:number,cz:number,n:number):{x:number;z:number;h:number}[]{
  const cand:{x:number;z:number;h:number;d:number}[]=[];
  for(const r of lines){
    if(!r.paved)continue;
    for(let i=1;i<r.pts.length;i++){
      const[ax,az]=r.pts[i-1],[bx,bz]=r.pts[i],Lg=Math.hypot(bx-ax,bz-az);if(Lg<12)continue;
      const ux=(bx-ax)/Lg,uz=(bz-az)/Lg,o=r.hw-1.3;
      for(let s=5;s<Lg-5;s+=7){
        const x=ax+ux*s-uz*o,z=az+uz*s+ux*o;
        cand.push({x,z,h:Math.atan2(ux,uz),d:Math.hypot(x-cx,z-cz)});
      }
    }
  }
  cand.sort((a,b)=>a.d-b.d);
  const out:{x:number;z:number;h:number}[]=[];
  for(const c of cand){if(c.d<25)continue;if(out.every(o=>Math.hypot(o.x-c.x,o.z-c.z)>14))out.push(c);if(out.length>=n)break;}
  return out;
}

// Radar atlas: streets, river, plazas and houses pre-drawn once at 0.6 px/m; the HUD
// blits the visible window (same contract as its own atlases).
let atlas:HTMLCanvasElement|null=null;
const AS=.6;
function buildAtlas():HTMLCanvasElement{
  const x0=nearGrid.x0,z0=nearGrid.z0,Wm=(nearGrid.nx-1)*nearGrid.cell,Hm=(nearGrid.nz-1)*nearGrid.cell;
  const c=document.createElement('canvas');c.width=Math.round(Wm*AS);c.height=Math.round(Hm*AS);
  const g=c.getContext('2d')!;
  const P=(p:number[]):[number,number]=>[(p[0]+DIV_OX-x0)*AS,(p[1]+DIV_OZ-z0)*AS];
  g.fillStyle='#5f7c3a';g.fillRect(0,0,c.width,c.height);
  g.fillStyle='#6f9a4e';
  for(const p of[...D.plazas,...D.areas]){g.beginPath();p.pts.forEach((q,i)=>{const[a,b]=P(q);i?g.lineTo(a,b):g.moveTo(a,b);});g.closePath();g.fill();}
  g.lineCap='round';g.lineJoin='round';
  for(const wt of D.waters){g.strokeStyle='#3f86b8';g.lineWidth=Math.max(1.5,wt.hw*2*AS);g.beginPath();wt.pts.forEach((q,i)=>{const[a,b]=P(q);i?g.lineTo(a,b):g.moveTo(a,b);});g.stroke();}
  for(const r of D.roads){g.strokeStyle=r.p?'#e8dcc4':'#b07a52';g.lineWidth=Math.max(2,r.hw*2*AS+1);g.beginPath();r.pts.forEach((q,i)=>{const[a,b]=P(q);i?g.lineTo(a,b):g.moveTo(a,b);});g.stroke();}
  g.fillStyle='#9a7458';
  for(const h of D.houses){
    const[x,z,hw,hd,rot]=h,cs=Math.cos(rot),sn=Math.sin(rot);g.beginPath();
    for(const[u,v]of[[-1,-1],[1,-1],[1,1],[-1,1]]){const[a,b]=P([x+u*hw/2*cs-v*hd/2*sn,z+u*hw/2*sn+v*hd/2*cs]);g.lineTo(a,b);}
    g.closePath();g.fill();
  }
  return c;
}
function drawRadar(ctx:CanvasRenderingContext2D,pp:{x:number;z:number},vis:number):void{
  if(!atlas)atlas=buildAtlas();
  const minX=nearGrid.x0,minZ=nearGrid.z0,maxX=minX+atlas.width/AS,maxZ=minZ+atlas.height/AS;
  const x0=Math.max(minX,pp.x-vis),x1=Math.min(maxX,pp.x+vis),z0=Math.max(minZ,pp.z-vis),z1=Math.min(maxZ,pp.z+vis);
  if(x1<=x0||z1<=z0)return;
  ctx.drawImage(atlas,(x0-minX)*AS,(z0-minZ)*AS,(x1-x0)*AS,(z1-z0)*AS,x0,z0,x1-x0,z1-z0);
}

// Full map (M): the whole town fitted to the canvas; returns world→canvas for the marker.
function drawFullMap(ctx:CanvasRenderingContext2D,cw:number,ch:number):(x:number,z:number)=>[number,number]{
  if(!atlas)atlas=buildAtlas();
  const s=Math.min(cw/atlas.width,ch/atlas.height),ox=(cw-atlas.width*s)/2,oy=(ch-atlas.height*s)/2;
  ctx.fillStyle='#4d6a30';ctx.fillRect(0,0,cw,ch);
  ctx.drawImage(atlas,ox,oy,atlas.width*s,atlas.height*s);
  const P=(x:number,z:number):[number,number]=>[ox+(x-nearGrid.x0)*AS*s,oy+(z-nearGrid.z0)*AS*s];
  ctx.font='700 12px "IBM Plex Mono",monospace';ctx.textAlign='center';ctx.textBaseline='middle';
  const L=D.landmarks;
  for(const[name,p]of[['IGREJA MATRIZ',[L.matriz.cx,L.matriz.cz]],['HOSPITAL REGIONAL',L.hospital],['MIRANTE · MORRO DA TORRE',L.torre],
    ['ESTÁDIO',L.estadio],['CEMITÉRIO',L.cemiterio],['RIO DO PEIXE',riverLabelAt()]] as [string,number[]][]){
    const[x,y]=P(p[0]+DIV_OX,p[1]+DIV_OZ);
    ctx.lineWidth=3;ctx.strokeStyle='rgba(5,3,8,.9)';ctx.strokeText(name,x,y-12);
    ctx.fillStyle='#ffd24a';ctx.fillText(name,x,y-12);
    ctx.beginPath();ctx.arc(x,y,3.5,0,Math.PI*2);ctx.fill();
  }
  return P;
}

// the Rio do Peixe point closest to the centre (label anchor)
function riverLabelAt():number[]{
  let best=[0,-600],bd=1e9;
  for(const wt of D.waters)if(wt.name==='Rio do Peixe')for(const q of wt.pts){const d=Math.hypot(q[0],q[1]);if(d<bd){bd=d;best=[q[0],q[1]-40];}}
  return best;
}

// "Where am I": the named street within reach, else a landmark zone, else the town.
let lastQ={x:1e9,z:1e9,name:'Divinolândia'};
function placeName(x:number,z:number):string{
  if(Math.hypot(x-lastQ.x,z-lastQ.z)<6)return lastQ.name;
  const lx=x-DIV_OX,lz=z-DIV_OZ,L=D.landmarks;
  let name='Divinolândia';
  const near=(p:number[],r:number):boolean=>Math.hypot(lx-p[0],lz-p[1])<r;
  if(near(L.torre,90))name='Mirante · Morro da Torre';
  else if(near(L.hospital,75))name='Hospital Regional';
  else if(near([L.matriz.cx,L.matriz.cz],32))name='Igreja Matriz do Divino Espírito Santo';
  else{
    let best=14,bn='';
    for(const p of D.plazas){if(p.n&&pointIn([lx,lz],p.pts as P2[],0)){bn=p.n;best=0;break;}}
    if(!bn)for(const r of D.roads){
      if(!r.n)continue;
      for(let i=1;i<r.pts.length;i++){
        const[ax,az]=r.pts[i-1],[bx,bz]=r.pts[i],dx=bx-ax,dz=bz-az,l2=dx*dx+dz*dz||1;
        let t=((lx-ax)*dx+(lz-az)*dz)/l2;t=t<0?0:t>1?1:t;
        const d=Math.hypot(lx-ax-t*dx,lz-az-t*dz);if(d<best){best=d;bn=r.n;}
      }
    }
    if(!bn)for(const wt of D.waters){if(wt.name!=='Rio do Peixe')continue;
      for(const q of wt.pts)if(Math.hypot(lx-q[0],lz-q[1])<45){bn='Beira do Rio · Rio do Peixe';break;}
      if(bn)break;}
    if(bn)name=bn;
  }
  lastQ={x,z,name};
  return name;
}
