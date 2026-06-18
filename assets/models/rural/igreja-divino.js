import * as THREE from 'three';
import {matte} from '../matte.js';
import {bakeProp} from '../props/prop-merge.js';

// Igreja do Divino Espírito Santo — réplica low-poly da matriz de Divinolândia/SP.
// Ver reference/divinolandia-praca/. Esta versão: torre ESBELTÍSSIMA e dominante com
// TOPO em volume quadrado (painéis vazados avermelhados + cobertura quase plana +
// ornamentos metálicos nos cantos, SEM relógio), janelas em ARCO OGIVAL altas e
// estreitas, fachada em camadas com arco profundo + cobogó denso + varanda saliente
// + entrada recuada, telhado fino, escadaria, e cores branco quente + rosa salmão +
// vermelho queimado. build() é puro (frente para +z).
const wallM=matte({color:0xf6f1e6,roughness:.96});   // branco quente
const roofM=matte({color:0xa8503a,roughness:.92});   // vermelho QUEIMADO
const moldM=matte({color:0xe2a08c,roughness:.85});   // ROSA SALMÃO suave
const whiteM=matte({color:0xf3eee3,roughness:.88});  // molduras claras das janelas/topo
const glassM=matte({color:0x152848,roughness:.34,side:THREE.DoubleSide}); // vitrais azul escuro
const latM=matte({color:0xb45c44,roughness:.93});    // cobogó / painéis vazados (avermelhado)
const darkM=matte({color:0x0c1320,roughness:.96});   // fundos / sombra
const doorM=matte({color:0x553a24,roughness:.9});
const stoneM=matte({color:0xcfc9bb,roughness:1});
const metalM=matte({color:0xded7c8,roughness:.55,metalness:.3}); // grade/ornamentos claros
const statueM=matte({color:0x7fb0e6,roughness:.7});
const treeM=matte({color:0x2c5836,roughness:1});
const crossM=matte({color:0xbfe6ff,emissive:0x39a0ff,emissiveIntensity:.9,roughness:.5});

// arco PARABÓLICO suave (laterais retas até hRect, parábola no topo).
function parabolicArch(w,hRect,rise){
  const r=w/2,s=new THREE.Shape();
  s.moveTo(-r,0);s.lineTo(-r,hRect);
  for(let i=0;i<=26;i++){const t=-1+2*i/26;s.lineTo(t*r,hRect+rise*(1-t*t));}
  s.lineTo(r,0);s.closePath();return s;
}
// janela OGIVAL (topo em ponta), alta e estreita, moldura clara, vidro azul, divisões.
function lancetWindow(w,h){
  const g=new THREE.Group(),r=w/2,tip=w*1.05,ft=0.05;
  const body=new THREE.Mesh(new THREE.PlaneGeometry(w,h),glassM);body.position.y=h/2;g.add(body);
  const sh=new THREE.Shape();sh.moveTo(-r,0);sh.quadraticCurveTo(-r,tip*0.62,0,tip);sh.quadraticCurveTo(r,tip*0.62,r,0);sh.closePath();
  const top=new THREE.Mesh(new THREE.ShapeGeometry(sh),glassM);top.position.y=h;g.add(top);
  for(const sx of[-1,1]){const j=new THREE.Mesh(new THREE.BoxGeometry(ft,h,.1),whiteM);j.position.set(sx*(r+ft/2),h/2,.04);g.add(j);
    const rl=Math.hypot(r,tip);const rk=new THREE.Mesh(new THREE.BoxGeometry(ft,rl,.08),whiteM);rk.position.set(sx*r/2,h+tip/2,.04);rk.rotation.z=sx*Math.atan2(r,tip);g.add(rk);}
  const sill=new THREE.Mesh(new THREE.BoxGeometry(w+ft*2,ft*1.2,.12),whiteM);sill.position.set(0,0,.05);g.add(sill);
  for(let k=1;k<4;k++){const tr=new THREE.Mesh(new THREE.BoxGeometry(w,ft*0.6,.06),whiteM);tr.position.set(0,h*k/4,.03);g.add(tr);}
  return g;
}
const band=(cx,cy,w,th,z,d=.2,m=moldM)=>{const b=new THREE.Mesh(new THREE.BoxGeometry(w,th,d),m);b.position.set(cx,cy,z);return b;};

function build(){
  const g=new THREE.Group();
  const baseY=.7, Fz=5.5;                         // plataforma mais alta (elevação do terreno)
  const W=8.0, D=11, NH=6.6, ncx=0.7;             // nave (à direita)
  const TW=1.55, TD=1.55, TH=15.5, tcx=-4.1;      // torre ESBELTÍSSIMA (~10x a largura), dominante

  // ---------- plataforma elevada + ESCADARIA larga + corrimão ----------
  const plat=new THREE.Mesh(new THREE.BoxGeometry(12.6,baseY,D+1.8),stoneM);
  plat.position.set(-0.1,baseY/2,0);plat.receiveShadow=true;g.add(plat);
  for(let s=0;s<5;s++){const step=new THREE.Mesh(new THREE.BoxGeometry(4.6-s*.45,.16,.55),stoneM);
    step.position.set(ncx,.08+s*.14,Fz+1.7-s*.34);step.receiveShadow=true;g.add(step);}
  for(const sx of[-1,1]){const hr=new THREE.Mesh(new THREE.BoxGeometry(.1,.8,2.0),metalM);hr.position.set(ncx+sx*2.1,baseY+.4,Fz+.9);g.add(hr);}

  // ---------- NAVE ----------
  const nave=new THREE.Mesh(new THREE.BoxGeometry(W,NH,D),wallM);
  nave.position.set(ncx,baseY+NH/2,0);nave.castShadow=true;nave.receiveShadow=true;g.add(nave);
  // telhado FINO e elegante (águas finas, beiral discreto)
  const RISE=2.0,OVER=.4,roofY=baseY+NH,half=W/2+OVER,slope=Math.hypot(half,RISE),rang=Math.atan2(RISE,half);
  for(const s of[-1,1]){const pane=new THREE.Mesh(new THREE.BoxGeometry(slope,.16,D+OVER*2),roofM);
    pane.position.set(ncx+s*half/2,roofY+RISE/2,0);pane.rotation.z=-s*rang;pane.castShadow=true;g.add(pane);}
  const ridge=new THREE.Mesh(new THREE.BoxGeometry(.18,.18,D+OVER*2),roofM);ridge.position.set(ncx,roofY+RISE,0);g.add(ridge);
  // frontão fino com contorno salmão + cruz pequena
  const gRise=2.1,cy=baseY+NH-0.05;
  const tri=(w,r)=>{const sh=new THREE.Shape();sh.moveTo(-w/2,0);sh.lineTo(w/2,0);sh.lineTo(0,r);sh.closePath();return sh;};
  const gBack=new THREE.Mesh(new THREE.ShapeGeometry(tri(W+.3,gRise+.22)),moldM);gBack.position.set(ncx,cy,Fz+.06);g.add(gBack);
  const gFront=new THREE.Mesh(new THREE.ShapeGeometry(tri(W,gRise)),wallM);gFront.position.set(ncx,cy,Fz+.12);g.add(gFront);
  const ncv=new THREE.Mesh(new THREE.BoxGeometry(.07,.46,.07),whiteM);ncv.position.set(ncx,cy+gRise+.22,Fz+.14);g.add(ncv);
  const nch=new THREE.Mesh(new THREE.BoxGeometry(.26,.07,.07),whiteM);nch.position.set(ncx,cy+gRise+.3,Fz+.14);g.add(nch);
  g.add(band(ncx,baseY+.3,W+.1,.56,Fz+.1,.22));    // faixa salmão da base

  // ---------- FACHADA EM CAMADAS (profundidade) ----------
  const aw=6.0, aRect=1.0, ar=aw/2, aBase=baseY+0.7, rise=4.0, aTop=aRect+rise; // arco alto e estreito
  const recess=new THREE.Mesh(new THREE.ShapeGeometry(parabolicArch(aw-.1,aRect,rise)),darkM);
  recess.position.set(ncx,aBase,Fz+.04);g.add(recess);
  // COBOGÓ bem DENSO (centenas de quadradinhos pequenos)
  const cell=0.20, czf=Fz+.12;
  for(let gx=-ar+0.13;gx<=ar-0.13;gx+=cell)for(let gy=0.16;gy<aTop-0.08;gy+=cell){
    let mx; if(gy<=aRect)mx=ar-0.14; else {const u=1-(gy-aRect)/rise; if(u<=0)continue; mx=ar*Math.sqrt(u)-0.12;}
    if(Math.abs(gx)>mx)continue;
    const tile=new THREE.Mesh(new THREE.BoxGeometry(cell*0.66,cell*0.66,.05),latM);
    tile.position.set(ncx+gx,aBase+gy,czf);g.add(tile);
  }
  // moldura salmão do arco AVANÇADA (relevo forte) — jambas + curva parabólica
  const zArch=Fz+.36;
  for(const sx of[-1,1]){const jamb=new THREE.Mesh(new THREE.BoxGeometry(.34,aRect,.44),moldM);jamb.position.set(ncx+sx*ar,aBase+aRect/2,zArch-.12);g.add(jamb);}
  {let px=-ar,py=aRect;for(let i=1;i<=28;i++){const t=-1+2*i/28,x=t*ar,y=aRect+rise*(1-t*t);
    const len=Math.hypot(x-px,y-py);const seg=new THREE.Mesh(new THREE.BoxGeometry(len,.32,.44),moldM);
    seg.position.set(ncx+(x+px)/2,aBase+(y+py)/2,zArch-.12);seg.rotation.z=Math.atan2(y-py,x-px);g.add(seg);px=x;py=y;}}
  // VARANDA saliente (laje + guarda-corpo) + porta branca atrás (sombra embaixo)
  const balY=aBase+aTop*0.46;
  const slab=new THREE.Mesh(new THREE.BoxGeometry(2.7,.2,.75),moldM);slab.position.set(ncx,balY,Fz+.55);slab.castShadow=true;g.add(slab);
  const slabU=new THREE.Mesh(new THREE.BoxGeometry(2.7,.12,.7),darkM);slabU.position.set(ncx,balY-.16,Fz+.52);g.add(slabU);
  for(let bx=-1.15;bx<=1.15;bx+=0.26){const bal=new THREE.Mesh(new THREE.BoxGeometry(.05,.32,.05),whiteM);bal.position.set(ncx+bx,balY+.26,Fz+.72);g.add(bal);}
  const brail=new THREE.Mesh(new THREE.BoxGeometry(2.5,.07,.1),moldM);brail.position.set(ncx,balY+.44,Fz+.72);g.add(brail);
  const pbF=new THREE.Mesh(new THREE.BoxGeometry(1.4,1.4,.05),moldM);pbF.position.set(ncx,balY+0.95,Fz+.18);g.add(pbF);
  const pb=new THREE.Mesh(new THREE.BoxGeometry(1.2,1.2,.06),whiteM);pb.position.set(ncx,balY+0.95,Fz+.2);g.add(pb);
  for(let k=0;k<5;k++){const sl=new THREE.Mesh(new THREE.BoxGeometry(1.08,.06,.05),glassM);sl.position.set(ncx,balY+0.55+k*0.2,Fz+.22);g.add(sl);}

  // ---------- ENTRADA RECUADA sob a varanda (sombra profunda) ----------
  const ptW=1.8,ptH=2.5;
  const portal=new THREE.Mesh(new THREE.BoxGeometry(ptW,ptH,.04),darkM);portal.position.set(ncx,baseY+ptH/2,Fz+.06);g.add(portal);
  for(const sx of[-1,1]){const pj=new THREE.Mesh(new THREE.BoxGeometry(.22,ptH,.5),moldM);pj.position.set(ncx+sx*(ptW/2+.06),baseY+ptH/2,Fz+.3);g.add(pj);}
  const plintel=new THREE.Mesh(new THREE.BoxGeometry(ptW+.6,.3,.5),moldM);plintel.position.set(ncx,baseY+ptH+.02,Fz+.3);g.add(plintel);
  for(const sx of[-1,1]){const leaf=new THREE.Mesh(new THREE.BoxGeometry(.74,2.1,.08),doorM);leaf.position.set(ncx+sx*.4,baseY+1.05,Fz+.1);g.add(leaf);}

  // ---------- janelas laterais OGIVAIS altas e estreitas ----------
  for(const sx of[-1,1])for(const dz of[-3.4,-1.2,1.2,3.4]){
    const win=lancetWindow(.32,3.4);win.position.set(ncx+sx*(W/2+.04),baseY+1.2,dz);
    win.rotation.y=sx>0?-Math.PI/2:Math.PI/2;g.add(win);
  }

  // ---------- TORRE ESBELTÍSSIMA ----------
  const tower=new THREE.Mesh(new THREE.BoxGeometry(TW,TH,TD),wallM);
  tower.position.set(tcx,baseY+TH/2,Fz-TD/2);tower.castShadow=true;tower.receiveShadow=true;g.add(tower);
  const tFz=Fz+.01;
  for(const sx of[-1,1])for(const sz of[-1,1]){const pil=new THREE.Mesh(new THREE.BoxGeometry(.22,TH,.22),moldM);
    pil.position.set(tcx+sx*(TW/2-.01),baseY+TH/2,(Fz-TD/2)+sz*(TD/2-.01));g.add(pil);}
  for(const by of[baseY+0.5,baseY+7.4,baseY+11.2]) g.add(band(tcx,by,TW+.04,.16,tFz,.14));
  // janelas OGIVAIS (sem relógio): nível A (altíssimas) + nível B
  for(const sx of[-1,1]){const win=lancetWindow(.3,5.4);win.position.set(tcx+sx*.3,baseY+1.6,tFz);g.add(win);}
  for(const sx of[-1,1]){const win=lancetWindow(.28,2.6);win.position.set(tcx+sx*.3,baseY+7.9,tFz);g.add(win);}
  // TOPO: volume quadrado com PAINÉIS VAZADOS avermelhados nas faces + cobertura quase plana
  const vt0=baseY+11.7, vt1=baseY+TH-.25, vh=vt1-vt0, vtc=(vt0+vt1)/2;
  for(const[ox,oz,ry]of[[0,1,0],[1,0,Math.PI/2],[-1,0,Math.PI/2]]){
    const fx=tcx+ox*(TW/2+.015), fzp=(Fz-TD/2)+oz*(TD/2+.015);
    // painel AVERMELHADO (não preto) com pequenos VAZADOS escuros numa grade densa
    const back=new THREE.Mesh(new THREE.BoxGeometry(TW-.28,vh,.04),latM);back.position.set(fx,vtc,fzp);back.rotation.y=ry;g.add(back);
    const rows=Math.max(5,Math.round(vh/0.3));
    for(let c=-1;c<=1;c++)for(let r2=0;r2<rows;r2++){const hole=new THREE.Mesh(new THREE.BoxGeometry(.12,.12,.06),darkM);
      const lx=c*0.32, ly=vt0+0.2+r2*(vh-0.4)/(rows-1);
      hole.position.set(fx+(ry?0:lx),ly,fzp+(ry?lx:0));hole.rotation.y=ry;g.add(hole);}
    for(const yy of[vt0,vt1]){const fr=new THREE.Mesh(new THREE.BoxGeometry(TW+.04,.14,.08),moldM);fr.position.set(fx,yy,fzp);fr.rotation.y=ry;g.add(fr);}
  }
  // cobertura QUASE PLANA (laje branca saliente + leve volume) — sem pirâmide
  const cap=new THREE.Mesh(new THREE.BoxGeometry(TW+.55,.28,TD+.55),whiteM);cap.position.set(tcx,baseY+TH+.1,Fz-TD/2);g.add(cap);
  const cap2=new THREE.Mesh(new THREE.BoxGeometry(TW+.15,.22,TD+.15),roofM);cap2.position.set(tcx,baseY+TH+.34,Fz-TD/2);g.add(cap2);
  // ornamentos metálicos finos nos 4 cantos
  for(const sx of[-1,1])for(const sz of[-1,1]){
    const orn=new THREE.Mesh(new THREE.CylinderGeometry(.022,.022,.75,6),metalM);orn.position.set(tcx+sx*(TW/2+.16),baseY+TH+.6,(Fz-TD/2)+sz*(TD/2+.16));g.add(orn);
    const kn=new THREE.Mesh(new THREE.SphereGeometry(.05,8,6),metalM);kn.position.set(tcx+sx*(TW/2+.16),baseY+TH+1.0,(Fz-TD/2)+sz*(TD/2+.16));g.add(kn);}
  // cruz PEQUENA no centro do topo
  const cv=new THREE.Mesh(new THREE.BoxGeometry(.08,.7,.08),crossM);cv.position.set(tcx,baseY+TH+.85,Fz-TD/2);g.add(cv);
  const ch=new THREE.Mesh(new THREE.BoxGeometry(.32,.08,.08),crossM);ch.position.set(tcx,baseY+TH+.95,Fz-TD/2);g.add(ch);

  // ---------- cerca BRANCA leve na frente ----------
  const fz2=Fz+2.1, fbtm=baseY+.05, fH=0.85;
  for(const hy of[fbtm+.1,fbtm+fH]){const rail=new THREE.Mesh(new THREE.BoxGeometry(12.0,.05,.05),metalM);rail.position.set(-0.1,hy,fz2);g.add(rail);}
  for(let fx=-5.9;fx<=5.7;fx+=0.22){if(Math.abs(fx-ncx)<1.3)continue; const bar=new THREE.Mesh(new THREE.BoxGeometry(.04,fH,.04),metalM);bar.position.set(fx,fbtm+fH/2+.1,fz2);g.add(bar);}
  for(let fx=-5.9;fx<=5.7;fx+=1.2){const post=new THREE.Mesh(new THREE.BoxGeometry(.1,fH+.28,.1),metalM);post.position.set(fx,fbtm+(fH+.28)/2,fz2);g.add(post);}

  // ---------- cipreste estreito e alto + imagem religiosa azul ----------
  const trunk=new THREE.Mesh(new THREE.CylinderGeometry(.1,.14,1.0,8),doorM);trunk.position.set(ncx+W/2+0.9,baseY+.5,1.4);g.add(trunk);
  const cyp=new THREE.Mesh(new THREE.ConeGeometry(.62,8.4,10),treeM);cyp.position.set(ncx+W/2+0.9,baseY+4.6,1.4);cyp.castShadow=true;g.add(cyp);
  const ped=new THREE.Mesh(new THREE.BoxGeometry(.5,.5,.5),stoneM);ped.position.set(tcx+TW/2+0.9,baseY+.25,Fz-0.1);g.add(ped);
  const stat=new THREE.Mesh(new THREE.CylinderGeometry(.12,.18,1.1,8),statueM);stat.position.set(tcx+TW/2+0.9,baseY+1.05,Fz-0.1);g.add(stat);
  const shd=new THREE.Mesh(new THREE.SphereGeometry(.16,10,8),statueM);shd.position.set(tcx+TW/2+0.9,baseY+1.65,Fz-0.1);g.add(shd);

  g.userData.r=Math.max(W,TH)/2+.6;g.userData.h=baseY+TH+1.5;
  return g;
}

export default {category:'Rural',label:'Igreja do Divino Espírito Santo',build};

export function addIgrejaDivino(cx,cz,ry=0){
  const g=build();g.position.set(cx,-.02,cz);g.rotation.y=ry;bakeProp(g);
  return{x0:cx-5.6,x1:cx+5.8,z0:cz-6.2,z1:cz+6.2,h:g.userData.h};
}
