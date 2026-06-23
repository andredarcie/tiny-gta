import * as THREE from 'three';
import {matte} from '../matte.ts';
import {scene} from '@/core/engine.ts';
import {rand} from '@/core/constants.ts';
import {makePed} from '../characters/pedestrian.ts';
import {makeDoorArrow} from './door-arrow.ts';

// County jail / presidio: exterior on a reserved city block and a separate
// interior group, same pattern as hospital, nightclub, and gym.

export const PRISON_I=2,PRISON_J=2; // block near the old busted release spot

export const PRISON_DOOR={x:-74.6,z:-66};
export const PRISON_SPAWN_OUT={x:-76.4,z:-66};

export const INT_CENTER={x:-800,z:330};
export const INT_DOOR={x:-814.2,z:330};
export const INT_SPAWN={x:-812.2,z:330};
export const PRISON_RELEASE={x:-808.8,z:329.4}; // busted spawn, release corridor
export const INT_BOUNDS={x0:-814.3,x1:-760.5,z0:320.7,z1:339.3,y1:5.2};
// The clandestine hole in the open cell at the far east of the cell-block wing
// (filled in by addPrison). Stepping on it drops into the escape tunnel — see
// js/activities/jail-break.ts.
export const TUNNEL_HOLE={x:-763,z:337};

const concreteM=matte({color:0x6b7378,roughness:.96});
const darkM=matte({color:0x15191d,roughness:.86});
const steelM=matte({color:0x535d66,metalness:.75,roughness:.32});
const stripeM=new THREE.MeshBasicMaterial({color:0x3e7bff});
const amberM=new THREE.MeshBasicMaterial({color:0xffd24a,transparent:true,opacity:.85});
const cellWallM=matte({color:0x1f252b,roughness:.98});

export const prisonFx:{guards:{g:any,t:number,sp:number,face:number,kind:string}[],inmates:{g:any,t:number,sp:number,face:number}[],exitArrow:THREE.Mesh|null,facade:THREE.Group|null,facadeArrow:THREE.Mesh|null,footprint:{x0:number,x1:number,z0:number,z1:number}|null,warning:THREE.Mesh|null}={guards:[],inmates:[],exitArrow:null,facade:null,
  facadeArrow:null,footprint:null,warning:null};
export const prisonInterior=new THREE.Group();
prisonInterior.visible=false;

function signTexture():THREE.CanvasTexture{
  const c=document.createElement('canvas');c.width=512;c.height=128;
  const x=c.getContext('2d')!;
  x.textAlign='center';x.textBaseline='middle';
  x.font='900 50px monospace';
  x.shadowColor='#3e7bff';x.shadowBlur=20;
  x.fillStyle='#dfeaff';
  for(let k=0;k<3;k++)x.fillText('COUNTY JAIL',256,64);
  const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;
  return t;
}

function addBars(parent:THREE.Object3D,x:number,y:number,z:number,w:number,h:number,vertical=true,axis='x'):void{
  const n=vertical?5:4;
  for(let i=0;i<n;i++){
    const u=(i-(n-1)/2)*(vertical?w/(n-1):h/(n-1));
    const bar=new THREE.Mesh(vertical
      ?new THREE.BoxGeometry(.08,h,.08)
      :new THREE.BoxGeometry(w,.08,.08),steelM);
    bar.position.set(
      x+(vertical&&axis==='x'?u:0),
      y+(vertical?0:u),
      z+(vertical&&axis==='z'?u:0),
    );
    if(!vertical&&axis==='z')bar.rotation.y=Math.PI/2;
    parent.add(bar);
  }
  const top=new THREE.Mesh(new THREE.BoxGeometry(
    axis==='x'?w:.1,.08,axis==='z'?w:.1),steelM);
  top.position.set(x,y+h/2,z);parent.add(top);
  const bot=top.clone();bot.position.set(x,y-h/2,z);parent.add(bot);
}

function makeBunk():THREE.Group{
  const g=new THREE.Group();
  const frame=new THREE.Mesh(new THREE.BoxGeometry(2,.18,.9),steelM);
  frame.position.y=.55;g.add(frame);
  const mat=new THREE.Mesh(new THREE.BoxGeometry(1.85,.16,.78),
    matte({color:0x77808a,roughness:.8}));
  mat.position.y=.69;g.add(mat);
  const upper=frame.clone();upper.position.y=1.7;g.add(upper);
  const upperMat=mat.clone();upperMat.position.y=1.84;g.add(upperMat);
  for(const sx of[-.92,.92])for(const sz of[-.36,.36]){
    const post=new THREE.Mesh(new THREE.BoxGeometry(.08,1.9,.08),steelM);
    post.position.set(sx,.95,sz);g.add(post);
  }
  return g;
}

function makeDesk():THREE.Group{
  const g=new THREE.Group();
  const desk=new THREE.Mesh(new THREE.BoxGeometry(5.2,1.05,1.2),
    matte({color:0x303944,roughness:.74}));
  desk.position.y=.52;g.add(desk);
  const top=new THREE.Mesh(new THREE.BoxGeometry(5.4,.1,1.35),steelM);
  top.position.y=1.08;g.add(top);
  const screen=new THREE.Mesh(new THREE.BoxGeometry(.7,.42,.08),
    new THREE.MeshBasicMaterial({color:0x9bdcff}));
  screen.position.set(1.6,1.36,-.48);g.add(screen);
  return g;
}

function addCellWall(parent:THREE.Object3D,x:number,z:number,w:number,d:number,h=3.25):THREE.Mesh{
  const wall=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),cellWallM);
  wall.position.set(x,h/2,z);wall.castShadow=true;wall.receiveShadow=true;
  parent.add(wall);
  return wall;
}

// Combined steel toilet-and-sink unit (the classic jail fixture), for cell detail.
function makeToiletSink():THREE.Group{
  const g=new THREE.Group();
  const por=matte({color:0xb6bcc2,roughness:.5,metalness:.2});
  g.add(mesh(new THREE.CylinderGeometry(.22,.18,.45,12),por,0,.32,0));        // bowl
  const seat=new THREE.Mesh(new THREE.TorusGeometry(.2,.05,6,14),por);
  seat.rotation.x=Math.PI/2;seat.position.y=.55;g.add(seat);
  g.add(mesh(new THREE.BoxGeometry(.5,.55,.2),por,0,.78,-.24));               // tank
  g.add(mesh(new THREE.BoxGeometry(.46,.12,.34),por,0,1.08,-.12));            // sink shelf
  g.add(mesh(new THREE.CylinderGeometry(.12,.1,.08,12),
    matte({color:0x2a2d33,roughness:.6}),0,1.12,-.08));                       // basin
  return g;
}
function mesh(geo:THREE.BufferGeometry,m:THREE.Material,x:number,y:number,z:number):THREE.Mesh{const o=new THREE.Mesh(geo,m);o.position.set(x,y,z);return o;}

// "CELL BLOCK D" placard over the doorway between the two rooms.
let cbSignTex:THREE.CanvasTexture|null=null;
function cellBlockSign():THREE.CanvasTexture{
  if(cbSignTex)return cbSignTex;
  const c=document.createElement('canvas');c.width=256;c.height=64;
  const x=c.getContext('2d')!;
  x.fillStyle='#161b22';x.fillRect(0,0,256,64);
  x.strokeStyle='#3e7bff';x.lineWidth=4;x.strokeRect(5,5,246,54);
  x.fillStyle='#dfeaff';x.textAlign='center';x.textBaseline='middle';
  x.font='900 28px monospace';x.fillText('CELL BLOCK D',128,34);
  cbSignTex=new THREE.CanvasTexture(c);cbSignTex.colorSpace=THREE.SRGBColorSpace;
  return cbSignTex;
}

export function addPrison(solids:{x0:number,x1:number,z0:number,z1:number,h:number}[]):void{
  const cx=-66,cz=-66;

  // Exterior: squat concrete building with barred windows and a small tower.
  const bld=new THREE.Mesh(new THREE.BoxGeometry(18,7.2,18),concreteM);
  bld.position.set(cx,3.6,cz);bld.castShadow=true;bld.receiveShadow=true;scene.add(bld);
  const roof=new THREE.Mesh(new THREE.BoxGeometry(18.4,.3,18.4),darkM);
  roof.position.set(cx,7.35,cz);scene.add(roof);
  const band=new THREE.Mesh(new THREE.BoxGeometry(18.5,.38,18.5),stripeM);
  band.position.set(cx,5.6,cz);scene.add(band);
  const tower=new THREE.Mesh(new THREE.BoxGeometry(3.2,6,3.2),concreteM);
  tower.position.set(cx+5.8,10.2,cz-5.8);tower.castShadow=true;scene.add(tower);
  const towerRoof=new THREE.Mesh(new THREE.BoxGeometry(3.8,.25,3.8),darkM);
  towerRoof.position.set(cx+5.8,13.3,cz-5.8);scene.add(towerRoof);

  const facade=new THREE.Group();
  const door=new THREE.Mesh(new THREE.BoxGeometry(.18,3.2,2.8),darkM);
  door.position.set(cx-9.02,1.6,cz);facade.add(door);
  addBars(facade,cx-9.14,2.1,cz,2.2,2.5,true,'z');
  const canopy=new THREE.Mesh(new THREE.BoxGeometry(2.8,.18,4.6),darkM);
  canopy.position.set(cx-10.1,3.25,cz);canopy.castShadow=true;facade.add(canopy);
  const sign=new THREE.Mesh(new THREE.PlaneGeometry(9.5,2.35),
    new THREE.MeshBasicMaterial({map:signTexture(),transparent:true}));
  sign.position.set(cx-9.13,6.05,cz);sign.rotation.y=-Math.PI/2;facade.add(sign);
  prisonFx.facadeArrow=makeDoorArrow();
  prisonFx.facadeArrow.position.set(cx-10.2,1.7,cz);facade.add(prisonFx.facadeArrow);
  scene.add(facade);
  prisonFx.facade=facade;
  prisonFx.footprint={x0:cx-9.2,x1:cx+9.2,z0:cz-9.2,z1:cz+9.2};

  for(const z of[cz-5.7,cz+5.7]){
    addBars(scene,cx-9.16,3.4,z,1.6,1.3,true,'z');
  }
  solids.push({x0:cx-9.2,x1:cx+9.2,z0:cz-9.2,z1:cz+9.2,h:13.4});

  // Interior: processing room with a holding cell row.
  // One long room: processing (west) + cell-block wing (east). Center shifts to -788,
  // width 54 (x ≈ -815 .. -761), so the player walks straight into the cell block.
  const shell=new THREE.Mesh(new THREE.BoxGeometry(54,6,20),
    matte({color:0x283039,roughness:1,side:THREE.BackSide}));
  shell.position.set(-788,3,330);prisonInterior.add(shell);
  const floor=new THREE.Mesh(new THREE.PlaneGeometry(53.4,19.4),
    matte({color:0x41464d,roughness:.94}));
  floor.rotation.x=-Math.PI/2;floor.position.set(-788,.02,330);prisonInterior.add(floor);
  const outer=new THREE.Mesh(new THREE.BoxGeometry(58,10,24),
    new THREE.MeshBasicMaterial({color:0x050608,side:THREE.BackSide}));
  outer.position.set(-788,3.8,330);prisonInterior.add(outer);

  for(const z of[320.1,339.9]){
    const s=new THREE.Mesh(new THREE.BoxGeometry(53.2,.1,.08),stripeM);
    s.position.set(-788,2.55,z);prisonInterior.add(s);
  }
  for(const x of[-814.9,-761.1]){
    const s=new THREE.Mesh(new THREE.BoxGeometry(.08,.1,19.2),stripeM);
    s.position.set(x,2.55,330);prisonInterior.add(s);
  }

  const cellFrontZ=334.2,cellBackZ=339.05;
  const cellDefs=[
    {x:-806.05,x0:-808.7,x1:-803.4,bunkX:-806.2,inmateX:-806.2},
    {x:-800.75,x0:-803.4,x1:-798.1,bunkX:-799.8,inmateX:-799.8},
  ];
  const cellDepth=cellBackZ-cellFrontZ;
  for(const x of[-808.7,-803.4,-798.1]){
    addCellWall(prisonInterior,x,(cellFrontZ+cellBackZ)/2,.28,cellDepth);
  }
  for(const c of cellDefs){
    addCellWall(prisonInterior,c.x,cellBackZ,c.x1-c.x0,.28);
    addBars(prisonInterior,c.x,1.8,cellFrontZ,c.x1-c.x0-.35,3.1,true);
    const sill=new THREE.Mesh(new THREE.BoxGeometry(c.x1-c.x0,.34,.22),steelM);
    sill.position.set(c.x,.28,cellFrontZ);prisonInterior.add(sill);
    const lock=new THREE.Mesh(new THREE.BoxGeometry(.18,.35,.12),amberM);
    lock.position.set(c.x+1.8,1.35,cellFrontZ-.12);prisonInterior.add(lock);
    const bunk=makeBunk();bunk.position.set(c.bunkX,0,337.4);prisonInterior.add(bunk);
  }

  const desk=makeDesk();desk.position.set(-796,.03,324.6);prisonInterior.add(desk);
  const lockers=new THREE.Mesh(new THREE.BoxGeometry(1.2,2.5,4.8),steelM);
  lockers.position.set(-787.8,1.25,327.4);prisonInterior.add(lockers);
  const bench=new THREE.Mesh(new THREE.BoxGeometry(4.2,.36,1),
    matte({color:0x22282e,roughness:.75}));
  bench.position.set(-807,.45,324.2);prisonInterior.add(bench);

  prisonFx.warning=new THREE.Mesh(new THREE.BoxGeometry(.7,.22,.7),amberM);
  prisonFx.warning.position.set(-800,5.05,330);prisonInterior.add(prisonFx.warning);
  const light=new THREE.PointLight(0xcfe6ff,70,46,1.7);
  light.position.set(-800,4.8,330);prisonInterior.add(light);

  const exitDoor=new THREE.Mesh(new THREE.BoxGeometry(.16,3,2.4),darkM);
  exitDoor.position.set(-815.05,1.5,330);prisonInterior.add(exitDoor);
  const exitBars=new THREE.Group();
  addBars(exitBars,0,1.6,0,2.1,2.6,true);
  exitBars.position.set(-814.82,0,330);exitBars.rotation.y=Math.PI/2;prisonInterior.add(exitBars);
  prisonFx.exitArrow=makeDoorArrow();
  prisonFx.exitArrow.position.set(-813.55,1.7,330);prisonInterior.add(prisonFx.exitArrow);

  const guardShirt=0x2a3f6e,guardPants=0x151b28,orange=0xff7a1a;
  const addGuard=(x:number,z:number,face:number,kind='idle'):void=>{
    const g=makePed(guardShirt,guardPants);g.position.set(x,0,z);g.rotation.y=face;
    prisonInterior.add(g);prisonFx.guards.push({g,t:rand(0,6),sp:rand(.8,1.2),face,kind});
  };
  const addInmate=(x:number,z:number,face:number):void=>{
    const g=makePed(orange,0x303030);g.position.set(x,0,z);g.rotation.y=face;
    prisonInterior.add(g);prisonFx.inmates.push({g,t:rand(0,6),sp:rand(.7,1.1),face});
  };
  // One guard + one inmate — matches the 'County Jail' entries in npcs.json (the
  // fixed 50-NPC cast), so the live jail population equals the data.
  addGuard(-812,329.2,Math.PI/2,'walk');
  addInmate(cellDefs[0].inmateX,337.1,-Math.PI/2);

  // ===== Cell-block wing (escape route): barred cells fill the east half of the
  // room. The FAR cell stands OPEN over a clandestine HOLE dug down to a dirt tunnel
  // (see js/activities/jail-break.ts). Walk east from processing straight into the cells. =====
  const WF=334.3,WB=339.7;                        // wing cell front / back z
  const wp=[-783,-777.3,-771.6,-765.9,-760.2];    // 4 cells between 5 partitions
  for(const x of wp){
    addCellWall(prisonInterior,x,(WF+WB)/2,.26,WB-WF);
    solids.push({x0:x-.13,x1:x+.13,z0:WF,z1:WB,h:3.4});
  }
  for(let i=0;i<wp.length-1;i++){
    const cx=(wp[i]+wp[i+1])/2,w=wp[i+1]-wp[i];
    addCellWall(prisonInterior,cx,WB,w,.26);      // cell back wall
    solids.push({x0:wp[i],x1:wp[i+1],z0:WB-.13,z1:WB+.13,h:3.4});
    if(i<wp.length-2){                            // a normal, locked cell
      addBars(prisonInterior,cx,1.8,WF,w-.4,3.1,true);
      const lock=new THREE.Mesh(new THREE.BoxGeometry(.18,.35,.12),amberM);
      lock.position.set(cx+1.7,1.35,WF-.12);prisonInterior.add(lock);
      const bunk=makeBunk();bunk.position.set(cx,0,337.2);prisonInterior.add(bunk);
      const ts=makeToiletSink();ts.position.set(cx+w/2-.55,0,WB-.6);prisonInterior.add(ts);
    }else{                                        // the OPEN cell with the escape hole
      const gate=new THREE.Group();
      addBars(gate,0,1.8,0,w-.4,3.1,true);
      gate.position.set(wp[i]+.35,0,WF);gate.rotation.y=1.15; // door swung open
      prisonInterior.add(gate);
      const hole=new THREE.Mesh(new THREE.PlaneGeometry(1.6,1.6),
        new THREE.MeshBasicMaterial({color:0x05060a}));
      hole.rotation.x=-Math.PI/2;hole.position.set(cx,.05,337);prisonInterior.add(hole);
      for(const sx of[-.86,.86]){                 // dug-out rim rails
        const r=new THREE.Mesh(new THREE.BoxGeometry(.12,.12,1.9),steelM);
        r.position.set(cx+sx,.07,337);prisonInterior.add(r);
      }
      for(let rr=0;rr<3;rr++){                    // ladder rungs into the dark
        const rung=new THREE.Mesh(new THREE.BoxGeometry(1.1,.06,.06),steelM);
        rung.position.set(cx,-.25-rr*.45,337.7);prisonInterior.add(rung);
      }
      TUNNEL_HOLE.x=cx;TUNNEL_HOLE.z=337;
    }
  }

  // ===== Divider wall: the cell block is now a SEPARATE room reached through a
  // doorway (not one open hall). Two full-height chunks leave a doorway at z~330. ====
  const DV=-785;
  addCellWall(prisonInterior,DV,324.6,.5,9.2,5.6);   // south chunk (z320 .. 329.2)
  addCellWall(prisonInterior,DV,336.6,.5,6.8,5.6);   // north chunk (z333.2 .. 340)
  for(const z of[329.4,333.2]){                       // steel doorway jambs
    const jamb=new THREE.Mesh(new THREE.BoxGeometry(.55,3.4,.22),steelM);
    jamb.position.set(DV,1.7,z);prisonInterior.add(jamb);
  }
  const lintel=new THREE.Mesh(new THREE.BoxGeometry(.55,.7,4.1),steelM);
  lintel.position.set(DV,3.55,331.3);prisonInterior.add(lintel);
  const cbSign=new THREE.Mesh(new THREE.PlaneGeometry(2.6,.66),
    new THREE.MeshBasicMaterial({map:cellBlockSign(),transparent:true}));
  cbSign.position.set(DV-.33,3.0,331.3);cbSign.rotation.y=Math.PI/2;prisonInterior.add(cbSign);
  // detailing: ceiling light strips + wall conduit pipes down the long room
  for(const x of[-806,-794,-772,-764]){
    const strip=new THREE.Mesh(new THREE.BoxGeometry(2.4,.12,.5),
      new THREE.MeshBasicMaterial({color:0xeaf4ff}));
    strip.position.set(x,5.45,330);prisonInterior.add(strip);
  }
  for(const z of[320.7,339.3]){
    const pipe=new THREE.Mesh(new THREE.CylinderGeometry(.07,.07,52,8),steelM);
    pipe.rotation.z=Math.PI/2;pipe.position.set(-788,4.8,z);prisonInterior.add(pipe);
  }

  scene.add(prisonInterior);

  solids.push(
    {x0:DV-.25,x1:DV+.25,z0:319.5,z1:329.5,h:5.6},     // divider wall (south of doorway)
    {x0:DV-.25,x1:DV+.25,z0:333.1,z1:340.5,h:5.6},     // divider wall (north of doorway)
    {x0:-816,x1:-814.9,z0:319.5,z1:340.5,h:6.5},        // west wall
    {x0:-761.1,x1:-760,z0:319.5,z1:340.5,h:6.5},        // east wall (moved east for the wing)
    {x0:-815.5,x1:-760.5,z0:319.4,z1:320.1,h:6.5},      // south wall (extended)
    {x0:-815.5,x1:-760.5,z0:339.9,z1:340.6,h:6.5},      // north wall (extended)
    {x0:-808.85,x1:-808.55,z0:334.05,z1:339.2,h:3.6},
    {x0:-803.55,x1:-803.25,z0:334.05,z1:339.2,h:3.6},
    {x0:-798.25,x1:-797.95,z0:334.05,z1:339.2,h:3.6},
    {x0:-808.7,x1:-803.4,z0:333.95,z1:334.35,h:3.6},
    {x0:-803.4,x1:-798.1,z0:333.95,z1:334.35,h:3.6},
    {x0:-808.7,x1:-803.4,z0:338.9,z1:339.2,h:3.6},
    {x0:-803.4,x1:-798.1,z0:338.9,z1:339.2,h:3.6},
    {x0:-798.8,x1:-793.1,z0:323.7,z1:325.7,h:1.4},
    {x0:-788.5,x1:-787.1,z0:324.8,z1:330.1,h:2.8},
  );
}
