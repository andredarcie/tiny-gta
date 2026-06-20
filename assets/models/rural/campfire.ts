import * as THREE from 'three';
import {matte} from '../matte.ts';

// Fogueira de acampamento: anel de pedras, lenha em fogueira (teepee + toras
// caídas), labaredas e um tripé com panela "vivendo da natureza". As labaredas
// ficam em userData.flames pra js/story/rick.ts fazer tremular (e uma luz quente).

const stoneM=matte({color:0x8d8f93,roughness:1});
const logM=matte({color:0x5a3b22,roughness:1});
const charM=matte({color:0x241a14,roughness:1});
const stickM=matte({color:0x6b4a2e,roughness:1});
const potM=matte({color:0x2a2a2e,roughness:.7});

// cilindro de `from` a `to` (usado pras pernas do tripé e toras inclinadas)
function strut(from: THREE.Vector3,to: THREE.Vector3,r: number,mat: THREE.Material): THREE.Mesh {
  const dir=new THREE.Vector3().subVectors(to,from);
  const len=Math.max(.01,dir.length());
  const m=new THREE.Mesh(new THREE.CylinderGeometry(r,r,len,7),mat);
  m.position.copy(from).addScaledVector(dir,.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),dir.normalize());
  m.castShadow=true;
  return m;
}

function build(): THREE.Group {
  const g=new THREE.Group();
  const ringR=.82;
  // anel de pedras
  for(let i=0;i<10;i++){
    const a=i/10*Math.PI*2;
    const s=new THREE.Mesh(new THREE.DodecahedronGeometry(.15+Math.random()*.07),stoneM);
    s.position.set(Math.cos(a)*ringR,.09,Math.sin(a)*ringR);
    s.rotation.set(Math.random()*3,Math.random()*3,Math.random()*3);
    s.castShadow=true;g.add(s);
  }
  // base de cinzas/brasa carbonizada
  const base=new THREE.Mesh(new THREE.CylinderGeometry(ringR-.12,ringR,.08,16),charM);
  base.position.y=.04;g.add(base);
  // toras caídas cruzadas + teepee inclinado
  for(let i=0;i<3;i++){
    const a=i/3*Math.PI;
    g.add(strut(new THREE.Vector3(Math.cos(a)*.55,.12,Math.sin(a)*.55),
      new THREE.Vector3(-Math.cos(a)*.55,.12,-Math.sin(a)*.55),.07,logM));
  }
  for(let i=0;i<4;i++){
    const a=i/4*Math.PI*2+.4;
    g.add(strut(new THREE.Vector3(Math.cos(a)*.5,0,Math.sin(a)*.5),
      new THREE.Vector3(0,.7,0),.06,logM));
  }
  // labaredas: cones translúcidos sobrepostos (laranja→amarelo)
  const flames: THREE.Mesh[]=[];
  for(const[c,r,h,y,o]of[
    [0xff4f1e,.34,1.05,.55,.82],[0xff9a2e,.23,.82,.6,.85],[0xffe06a,.13,.58,.66,.92]
  ]){
    const m=new THREE.Mesh(new THREE.ConeGeometry(r,h,9),
      new THREE.MeshBasicMaterial({color:c,transparent:true,opacity:o,depthWrite:false}));
    m.position.y=y;g.add(m);flames.push(m);
  }
  g.userData.flames=flames;
  // poça de luz quente no chão (truque dos postes: glow aditivo, sem luz real —
  // js/story/rick.ts pulsa a opacidade). Mantém o custo de render baixo.
  const glow=new THREE.Mesh(new THREE.CircleGeometry(2.1,20),
    new THREE.MeshBasicMaterial({color:0xff7a2e,transparent:true,opacity:.2,
      blending:THREE.AdditiveBlending,depthWrite:false}));
  glow.rotation.x=-Math.PI/2;glow.position.y=.05;g.add(glow);
  g.userData.glow=glow;
  // tripé de varas com panela pendurada sobre o fogo
  const apex=new THREE.Vector3(0,1.55,0);
  for(let i=0;i<3;i++){
    const a=i/3*Math.PI*2;
    g.add(strut(new THREE.Vector3(Math.cos(a)*.62,0,Math.sin(a)*.62),apex,.028,stickM));
  }
  const pot=new THREE.Mesh(new THREE.CylinderGeometry(.21,.17,.26,12),potM);
  pot.position.y=.95;pot.castShadow=true;g.add(pot);
  const rim=new THREE.Mesh(new THREE.TorusGeometry(.21,.02,6,12),potM);
  rim.rotation.x=Math.PI/2;rim.position.y=1.08;g.add(rim);
  const handle=new THREE.Mesh(new THREE.TorusGeometry(.18,.014,6,12,Math.PI),potM);
  handle.position.y=1.1;g.add(handle);
  g.add(strut(new THREE.Vector3(0,1.1,0),apex,.01,potM)); // gancho/corrente
  return g;
}

// Padrão de modelo: descriptor pro model-viewer (descoberta automática).
export default {category:'Rural',label:'Campfire',build};
