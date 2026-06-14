import * as THREE from 'three';

// Poça de fogo: várias línguas de chama de tamanhos diferentes, usada pelo
// molotov (incêndio que fica queimando no chão) e pela carga do detonador.
// As chamas tremem no update do weapons.js (escala/opacidade de userData.flames).

export function makeFireModel(){
  const g=new THREE.Group();
  const flames=[];
  const n=7;
  for(let i=0;i<n;i++){
    const a=(i/n)*Math.PI*2;
    const r=Math.random()*.6;
    const h=.5+Math.random()*.7;
    const col=i%2?0xff8a1e:0xffc24a;
    const f=new THREE.Mesh(new THREE.ConeGeometry(.28,h,7),
      new THREE.MeshBasicMaterial({color:col,transparent:true,opacity:.85}));
    f.position.set(Math.cos(a)*r,h/2,Math.sin(a)*r);
    g.add(f);flames.push(f);
  }
  // núcleo claro no centro
  const core=new THREE.Mesh(new THREE.ConeGeometry(.34,1.1,8),
    new THREE.MeshBasicMaterial({color:0xfff0a0,transparent:true,opacity:.9}));
  core.position.y=.55;g.add(core);flames.push(core);
  // brasas/fumaça base
  const smoke=new THREE.Mesh(new THREE.SphereGeometry(.9,10,8),
    new THREE.MeshBasicMaterial({color:0x201018,transparent:true,opacity:.22}));
  smoke.position.y=.6;g.add(smoke);
  g.userData.flames=flames;
  return g;
}

export default {category:'Effects',label:'Fire',build:()=>makeFireModel()};
