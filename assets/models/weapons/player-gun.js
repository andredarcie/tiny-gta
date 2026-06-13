import * as THREE from 'three';

// Glock 17 low-poly, seguindo as proporções reais (em mm, escaladas por K):
//   comprimento 204 · altura 138 · largura do slide 25,5 · cano 114
//   raio de mira ~165 · ângulo do punho ~22°.
// Traços fiéis: striker-fired (SEM cão externo), slide de topo plano com
// serrilhado SÓ na traseira, cano embutido (boca rente à frente do slide),
// guarda-mato retangular, gatilho com aba de segurança, punho de polímero
// raked com finger grooves, beavertail e base de carregador.
// Cano em +Z; g.userData.muzzlePoint marca a boca (usado pelo weapons.js).
const K=0.0045;                 // 1 mm -> unidades do jogo
const mm=v=>v*K;
const yBore=mm(22);             // eixo do cano logo acima da origem (a mão segura aqui)

const slideMat=new THREE.MeshStandardMaterial({color:0x111116,roughness:.4,metalness:.55});
const frameMat=new THREE.MeshStandardMaterial({color:0x0c0c10,roughness:.95,metalness:.03});
const steelMat=new THREE.MeshStandardMaterial({color:0x55585f,roughness:.3,metalness:1});
const boreMat=new THREE.MeshBasicMaterial({color:0x050507});
const dotMat=new THREE.MeshBasicMaterial({color:0xe9eef2}); // pontos brancos da mira
const glowMat=new THREE.MeshBasicMaterial({color:0xffd24a,transparent:true,opacity:.25});

const box=(w,h,d,mat,x,y,z,rx=0,ry=0,rz=0,cast=true)=>{
  const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);
  m.position.set(x,y,z);m.rotation.set(rx,ry,rz);m.castShadow=cast;
  return m;
};
const cyl=(r,len,mat,x,y,z,rx=0,cast=true)=>{
  const m=new THREE.Mesh(new THREE.CylinderGeometry(r,r,len,12),mat);
  m.position.set(x,y,z);m.rotation.x=rx;m.castShadow=cast;
  return m;
};

export function makeGunModel({pickup=false}={}){
  const g=new THREE.Group();
  const W=mm(25.5);                 // largura do slide
  const zMuzzle=mm(102);            // frente do slide (metade do comprimento à frente da origem)
  const slideLen=mm(186), slideH=mm(28);
  const slideCz=zMuzzle-slideLen/2; // centro do slide em z
  const slideCy=yBore+mm(3);        // cano fica no terço inferior do slide

  // ---- slide: bloco de topo plano ----
  g.add(box(W,slideH,slideLen,slideMat,0,slideCy,slideCz));
  // bisel do nariz (chanfro no topo frontal)
  g.add(box(W,mm(7),mm(20),slideMat,0,slideCy+slideH/2-mm(2),zMuzzle-mm(18),-.3));
  // serrilhado SÓ na traseira (Glock Gen3): ribs verticais nos dois lados
  for(let i=0;i<7;i++)
    g.add(box(W+mm(1.5),slideH-mm(4),mm(3),slideMat,0,slideCy,slideCz-slideLen/2+mm(14)+i*mm(9)));
  // janela de ejeção (lado direito)
  g.add(box(mm(4),mm(16),mm(40),slideMat,W/2-mm(1),slideCy+mm(4),slideCz+mm(34)));
  // boca do cano embutida, rente à frente do slide
  g.add(cyl(mm(13),mm(8),steelMat,0,yBore,zMuzzle-mm(4),Math.PI/2));
  g.add(cyl(mm(8),mm(10),boreMat,0,yBore,zMuzzle-mm(1),Math.PI/2,false));

  // ---- miras (raio ~165mm): poste frontal 1 ponto + traseira em U 2 pontos ----
  const yTop=slideCy+slideH/2;
  g.add(box(mm(9),mm(13),mm(11),slideMat,0,yTop+mm(5),zMuzzle-mm(20)));
  g.add(box(mm(6),mm(6),mm(6),dotMat,0,yTop+mm(9),zMuzzle-mm(20),0,0,0,false));
  g.add(box(mm(38),mm(13),mm(11),slideMat,0,yTop+mm(5),slideCz-slideLen/2+mm(14))); // bloco traseiro
  for(const dx of[-mm(11),mm(11)])
    g.add(box(mm(6),mm(6),mm(6),dotMat,dx,yTop+mm(6),slideCz-slideLen/2+mm(14),0,0,0,false));

  // ---- frame de polímero ----
  const frameTopY=slideCy-slideH/2;     // o slide repousa aqui
  // dust cover (frente do frame, sob o cano) — recuado um pouco da boca
  g.add(box(mm(22),mm(20),mm(150),frameMat,0,frameTopY-mm(8),slideCz+mm(6)));
  // trilho de acessório com uma ranhura transversal
  g.add(box(mm(16),mm(8),mm(50),frameMat,0,frameTopY-mm(20),zMuzzle-mm(58)));
  g.add(box(mm(18),mm(3),mm(4),frameMat,0,frameTopY-mm(24),zMuzzle-mm(58),0,0,0,false));
  // alavanca de retém do slide (lado esquerdo) e botão do carregador
  g.add(box(mm(4),mm(7),mm(26),steelMat,-W/2-mm(1),frameTopY+mm(2),slideCz-mm(40)));
  g.add(box(mm(5),mm(8),mm(8),frameMat,-W/2-mm(1),frameTopY-mm(6),slideCz-mm(70)));

  // ---- guarda-mato RETANGULAR ----
  const guardZ=-mm(20);                 // guarda-mato/gatilho recuados pra traseira
  g.add(box(mm(10),mm(44),mm(9),frameMat,0,frameTopY-mm(30),guardZ+mm(34),-.12)); // barra frontal
  g.add(box(mm(10),mm(9),mm(40),frameMat,0,frameTopY-mm(50),guardZ+mm(14)));        // barra inferior
  // gatilho + aba de segurança central
  g.add(box(mm(7),mm(22),mm(6),frameMat,0,frameTopY-mm(30),guardZ+mm(20)));
  g.add(box(mm(3),mm(16),mm(3),steelMat,0,frameTopY-mm(30),guardZ+mm(23),0,0,0,false));

  // ---- punho: polímero raked ~22°, com finger grooves, beavertail e carregador ----
  const grip=new THREE.Group();
  const gw=mm(30),gd=mm(55);               // largura e profundidade do punho
  grip.add(box(gw,mm(95),gd,frameMat,0,mm(-40),0));
  // beavertail: prolongamento no topo traseiro
  grip.add(box(mm(26),mm(12),mm(24),frameMat,0,mm(8),-gd/2+mm(4),.5));
  // finger grooves (Gen3/4) na frente do punho
  for(let i=0;i<3;i++)
    grip.add(box(gw+mm(1),mm(7),mm(10),slideMat,0,mm(-12)-i*mm(24),gd/2-mm(2),0,0,0,false));
  // pegada na traseira
  for(let i=0;i<5;i++)
    grip.add(box(gw-mm(6),mm(4),mm(4),slideMat,0,mm(-4)-i*mm(16),-gd/2+mm(2),0,0,0,false));
  // base do carregador (sobra um tico na traseira)
  grip.add(box(gw+mm(2),mm(11),gd+mm(8),frameMat,0,mm(-92),-mm(4)));
  grip.position.set(0,frameTopY-mm(18),slideCz-slideLen/2+mm(42));
  grip.rotation.x=0;                        // punho reto/vertical (preferência do projeto)
  g.add(grip);

  if(pickup){
    const glow=new THREE.Mesh(new THREE.TorusGeometry(.9,.045,8,28),glowMat);
    glow.rotation.x=Math.PI/2;
    glow.position.y=mm(-110);
    g.add(glow);
  }

  const muzzlePoint=new THREE.Object3D();
  muzzlePoint.position.set(0,yBore,zMuzzle+mm(8));
  g.userData.muzzlePoint=muzzlePoint;
  g.add(muzzlePoint);
  return g;
}

// Padrão de modelo: descriptor para o model-viewer (descoberta automática).
export default {category:'Weapons',label:'Pistol',build:()=>makeGunModel()};
