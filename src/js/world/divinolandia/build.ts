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
import {mergeStatic} from '../../../assets/models/props/prop-merge.ts';
import {divData as D,divinoHeight,nearGrid,farGrid,PLAY,DIV_OX,DIV_OZ,altitudeAt,SITE_FLOOR} from './data.ts';
import {addObb,setPlayBounds} from './collide.ts';
import {makeTerrainMesh,farTerrainMat} from '../../../assets/models/divinolandia/terreno.ts';
import {makeStreets,makeWater,type StreetLine} from '../../../assets/models/divinolandia/rua.ts';
import {addCasa,finalizeCasas,casaTop,EAVE,type CasaSpec} from '../../../assets/models/divinolandia/casa.ts';
import {makeTrees,makeCoffee} from '../../../assets/models/divinolandia/vegetacao.ts';
import {makeSurface,makeWall,makeTomb,makeGoal,type Surface} from '../../../assets/models/divinolandia/praca.ts';
import {makePostes,makePoleWires} from '../../../assets/models/divinolandia/poste.ts';
import Hospital,{HOSP_FOOT,HOSP_LOT} from '../../../assets/models/divinolandia/hospital-regional.ts';
import HospitalAnexo,{ANNEX_FOOT,ANNEX_LOT} from '../../../assets/models/divinolandia/hospital-anexo.ts';
import Torre from '../../../assets/models/divinolandia/torre-mirante.ts';
import Placa from '../../../assets/models/divinolandia/placa.ts';
import Predio from '../../../assets/models/divinolandia/predio-publico.ts';
import Prefeitura,{PREF_FOOT} from '../../../assets/models/divinolandia/prefeitura.ts';
import {buildEuclidesSchool,EUCLIDES_SITE} from '../../../assets/models/divinolandia/escola-euclides.ts';
import Igreja,{IGREJA_FOOT} from '../../../assets/models/divinolandia/igreja-matriz.ts';
import PracaAlcindo,{ALCINDO} from '../../../assets/models/divinolandia/praca-alcindo.ts';
import PracaLadislau,{LADISLAU,MATRIZ_AT} from '../../../assets/models/divinolandia/praca-ladislau.ts';
import {CORETO_R} from '../../../assets/models/rural/coreto.ts';
import type {GroundAt} from '../../../assets/models/divinolandia/praca-chao.ts';
import Bench from '../../../assets/models/props/park-bench.ts';
import PostoTriangulo,{ORIGIN as TRI_O,POSTO_FOOT as TRI_FOOT} from '../../../assets/models/divinolandia/posto-triangulo.ts';
import PostoPassoni,{ORIGIN as PAS_O,POSTO_FOOT as PAS_FOOT} from '../../../assets/models/divinolandia/posto-passoni.ts';
import PostoLurain,{ORIGIN as LUR_O,POSTO_FOOT as LUR_FOOT} from '../../../assets/models/divinolandia/posto-lurain.ts';
import PostoTaurus,{ORIGIN as TAU_O,POSTO_FOOT as TAU_FOOT} from '../../../assets/models/divinolandia/posto-taurus.ts';
import MonumentoCiclista,{ORIGIN as MON_O,MONUMENTO_FOOT as MON_FOOT} from '../../../assets/models/divinolandia/monumento-ciclista.ts';
import EntornoCiclista,{ORIGIN as ENT_O,ENTORNO_FOOT as ENT_FOOT} from '../../../assets/models/divinolandia/entorno-ciclista.ts';
import Mahindra,{ORIGIN as MAH_O,MAHINDRA_FOOT as MAH_FOOT} from '../../../assets/models/divinolandia/concessionaria-mahindra.ts';
import {makeFiatUno} from '../../../assets/models/vehicles/fiat-uno.ts';
import {makeKombi} from '../../../assets/models/vehicles/kombi.ts';
import {buildSurveyedStreet} from './ruas/build-rua.ts';
import {STREETS} from './ruas/index.ts';
import {planRoadPoles} from './postes-rua.ts';
import {waterLines} from './water.ts';
import {SITE_TABLE,ALL_LOTS,onSiteLot,siteLotPolygon,type LotId} from './sites-table.ts';

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
  const SURVEYED=new Set(STREETS.map(s=>s.rua));
  const surveyedLots:{x:number;z:number;width:number;depth:number;rotation:number}[]=[];
  const lines:StreetLine[]=D.roads.map(r=>{
    const pts=r.pts.map(p=>w(p));
    const mid=pts[Math.floor(pts.length/2)];
    // surveyed streets draw their own raised sidewalks, poles and lamps (ruas/build-rua.ts)
    // granite setts: tagged in OSM, or round the Matriz squares (every Street View panorama
    // there shows paralelepípedo; OSM does not tag it)
    const sett=r.sf==='sett'||!!r.p&&Math.hypot(mid[0]-DIV_OX-45,mid[1]-DIV_OZ-5)<130;
    return{pts,hw:r.hw,paved:!!r.p,sett,sidewalk:!SURVEYED.has(r.n)&&!!r.p&&r.k!=='primary'&&r.k!=='primary_link'&&townAt(mid[0],mid[1])>0};
  });
  scene.add(makeStreets(lines,H,nearGrid));
  // is (x,z) within `margin` of a street's drawn width (roadway + sidewalk)?
  const SC=24,streetHash=new Map<string,{ax:number;az:number;bx:number;bz:number;r:number}[]>();
  for(const l of lines)for(let i=1;i<l.pts.length;i++){
    const[ax,az]=l.pts[i-1],[bx,bz]=l.pts[i],seg={ax,az,bx,bz,r:l.hw+(l.sidewalk?2.1:0)},m=seg.r+3;
    for(let a=Math.floor((Math.min(ax,bx)-m)/SC);a<=Math.floor((Math.max(ax,bx)+m)/SC);a++)
      for(let b=Math.floor((Math.min(az,bz)-m)/SC);b<=Math.floor((Math.max(az,bz)+m)/SC);b++){
        const key=a+'_'+b;let arr=streetHash.get(key);if(!arr){arr=[];streetHash.set(key,arr);}arr.push(seg);
      }
  }
  const nearStreet=(x:number,z:number,margin:number):boolean=>(streetHash.get(Math.floor(x/SC)+'_'+Math.floor(z/SC))||[]).some(g=>{
    const dx=g.bx-g.ax,dz=g.bz-g.az,l2=dx*dx+dz*dz||1;let t=((x-g.ax)*dx+(z-g.az)*dz)/l2;t=t<0?0:t>1?1:t;
    return Math.hypot(x-g.ax-t*dx,z-g.az-t*dz)<g.r+Math.min(margin,3);
  });

  // ---------- surveyed streets (lot by lot from Street View) ----------
  // the bake chained each one into a single polyline (ruas/spec.ts chainPieces), cut into
  // its surface pieces in order: concatenating them gives the arc-length frame of the spec
  for(const spec of STREETS){
    const pts:[number,number][]=[];
    for(const r of D.roads)if(r.n===spec.rua)for(const p of r.pts){const q=w(p);const last=pts[pts.length-1];if(!last||Math.hypot(last[0]-q[0],last[1]-q[1])>.5)pts.push(q);}
    if(pts.length<2)continue;
    const street=new THREE.Group();                          // all lots merged together (few draw calls)
    const r=buildSurveyedStreet(spec,pts,D.roads.find(r=>r.n===spec.rua)!.hw,H,o=>{street.add(o);});
    scene.add(r.wires);                                      // lines aren't merged with the meshes
    surveyedLots.push(...r.footprints);
    placeStatic(street);
  }
  // ---------- the cell towers of the centre (seen over the roofs from the street) ----------
  for(const p of D.landmarks.torresCelular){
    const[x,z]=w(p);const t=Torre.build({h:38,painted:false,mirante:false});t.position.set(x,H(x,z),z);placeStatic(t);
    addObb(x,z,3.6,3.6,0,H(x,z)+40);
  }
  scene.add(makeWater(waterLines));

  // ---------- plazas, greens, pitches, cemetery, schools ----------
  const ground=new THREE.Group();
  const trees:{x:number;y:number;z:number;s:number;r:number}[]=[];
  const deco=new THREE.Group();
  for(const p of [...D.plazas,...D.areas]){
    const pts=p.pts.map(q=>w(q)) as P2[];
    const k=p.k as Surface|'hospital'|'torre';
    if(k==='hospital'||k==='torre')continue;
    if(p.n&&MATRIZ_SQUARES.has(p.n))continue;             // laid out 1:1 below (praca-alcindo/ladislau)
    if(p.n!=='Escola Municipal Euclides da Cunha')ground.add(makeSurface(k,pts,H,nearGrid));
    let cx=0,cz=0;for(const q of pts){cx+=q[0];cz+=q[1];}cx/=pts.length;cz/=pts.length;
    if(k==='praca'||k==='verde'){
      // a ring of shade trees + benches around the middle of each plaza
      // (an OSM plaza is no circle: keep only the spots well inside it and off the streets)
      let r=1e9;for(const q of pts)r=Math.min(r,Math.hypot(q[0]-cx,q[1]-cz));
      const n=Math.max(4,Math.min(10,Math.floor(r/4)));
      for(let i=0;i<n;i++){const a=i/n*Math.PI*2,rr=r*.62;const x=cx+Math.cos(a)*rr,z=cz+Math.sin(a)*rr;
        if(pointIn([x,z],pts,2.5)&&!nearStreet(x,z,1.5)&&!inOsmBuilding(x,z,2.5))trees.push({x,y:H(x,z),z,s:.75,r:a});}
      if(k==='praca'&&r>8)for(let i=0;i<4;i++){
        const a=i*Math.PI/2+.4,x=cx+Math.cos(a)*r*.38,z=cz+Math.sin(a)*r*.38;
        if(!pointIn([x,z],pts,1.5)||nearStreet(x,z,1.2)||inOsmBuilding(x,z,1))continue;
        const b=Bench.build();b.position.set(x,H(x,z)+.15,z);b.rotation.y=-a+Math.PI/2;deco.add(b);
      }
    }else if(k==='cemiterio'){
      // (the streets and the driveways through it stay open: a gate in the wall, no graves)
      deco.add(makeWall(pts,H,2.2,(x,z)=>nearStreet(x,z,.3)));
      for(let a=-60;a<=60;a+=3.2)for(let b=-60;b<=60;b+=4.6){
        const x=cx+a,z=cz+b;
        if(!pointIn([x,z],pts,3)||nearStreet(x,z,1.3))continue;
        const t=makeTomb();t.position.set(x,H(x,z),z);deco.add(t);
      }
    }else if(k==='campo'||k==='estadio'){
      const o=longAxis(pts);
      for(const s of[-1,1]){
        const gx=cx+Math.cos(o.a)*(o.len/2-3)*s,gz=cz+Math.sin(o.a)*(o.len/2-3)*s;
        const g=makeGoal();g.position.set(gx,H(gx,gz)+.16,gz);g.rotation.y=Math.atan2(-Math.cos(o.a)*s,-Math.sin(o.a)*s);deco.add(g);
      }
    }else if(k==='escola'){
      if(p.n==='Escola Municipal Euclides da Cunha'){
        // The photographed façade faces Rua São Vicente de Paula at the parcel's north edge.
        const schoolX=DIV_OX+EUCLIDES_SITE.x,schoolZ=DIV_OZ+EUCLIDES_SITE.z,schoolYaw=EUCLIDES_SITE.yaw;
        const sine=Math.sin(schoolYaw),cosine=Math.cos(schoolYaw);
        const localHeight=(localX:number,localZ:number):number=>H(schoolX+localX*cosine+localZ*sine,schoolZ-localX*sine+localZ*cosine);
        const baseHeight=localHeight(0,24.5);
        const school=buildEuclidesSchool({groundAt:(x,z)=>localHeight(x,z)-baseHeight});
        school.position.set(schoolX,baseHeight,schoolZ);school.rotation.y=schoolYaw;deco.add(school);
        obbFromModel(schoolX,schoolZ,schoolYaw,0,EUCLIDES_SITE.centerZ,EUCLIDES_SITE.width,EUCLIDES_SITE.depth,baseHeight+10);
      }else{
        const o=longAxis(pts),bw=Math.min(40,o.len*.55),th=Math.atan2(-Math.sin(o.a),Math.cos(o.a));
        const f=slopeFloor(cx,cz,bw,11,-th);
        const b=Predio.build({w:bw,d:11,floors:2,color:0xdfe6cf,base:f.base});b.position.set(cx,f.y,cz);b.rotation.y=th;deco.add(b);
        obbFromModel(cx,cz,th,0,0,bw,11,f.y+8);
      }
    }
  }
  for(const g of ground.children){(g as THREE.Mesh).matrixAutoUpdate=false;}
  scene.add(ground);
  placeStatic(deco);

  // ---------- Igreja Matriz + its two squares, 1:1 from the satellite and Street View ----------
  // Each square is laid out in its own frame (u along the street grid, v across) and draped
  // on the real terrain; the church stands on its terrace, the levelled `matriz` lot.
  const L=D.landmarks;
  const [mx,mz]=w([L.matriz.cx,L.matriz.cz]);
  const [px,pz]=w([L.pracaMatriz.x,L.pracaMatriz.z]);
  const square=(sq:{x:number;z:number;rot:number})=>{
    const ox=sq.x+DIV_OX,oz=sq.z+DIV_OZ,c=Math.cos(sq.rot),s=Math.sin(sq.rot),y0=H(ox,oz);
    const at:GroundAt=(u:number,v:number):number=>H(ox+u*c-v*s,oz+u*s+v*c)-y0;
    // the terrain grid's lines in the square's frame, so its surfaces lie exactly on the ground
    at.grid=[(u,v)=>(ox+u*c-v*s-nearGrid.x0)/nearGrid.cell,(u,v)=>(oz+u*s+v*c-nearGrid.z0)/nearGrid.cell];
    const world=(u:number,v:number):[number,number]=>[ox+u*c-v*s,oz+u*s+v*c];
    return{ox,oz,y0,th:-sq.rot,at,world};
  };
  {
    const A=square(ALCINDO);
    const g=PracaAlcindo.build({groundAt:A.at});g.position.set(A.ox,A.y0,A.oz);g.rotation.y=A.th;placeStatic(g);
    const top=(u:number,v:number,h:number):number=>A.y0+A.at(u,v)+h;
    obbFromModel(A.ox,A.oz,A.th,40.5,4.5,CORETO_R*2,CORETO_R*2,top(40.5,4.5,1.3));        // coreto (stand on it: floor 1.3)
    obbFromModel(A.ox,A.oz,A.th,4.5,4.5,10.8,10.8,top(4.5,4.5,.6));                       // fountain basin
    obbFromModel(A.ox,A.oz,A.th,-32.2,-29.8,10.5,8.5,top(-32.2,-29.8,3.3));               // shelter
    obbFromModel(A.ox,A.oz,A.th,-36.4,35.5,2.8,5.6,top(-36.4,35.5,2.9));                  // snack kiosk
    {const[x,z]=A.world(4.6,-26.2);addObb(x,z,9.4,9.4,ALCINDO.rot+.56,top(4.6,-26.2,4.2));} // white pavilion
    const Ld=square(LADISLAU);
    const gl=PracaLadislau.build({groundAt:Ld.at});gl.position.set(Ld.ox,Ld.y0,Ld.oz);gl.rotation.y=Ld.th;placeStatic(gl);
    const[cx,cz]=Ld.world(MATRIZ_AT.u,MATRIZ_AT.v),fy=SITE_FLOOR.matriz;
    const church=Igreja.build();church.position.set(cx,fy,cz);church.rotation.y=Ld.th;placeStatic(church);
    for(const[bx,bz,bw,bd,ht]of IGREJA_FOOT)obbFromModel(cx,cz,Ld.th,bx,bz,bw,bd,fy+ht);
  }

  // ---------- Prefeitura and the other mapped public buildings ----------
  // the Prefeitura, rebuilt from Street View on its levelled lot (sites-table.ts)
  {
    const s=SITE_TABLE.prefeitura,th=s.face;
    const ox=s.x+DIV_OX-Math.sin(th)*.8,oz=s.z+DIV_OZ-Math.cos(th)*.8,y=SITE_FLOOR.prefeitura;
    const pref=Prefeitura.build();pref.position.set(ox,y,oz);pref.rotation.y=th;placeStatic(pref);
    for(const[cx,cz,bw,bd,ht]of PREF_FOOT)obbFromModel(ox,oz,th,cx,cz,bw,bd,y+ht);
  }
  for(const b of D.buildings){
    if(b.kind==='townhall')continue;                      // built above
    const [bx,bz]=w([b.cx,b.cz]),th=-b.rot;
    const fl=b.kind==='church'||b.kind==='place_of_worship'?1:2;
    const f=slopeFloor(bx,bz,Math.max(8,b.w),Math.max(8,b.d),b.rot);
    const pr=Predio.build({w:Math.max(8,b.w),d:Math.max(8,b.d),floors:fl,color:0xe7e1d3,base:f.base});
    pr.position.set(bx,f.y,bz);pr.rotation.y=th;placeStatic(pr);
    obbFromModel(bx,bz,th,0,0,Math.max(8,b.w),Math.max(8,b.d),f.y+fl*3.4+1);
  }

  // ---------- Hospital Regional: the old sanatorium + its modern annex, on their real
  // footprint (sites-table.ts); both share the sanatorium's frame, each on its own lot ----------
  for(const[id,model,lot,foot]of[['hospital',Hospital,HOSP_LOT,HOSP_FOOT],['hospitalAnnex',HospitalAnexo,ANNEX_LOT,ANNEX_FOOT]] as const){
    const s=SITE_TABLE[id],th=s.face,c=Math.cos(th),sn=Math.sin(th),y=SITE_FLOOR[id];
    const ox=s.x+DIV_OX-(lot.x*c+lot.z*sn),oz=s.z+DIV_OZ-(-lot.x*sn+lot.z*c);
    const m=model.build();m.position.set(ox,y,oz);m.rotation.y=th;placeStatic(m);
    for(const[cx,cz,bw,bd,ht]of foot)obbFromModel(ox,oz,th,cx,cz,bw,bd,y+ht);
  }
  // the sanatorium's glass entrance is the street door of the game's hospital (models/city/hospital.ts)

  // ---------- the four fuel stations, the Monumento ao Ciclista and its surroundings (the
  // lots round the east entrance, the Mahindra dealer), 1:1 from Street View (posto-*.ts,
  // monumento-ciclista.ts, entorno-ciclista.ts, concessionaria-mahindra.ts): each is built in town-local metres and stands on the
  // real slope of its lot (sites-table.ts DRAPED_LOTS) ----------
  for(const[model,origin,foot]of[[PostoTriangulo,TRI_O,TRI_FOOT],[PostoPassoni,PAS_O,PAS_FOOT],[PostoLurain,LUR_O,LUR_FOOT],[PostoTaurus,TAU_O,TAU_FOOT],
    [MonumentoCiclista,MON_O,MON_FOOT],[EntornoCiclista,ENT_O,ENT_FOOT],[Mahindra,MAH_O,MAH_FOOT]] as const){
    const[ox,oz]=w(origin),y0=H(ox,oz);
    const at:GroundAt=(x:number,z:number):number=>H(x+DIV_OX,z+DIV_OZ)-y0;
    at.grid=[(x,_z)=>(x+DIV_OX-nearGrid.x0)/nearGrid.cell,(_x,z)=>(z+DIV_OZ-nearGrid.z0)/nearGrid.cell];
    const m=model.build({groundAt:at});m.position.set(ox,y0,oz);placeStatic(m);
    for(const[x,z,bw,bd,rot,ht]of foot){const[wx,wz]=w([x,z]);addObb(wx,wz,bw,bd,rot,H(wx,wz)+ht);}
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
  const casas:CasaSpec[]=[];
  for(let i=0;i<D.houses.length;i++){
    const[hx0,hz0,hw,hd,rot,fl,c,roof,shop]=D.houses[i];
    if(houseOnSite(hx0,hz0,hw,hd,rot))continue;           // the lot of a game place (sites-table.ts)
    if(rectsOverlap(rectCorners(hx0,hz0,hw,hd,rot),EUCLIDES_LOT))continue;   // the school's campus and its entrance
    const[x,z]=w([hx0,hz0]),cs=Math.cos(rot),sn=Math.sin(rot);
    const at=(u:number,v:number):number=>H(x+u*hw/2*cs-v*hd/2*sn,z+u*hw/2*sn+v*hd/2*cs);
    const hs=[at(-1,-1),at(1,-1),at(1,1),at(-1,1)];
    // the lowest ground anywhere along the walls (between the corners the terrain's own
    // triangles can dip lower than all four)
    let low=Math.min(...hs);
    for(let k=0;k<=8;k++){const t=k/4-1;low=Math.min(low,at(t,-1),at(t,1),at(-1,t),at(1,t));}
    const front=H(x-sn*hd/2,z+cs*hd/2);
    const floor=Math.max(front,Math.max(...hs)-2.4)+.15,base=low-.6;
    if(floor-front>1.45)continue;                         // a place's levelled pad left it on a bank too steep for a doorstep
    casas.push({x,z,w:hw,d:hd,rot,floor,base,floors:fl,color:c,flat:!!roof,shop,seed:i+1,step:floor-front});
  }
  sideEaves(casas);
  for(const spec of casas){
    addCasa(spec);
    addObb(spec.x,spec.z,spec.w,spec.d,spec.rot,spec.floor+casaTop(spec));
  }
  for(const g of finalizeCasas()){scene.add(g);cullGroups.push({g,r:1100});}

  // ---------- utility poles along inhabited streets ----------
  const poleRoutes=planRoadPoles({
    roads:lines.map((line,index)=>{
      const road=D.roads[index],mid=line.pts[Math.floor(line.pts.length/2)];
      const arterial=road.k==='primary'||road.k==='secondary';
      return{name:road.n,pts:line.pts,halfWidth:line.hw,paved:line.paved,sidewalk:line.sidewalk,
        enabled:line.sidewalk||arterial&&townAt(mid[0],mid[1])>0};
    }),
    houses:[...D.houses.map(([x,z,width,depth,rotation])=>({x:x+DIV_OX,z:z+DIV_OZ,width,depth,rotation})),...surveyedLots,
      ...D.buildings.map(b=>({x:b.cx+DIV_OX,z:b.cz+DIV_OZ,width:Math.max(8,b.w),depth:Math.max(8,b.d),rotation:b.rot}))],
    protectedAreas:[...[...D.areas,...D.plazas].map(area=>area.pts),...(Object.keys(ALL_LOTS) as LotId[]).map(id=>siteLotPolygon(id,3))]
      .map(area=>area.map(point=>w(point))),
    surveyedStreets:[...SURVEYED],
  }).map(route=>route.map(site=>({...site,y:H(site.x,site.z)})));
  const poles=poleRoutes.flat();
  scene.add(makePostes(poles),makePoleWires(poleRoutes));
  for(const pole of poles)addObb(pole.x,pole.z,.36,.36,0,pole.y+10.5);

  // ---------- vegetation ----------
  for(let i=0;i<D.trees.length;i+=3){
    if(onSiteLot(D.trees[i],D.trees[i+1],3))continue;
    if(inMatrizSquare(D.trees[i],D.trees[i+1]))continue;      // their trees are the surveyed ones
    const[x,z]=w([D.trees[i],D.trees[i+1]]);trees.push({x,y:H(x,z)-.1,z,s:D.trees[i+2],r:i});
  }
  for(const g of makeTrees(trees)){scene.add(g);cullGroups.push({g,r:900});}
  const cof:{x:number;y:number;z:number;s:number;r:number}[]=[];
  for(let i=0;i<D.coffee.length;i+=3){
    if(onSiteLot(D.coffee[i],D.coffee[i+1],3))continue;
    const[x,z]=w([D.coffee[i],D.coffee[i+1]]);cof.push({x,y:H(x,z)-.15,z,s:1,r:D.coffee[i+2]});
  }
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
// Side eaves of the terraced houses: a neighbour standing within two eaves of a side wall
// (and facing it along the house's depth) gets half the gap each, so the roofs meet
// instead of one eave running into the other house's wall.
function sideEaves(list:CasaSpec[]):void{
  const C=24,grid=new Map<string,number[]>();
  list.forEach((h,k)=>{const key=Math.floor(h.x/C)+'_'+Math.floor(h.z/C);let a=grid.get(key);if(!a){a=[];grid.set(key,a);}a.push(k);});
  list.forEach((h,k)=>{
    const c=Math.cos(h.rot),s=Math.sin(h.rot),e:[number,number]=[EAVE,EAVE];
    const i0=Math.floor(h.x/C),j0=Math.floor(h.z/C);
    for(let a=-1;a<=1;a++)for(let b=-1;b<=1;b++)for(const o of grid.get((i0+a)+'_'+(j0+b))||[]){
      if(o===k)continue;
      const n=list[o];
      // the neighbour's corners in this house's frame (u along the façade, v along its depth)
      let u0=Infinity,u1=-Infinity,v0=Infinity,v1=-Infinity;
      for(const[x,z]of rectCorners(n.x,n.z,n.w,n.d,n.rot)){
        const dx=x-h.x,dz=z-h.z,u=dx*c+dz*s,v=-dx*s+dz*c;
        u0=Math.min(u0,u);u1=Math.max(u1,u);v0=Math.min(v0,v);v1=Math.max(v1,v);
      }
      if(v1<-h.d/2-EAVE||v0>h.d/2+EAVE)continue;              // not beside it
      if(u0>=h.w/2-.05&&u0-h.w/2<2*EAVE)e[1]=Math.min(e[1],Math.max(0,(u0-h.w/2)/2-.02));
      if(u1<=-h.w/2+.05&&-h.w/2-u1<2*EAVE)e[0]=Math.min(e[0],Math.max(0,(-h.w/2-u1)/2-.02));
    }
    h.eave=e;
  });
}
// inside (or within m of) one of the mapped buildings drawn as a Predio box (world x,z)
function inOsmBuilding(x:number,z:number,m:number):boolean{
  return D.buildings.some(b=>{
    if(b.kind==='townhall')return false;
    const dx=x-b.cx-DIV_OX,dz=z-b.cz-DIV_OZ,c=Math.cos(b.rot),s=Math.sin(b.rot);
    return Math.abs(dx*c+dz*s)<Math.max(8,b.w)/2+m&&Math.abs(-dx*s+dz*c)<Math.max(8,b.d)/2+m;
  });
}
// Floor of a plain box building (Predio) on a slope: the mean ground, but buried at most
// 1.2 m on the high side; its plinth (`base` below the floor) reaches the lowest ground.
function slopeFloor(x:number,z:number,w:number,d:number,rot:number):{y:number;base:number}{
  const c=Math.cos(rot),s=Math.sin(rot),hs:number[]=[];
  for(let a=-1;a<=1;a+=.5)for(let b=-1;b<=1;b+=.5)hs.push(H(x+a*w/2*c-b*d/2*s,z+a*w/2*s+b*d/2*c));
  const mean=hs.reduce((p,q)=>p+q,0)/hs.length,y=Math.max(mean,Math.max(...hs)-1.2);
  return{y,base:Math.max(1.5,y-Math.min(...hs)+.4)};
}
// the Euclides da Cunha campus (escola-euclides.ts frame: x across, z toward the street),
// grown 1.5 m, town-local
const EUCLIDES_LOT:P2[]=(()=>{
  const E=EUCLIDES_SITE,c=Math.cos(E.yaw),s=Math.sin(E.yaw),hw=E.width/2+1.5,z0=E.centerZ-E.depth/2-1.5,z1=E.centerZ+E.depth/2+1.5;
  return[[-hw,z0],[hw,z0],[hw,z1],[-hw,z1]].map(([x,z])=>[E.x+x*c+z*s,E.z-x*s+z*c] as P2);
})();
// a generated house touching a game place's lot (the two rectangles overlap)
function houseOnSite(x:number,z:number,hw:number,hd:number,rot:number):boolean{
  if(onSiteLot(x,z))return true;
  const house=rectCorners(x,z,hw,hd,rot);
  return(Object.keys(ALL_LOTS) as LotId[]).some(id=>{
    const s=ALL_LOTS[id];
    return Math.hypot(s.x-x,s.z-z)<(Math.hypot(s.w,s.d)+Math.hypot(hw,hd))/2+2&&rectsOverlap(house,siteLotPolygon(id,2));
  });
}
// corners of a w×d rectangle centred at (x,z) whose local +x runs along (cos rot, sin rot)
function rectCorners(x:number,z:number,w:number,d:number,rot:number):P2[]{
  const c=Math.cos(rot),s=Math.sin(rot);
  return[[-1,-1],[1,-1],[1,1],[-1,1]].map(([u,v])=>[x+u*w/2*c-v*d/2*s,z+u*w/2*s+v*d/2*c] as P2);
}
// separating-axis test of two convex quads
function rectsOverlap(a:P2[],b:P2[]):boolean{
  for(const poly of[a,b])for(let i=0;i<poly.length;i++){
    const p=poly[i],q=poly[(i+1)%poly.length],nx=q[1]-p[1],nz=p[0]-q[0];
    let a0=Infinity,a1=-Infinity,b0=Infinity,b1=-Infinity;
    for(const v of a){const d=v[0]*nx+v[1]*nz;a0=Math.min(a0,d);a1=Math.max(a1,d);}
    for(const v of b){const d=v[0]*nx+v[1]*nz;b0=Math.min(b0,d);b1=Math.max(b1,d);}
    if(a1<=b0||b1<=a0)return false;
  }
  return true;
}
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
  ctx.font='700 12px "Barlow Condensed",monospace';ctx.textAlign='center';ctx.textBaseline='middle';
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

// the two squares of the Matriz, laid out 1:1 (praca-alcindo.ts / praca-ladislau.ts)
const MATRIZ_SQUARES=new Set(['Praça Doutor Alcindo Cardoso de Paiva','Praça Professor Ladislau Rodrigues Pinto']);
function inMatrizSquare(lx:number,lz:number):boolean{
  for(const sq of[ALCINDO,LADISLAU]){
    const dx=lx-sq.x,dz=lz-sq.z,c=Math.cos(sq.rot),s=Math.sin(sq.rot),u=dx*c+dz*s,v=-dx*s+dz*c;
    if(u>sq.u0-1&&u<sq.u1+1&&v>sq.v0-1&&v<sq.v1+1)return true;
  }
  return false;
}
