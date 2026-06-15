import * as THREE from 'three';

// Rampa de salto (estilo "unique stunt jump" do GTA): uma cunha de madeira/concreto.
// É um prisma triangular — base no chão na traseira, subindo até a borda alta na
// frente (ponta em +z). A cunha SOBE ao longo do +z local de propósito: no motor os
// carros apontam o eixo local +z e andam em (sin h, cos h) (ver player.js), e a
// detecção de decolagem em stunt-jumps.js usa a MESMA convenção. Assim, posicionar a
// rampa com rotation.y = heading faz o carro encarar a subida de frente. O carro
// acelera contra ela e decola. A face inclinada leva listras de alerta amarelas/
// pretas, desenhadas num <canvas> (padrão do projeto: sem assets binários). Modelo
// PURO: build() devolve um Object3D fresco, sem scene.add. ~6m de comprimento e
// ~2.5m de altura na ponta.
//
// As rampas ficam ESCONDIDAS na areia/pasto (sem blip no radar), então o visual
// precisa ser legível à distância sobre fundo claro: corpo de madeira escura +
// face de alerta amarelo/preto + cavaletes laterais que destacam a silhueta.

const LEN=6, HEI=2.5, WID=4.4;

// Listras diagonais amarelo/preto (faixa de alerta) para a face inclinada.
// Padrão grosso pra ler de longe; chevrons apontando pra subida (+z) dão a leitura
// de "rampa pra cima".
function hazardTexture(){
  const c=document.createElement('canvas');c.width=c.height=128;
  const x=c.getContext('2d');
  x.fillStyle='#f2b705';x.fillRect(0,0,128,128);
  x.fillStyle='#111';
  const s=26;
  // listras diagonais
  x.save();x.translate(64,64);x.rotate(Math.PI/4);x.translate(-90,-90);
  for(let i=-2;i<10;i++)x.fillRect(i*s*2,0,s,260);
  x.restore();
  // moldura escura nas bordas pra destacar o retângulo da rampa sobre a areia
  x.lineWidth=10;x.strokeStyle='#111';x.strokeRect(5,5,118,118);
  const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;
  t.magFilter=THREE.NearestFilter;
  return t;
}

export function makeStuntRamp(){
  const g=new THREE.Group();

  const hl=LEN/2, hw=WID/2;
  const wood=new THREE.MeshStandardMaterial({color:0x7a4a22,roughness:.92,metalness:.03,side:THREE.DoubleSide});
  const dark=new THREE.MeshStandardMaterial({color:0x14161a,roughness:.7});

  // Corpo da cunha: prisma triangular. Geometria customizada (perfil triangular
  // no plano z/y, extrudado em x). Vértices: traseira no chão (z=-hl,y=0), base
  // dianteira (z=+hl,y=0) e ponta alta (z=+hl,y=HEI) — sobe ao longo de +z.
  // Origem do grupo no centro. Dois lados (x=±hw) enrolados pra normal apontar
  // pra fora (−x e +x).
  const pos=[
    -hw,0,-hl,  -hw,0, hl,  -hw,HEI, hl,
     hw,0,-hl,   hw,HEI, hl,  hw,0, hl,
  ];
  const sideGeo=new THREE.BufferGeometry();
  sideGeo.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));
  sideGeo.computeVertexNormals();
  g.add(new THREE.Mesh(sideGeo,wood));

  // Rampa (face inclinada) com a textura de alerta: um plano do chão da traseira
  // (z=-hl) até a ponta alta da frente (z=+hl). Plano nasce no XY (normal +z);
  // a inclinação θ faz a normal apontar para cima e para trás (encara o carro).
  const slopeLen=Math.hypot(LEN,HEI);
  const theta=Math.atan2(HEI,LEN);
  const slope=new THREE.Mesh(
    new THREE.PlaneGeometry(WID,slopeLen),
    new THREE.MeshStandardMaterial({map:hazardTexture(),roughness:.7,metalness:.05})
  );
  slope.rotation.x=-(Math.PI/2+theta); // deita o plano e inclina para subir em +z
  slope.position.set(0,HEI/2,0);
  g.add(slope);

  // Base traseira (parede de fundo, borda baixa) — dá volume e fecha o fundo.
  const back=new THREE.Mesh(new THREE.BoxGeometry(WID,0.4,.3),wood);
  back.position.set(0,0.2,-hl);g.add(back);

  // Borda dianteira (lábio de lançamento) — uma faixa escura na ponta alta (+z).
  const lip=new THREE.Mesh(new THREE.BoxGeometry(WID+.2,.35,.5),dark);
  lip.position.set(0,HEI-.1,hl);g.add(lip);

  // Cavaletes laterais: dois "trilhos" de madeira correndo pela aresta superior de
  // cada lado, da traseira baixa à ponta alta. Reforçam a silhueta da cunha de
  // longe (legibilidade sobre areia clara) e dão um ar de obra rústica. Caixa fina
  // inclinada no mesmo θ da face, deslocada pra fora em x.
  const railLen=slopeLen+.2;
  for(const sx of[-1,1]){
    const rail=new THREE.Mesh(new THREE.BoxGeometry(.22,.3,railLen),wood);
    rail.position.set(sx*(hw+.06),HEI/2+.12,0);
    rail.rotation.x=-theta; // acompanha a subida da face
    g.add(rail);
  }

  // Postes/cunhas de apoio na traseira: dois tocos curtos que "ancoram" a rampa no
  // chão, ajudando a destacá-la e a dar sombra própria sobre a areia.
  for(const sx of[-1,1]){
    const post=new THREE.Mesh(new THREE.BoxGeometry(.3,.7,.3),wood);
    post.position.set(sx*(hw-.1),.35,-hl+.2);
    g.add(post);
  }

  g.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});
  return g;
}

// Padrão de modelo: descriptor para o model-viewer (descoberta automática).
export default {category:'Props',label:'Stunt ramp',build(){return makeStuntRamp();}};
