import * as THREE from 'three';
import {matte} from '../matte.ts';
import {bakeProp} from '../props/prop-merge.ts';

// Coreto (bandstand) octogonal da praça — como o da Praça da Matriz de Divinolândia
// (ver reference/divinolandia-praca/praca_natal_01.jpg): plataforma elevada com
// alguns degraus, guarda-corpo branco, colunas brancas e um telhado piramidal
// octogonal de telha (terracota). Lados abertos; entrada (vão + escada) virada
// para +z. build() é puro (coreto na origem); addCoreto posiciona, faz bake e
// devolve a colisão (mesmo padrão de church/farm-house).
const baseM=matte({color:0xc9c2b4,roughness:1});    // concreto da plataforma
const floorM=matte({color:0xddd6c8,roughness:.9});  // piso de cima
const colM=matte({color:0xf2efe8,roughness:.85});   // colunas brancas
const railM=matte({color:0xeae6dd,roughness:.85});  // guarda-corpo branco
const roofM=matte({color:0xb9532b,roughness:.9});   // telha (terracota)
const finialM=matte({color:0xcfc6b6,roughness:.7});

const R=2.45;          // raio das colunas (vértices do octógono)
const FLOOR_Y=0.58;    // topo da plataforma
const COL_H=2.55;      // altura das colunas
const ENTRY=2;         // índice da face da ENTRADA (voltada p/ +z) — sem guarda-corpo, com escada

function build(): THREE.Group {
  const g=new THREE.Group();
  // plataforma octogonal (prisma de 8 lados) levemente tronco-cônica + piso
  const base=new THREE.Mesh(new THREE.CylinderGeometry(R+.35,R+.55,FLOOR_Y,8),baseM);
  base.position.y=FLOOR_Y/2;base.rotation.y=Math.PI/8;base.castShadow=true;base.receiveShadow=true;g.add(base);
  const floor=new THREE.Mesh(new THREE.CylinderGeometry(R+.2,R+.2,.08,8),floorM);
  floor.position.y=FLOOR_Y+.04;floor.rotation.y=Math.PI/8;g.add(floor);
  // 8 colunas brancas nos vértices do octógono
  for(let k=0;k<8;k++){
    const a=Math.PI/8+k*Math.PI/4;
    const col=new THREE.Mesh(new THREE.CylinderGeometry(.12,.13,COL_H,10),colM);
    col.position.set(Math.cos(a)*R,FLOOR_Y+COL_H/2,Math.sin(a)*R);col.castShadow=true;g.add(col);
  }
  // guarda-corpo branco nas faces (menos a da entrada): mureta + corrimão + balaústres
  for(let k=0;k<8;k++){
    if(k===ENTRY)continue;
    const a=k*Math.PI/4;                       // centro da face
    const cx=Math.cos(a)*(R-.05),cz=Math.sin(a)*(R-.05),len=R*0.82;
    const low=new THREE.Mesh(new THREE.BoxGeometry(len,.5,.12),railM);
    low.position.set(cx,FLOOR_Y+.28,cz);low.rotation.y=-a;g.add(low);
    const top=new THREE.Mesh(new THREE.BoxGeometry(len,.1,.18),railM);
    top.position.set(cx,FLOOR_Y+.92,cz);top.rotation.y=-a;g.add(top);
    for(const t of[-.3,0,.3]){ // balaústres distribuídos ao longo da face
      const bal=new THREE.Mesh(new THREE.CylinderGeometry(.05,.05,.5,8),railM);
      const tx=Math.cos(a-Math.PI/2)*t*len, tz=Math.sin(a-Math.PI/2)*t*len;
      bal.position.set(cx+tx,FLOOR_Y+.62,cz+tz);g.add(bal);
    }
  }
  // escada de acesso na entrada (+z)
  for(let s=0;s<2;s++){
    const step=new THREE.Mesh(new THREE.BoxGeometry(1.7,.22,.5),baseM);
    step.position.set(0,.11+s*.22,R+.55-s*.34);
    g.add(step);
  }
  // telhado piramidal octogonal (telha) + beiral + pináculo
  const eaveY=FLOOR_Y+COL_H;
  const eave=new THREE.Mesh(new THREE.CylinderGeometry(R+.55,R+.55,.16,8),roofM);
  eave.position.y=eaveY+.02;eave.rotation.y=Math.PI/8;g.add(eave);
  const roof=new THREE.Mesh(new THREE.ConeGeometry(R+.75,1.9,8),roofM);
  roof.position.y=eaveY+.1+1.9/2;roof.rotation.y=Math.PI/8;roof.castShadow=true;g.add(roof);
  const finial=new THREE.Mesh(new THREE.SphereGeometry(.16,10,8),finialM);
  finial.position.y=eaveY+.1+1.9+.1;g.add(finial);
  const spike=new THREE.Mesh(new THREE.CylinderGeometry(.03,.03,.5,6),finialM);
  spike.position.y=eaveY+.1+1.9+.35;g.add(spike);

  g.userData.r=R+.8;g.userData.h=eaveY+2.2;
  return g;
}

export default {category:'Rural',label:'Coreto (bandstand)',build};

export function addCoreto(cx: number,cz: number): {x0:number;x1:number;z0:number;z1:number;h:number} {
  const g=build();g.position.set(cx,-.02,cz);bakeProp(g);
  return{x0:cx-(R+.5),x1:cx+(R+.5),z0:cz-(R+.5),z1:cz+(R+.5),h:g.userData.h};
}
