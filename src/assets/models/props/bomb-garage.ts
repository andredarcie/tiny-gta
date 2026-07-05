import * as THREE from 'three';

// Garagem do "DEMO GARAGE" (oficina clandestina de demolição): um galpão
// pequeno de cara suja onde se instala uma bomba no carro. Modelo PURO: build()
// devolve um Object3D fresco, sem scene.add. Cores escuras (chapa de metal) com
// detalhes amarelos/vermelhos de alerta. Sem assets binários: o símbolo de
// perigo (triângulo amarelo com "!") é desenhado num <canvas> (padrão do projeto).
// Origem do grupo no centro da base; a "boca"/portão fica voltada para -z, então
// o carro entra de frente pela abertura.

const W=8, D=7, H=4.2;   // largura, profundidade e altura do galpão

// Textura procedural do aviso de perigo: triângulo amarelo com "!" sobre fundo
// escuro. Vira a placa pendurada na lateral/bancada.
function hazardSignTexture(): THREE.CanvasTexture{
  const c=document.createElement('canvas');c.width=c.height=128;
  const x=c.getContext('2d')!;
  x.fillStyle='#1a1c20';x.fillRect(0,0,128,128);
  // triângulo amarelo
  x.fillStyle='#f2c40f';
  x.beginPath();
  x.moveTo(64,16);x.lineTo(116,108);x.lineTo(12,108);x.closePath();x.fill();
  // borda do triângulo
  x.lineWidth=6;x.strokeStyle='#0c0d10';x.stroke();
  // ponto de exclamação preto no meio
  x.fillStyle='#0c0d10';
  x.fillRect(58,42,12,42);          // haste
  x.fillRect(58,92,12,12);          // pingo
  const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;
  t.magFilter=THREE.NearestFilter;
  return t;
}

export function makeBombGarage(): THREE.Group{
  const g=new THREE.Group();

  // materiais: chapa escura suja, detalhe vermelho e amarelo de alerta
  const shell=new THREE.MeshStandardMaterial({color:0x24262b,roughness:.85,metalness:.35});
  const trim=new THREE.MeshStandardMaterial({color:0x2f3138,roughness:.7,metalness:.4});
  const red=new THREE.MeshStandardMaterial({color:0xb02016,roughness:.6,metalness:.2,
    emissive:0x3a0a06,emissiveIntensity:.5});
  const yellow=new THREE.MeshStandardMaterial({color:0xf2c40f,roughness:.6,metalness:.2});
  const dark=new THREE.MeshStandardMaterial({color:0x141519,roughness:.9});

  // ----- piso/laje da oficina (concreto sujo) -----
  const slab=new THREE.Mesh(new THREE.BoxGeometry(W+1.4,.3,D+1.4),
    new THREE.MeshStandardMaterial({color:0x3a3a3e,roughness:.95}));
  slab.position.y=.15;slab.receiveShadow=true;g.add(slab);

  // ----- paredes laterais e fundo (a frente em -z fica aberta = portão) -----
  // lateral esquerda e direita
  for(const sx of[-1,1]){
    const wall=new THREE.Mesh(new THREE.BoxGeometry(.4,H,D),shell);
    wall.position.set(sx*(W/2),H/2+.3,0);wall.castShadow=true;wall.receiveShadow=true;g.add(wall);
  }
  // parede do fundo (+z)
  const back=new THREE.Mesh(new THREE.BoxGeometry(W+.4,H,.4),shell);
  back.position.set(0,H/2+.3,D/2);back.castShadow=true;back.receiveShadow=true;g.add(back);

  // ----- teto levemente inclinado -----
  const roof=new THREE.Mesh(new THREE.BoxGeometry(W+1,.4,D+.6),trim);
  roof.position.set(0,H+.5,0);roof.rotation.x=-.05;roof.castShadow=true;g.add(roof);

  // ----- viga/dintel da frente sobre a boca do portão -----
  const lintel=new THREE.Mesh(new THREE.BoxGeometry(W+.4,1.0,.5),trim);
  lintel.position.set(0,H-.1,-D/2);lintel.castShadow=true;g.add(lintel);

  // ----- portão de enrolar meio aberto (chapa corrugada presa no dintel) -----
  const door=new THREE.Mesh(new THREE.BoxGeometry(W-.6,1.4,.18),dark);
  door.position.set(0,H-1.0,-D/2);g.add(door);
  // ripas horizontais do portão (só visual)
  for(let i=0;i<4;i++){
    const slat=new THREE.Mesh(new THREE.BoxGeometry(W-.8,.06,.22),trim);
    slat.position.set(0,H-1.55+i*.35,-D/2);g.add(slat);
  }

  // ----- faixa de alerta vermelha sobre o dintel -----
  const stripe=new THREE.Mesh(new THREE.BoxGeometry(W+.42,.4,.52),red);
  stripe.position.set(0,H+.35,-D/2);g.add(stripe);

  // ----- bancada de trabalho encostada na parede do fundo -----
  const bench=new THREE.Mesh(new THREE.BoxGeometry(W-2,.9,1.0),trim);
  bench.position.set(0,.75,D/2-.9);bench.castShadow=true;bench.receiveShadow=true;g.add(bench);
  // pés da bancada
  for(const sx of[-1,1]){
    const leg=new THREE.Mesh(new THREE.BoxGeometry(.18,.6,.9),dark);
    leg.position.set(sx*(W/2-1.4),.4,D/2-.9);g.add(leg);
  }
  // engradados/caixas de explosivo sobre a bancada (vermelho/amarelo)
  for(let i=0;i<3;i++){
    const crate=new THREE.Mesh(new THREE.BoxGeometry(.7,.6,.7),i===1?yellow:red);
    crate.position.set(-1.6+i*1.6,1.5,D/2-.9);crate.castShadow=true;g.add(crate);
  }

  // ----- placa com símbolo de perigo (triângulo amarelo) na bancada/parede -----
  const sign=new THREE.Mesh(new THREE.PlaneGeometry(1.3,1.3),
    new THREE.MeshStandardMaterial({map:hazardSignTexture(),roughness:.7,metalness:.05}));
  sign.position.set(W/2-1.8,2.5,D/2-.32);g.add(sign);

  // ----- luz/alerta vermelha no teto da boca (decorativa, "armando") -----
  const lamp=new THREE.Mesh(new THREE.SphereGeometry(.2,12,8),
    new THREE.MeshBasicMaterial({color:0xff3b3b}));
  lamp.position.set(0,H-.4,-D/2+.4);g.add(lamp);

  // ----- giroflex/sirene no canto do teto (visual de oficina clandestina) -----
  // base preta + domo vermelho translúcido; o gameplay (bomb-shop.js) não anima
  // este aqui — é só cara de "garagem perigosa". Fica baixo custo (2 meshes).
  const beaconBase=new THREE.Mesh(new THREE.CylinderGeometry(.16,.18,.12,10),dark);
  beaconBase.position.set(W/2-.6,H+.8,-D/2+.8);g.add(beaconBase);
  const beaconDome=new THREE.Mesh(new THREE.SphereGeometry(.16,10,6,0,Math.PI*2,0,Math.PI/2),
    new THREE.MeshBasicMaterial({color:0xff5a2a}));
  beaconDome.position.set(W/2-.6,H+.86,-D/2+.8);g.add(beaconDome);

  // ----- listras de perigo (hazard) pintadas no piso da boca, amarelo/preto -----
  // marca onde o carro deve parar pra armar. Planos finos no chão (sem custo de
  // sombra, deitados sobre a laje).
  for(let i=0;i<5;i++){
    const dash=new THREE.Mesh(new THREE.BoxGeometry(.6,.02,.6),i%2?dark:yellow);
    dash.position.set(-2.2+i*1.1,.31,-D/2+1.2);g.add(dash);
  }

  // ----- pneus velhos empilhados num canto (decoração de oficina) -----
  const tireMat=new THREE.MeshStandardMaterial({color:0x141414,roughness:.95});
  for(let i=0;i<3;i++){
    const tire=new THREE.Mesh(new THREE.TorusGeometry(.42,.18,8,14),tireMat);
    tire.rotation.x=Math.PI/2;
    tire.position.set(-W/2+1.1,.5+i*.42,D/2-1.4);g.add(tire);
  }

  // ----- "bujão"/tanque vermelho de explosivo encostado na parede -----
  const tank=new THREE.Mesh(new THREE.CylinderGeometry(.32,.32,1.3,12),red);
  tank.position.set(-W/2+1.1,.95,-1.2);tank.castShadow=true;g.add(tank);
  const tankCap=new THREE.Mesh(new THREE.CylinderGeometry(.14,.14,.22,8),dark);
  tankCap.position.set(-W/2+1.1,1.7,-1.2);g.add(tankCap);

  return g;
}

// Padrão de modelo: descriptor para o model-viewer (descoberta automática).
export default {category:'Props',label:'Bomb garage',build(){return makeBombGarage();}};
