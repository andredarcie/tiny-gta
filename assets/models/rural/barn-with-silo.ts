import * as THREE from 'three';
import {matte} from '../matte.ts';
import {scene} from '@/core/engine.ts';
import {RURAL_GAP} from '@/core/constants.ts';

// build() puro: celeiro + silo num grupo na origem (coords relativas ao centro
// do celeiro). addBarnWithSilo posiciona no mundo e registra a colisao.
function build(): THREE.Group {
  const g=new THREE.Group();
  const barnM=matte({color:0xb03a2e,roughness:.95});
  const barn=new THREE.Mesh(new THREE.BoxGeometry(7,3.4,5),barnM);
  barn.position.set(0,1.68,0);barn.castShadow=true;barn.receiveShadow=true;g.add(barn);
  const broof=new THREE.Mesh(new THREE.ConeGeometry(4.6,2,4),
    matte({color:0x6e5a50,roughness:.9}));
  broof.position.set(0,4.4,0);broof.rotation.y=Math.PI/4;broof.castShadow=true;g.add(broof);
  const trim=new THREE.Mesh(new THREE.BoxGeometry(2.2,2.2,.08),
    matte({color:0xf2ead6,roughness:.9}));
  trim.position.set(0,1.5,2.55);g.add(trim);
  const silo=new THREE.Mesh(new THREE.CylinderGeometry(1.5,1.5,6,10),
    matte({color:0xc9cdd6,roughness:.6}));
  silo.position.set(7,3,2);silo.castShadow=true;g.add(silo);
  const dome=new THREE.Mesh(new THREE.SphereGeometry(1.5,10,6,0,Math.PI*2,0,Math.PI/2),
    matte({color:0x9aa0ad,roughness:.6}));
  dome.position.set(7,6,2);g.add(dome);
  return g;
}

export default {category:'Rural',label:'Barn with silo',build};

export function addBarnWithSilo(solids: {x0:number;x1:number;z0:number;z1:number;h:number}[]): void {
  const g=build();g.position.set(250+RURAL_GAP,0,-34);scene.add(g);
  solids.push({x0:246.2+RURAL_GAP,x1:253.8+RURAL_GAP,z0:-36.8,z1:-31.2,h:5.5});
  solids.push({x0:255.4+RURAL_GAP,x1:258.6+RURAL_GAP,z0:-33.6,z1:-30.4,h:7.5});
}
