import * as THREE from 'three';
import {scene,renderer} from '../../../js/engine.js';
import {cityCoastR,ruralHalf,RURAL_X0,RURAL_TIP}
  from '../../../js/constants.js';
import {makeRng} from '../../../js/rng.js';
// Seeded so the coast sand-speckle texture is identical every load.
const {random,irand,pick}=makeRng(0x15a4e);

// ====== Ilha: areia + raso + espuma seguindo a costa irregular ==============
// Substitui as peças QUADRADAS antigas (praia da cidade, anéis de shallows, bordas
// de areia retangulares da zona rural). Tudo aqui é estático (a espuma só pulsa
// escala/opacidade), seguindo o MESMO contorno de constants.js (cityCoastR /
// ruralHalf) que o gameplay usa em isLand — então nunca se "nada na areia".
//
// Empilhamento em Y (de baixo p/ cima, sem z-fighting): mar -0.32 (sea.js) <
// shallows -0.31 < areia -0.06 < espuma -0.045 < gramado rural -0.02 < chão
// cidade 0. As malhas de terra (chão/gramado) cobrem o miolo; a areia só aparece
// no anel entre o conteúdo e a costa.

const SAND_Y=-.06, SHAL_Y=-.31, FOAM_Y=-.045;
const NA=168;                       // amostras angulares da costa da cidade (suave)

// textura de areia tileável (grão + manchas), parecida com a praia antiga porém
// SEM a moldura de espuma quadrada — a espuma agora é uma faixa que segue a costa
function sandTexture(){
  const c=document.createElement('canvas');c.width=c.height=256;
  const x=c.getContext('2d');
  x.fillStyle='#e7d29a';x.fillRect(0,0,256,256);
  for(let k=0;k<2200;k++){
    x.fillStyle=`rgba(${irand(195,238)},${irand(168,208)},${irand(118,158)},.18)`;
    x.fillRect(random()*256,random()*256,irand(2,5),irand(2,5));
  }
  // conchinhas/estrelas esparsas
  for(let k=0;k<70;k++){
    x.fillStyle=pick(['rgba(255,244,235,.8)','rgba(255,170,185,.7)','rgba(255,214,140,.7)','rgba(190,235,255,.65)']);
    x.fillRect(random()*256,random()*256,irand(1,3),irand(1,3));
  }
  const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;
  t.wrapS=t.wrapT=THREE.RepeatWrapping;
  t.anisotropy=renderer.capabilities.getMaxAnisotropy();
  return t;
}

// ShapeGeometry deita-se no plano (giro -90° no X) e ganha UV = (x,y) local.
// Pra textura repetir num tamanho de mundo fixo, escalo o repeat.
function layFlat(geo,mat,y){
  const m=new THREE.Mesh(geo,mat);
  m.rotation.x=-Math.PI/2;m.position.y=y;
  m.receiveShadow=true;m.matrixAutoUpdate=false;m.updateMatrix();
  scene.add(m);return m;
}

// --- contorno da cidade (polar, centrado na origem) ---
// IMPORTANTE: o mesh deita com rotation.x=-90°, então Y local → -Z mundo (igual
// ao chão rural que amostra com -getY). Por isso nego o seno: assim o ponto cai
// no ângulo de mundo `th` e a areia bate 1:1 com isLand (atan2(z,x)).
function cityShape(extra=0){
  const sh=new THREE.Shape();
  for(let i=0;i<=NA;i++){
    const th=i/NA*Math.PI*2, r=cityCoastR(th)+extra;
    const px=Math.cos(th)*r, py=-Math.sin(th)*r;
    i?sh.lineTo(px,py):sh.moveTo(px,py);
  }
  sh.closePath();return sh;
}

// --- contorno da península (percorre a borda norte e volta pela sul) ---
function ruralShape(extra=0){
  const sh=new THREE.Shape();
  const x0=RURAL_X0-8, x1=RURAL_TIP, step=5;
  let first=true;
  for(let x=x0;x<=x1;x+=step){            // borda norte: z = +ruralHalf
    const z=ruralHalf(x)+extra*(ruralHalf(x)>0?1:0);
    first?(sh.moveTo(x,z),first=false):sh.lineTo(x,z);
  }
  for(let x=x1;x>=x0;x-=step)             // volta pela borda sul: z = -ruralHalf
    sh.lineTo(x,-(ruralHalf(x)+extra*(ruralHalf(x)>0?1:0)));
  sh.closePath();return sh;
}

// faixa fina seguindo o contorno polar da cidade (anel com furo) — pra espuma
function cityRing(rOut,thick){
  const sh=new THREE.Shape(),hole=new THREE.Path();
  for(let i=0;i<=NA;i++){
    const th=i/NA*Math.PI*2, ro=cityCoastR(th)+rOut, ri=ro-thick;
    const co=Math.cos(th),so=-Math.sin(th);   // -sin: Y local → -Z mundo (ver cityShape)
    i?sh.lineTo(co*ro,so*ro):sh.moveTo(co*ro,so*ro);
    i?hole.lineTo(co*ri,so*ri):hole.moveTo(co*ri,so*ri);
  }
  sh.closePath();hole.closePath();sh.holes.push(hole);
  return new THREE.ShapeGeometry(sh);
}

// anel (annulus) seguindo o contorno polar da cidade — pro raso, sem encher o
// miolo (evita overdraw; o original também usava anéis com furo)
function cityAnnulus(inExtra,outExtra){
  const sh=new THREE.Shape(),hole=new THREE.Path();
  for(let i=0;i<=NA;i++){
    const th=i/NA*Math.PI*2, ro=cityCoastR(th)+outExtra, ri=cityCoastR(th)+inExtra;
    const co=Math.cos(th),so=-Math.sin(th);
    i?sh.lineTo(co*ro,so*ro):sh.moveTo(co*ro,so*ro);
    i?hole.lineTo(co*ri,so*ri):hole.moveTo(co*ri,so*ri);
  }
  sh.closePath();hole.closePath();sh.holes.push(hole);
  return new THREE.ShapeGeometry(sh);
}
// banda (com furo) ao redor da península — pro raso. Furo interno em inExtra=0 =
// borda da areia (não cruza no bico, onde ruralHalf→0).
function ruralBand(inExtra,outExtra){
  const sh=new THREE.Shape(),hole=new THREE.Path();
  const x0=RURAL_X0-8,x1=RURAL_TIP,step=5;let f=true;
  for(let x=x0;x<=x1;x+=step){const z=ruralHalf(x)+outExtra;f?(sh.moveTo(x,z),f=false):sh.lineTo(x,z);}
  for(let x=x1;x>=x0;x-=step)sh.lineTo(x,-(ruralHalf(x)+outExtra));
  sh.closePath();f=true;
  for(let x=x0;x<=x1;x+=step){const z=ruralHalf(x)+inExtra;f?(hole.moveTo(x,z),f=false):hole.lineTo(x,z);}
  for(let x=x1;x>=x0;x-=step)hole.lineTo(x,-(ruralHalf(x)+inExtra));
  hole.closePath();sh.holes.push(hole);
  return new THREE.ShapeGeometry(sh);
}

// faixa fina ao longo de UMA borda da península (norte: sign=+1, sul: sign=-1)
function ruralEdgeStrip(rOut,thick,sign){
  const sh=new THREE.Shape();const x0=RURAL_X0+10,x1=RURAL_TIP,step=5;
  const pts=[];
  for(let x=x0;x<=x1;x+=step){const z=sign*(ruralHalf(x)+rOut);pts.push([x,z]);}
  sh.moveTo(pts[0][0],pts[0][1]);
  for(let i=1;i<pts.length;i++)sh.lineTo(pts[i][0],pts[i][1]);
  for(let i=pts.length-1;i>=0;i--)sh.lineTo(pts[i][0],pts[i][1]-sign*thick);
  sh.closePath();return new THREE.ShapeGeometry(sh);
}

// Monta toda a ilha. Retorna os objetos de espuma p/ updateCoastFoam.
export function buildIsland(){
  const sandMat=new THREE.MeshLambertMaterial({map:sandTexture()});
  const TILE=70;                          // 1 tile de areia cobre 70 un de mundo
  for(const map of[sandMat.map]){map.repeat.set(1/TILE,1/TILE);}

  // 1) AREIA: disco irregular da cidade + franja da península (preenchidos; o
  //    chão/gramado cobrem o miolo, a areia só assoma na orla)
  layFlat(new THREE.ShapeGeometry(cityShape(0)),sandMat,SAND_Y);
  layFlat(new THREE.ShapeGeometry(ruralShape(0)),sandMat,SAND_Y);

  // 2) RASO turquesa: dois anéis seguindo a costa, logo acima do mar (a borda
  //    interna tuca sob a areia → sem emenda; o miolo fica vazado → sem overdraw)
  const shalMat=new THREE.MeshBasicMaterial({color:0x55d8d8,transparent:true,opacity:.42,depthWrite:false});
  const shalMat2=new THREE.MeshBasicMaterial({color:0x3fc2cf,transparent:true,opacity:.24,depthWrite:false});
  layFlat(cityAnnulus(-3,22),shalMat,SHAL_Y);
  layFlat(ruralBand(0,22),shalMat,SHAL_Y);
  layFlat(cityAnnulus(20,44),shalMat2,SHAL_Y);
  layFlat(ruralBand(20,44),shalMat2,SHAL_Y);

  // 3) ESPUMA: bandas finas na linha d'água. Cidade = anéis polares (pulsam
  //    escala+opacidade, centrados na origem). Península = tiras N/S (só opacidade).
  const foam=[];
  for(let k=0;k<3;k++){
    const g=cityRing(-1-k*.6,2.4);
    const m=new THREE.Mesh(g,new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:.2,depthWrite:false}));
    m.rotation.x=-Math.PI/2;m.position.y=FOAM_Y+k*.004;scene.add(m);
    foam.push({m,ph:k*2.1,spd:.55+k*.12,amp:.012+k*.004,polar:true});
  }
  for(const sign of[1,-1]){
    const g=ruralEdgeStrip(-1,2.6,sign);
    const m=new THREE.Mesh(g,new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:.16,depthWrite:false}));
    m.rotation.x=-Math.PI/2;m.position.y=FOAM_Y;scene.add(m);
    foam.push({m,ph:sign>0?0:1.7,spd:.6,amp:0,polar:false});
  }
  return foam;
}

// Anima a espuma (chamado por world.updateBeach → main.js step)
export function updateCoastFoam(foam,time){
  for(const w of foam){
    if(w.polar){
      const s=1+w.amp*(.5+.5*Math.sin(time*w.spd+w.ph));
      w.m.scale.set(s,s,1);
    }
    w.m.material.opacity=(w.polar?.06:.05)+.28*Math.max(0,Math.sin(time*w.spd+w.ph+1.2));
  }
}
