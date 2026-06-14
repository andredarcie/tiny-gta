import * as THREE from 'three';
import {matte} from '../matte.js';
import {scene} from '../../../js/engine.js';

// Oficina de customização "MOD GARAGE" (estilo Pay'n'Spray / TransFender do GTA).
// Diferente dos outros prédios especiais, NÃO tem interior off-map: é um galpão
// de FRENTE ABERTA num quarteirão reservado, e o jogador entra DE CARRO pela
// abertura até a plataforma (WORKSHOP_PAD). Perto dela, parado, abre o menu de
// custom (js/mod-shop.js). Os mods são aplicados no próprio carro do jogador.

export const WORKSHOP_I=5,WORKSHOP_J=2;            // quarteirão reservado (centro-sul)
const CX=44*WORKSHOP_I-154,CZ=44*WORKSHOP_J-154;   // centro do quarteirão (66,-66)
export const WORKSHOP_CENTER={x:CX,z:CZ};
// abertura na face -z (de frente pra rua de baixo); o carro entra e para aqui,
// um pouco pra dentro, com o nariz (+z) apontando pro fundo
export const WORKSHOP_PAD={x:CX,z:CZ+3};           // (66,-63)

export const workshopFx={sign:null,ring:null};

const wallM=matte({color:0x3a3f48,roughness:.95});
const trimM=matte({color:0x20242b,roughness:.8});
const accentM=new THREE.MeshBasicMaterial({color:0x19e3ff}); // faixa "neon" ciano
const steelM=matte({color:0x6b7079,metalness:.85,roughness:.35});
const darkM=matte({color:0x14161b,roughness:.9});
const tireM=matte({color:0x14121a,roughness:.95});
const floorM=matte({color:0x26282d,roughness:.96});
const drumM=matte({color:0xb6422f,roughness:.7,metalness:.2});

function signTexture(){
  const c=document.createElement('canvas');c.width=512;c.height=128;
  const x=c.getContext('2d');
  x.fillStyle='#0b0e13';x.fillRect(0,0,512,128);
  x.textAlign='center';x.textBaseline='middle';
  x.font="900 52px 'Arial Black',monospace";
  x.shadowColor='#19e3ff';x.shadowBlur=24;
  x.fillStyle='#e8fbff';
  for(let k=0;k<3;k++)x.fillText('MOD GARAGE',256,60);
  x.shadowBlur=0;x.font="700 20px monospace";x.fillStyle='#ffd24a';
  x.fillText('CUSTOM • PAINT • TUNE',256,104);
  const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;
  return t;
}

function makeTireStack(n){
  const g=new THREE.Group();
  for(let k=0;k<n;k++){
    const t=new THREE.Mesh(new THREE.CylinderGeometry(.42,.42,.26,16),tireM);
    t.position.y=.15+k*.27;g.add(t);
  }
  return g;
}

export function addWorkshop(solids){
  // ----- piso de concreto + plataforma marcada -----
  const slab=new THREE.Mesh(new THREE.PlaneGeometry(19,19),floorM);
  slab.rotation.x=-Math.PI/2;slab.position.set(CX,.02,CZ);slab.receiveShadow=true;
  scene.add(slab);
  // anel da plataforma onde o carro para (corona estilo GTA)
  const ring=new THREE.Mesh(new THREE.TorusGeometry(2.5,.14,8,28),
    new THREE.MeshBasicMaterial({color:0x19e3ff,transparent:true,opacity:.9}));
  ring.rotation.x=-Math.PI/2;ring.position.set(WORKSHOP_PAD.x,.06,WORKSHOP_PAD.z);
  scene.add(ring);workshopFx.ring=ring;
  // faixa amarela pintada no chão sob o anel
  const mark=new THREE.Mesh(new THREE.RingGeometry(2.62,2.95,28),
    new THREE.MeshBasicMaterial({color:0xffcf2e,transparent:true,opacity:.55}));
  mark.rotation.x=-Math.PI/2;mark.position.set(WORKSHOP_PAD.x,.04,WORKSHOP_PAD.z);
  scene.add(mark);

  // ----- galpão: 3 paredes + teto, FRENTE (-z) aberta -----
  const back=new THREE.Mesh(new THREE.BoxGeometry(18.6,5,.6),wallM);
  back.position.set(CX,2.5,CZ+9);back.castShadow=true;back.receiveShadow=true;scene.add(back);
  for(const sx of[-1,1]){
    const w=new THREE.Mesh(new THREE.BoxGeometry(.6,5,18),wallM);
    w.position.set(CX+sx*9,2.5,CZ);w.castShadow=true;w.receiveShadow=true;scene.add(w);
  }
  const roof=new THREE.Mesh(new THREE.BoxGeometry(19.2,.4,19.2),trimM);
  roof.position.set(CX,5.2,CZ);roof.castShadow=true;scene.add(roof);
  // viga/marquise sobre a abertura, com a faixa neon e o letreiro
  const header=new THREE.Mesh(new THREE.BoxGeometry(19.2,1.3,.7),wallM);
  header.position.set(CX,4.4,CZ-9);scene.add(header);
  const neon=new THREE.Mesh(new THREE.BoxGeometry(19.2,.16,.16),accentM);
  neon.position.set(CX,3.7,CZ-9.2);scene.add(neon);
  workshopFx.sign=new THREE.Mesh(new THREE.PlaneGeometry(11,2.4),
    new THREE.MeshBasicMaterial({map:signTexture(),transparent:true}));
  workshopFx.sign.position.set(CX,4.45,CZ-9.38);workshopFx.sign.rotation.y=Math.PI;
  scene.add(workshopFx.sign);
  // pilastras laranja enquadrando a boca da garagem
  for(const sx of[-1,1]){
    const col=new THREE.Mesh(new THREE.BoxGeometry(.7,3.8,.7),trimM);
    col.position.set(CX+sx*9,1.9,CZ-9);scene.add(col);
  }

  // ----- detalhes internos -----
  // parede de ferramentas (pegboard) no fundo
  const peg=new THREE.Mesh(new THREE.PlaneGeometry(7,2.6),
    matte({color:0x9a4f1e,roughness:.85}));
  peg.position.set(CX-3.5,2.6,CZ+8.65);peg.rotation.y=Math.PI;scene.add(peg);
  for(let k=0;k<5;k++){ // chaves/ferramentas penduradas
    const tool=new THREE.Mesh(new THREE.BoxGeometry(.1,.7+Math.random()*.4,.06),steelM);
    tool.position.set(CX-6+k*1.1,2.6,CZ+8.55);scene.add(tool);
  }
  // bancada
  const bench=new THREE.Mesh(new THREE.BoxGeometry(5,.18,1),
    matte({color:0x4a4036,roughness:.85}));
  bench.position.set(CX-5.6,1.0,CZ+5);bench.rotation.y=Math.PI/2;scene.add(bench);
  // elevador hidráulico (dois postes + braços) no canto direito
  for(const dz of[-1.4,1.4]){
    const post=new THREE.Mesh(new THREE.BoxGeometry(.4,3.2,.4),steelM);
    post.position.set(CX+6.4,1.6,CZ+dz);scene.add(post);
    const arm=new THREE.Mesh(new THREE.BoxGeometry(.3,.2,2.4),steelM);
    arm.position.set(CX+5.7,1.2,CZ+dz);scene.add(arm);
  }
  // pilhas de pneu + tambores de óleo
  const t1=makeTireStack(4);t1.position.set(CX+7.4,0,CZ+6.4);scene.add(t1);
  const t2=makeTireStack(3);t2.position.set(CX-6.6,0,CZ-5.4);scene.add(t2);
  for(const[dx,dz]of[[6.9,-5.8],[6.1,-6.4]]){
    const drum=new THREE.Mesh(new THREE.CylinderGeometry(.4,.4,1.1,12),drumM);
    drum.position.set(CX+dx,.55,CZ+dz);scene.add(drum);
  }
  // luz quente do galpão
  const light=new THREE.PointLight(0xfff0d0,60,40,1.8);
  light.position.set(CX,4.4,CZ);scene.add(light);

  // ----- sólidos: 3 paredes (frente aberta deixa o carro entrar) -----
  solids.push(
    {x0:CX-9.4,x1:CX+9.4,z0:CZ+8.6,z1:CZ+9.4,h:5},  // fundo (+z)
    {x0:CX-9.4,x1:CX-8.6,z0:CZ-9,z1:CZ+9,h:5},      // parede esquerda
    {x0:CX+8.6,x1:CX+9.4,z0:CZ-9,z1:CZ+9,h:5},      // parede direita
    {x0:CX+6.0,x1:CX+6.8,z0:CZ-1.8,z1:CZ+1.8,h:3},  // postes do elevador
  );
}
