import * as THREE from 'three';
import {matte} from '../matte.ts';

const CAMPUS_WIDTH=57;
const CAMPUS_DEPTH=72.2;
const STREET_EDGE=37.2;
const CAMPUS_CENTER_Z=1.1;
const FACADE_Z=21.5;
const FACADE_START=-19;
const FACADE_END=27.5;
const WALL_HEIGHT=3.65;
const RETAINING_HEIGHT=.72;
const MESH_HEIGHT=1.5;
const SCHOOL_BLUE='#4a6b8a';
const LOWER_BLUE='#6f8ba5';

export const EUCLIDES_SITE={x:75.98,z:242.48,yaw:2.98,front:STREET_EDGE,width:CAMPUS_WIDTH,depth:CAMPUS_DEPTH,centerZ:CAMPUS_CENTER_Z} as const;

const materials={
  blue:matte({color:SCHOOL_BLUE}),
  darkBlue:matte({color:'#294761'}),
  lightBlue:matte({color:LOWER_BLUE}),
  coral:matte({color:'#a95b4f'}),
  coping:matte({color:'#af7669'}),
  pale:matte({color:'#e5e1d4'}),
  shadow:matte({color:'#25353a'}),
  blind:matte({color:'#b7c0bc'}),
  metal:matte({color:'#d4d8d4'}),
  roof:matte({color:'#687781',side:THREE.DoubleSide}),
  roofRib:matte({color:'#a6aaa2'}),
  soil:matte({color:'#825a44',side:THREE.DoubleSide}),
  bark:matte({color:'#6a5948'}),
  leavesDark:matte({color:'#365f3c'}),
  leaves:matte({color:'#527947'}),
  leavesLight:matte({color:'#759255'}),
  flowers:matte({color:'#bb6693'}),
  palm:matte({color:'#547743',side:THREE.DoubleSide}),
  yellow:matte({color:'#e0af58'}),
  white:matte({color:'#eee9db'}),
};

type Box={x:number;y:number;z:number;w:number;h:number;d:number;material:THREE.Material};
type GroundAt=(x:number,z:number)=>number;
type SchoolSite={groundAt?:GroundAt};
type Branch={start:THREE.Vector3;end:THREE.Vector3;radius:number};

function addBox(group:THREE.Group,box:Box):THREE.Mesh{
  const mesh=new THREE.Mesh(new THREE.BoxGeometry(box.w,box.h,box.d),box.material);
  mesh.position.set(box.x,box.y,box.z);
  mesh.castShadow=true;mesh.receiveShadow=true;
  group.add(mesh);
  return mesh;
}

function addWindow(group:THREE.Group,centerX:number,width:number):void{
  const faceZ=FACADE_Z+3.05;
  const middleY=2.28;
  addBox(group,{x:centerX,y:middleY,z:faceZ,w:width,h:1.44,d:.09,material:materials.coral});
  addBox(group,{x:centerX,y:middleY,z:faceZ+.06,w:width-.22,h:1.22,d:.06,material:materials.shadow});
  const paneWidth=(width-.3)/3;
  for(let pane=0;pane<3;pane++){
    const x=centerX+(pane-1)*paneWidth;
    if(pane===1&&centerX<3){
      addBox(group,{x,y:middleY,z:faceZ+.1,w:paneWidth-.07,h:1.15,d:.045,material:materials.pale});
      continue;
    }
    for(let row=0;row<7;row++){
      const slat=addBox(group,{x,y:middleY-.49+row*.16,z:faceZ+.11,w:paneWidth-.09,h:.055,d:.07,material:materials.blind});
      slat.rotation.x=-.18;
    }
    addBox(group,{x,y:middleY,z:faceZ+.07,w:.035,h:1.17,d:.06,material:materials.metal});
  }
  for(const x of[centerX-width/2+.12,centerX-width/6,centerX+width/6,centerX+width/2-.12]){
    addBox(group,{x,y:middleY,z:faceZ+.11,w:.075,h:1.3,d:.08,material:materials.metal});
  }
  addBox(group,{x:centerX,y:1.51,z:faceZ+.05,w:width+.14,h:.09,d:.16,material:materials.coral});
}

function addPaintedLetters(group:THREE.Group):void{
  if(typeof document==='undefined')return;
  const canvas=document.createElement('canvas');
  canvas.width=4096;canvas.height=220;
  const ctx=canvas.getContext('2d');if(!ctx)return;
  ctx.fillStyle=LOWER_BLUE;ctx.fillRect(0,0,canvas.width,canvas.height);
  ctx.fillStyle='#e9e9e2';ctx.font='bold 178px Arial, sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';
  ctx.fillText('E.M.E.B. EUCLIDES DA CUNHA',canvas.width/2,canvas.height/2+6);
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
  const mesh=new THREE.Mesh(new THREE.PlaneGeometry(38,1.35),new THREE.MeshLambertMaterial({map:texture,side:THREE.DoubleSide}));
  mesh.position.set(7.15,.82,FACADE_Z+3.2);
  group.add(mesh);
}

function addFrontBuilding(group:THREE.Group):void{
  const center=(FACADE_START+FACADE_END)/2;
  const width=FACADE_END-FACADE_START;
  addBox(group,{x:center,y:WALL_HEIGHT/2,z:FACADE_Z,w:width,h:WALL_HEIGHT,d:6,material:materials.blue});
  addBox(group,{x:center,y:.78,z:FACADE_Z+3.06,w:width+.1,h:1.56,d:.1,material:materials.lightBlue});
  addBox(group,{x:center,y:3.45,z:FACADE_Z+3.06,w:width+.2,h:.4,d:.14,material:materials.darkBlue});
  addBox(group,{x:center,y:.12,z:FACADE_Z+3.06,w:width+.2,h:.24,d:.14,material:materials.lightBlue});
  for(const [x,w] of [[-15.5,6.1],[-7.9,6.2],[-.3,6.2],[7.3,6.2],[14.9,6.2],[22.5,6.2]] as [number,number][])addWindow(group,x,w);
  addPaintedLetters(group);
  addCorrugatedRoof(group,{x:center,z:FACADE_Z-.15,w:width+.7,d:7.1,y:3.89});
}

function addCorrugatedRoof(group:THREE.Group,roof:{x:number;z:number;w:number;d:number;y:number}):void{
  const base=addBox(group,{x:roof.x,y:roof.y,z:roof.z,w:roof.w,h:.09,d:roof.d,material:materials.roof});
  base.rotation.x=-.025;
  for(let x=roof.x-roof.w/2+.15;x<roof.x+roof.w/2;x+=.28){
    addBox(group,{x,y:roof.y+.058,z:roof.z,w:.03,h:.045,d:roof.d,material:materials.roofRib});
  }
  addBox(group,{x:roof.x,y:roof.y-.08,z:roof.z+roof.d/2,w:roof.w+.15,h:.11,d:.13,material:materials.roofRib});
}

function addEntrance(group:THREE.Group):void{
  addBox(group,{x:-23.2,y:1.86,z:20.5,w:8.4,h:3.72,d:7.8,material:materials.white});
  addBox(group,{x:-21,y:1.86,z:24.46,w:2.35,h:3.5,d:.1,material:materials.white});
  addBox(group,{x:-21,y:1.38,z:24.53,w:1.25,h:2.45,d:.06,material:materials.shadow});
  addBox(group,{x:-21,y:1.38,z:24.59,w:.045,h:2.42,d:.06,material:materials.metal});
  addBox(group,{x:-25.3,y:1.95,z:24.48,w:3.45,h:3.45,d:.12,material:materials.yellow});
  addMural(group,-25.3,24.56);
  addCorrugatedRoof(group,{x:-23.2,z:20.6,w:9,d:8.4,y:3.9});

  addBox(group,{x:-27.1,y:2.8,z:27,w:3.2,h:.12,d:13.6,material:materials.darkBlue});
  for(const z of[20.5,27,33.5])addBox(group,{x:-28.35,y:1.46,z,w:.09,h:2.9,d:.09,material:materials.metal});
  addBox(group,{x:-28.35,y:1.45,z:34.2,w:2.7,h:2.9,d:.12,material:materials.metal});
  for(let x=-29.5;x<-27.2;x+=.28)addBox(group,{x,y:1.5,z:34.28,w:.025,h:2.6,d:.04,material:materials.metal});
}

function addMural(group:THREE.Group,x:number,z:number):void{
  if(typeof document==='undefined')return;
  const canvas=document.createElement('canvas');canvas.width=512;canvas.height=512;
  const ctx=canvas.getContext('2d');if(!ctx)return;
  ctx.fillStyle='#dcb05d';ctx.fillRect(0,0,512,512);
  ctx.lineWidth=11;ctx.strokeStyle='#516c72';ctx.beginPath();ctx.arc(256,256,196,0,Math.PI*2);ctx.stroke();
  const colors=['#d17766','#427f89','#7b9349','#f3d483','#b47793'];
  for(let i=0;i<35;i++){
    const angle=i*2.4,r=25+(i%7)*26,px=256+Math.cos(angle)*r,py=256+Math.sin(angle)*r;
    ctx.beginPath();ctx.arc(px,py,8+i%5*3,0,Math.PI*2);ctx.fillStyle=colors[i%colors.length];ctx.fill();
    ctx.strokeStyle='#455e60';ctx.lineWidth=3;ctx.stroke();
  }
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
  const mural=new THREE.Mesh(new THREE.PlaneGeometry(2.95,2.95),new THREE.MeshLambertMaterial({map:texture,side:THREE.DoubleSide}));
  mural.position.set(x,2.05,z);group.add(mural);
}

function addRearBuildings(group:THREE.Group):void{
  addBox(group,{x:9,y:1.75,z:1,w:13,h:3.5,d:33,material:materials.white});
  addBox(group,{x:-8,y:1.75,z:-14,w:28,h:3.5,d:10,material:materials.white});
  addBox(group,{x:12,y:1.75,z:-26,w:24,h:3.5,d:9,material:materials.white});
  addCorrugatedRoof(group,{x:9,z:1,w:13.8,d:34,y:3.75});
  addCorrugatedRoof(group,{x:-8,z:-14,w:28.8,d:10.8,y:3.75});
  addCorrugatedRoof(group,{x:12,z:-26,w:24.8,d:9.8,y:3.75});
}

function addFacadeFoundations(group:THREE.Group,groundAt:GroundAt):void{
  for(let x=FACADE_START;x<FACADE_END;x+=2.5){
    const width=Math.min(2.5,FACADE_END-x);
    const ground=Math.min(groundAt(x,FACADE_Z+8),groundAt(x+width,FACADE_Z+8));
    if(ground<-.05)addBox(group,{x:x+width/2,y:ground/2,z:FACADE_Z+8,w:width+.03,h:-ground+.12,d:.2,material:materials.blue});
  }
  for(let x=-27.4;x<-19;x+=2){
    const width=Math.min(2,-19-x);
    const ground=Math.min(groundAt(x,29.5),groundAt(x+width,29.5));
    if(ground<-.05)addBox(group,{x:x+width/2,y:ground/2,z:29.5,w:width+.02,h:-ground+.12,d:.22,material:materials.white});
  }
}

function addGardenBank(group:THREE.Group,groundAt:GroundAt):void{
  const vertices:number[]=[],uvs:number[]=[];
  for(let x=-28;x<28;x+=2){
    const a=[x,groundAt(x,STREET_EDGE)+.08,STREET_EDGE];
    const b=[x+2,groundAt(x+2,STREET_EDGE)+.08,STREET_EDGE];
    const c=[x,groundAt(x,30)+.08,30];
    const d=[x+2,groundAt(x+2,30)+.08,30];
    vertices.push(...a,...c,...b,...b,...c,...d);
    const u=(x+28)/2;
    uvs.push(u,0,u,6,u+1,0,u+1,0,u,6,u+1,6);
  }
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
  geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));
  geometry.computeVertexNormals();
  const bank=new THREE.Mesh(geometry,makeGardenMaterial());bank.receiveShadow=true;group.add(bank);
}

function makeGardenMaterial():THREE.Material{
  if(typeof document==='undefined')return materials.soil;
  const canvas=document.createElement('canvas');canvas.width=128;canvas.height=128;
  const ctx=canvas.getContext('2d');if(!ctx)return materials.soil;
  ctx.fillStyle='#795741';ctx.fillRect(0,0,128,128);
  for(let i=0;i<950;i++){
    const x=(i*67.7)%128,y=(i*39.13)%128;
    ctx.fillStyle=i%5===0?'#72845b':i%3===0?'#92674b':'#675940';
    ctx.fillRect(x,y,1+i%4,1+i%3);
  }
  const texture=new THREE.CanvasTexture(canvas);
  texture.wrapS=THREE.RepeatWrapping;texture.wrapT=THREE.RepeatWrapping;
  texture.colorSpace=THREE.SRGBColorSpace;
  return new THREE.MeshLambertMaterial({map:texture,side:THREE.DoubleSide});
}

function addFence(group:THREE.Group,groundAt:GroundAt):void{
  const meshCanvas=typeof document==='undefined'?null:document.createElement('canvas');
  let meshMaterial:THREE.Material=materials.metal;
  if(meshCanvas){
    meshCanvas.width=64;meshCanvas.height=64;
    const ctx=meshCanvas.getContext('2d');
    if(ctx){
      ctx.clearRect(0,0,64,64);ctx.strokeStyle='rgba(138,151,147,.55)';ctx.lineWidth=2;
      for(let x=-64;x<=64;x+=32){
        ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x+64,64);ctx.stroke();
        ctx.beginPath();ctx.moveTo(x,64);ctx.lineTo(x+64,0);ctx.stroke();
      }
      const texture=new THREE.CanvasTexture(meshCanvas);texture.wrapS=THREE.RepeatWrapping;texture.wrapT=THREE.RepeatWrapping;
      texture.repeat.set(18,7);texture.colorSpace=THREE.SRGBColorSpace;
      meshMaterial=new THREE.MeshBasicMaterial({map:texture,transparent:true,side:THREE.DoubleSide,depthWrite:false,alphaTest:.12});
    }
  }
  for(let x=-28.5;x<28.5;x+=3){
    const y0=groundAt(x,STREET_EDGE),y1=groundAt(x+3,STREET_EDGE);
    const mid=(y0+y1)/2;
    addBox(group,{x:x+1.5,y:mid+.24,z:STREET_EDGE,w:3.01,h:1.04,d:.22,material:materials.lightBlue});
    addBox(group,{x:x+1.5,y:mid+RETAINING_HEIGHT+.015,z:STREET_EDGE,w:3.02,h:.12,d:.34,material:materials.coping});
    const mesh=new THREE.Mesh(new THREE.PlaneGeometry(3,MESH_HEIGHT),meshMaterial);
    mesh.position.set(x+1.5,mid+RETAINING_HEIGHT+MESH_HEIGHT/2,STREET_EDGE);
    group.add(mesh);
    addBox(group,{x,y:y0+RETAINING_HEIGHT+MESH_HEIGHT/2,z:STREET_EDGE,w:.065,h:MESH_HEIGHT,d:.065,material:materials.metal});
    const lean=addBox(group,{x,y:y0+RETAINING_HEIGHT+MESH_HEIGHT+.13,z:STREET_EDGE-.18,w:.065,h:.48,d:.065,material:materials.metal});
    lean.rotation.x=-.7;
  }
  for(const side of[-28.5,28.5])addBox(group,{x:side,y:groundAt(side,STREET_EDGE)+RETAINING_HEIGHT+MESH_HEIGHT/2,z:STREET_EDGE,w:.085,h:MESH_HEIGHT,d:.085,material:materials.metal});
}

function addBranch(group:THREE.Group,branch:Branch):void{
  const length=branch.start.distanceTo(branch.end);
  const direction=branch.end.clone().sub(branch.start).normalize();
  const mesh=new THREE.Mesh(new THREE.CylinderGeometry(branch.radius*.55,branch.radius,length,7),materials.bark);
  mesh.position.copy(branch.start).add(branch.end).multiplyScalar(.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),direction);
  mesh.castShadow=true;group.add(mesh);
}

function addCanopyTree(group:THREE.Group,groundAt:GroundAt,position:{x:number;z:number;scale:number}):void{
  const base=groundAt(position.x,position.z);
  const s=position.scale;
  const trunk=new THREE.Vector3(position.x,base+.1,position.z);
  const fork=new THREE.Vector3(position.x+.18*s,base+4.5*s,position.z);
  addBranch(group,{start:trunk,end:fork,radius:.48*s});
  const leaves=[materials.leavesDark,materials.leaves,materials.leavesLight];
  for(let i=0;i<30;i++){
    const angle=i*2.399,rad=(2.1+(i%6)*.53)*s;
    const end=new THREE.Vector3(position.x+Math.cos(angle)*rad,base+(5.8+(i%7)*.4)*s,position.z+Math.sin(angle)*rad*.82);
    if(i<14)addBranch(group,{start:fork,end,radius:.12*s});
    const clump=new THREE.Mesh(new THREE.IcosahedronGeometry((1.05+(i%4)*.2)*s,2),leaves[i%leaves.length]);
    clump.position.copy(end);clump.scale.y=.82;clump.castShadow=true;group.add(clump);
  }
}

function addFloweringShrub(group:THREE.Group,groundAt:GroundAt,x:number,z:number):void{
  const base=groundAt(x,z);
  for(let i=0;i<9;i++){
    const angle=i*2.4,r=1.1+(i%3)*.4;
    const clump=new THREE.Mesh(new THREE.IcosahedronGeometry(r,1),i%4===0?materials.flowers:materials.leavesDark);
    clump.position.set(x+Math.cos(angle)*r*.7,base+1.8+(i%3)*.4,z+Math.sin(angle)*r*.5);
    clump.castShadow=true;group.add(clump);
  }
}

function addPalm(group:THREE.Group,groundAt:GroundAt,x:number,z:number):void{
  const base=groundAt(x,z);
  addBranch(group,{start:new THREE.Vector3(x,base,z),end:new THREE.Vector3(x+.25,base+7.5,z),radius:.18});
  for(let i=0;i<10;i++){
    const angle=i*Math.PI*2/10;
    const direction=new THREE.Vector3(Math.cos(angle),0,Math.sin(angle));
    const side=new THREE.Vector3(-direction.z,0,direction.x);
    const origin=new THREE.Vector3(x+.25,base+7.5,z);
    const tip=origin.clone().addScaledVector(direction,3.2).add(new THREE.Vector3(0,-1.8,0));
    const mid=origin.clone().addScaledVector(direction,1.8).add(new THREE.Vector3(0,.25,0));
    const curve=new THREE.QuadraticBezierCurve3(origin,mid,tip);
    const stem=new THREE.Mesh(new THREE.TubeGeometry(curve,10,.025,4,false),materials.palm);
    group.add(stem);
    for(let leaf=1;leaf<=8;leaf++){
      const t=leaf/9;
      const root=curve.getPoint(t);
      const reach=(.8-Math.abs(t-.43))*1.1;
      for(const sign of[-1,1]){
        const end=root.clone().addScaledVector(side,reach*sign).add(new THREE.Vector3(0,-.5,0));
        const vertices=new Float32Array([
          root.x,root.y,root.z,
          end.x,end.y,end.z,
          root.x+direction.x*.22,root.y-.07,root.z+direction.z*.22,
        ]);
        const geometry=new THREE.BufferGeometry();
        geometry.setAttribute('position',new THREE.BufferAttribute(vertices,3));
        geometry.setAttribute('uv',new THREE.Float32BufferAttribute([0,0,1,0,0,1],2));
        geometry.computeVertexNormals();
        group.add(new THREE.Mesh(geometry,materials.palm));
      }
    }
  }
}

function addPlanting(group:THREE.Group,groundAt:GroundAt):void{
  addCanopyTree(group,groundAt,{x:-9,z:33,scale:1.05});
  addCanopyTree(group,groundAt,{x:16,z:32.5,scale:.95});
  addFloweringShrub(group,groundAt,23,32);
  for(const x of[-25,-22,-19]){
    const shrub=new THREE.Mesh(new THREE.IcosahedronGeometry(.65,1),materials.leavesDark);
    shrub.position.set(x,groundAt(x,32)+.7,32);shrub.castShadow=true;group.add(shrub);
  }
  addPalm(group,groundAt,-25,32);
}

export function buildEuclidesSchool(site:SchoolSite={}):THREE.Group{
  const group=new THREE.Group();
  const groundAt=site.groundAt??(()=>0);
  addRearBuildings(group);
  const streetFacade=new THREE.Group();
  addFrontBuilding(streetFacade);
  addEntrance(streetFacade);
  streetFacade.position.z=5;group.add(streetFacade);
  addFacadeFoundations(group,groundAt);
  addGardenBank(group,groundAt);
  addFence(group,groundAt);
  addPlanting(group,groundAt);
  group.userData={name:'EMEB Euclides da Cunha',width:CAMPUS_WIDTH,depth:CAMPUS_DEPTH,height:10};
  return group;
}

export default {category:'Divinolândia',label:'EMEB Euclides da Cunha',build:buildEuclidesSchool};
