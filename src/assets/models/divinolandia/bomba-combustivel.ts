import * as THREE from 'three';
import {matte} from '../matte.ts';
import {BR,TAURUS,canvasTex,brLogo,taurusBadge} from './posto-kit.ts';

// Fuel pump (bomba de combustível) of Divinolândia's stations, from the Street View frames:
// the modern double-sided electronic dispenser — a plinth, a slim body whose two faces
// carry the brand's panel, the grey head with the two price/volume displays on each face,
// the nozzles in their holsters on the sides with the black hoses looping down.
//  - 'petrobras': white body, green foot, the yellow→green gradient band and the BR mark
//    (Triângulo and Passoni);
//  - 'taurus': white body, the blue panel with the rainbow waves and "Taurus";
//  - 'lurain': white unbranded body under a black head (Posto Lurain's petrol pumps);
//  - 'diesel': Lurain's taller truck diesel dispenser, grey with a black head.
// build() is pure; the faces look along ±z, the hoses hang on ±x. Origin on the island top.
export type PumpKind='petrobras'|'taurus'|'lurain'|'diesel';
const mats=new Map<string,THREE.Material>();
const m=(k:string,f:()=>THREE.Material):THREE.Material=>{let x=mats.get(k);if(!x){x=f();mats.set(k,x);}return x;};
const col=(c:string|number):THREE.Material=>m('c'+c,()=>matte({color:c}));

function panel(kind:PumpKind):THREE.Material{
  return m('p'+kind,()=>matte({map:canvasTex(128,256,(x,w,h)=>{
    x.fillStyle='#f1f2ef';x.fillRect(0,0,w,h);
    if(kind==='petrobras'){
      const g=x.createLinearGradient(0,h*.55,0,h*.8);g.addColorStop(0,BR.yellow);g.addColorStop(1,'#8fbf3a');
      x.fillStyle=g;x.fillRect(w*.08,h*.55,w*.84,h*.25);
      x.fillStyle=BR.green;x.fillRect(0,h*.8,w,h*.2);
      brLogo(x,w*.22,h*.48,w*.18);x.fillStyle=BR.green;x.font='700 15px Arial';x.textAlign='left';x.fillText('PETROBRAS',w*.36,h*.49);
      x.fillStyle='#c9cbc6';for(let i=0;i<3;i++)x.fillRect(w*.12+i*w*.27,h*.2,w*.2,h*.14);   // product labels
    }else if(kind==='taurus'){
      x.fillStyle=TAURUS.blue;x.fillRect(w*.08,h*.32,w*.84,h*.6);
      taurusBadge(x,w*.5,h*.72,w*.5);
      x.fillStyle='#fff';x.font='italic 900 26px Arial';x.textAlign='center';x.fillText('Taurus',w*.5,h*.44);
    }else{
      x.fillStyle='#d9dbd8';x.fillRect(w*.1,h*.25,w*.8,h*.5);
      x.fillStyle='#8e9295';x.fillRect(w*.1,h*.82,w*.8,h*.06);
    }
  })}));
}
function display():THREE.Material{
  return m('disp',()=>matte({emissive:0x0b0d0b,map:canvasTex(128,96,(x,w,h)=>{
    x.fillStyle='#3a3d3e';x.fillRect(0,0,w,h);
    for(const y of[8,38]){x.fillStyle='#9fb3a2';x.fillRect(10,y,w-20,22);x.fillStyle='#283028';x.font='700 18px monospace';x.textAlign='right';x.fillText('0,000',w-14,y+18);}
    x.fillStyle='#2b2b2b';for(let i=0;i<4;i++)x.fillRect(16+i*24,68,18,18);                  // keypad
  })}));
}

function build(o:{kind?:PumpKind}={}):THREE.Group{
  const g=new THREE.Group(),kind=o.kind??'petrobras',diesel=kind==='diesel';
  const H=diesel?2.35:2.05,W=diesel?1.2:1.05,D=.48;
  const body=kind==='diesel'?col('#c7c9c8'):col('#eeefec'),head=kind==='lurain'||diesel?col('#262729'):col('#9a9d9f');
  const plinth=kind==='petrobras'?col(BR.green):kind==='taurus'?col(TAURUS.blue):col('#3a3b3d');
  const box=(mm:THREE.Material|THREE.Material[],w:number,h:number,d:number,x:number,y:number,z:number):THREE.Mesh=>{
    const b=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mm);b.position.set(x,y+h/2,z);b.castShadow=true;g.add(b);return b;};
  box(plinth,W+.06,.14,D+.06,0,0,0);
  // body: the brand panel on both faces (BoxGeometry face order +x,-x,+y,-y,+z,-z)
  const pm=panel(kind);
  box([body,body,body,body,pm,pm],W,H*.62,D,0,.14,0);
  // head with the displays on both faces
  const hy=.14+H*.62,dm=display();
  box([head,head,head,head,dm,dm],W*.92,H*.3,D*.8,0,hy,0);
  box(col('#d8dad7'),W+.04,.06,D+.04,0,hy+H*.3,0);                  // cap
  if(kind==='lurain'||diesel){const t=box(col('#f1f1ef'),W*.5,.18,.04,0,hy+H*.3+.06,0);t.name='brand';}
  // nozzles in their holsters on the two ends, hoses looping down to the floor and back up
  const hose=col('#151515'),noz=col(kind==='diesel'?'#1d1d1d':'#c9c9c4');
  for(const s of[-1,1]){
    box(col('#7b7e80'),.08,.5,.3,s*(W/2+.04),.85,0);
    for(const dz of[-.09,.09]){
      const n=new THREE.Mesh(new THREE.BoxGeometry(.07,.26,.07),noz);n.position.set(s*(W/2+.11),1.05,dz);n.rotation.z=s*.5;g.add(n);
      const curve=new THREE.CatmullRomCurve3([new THREE.Vector3(s*(W/2-.05),hy+.05,dz),new THREE.Vector3(s*(W/2+.25),hy-.2,dz),
        new THREE.Vector3(s*(W/2+.32),.35,dz*1.6),new THREE.Vector3(s*(W/2+.2),.9,dz),new THREE.Vector3(s*(W/2+.12),1.0,dz)]);
      const t=new THREE.Mesh(new THREE.TubeGeometry(curve,10,.022,5),hose);g.add(t);
    }
  }
  return g;
}

export default {category:'Divinolândia',label:'Bomba de combustível',build,variants:[
  {label:'Petrobras',opts:{kind:'petrobras'}},{label:'Taurus',opts:{kind:'taurus'}},
  {label:'Lurain',opts:{kind:'lurain'}},{label:'Diesel (Lurain)',opts:{kind:'diesel'}}]};
