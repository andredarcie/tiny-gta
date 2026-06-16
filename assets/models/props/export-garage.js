import * as THREE from 'three';

// Galpao de doca do IMPORT/EXPORT (estilo da garagem que compra carros no open-world):
// um piso de concreto marcado com listras de alerta, uma estrutura de portao
// aberto (dois pilares + viga) e um guindaste simples ao lado. Cores
// industriais (concreto cinza, aco escuro, ferrugem). Modelo PURO: build()
// devolve um Object3D fresco, sem scene.add. Marca de ~10x10m no chao; a origem
// do grupo fica no centro do piso para casar com o PAD do sistema.

const PAD=10;       // lado da marca quadrada no chao (~10m)
const GATE_W=8;     // vao livre do portao
const GATE_H=5.2;   // altura da viga do portao

// Textura de alerta amarelo/preto para a borda do piso de entrega (canvas, sem
// assets binarios — padrao do projeto).
function hazardTexture(){
  const c=document.createElement('canvas');c.width=c.height=128;
  const x=c.getContext('2d');
  x.fillStyle='#f2b705';x.fillRect(0,0,128,128);
  x.fillStyle='#14161a';
  const s=24;
  x.save();x.translate(64,64);x.rotate(Math.PI/4);x.translate(-110,-110);
  for(let i=-2;i<12;i++)x.fillRect(i*s*2,0,s,320);
  x.restore();
  const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;
  t.magFilter=THREE.NearestFilter;
  t.wrapS=t.wrapT=THREE.RepeatWrapping;
  return t;
}

function build(){
  const g=new THREE.Group();

  const concrete=new THREE.MeshStandardMaterial({color:0x6a6e74,roughness:.95,metalness:.05});
  const steel=new THREE.MeshStandardMaterial({color:0x3a3f47,roughness:.6,metalness:.5});
  const rust=new THREE.MeshStandardMaterial({color:0x8a5a3c,roughness:.85,metalness:.2});
  const hazard=new THREE.MeshStandardMaterial({color:0xf2b705,roughness:.8,metalness:.1});

  // Piso de concreto da marca (levemente acima do chao para nao brigar com o terreno).
  const floor=new THREE.Mesh(new THREE.BoxGeometry(PAD,.12,PAD),concrete);
  floor.position.y=.06;floor.receiveShadow=true;g.add(floor);

  // Moldura de listras de alerta ao redor do piso (quatro faixas finas).
  const haz=new THREE.MeshStandardMaterial({map:hazardTexture(),roughness:.8,metalness:.05});
  const band=.5, top=.13;
  for(const[w,d,ox,oz,rep] of[
    [PAD,band,0,(PAD-band)/2,PAD/band],
    [PAD,band,0,-(PAD-band)/2,PAD/band],
    [band,PAD,(PAD-band)/2,0,PAD/band],
    [band,PAD,-(PAD-band)/2,0,PAD/band],
  ]){
    const m=haz.clone();
    if(m.map){m.map=haz.map.clone();m.map.needsUpdate=true;m.map.repeat.set(Math.max(w,d)/band,1);}
    const strip=new THREE.Mesh(new THREE.BoxGeometry(w,.02,d),m);
    strip.position.set(ox,top,oz);strip.receiveShadow=true;g.add(strip);
  }

  // Seta de entrega no centro: chevrons claros apontando para dentro (canvas
  // seria exagero aqui — barras simples de concreto claro bastam).
  const mark=new THREE.MeshStandardMaterial({color:0xd7dade,roughness:.9});
  for(let i=0;i<3;i++){
    const bar=new THREE.Mesh(new THREE.BoxGeometry(2.6,.02,.32),mark);
    bar.position.set(0,top,-1.4+i*1.2);bar.receiveShadow=true;g.add(bar);
  }

  // Portao aberto: dois pilares de aco e uma viga em cima, no fundo da marca (-z).
  const pillarGeo=new THREE.BoxGeometry(.55,GATE_H,.55);
  for(const sx of[-1,1]){
    const p=new THREE.Mesh(pillarGeo,steel);
    p.position.set(sx*GATE_W/2,GATE_H/2,-PAD/2+.4);
    p.castShadow=true;g.add(p);
  }
  const beam=new THREE.Mesh(new THREE.BoxGeometry(GATE_W+1.1,.7,.7),steel);
  beam.position.set(0,GATE_H,-PAD/2+.4);beam.castShadow=true;g.add(beam);
  // Placa amarela na viga (faixa de alerta) — identifica a garagem de longe.
  const sign=new THREE.Mesh(new THREE.BoxGeometry(GATE_W-.5,.9,.16),hazard);
  sign.position.set(0,GATE_H-.1,-PAD/2+.05);g.add(sign);

  // Parede de fundo baixa (galpao parcial) atras do portao.
  const wall=new THREE.Mesh(new THREE.BoxGeometry(PAD,3.2,.4),concrete);
  wall.position.set(0,1.6,-PAD/2-.2);wall.castShadow=true;wall.receiveShadow=true;g.add(wall);

  // Guindaste simples ao lado direito: mastro vertical, lanca horizontal e cabo.
  // O gancho fica posicionado sobre o centro do PAD (lanca aponta para a marca)
  // para que a animacao de export o erga sobre o carro de forma convincente.
  const crane=new THREE.Group();
  const mast=new THREE.Mesh(new THREE.BoxGeometry(.6,7,.6),rust);
  mast.position.y=3.5;mast.castShadow=true;crane.add(mast);
  const base=new THREE.Mesh(new THREE.BoxGeometry(1.8,.4,1.8),steel);
  base.position.y=.2;crane.add(base);
  // lanca apontando para o centro do PAD (para -x, ja que o guindaste fica a +x)
  const REACH=PAD/2+1.4;                 // distancia do mastro ate o centro do PAD
  const jib=new THREE.Mesh(new THREE.BoxGeometry(REACH+1.2,.4,.4),rust);
  jib.position.set(-REACH/2+.3,6.6,0);jib.castShadow=true;crane.add(jib);
  // contrapeso atras do mastro (estetica industrial, sem custo extra de draw call)
  const cw=new THREE.Mesh(new THREE.BoxGeometry(1,1.1,1),steel);
  cw.position.set(.9,6.6,0);cw.castShadow=true;crane.add(cw);
  const cable=new THREE.Mesh(new THREE.CylinderGeometry(.04,.04,3,6),steel);
  cable.position.set(-REACH+.3,5,0);crane.add(cable);
  const hook=new THREE.Mesh(new THREE.BoxGeometry(.5,.5,.5),steel);
  hook.position.set(-REACH+.3,3.4,0);hook.castShadow=true;crane.add(hook);
  // guindaste encostado na borda +x do piso; com a lanca apontando o centro,
  // o gancho cai exatamente sobre o PAD (origem local x=0).
  crane.position.set(REACH,0,1.2);g.add(crane);
  // expoe gancho e guindaste para o sistema animar (lift do export / balanco)
  // sem o gameplay precisar conhecer a geometria interna.
  g.userData.hook=hook;
  g.userData.crane=crane;

  return g;
}

export default {category:'Props',label:'Export garage',build};

// Back-compat / atalho de gameplay: factory direta.
export function makeExportGarage(){return build();}
