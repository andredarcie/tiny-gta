import * as THREE from 'three';

// Blaze: incêndio encorpado de prédio/veículo — bem mais que a poça do molotov
// (effects/fire.js). Base carbonizada + brasas brilhando + um anel de línguas de
// chama de alturas variadas + núcleo quente claro no meio. flames[] é tremido
// pelo js/firefighter.js (escala/opacidade/balanço). build() é PURO (devolve um
// Object3D novo, sem scene.add), seguindo o padrão de UM modelo por arquivo.

function makeBlaze(): THREE.Group{
  const g=new THREE.Group();
  const flames: THREE.Mesh[]=[];

  // base carbonizada: disco escuro no chão (a mancha de queimado)
  const char=new THREE.Mesh(new THREE.CircleGeometry(1.9,18),
    new THREE.MeshBasicMaterial({color:0x1d0d08,transparent:true,opacity:.92,depthWrite:false}));
  char.rotation.x=-Math.PI/2;char.position.y=.02;char.renderOrder=1;g.add(char);

  // brasas: disco laranja emissivo logo acima da base (pulsa via flames[])
  const embers=new THREE.Mesh(new THREE.CircleGeometry(1.35,18),
    new THREE.MeshBasicMaterial({color:0xff5a1e,transparent:true,opacity:.55,depthWrite:false}));
  embers.rotation.x=-Math.PI/2;embers.position.y=.06;embers.renderOrder=2;g.add(embers);flames.push(embers);

  // línguas de chama: anel externo + algumas centrais mais altas
  const specs: [number, number, number, number][]=[];
  const ring=8;
  for(let i=0;i<ring;i++){
    const a=i/ring*Math.PI*2,r=.7+Math.random()*.4;
    specs.push([Math.cos(a)*r,Math.sin(a)*r,1.0+Math.random()*.9,i%2?0xff8a1e:0xffb33a]);
  }
  for(let i=0;i<4;i++)
    specs.push([(Math.random()-.5)*.9,(Math.random()-.5)*.9,1.7+Math.random()*1.1,i%2?0xffc24a:0xff7a1e]);
  for(const[x,z,h,col]of specs){
    const f=new THREE.Mesh(new THREE.ConeGeometry(.36,h,7),
      new THREE.MeshBasicMaterial({color:col,transparent:true,opacity:.85,depthWrite:false}));
    f.position.set(x,h/2,z);f.userData.baseH=h;f.renderOrder=3;g.add(f);flames.push(f);
  }

  // núcleo quente claro no centro (a parte mais brilhante do fogo)
  const core=new THREE.Mesh(new THREE.ConeGeometry(.52,2.5,9),
    new THREE.MeshBasicMaterial({color:0xfff0a0,transparent:true,opacity:.9,depthWrite:false}));
  core.position.y=1.25;core.userData.baseH=2.5;core.renderOrder=4;g.add(core);flames.push(core);

  g.userData.flames=flames;
  g.userData.embers=embers;
  return g;
}

export function makeBlazeModel(): THREE.Group{return makeBlaze();}
export default {category:'Effects',label:'Blaze',build:makeBlaze};
