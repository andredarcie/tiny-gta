import * as THREE from 'three';

// Pórtico FLUTUANTE da corrida de lanchas: dois flutuadores (pontoons) com
// mastros segurando uma faixa quadriculada no alto, atravessando um vão largo o
// bastante pra lancha passar. O equivalente aquático do race-gate/race-finish da
// corrida de rua. A lancha passa direto por ele (não entra em solids[]); serve só
// de referência visual da linha. Sem assets binários — o xadrez é desenhado num
// <canvas> (padrão do projeto).
//
// Origem em y=0 = linha d'água: os flutuadores ficam meio submersos. O gameplay
// posiciona o grupo em y≈SEA_Y (superfície do mar). `finish:true` troca a faixa
// de largada pela linha de CHEGADA (rótulo FINISH + fita pra romper + bandeira).

function checkerTexture(repeat=6){
  const c=document.createElement('canvas');c.width=c.height=64;
  const x=c.getContext('2d'),s=16;
  for(let i=0;i<4;i++)for(let j=0;j<4;j++){
    x.fillStyle=(i+j)%2?'#0a0a0a':'#f4f4f4';
    x.fillRect(i*s,j*s,s,s);
  }
  const t=new THREE.CanvasTexture(c);
  t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(repeat,1);
  t.magFilter=THREE.NearestFilter;
  return t;
}

function buildGate({color=0xff8a1e,finish=false}={}){
  const g=new THREE.Group();
  const W=13; // vão do pórtico (lancha é larga e rápida)
  const paint=new THREE.MeshStandardMaterial({color,roughness:.45,metalness:.2});
  const darkM=new THREE.MeshStandardMaterial({color:0x14181e,roughness:.6,metalness:.3});
  const chromeM=new THREE.MeshStandardMaterial({color:0xd9dde4,roughness:.2,metalness:.9});

  // ---- flutuadores laterais + mastros + luzes de navegação ----
  for(const sx of[-1,1]){
    const pon=new THREE.Mesh(new THREE.CylinderGeometry(.5,.5,3.2,12),paint);
    pon.rotation.x=Math.PI/2; // eixo ao longo de Z
    pon.position.set(sx*W/2,0,0);pon.castShadow=true;g.add(pon);
    for(const sz of[-1,1]){ // tampas cônicas (proa/popa do flutuador)
      const tip=new THREE.Mesh(new THREE.ConeGeometry(.5,.7,12),paint);
      tip.rotation.x=sz>0?Math.PI/2:-Math.PI/2;
      tip.position.set(sx*W/2,0,sz*1.95);g.add(tip);
    }
    const mast=new THREE.Mesh(new THREE.CylinderGeometry(.22,.26,5.2,10),
      finish?darkM:paint);
    mast.position.set(sx*W/2,2.7,0);g.add(mast);
    const nav=new THREE.Mesh(new THREE.SphereGeometry(.12,8,6),
      new THREE.MeshBasicMaterial({color:sx<0?0xd11f1f:0x2bd14a})); // bombordo/boreste
    nav.position.set(sx*W/2,5.4,0);g.add(nav);
  }

  if(finish){
    // faixa escura + rótulo FINISH no alto
    const banner=new THREE.Mesh(new THREE.BoxGeometry(W,1.0,.16),
      new THREE.MeshStandardMaterial({color:0x14161a,roughness:.7}));
    banner.position.set(0,4.6,0);g.add(banner);
    {
      const c=document.createElement('canvas');c.width=256;c.height=64;
      const x=c.getContext('2d');
      x.fillStyle='#14161a';x.fillRect(0,0,256,64);
      x.fillStyle='#ffce5a';x.font='bold 44px monospace';x.textAlign='center';x.textBaseline='middle';
      x.fillText('FINISH',128,36);
      const label=new THREE.Mesh(new THREE.PlaneGeometry(W*.9,.9),
        new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(c),transparent:true,side:THREE.DoubleSide}));
      label.position.set(0,4.6,.1);g.add(label);
    }
    // fita xadrez baixa pra "romper" na altura da lancha
    const tape=new THREE.Mesh(new THREE.BoxGeometry(W,.5,.08),
      new THREE.MeshBasicMaterial({map:checkerTexture(8)}));
    tape.position.set(0,1.5,0);g.add(tape);
    // bandeira xadrez tremulando (boat-race.js anima via userData.flag)
    const stick=new THREE.Mesh(new THREE.CylinderGeometry(.05,.05,1.8,6),chromeM);
    stick.position.set(W/2+.1,3.4,0);g.add(stick);
    const flag=new THREE.Mesh(new THREE.PlaneGeometry(1.2,.75),
      new THREE.MeshBasicMaterial({map:checkerTexture(4),side:THREE.DoubleSide}));
    flag.position.set(W/2+.7,4.0,0);g.add(flag);
    g.userData.flag=flag;
  }else{
    // faixa xadrez de largada no alto + bordas escuras
    const banner=new THREE.Mesh(new THREE.BoxGeometry(W,1.1,.18),
      new THREE.MeshBasicMaterial({map:checkerTexture(6)}));
    banner.position.set(0,4.9,0);g.add(banner);
    const trimMat=new THREE.MeshStandardMaterial({color:0x14161a,roughness:.7});
    for(const dy of[.62,-.62]){
      const trim=new THREE.Mesh(new THREE.BoxGeometry(W+.1,.16,.22),trimMat);
      trim.position.set(0,4.9+dy,0);g.add(trim);
    }
  }
  return g;
}

// boat-race.js usa makeBoatRaceGate({color,finish}); o grupo é orientado lá.
export function makeBoatRaceGate(opts){return buildGate(opts);}

// Padrão de modelo: descriptor para o model-viewer (descoberta automática).
export default {category:'Missions',label:'Boat race gate',
  build:o=>buildGate({color:o?.color??0xff8a1e,finish:!!o?.finish}),
  variants:[{label:'Boat race — start gate',opts:{}},
            {label:'Boat race — finish line',opts:{finish:true}}]};
