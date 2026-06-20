import * as THREE from 'three';

// Linha de CHEGADA da corrida de rua: diferente do pórtico de largada. Dois
// postes segurando uma fita xadrez na altura do carro, uma faixa "FINISH" no
// alto e um pequeno público esperando nas laterais — um deles agita uma
// bandeira quadriculada. Sem assets binários (xadrez desenhado em <canvas>).
// O grupo é orientado em race.js pra encarar quem chega (rotation.y).

function checkerTexture(repeat=6): THREE.CanvasTexture{
  const c=document.createElement('canvas');c.width=c.height=64;
  const x=c.getContext('2d')!,s=16;
  for(let i=0;i<4;i++)for(let j=0;j<4;j++){
    x.fillStyle=(i+j)%2?'#0a0a0a':'#f4f4f4';
    x.fillRect(i*s,j*s,s,s);
  }
  const t=new THREE.CanvasTexture(c);
  t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(repeat,1);
  t.magFilter=THREE.NearestFilter;
  return t;
}

// figura simples de torcedor (corpo + cabeça + pernas); braço opcional erguido
function makeFan(shirt: number,armUp=false): THREE.Group{
  const g=new THREE.Group();
  const skin=0xe0a878;
  const body=new THREE.Mesh(new THREE.BoxGeometry(.5,.7,.3),
    new THREE.MeshStandardMaterial({color:shirt,roughness:.8}));
  body.position.y=1.0;g.add(body);
  const head=new THREE.Mesh(new THREE.SphereGeometry(.22,10,8),
    new THREE.MeshStandardMaterial({color:skin,roughness:.7}));
  head.position.y=1.52;g.add(head);
  const legMat=new THREE.MeshStandardMaterial({color:0x2a2f3a,roughness:.85});
  for(const sx of[-.13,.13]){
    const leg=new THREE.Mesh(new THREE.BoxGeometry(.16,.62,.22),legMat);
    leg.position.set(sx,.5,0);g.add(leg);
  }
  const armMat=new THREE.MeshStandardMaterial({color:shirt,roughness:.8});
  for(const sx of[-1,1]){
    const arm=new THREE.Mesh(new THREE.BoxGeometry(.13,.6,.16),armMat);
    if(armUp&&sx>0){arm.position.set(sx*.31,1.32,0);arm.rotation.z=-.5;}
    else arm.position.set(sx*.31,1.0,0);
    g.add(arm);
  }
  return g;
}

export function makeRaceFinish(): THREE.Group{
  const g=new THREE.Group();
  const W=9;
  const poleMat=new THREE.MeshStandardMaterial({color:0x33363d,roughness:.5,metalness:.2});
  for(const sx of[-1,1]){
    const pole=new THREE.Mesh(new THREE.CylinderGeometry(.26,.3,4.6,10),poleMat);
    pole.position.set(sx*W/2,2.3,0);g.add(pole);
  }
  // fita xadrez na altura do carro ("rompe a fita")
  const tape=new THREE.Mesh(new THREE.BoxGeometry(W,.5,.08),
    new THREE.MeshBasicMaterial({map:checkerTexture(8)}));
  tape.position.set(0,1.3,0);g.add(tape);
  // faixa FINISH no alto
  const banner=new THREE.Mesh(new THREE.BoxGeometry(W,1.0,.16),
    new THREE.MeshStandardMaterial({color:0x14161a,roughness:.7}));
  banner.position.set(0,4.3,0);g.add(banner);
  {
    const c=document.createElement('canvas');c.width=256;c.height=64;
    const x=c.getContext('2d')!;
    x.fillStyle='#14161a';x.fillRect(0,0,256,64);
    x.fillStyle='#ffce5a';x.font='bold 44px monospace';x.textAlign='center';x.textBaseline='middle';
    x.fillText('FINISH',128,36);
    const label=new THREE.Mesh(new THREE.PlaneGeometry(W*.9,.9),
      new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(c),transparent:true,side:THREE.DoubleSide}));
    label.position.set(0,4.3,.1);g.add(label);
  }
  // público esperando nas duas calçadas, virado pra quem chega (-z local)
  const shirts=[0xff2e88,0x19e3ff,0x9dff2e,0xffd24a,0xff7a1a,0x35d435];
  let si=0;
  for(const baseX of[-1,1]){
    for(let k=0;k<3;k++){
      const fan=makeFan(shirts[si++%shirts.length],baseX>0&&k===0);
      fan.position.set(baseX*(W/2+1.1+k*.9),0,-1.6+k*.5);
      fan.rotation.y=Math.PI; // encara o carro que chega
      g.add(fan);
    }
  }
  // bandeira quadriculada erguida por um dos torcedores
  {
    const stick=new THREE.Mesh(new THREE.CylinderGeometry(.05,.05,1.6,6),
      new THREE.MeshStandardMaterial({color:0x6a4a2a}));
    stick.position.set(W/2+1.1,1.9,-1.6);g.add(stick);
    const flag=new THREE.Mesh(new THREE.PlaneGeometry(1.1,.7),
      new THREE.MeshBasicMaterial({map:checkerTexture(4),side:THREE.DoubleSide}));
    flag.position.set(W/2+1.7,2.45,-1.6);g.add(flag);
    g.userData.flag=flag; // race.js pode animar o tremular
  }
  return g;
}

// Padrão de modelo: descriptor para o model-viewer (descoberta automática).
export default {category:'Missions',label:'Race finish line',build:()=>makeRaceFinish()};
