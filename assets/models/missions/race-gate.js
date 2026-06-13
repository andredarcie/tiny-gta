import * as THREE from 'three';

// Pórtico de largada/chegada da corrida: dois postes e uma faixa quadriculada
// no alto, atravessando a rua. Sem assets binários — a bandeira xadrez é
// desenhada num <canvas> (padrão do projeto). O carro passa direto por ele
// (não entra em solids[]); serve só de referência visual da linha.
function checkerTexture(){
  const c=document.createElement('canvas');c.width=c.height=64;
  const x=c.getContext('2d');
  const s=16;
  for(let i=0;i<4;i++)for(let j=0;j<4;j++){
    x.fillStyle=(i+j)%2?'#0a0a0a':'#f4f4f4';
    x.fillRect(i*s,j*s,s,s);
  }
  const t=new THREE.CanvasTexture(c);
  t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(6,1);
  t.magFilter=THREE.NearestFilter;
  return t;
}

export function makeRaceGate(color=0xff8a1e){
  const g=new THREE.Group();
  const postMat=new THREE.MeshStandardMaterial({color,roughness:.5,metalness:.1});
  const W=9; // vão do pórtico (mais largo que a rua)
  for(const sx of[-1,1]){
    const post=new THREE.Mesh(new THREE.CylinderGeometry(.3,.34,5.4,10),postMat);
    post.position.set(sx*W/2,2.7,0);g.add(post);
  }
  // faixa xadrez no alto
  const banner=new THREE.Mesh(new THREE.BoxGeometry(W,1.1,.18),
    new THREE.MeshBasicMaterial({map:checkerTexture()}));
  banner.position.set(0,5.0,0);g.add(banner);
  // borda escura da faixa (acabamento)
  const trimMat=new THREE.MeshStandardMaterial({color:0x14161a,roughness:.7});
  for(const dy of[.62,-.62]){
    const trim=new THREE.Mesh(new THREE.BoxGeometry(W+.1,.16,.22),trimMat);
    trim.position.set(0,5.0+dy,0);g.add(trim);
  }
  return g;
}

// Padrão de modelo: descriptor para o model-viewer (descoberta automática).
export default {category:'Missions',label:'Race gate',build:o=>makeRaceGate(o.color??0xff8a1e)};
