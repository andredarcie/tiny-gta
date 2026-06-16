import * as THREE from 'three';

// Pistola PADRÃO do open-world: uma semi-automática cinza estilo Colt M1911 — o
// traço que a distingue de uma Glock é o CÃO EXTERNO (spur hammer) na traseira,
// o slide de aço com bucha de cano (barrel bushing) na boca, o guarda-mato
// arredondado, a trava de segurança no quadro e os cabos (grip panels) escuros.
// Proporções em mm escaladas por K (comprimento ~210, altura ~140, cano ~127).
// Cano em +Z; g.userData.muzzlePoint marca a boca (usado pelo weapons.js).
const K=0.0045;                 // 1 mm -> unidades do jogo
const mm=v=>v*K;
const yBore=mm(22);             // eixo do cano logo acima da origem (a mão segura aqui)

const slideMat=new THREE.MeshStandardMaterial({color:0x70747c,roughness:.34,metalness:.95});
const frameMat=new THREE.MeshStandardMaterial({color:0x3c3f47,roughness:.45,metalness:.7});
const gripMat=new THREE.MeshStandardMaterial({color:0x2a1d14,roughness:.85,metalness:.05});
const steelMat=new THREE.MeshStandardMaterial({color:0x9ca0a8,roughness:.25,metalness:1});
const boreMat=new THREE.MeshBasicMaterial({color:0x050507});
const dotMat=new THREE.MeshBasicMaterial({color:0xe9eef2}); // pontos brancos da mira
const glowMat=new THREE.MeshBasicMaterial({color:0xffd24a,transparent:true,opacity:.25});

const box=(w,h,d,mat,x,y,z,rx=0,ry=0,rz=0,cast=false)=>{
  const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);
  m.position.set(x,y,z);m.rotation.set(rx,ry,rz);m.castShadow=cast;
  return m;
};
const cyl=(r,len,mat,x,y,z,rx=0,cast=false)=>{
  const m=new THREE.Mesh(new THREE.CylinderGeometry(r,r,len,12),mat);
  m.position.set(x,y,z);m.rotation.x=rx;m.castShadow=cast;
  return m;
};

export function makePistolModel({pickup=false}={}){
  const g=new THREE.Group();
  const W=mm(24);                   // largura do slide
  const zMuzzle=mm(105);            // frente do slide
  const slideLen=mm(190), slideH=mm(28);
  const slideCz=zMuzzle-slideLen/2; // centro do slide em z
  const slideCy=yBore+mm(3);

  // ---- slide de aço (1911: topo levemente arredondado, lados lisos) ----
  g.add(box(W,slideH,slideLen,slideMat,0,slideCy,slideCz));
  g.add(box(W-mm(6),mm(6),slideLen,slideMat,0,slideCy+slideH/2-mm(1),slideCz)); // quina superior
  // serrilhado de armar na traseira do slide
  for(let i=0;i<6;i++)
    g.add(box(W+mm(1),slideH-mm(6),mm(2.5),slideMat,0,slideCy,slideCz-slideLen/2+mm(12)+i*mm(8)));
  // ---- bucha de cano + boca embutida ----
  g.add(cyl(mm(13),mm(10),steelMat,0,yBore,zMuzzle-mm(5),Math.PI/2));
  g.add(cyl(mm(7),mm(12),boreMat,0,yBore,zMuzzle-mm(1),Math.PI/2,false));

  // ---- miras: poste frontal 1 ponto + traseira em U 2 pontos ----
  const yTop=slideCy+slideH/2;
  g.add(box(mm(8),mm(12),mm(10),slideMat,0,yTop+mm(4),zMuzzle-mm(18)));
  g.add(box(mm(5),mm(5),mm(5),dotMat,0,yTop+mm(8),zMuzzle-mm(18),0,0,0,false));
  g.add(box(mm(34),mm(12),mm(10),slideMat,0,yTop+mm(4),slideCz-slideLen/2+mm(12)));
  for(const dx of[-mm(10),mm(10)])
    g.add(box(mm(5),mm(5),mm(5),dotMat,dx,yTop+mm(5),slideCz-slideLen/2+mm(12),0,0,0,false));

  // ---- CÃO EXTERNO (spur hammer): a assinatura do 1911 na traseira ----
  const hammer=new THREE.Group();
  hammer.add(box(mm(8),mm(20),mm(7),steelMat,0,mm(8),0));        // corpo do cão
  hammer.add(box(mm(14),mm(6),mm(7),steelMat,0,mm(17),-mm(3),0,0,.2)); // esporão
  hammer.position.set(0,slideCy+mm(2),slideCz-slideLen/2-mm(4));
  hammer.rotation.x=-.35; // recuado/armado
  g.add(hammer);

  // ---- quadro (frame) de aço ----
  const frameTopY=slideCy-slideH/2;
  g.add(box(mm(22),mm(18),mm(150),frameMat,0,frameTopY-mm(7),slideCz+mm(8))); // dust cover sob o cano
  g.add(box(mm(24),mm(10),mm(70),frameMat,0,frameTopY-mm(3),slideCz-mm(20)));  // corpo do quadro
  // trava de segurança (thumb safety) + retém do slide no lado esquerdo
  g.add(box(mm(4),mm(7),mm(22),steelMat,-W/2-mm(1),frameTopY+mm(1),slideCz-mm(46)));
  g.add(box(mm(4),mm(9),mm(10),steelMat,-W/2-mm(1),frameTopY-mm(7),slideCz-mm(64)));

  // ---- guarda-mato arredondado + gatilho ----
  const guardZ=-mm(16);
  g.add(box(mm(10),mm(40),mm(9),frameMat,0,frameTopY-mm(28),guardZ+mm(36),-.1)); // barra frontal
  g.add(box(mm(10),mm(9),mm(44),frameMat,0,frameTopY-mm(46),guardZ+mm(16)));       // barra inferior
  g.add(box(mm(7),mm(20),mm(6),steelMat,0,frameTopY-mm(28),guardZ+mm(22)));        // gatilho

  // ---- punho 1911: cabos escuros, mainspring housing serrilhado, beavertail ----
  const grip=new THREE.Group();
  const gw=mm(30),gd=mm(54);
  grip.add(box(gw,mm(96),gd,frameMat,0,mm(-42),0));                   // moldura do punho
  // cabos (grip panels) dos dois lados
  for(const dx of[-gw/2-mm(1),gw/2+mm(1)])
    grip.add(box(mm(3),mm(78),gd-mm(8),gripMat,dx,mm(-42),0));
  // beavertail (grip safety) no topo traseiro
  grip.add(box(mm(24),mm(10),mm(20),steelMat,0,mm(6),-gd/2+mm(4),.5));
  // serrilhado do mainspring housing na traseira
  for(let i=0;i<6;i++)
    grip.add(box(gw-mm(8),mm(3),mm(3),gripMat,0,mm(-12)-i*mm(13),-gd/2+mm(1),0,0,0,false));
  // base do carregador
  grip.add(box(gw+mm(2),mm(10),gd+mm(4),steelMat,0,mm(-92),0));
  grip.position.set(0,frameTopY-mm(20),slideCz-slideLen/2+mm(40));
  grip.rotation.x=0;                  // punho reto/vertical (preferência do projeto)
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
export default {category:'Weapons',label:'Pistol',build:()=>makePistolModel()};
