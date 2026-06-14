import * as THREE from 'three';
import {scene} from '../../../js/engine.js';
import {makeDoorArrow} from '../city/door-arrow.js';

// Casa de campo COMPRÁVEL (safehouse estilo GTA), no mesmo molde dos demais
// interiores (boate/academia/hospital/presídio): fachada no mapa + ambiente
// interno a ~600m num Group visible=false. Diferenças (ver js/property.js):
//   - só ABRE depois de comprada (placa FOR SALE na frente);
//   - dentro tem uma geladeira com comida que cura a vida;
//   - tem uma GARAGEM ao lado pra guardar um carro, que volta salvo até depois
//     de fechar o jogo (localStorage).

// ----- fachada: casa + garagem perto da montanha, no fim da zona rural -----
export const RANCH_CX=420, RANCH_CZ=-80;        // centro do corpo da casa, longe da cidade
export const RANCH_DOOR={x:420,z:-85.5};        // porta da frente (face norte): entra ao encostar
export const RANCH_SPAWN_OUT={x:420,z:-88};     // onde o jogador nasce ao sair pro quintal
export const RANCH_SALE={x:420,z:-88};          // placa FOR SALE / gatilho de compra
export const GARAGE_PAD={x:409,z:-80};          // vaga dentro da garagem (carro salvo fica aqui)

// ----- interior: sala a ~600m do mapa (z=80 fica livre entre boate(-22) e hospital(180)) -----
export const INT_CENTER={x:-800,z:80};
export const INT_DOOR={x:-807.4,z:80};          // porta de saída (parede oeste)
export const INT_SPAWN={x:-805.8,z:80};         // nasce ao lado da porta, olhando pra dentro (+x)
export const INT_BOUNDS={x0:-807.6,x1:-792.4,z0:74.4,z1:85.6,y1:4.0};
export const FOOD={x:-793,z:77};                // comida da geladeira: cura quem come
export const TV={x:INT_CENTER.x-5,z:INT_CENTER.z+1.2,y:1.2}; // tela da TV da sala
export const HOUSE_PRICE=1;                      // preço da casa (1 dólar pra teste; js/property.js importa)

const wallM=new THREE.MeshStandardMaterial({color:0xf3ecd8,roughness:.95});      // tábuas claras (lambris)
const roofM=new THREE.MeshStandardMaterial({color:0x7c3b2c,roughness:.85});      // telha de barro escura
const trimM=new THREE.MeshStandardMaterial({color:0x5e3c24,roughness:.8});       // madeira escura (vigas)
const sidingM=new THREE.MeshStandardMaterial({color:0xd8ccb2,roughness:.9});     // linhas do lambril
const whiteM=new THREE.MeshStandardMaterial({color:0xfbfaf4,roughness:.7});      // acabamento branco (quinas/janelas)
const woodDoorM=new THREE.MeshStandardMaterial({color:0x6e4a32,roughness:.85});
const winM=new THREE.MeshStandardMaterial({color:0xbfe0ef,roughness:.25,metalness:.3,side:THREE.DoubleSide});
const shutterM=new THREE.MeshStandardMaterial({color:0x4a7a52,roughness:.85});   // venezianas verdes
const brickM=new THREE.MeshStandardMaterial({color:0x9a4b3a,roughness:.95});     // chaminé de tijolo
const metalM=new THREE.MeshStandardMaterial({color:0xb8bec6,roughness:.45,metalness:.6});
const concreteM=new THREE.MeshStandardMaterial({color:0x8d8f93,roughness:1});
const flowerM=new THREE.MeshStandardMaterial({color:0xdb4d68,roughness:.75});
const leafAccentM=new THREE.MeshStandardMaterial({color:0x3f8e4d,roughness:.85});
const warmLampM=new THREE.MeshBasicMaterial({color:0xffd37a});

export const ranchFx={facade:null,facadeArrow:null,footprint:null,
  exitArrow:null,saleSign:null,soldSign:null,food:null,tv:null};
export const ranchInterior=new THREE.Group();
ranchInterior.visible=false;

// placa FOR SALE pintada num canvas (some depois da compra)
function saleTexture(sold){
  const c=document.createElement('canvas');c.width=256;c.height=256;
  const x=c.getContext('2d');
  x.fillStyle=sold?'#244d2a':'#7a2230';x.fillRect(0,0,256,256);
  x.fillStyle='#f4ecd8';x.fillRect(10,10,236,236);
  x.fillStyle=sold?'#244d2a':'#7a2230';
  x.textAlign='center';x.textBaseline='middle';
  if(sold){
    x.font='900 70px monospace';x.fillText('SOLD',128,128);
  }else{
    x.font='900 52px monospace';x.fillText('FOR',128,70);x.fillText('SALE',128,128);
    x.font='900 40px monospace';x.fillText('$'+HOUSE_PRICE,128,190);
  }
  const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return t;
}

// Placa de quintal: dois postes nas laterais e caixilho vazado. A tábua é
// desenhada dos dois lados, então o texto aparece chegando de qualquer direção.
function makeSign(sold){
  const g=new THREE.Group();
  for(const sx of[-.85,.85]){
    const post=new THREE.Mesh(new THREE.BoxGeometry(.12,2.3,.12),trimM);
    post.position.set(sx,1.15,0);g.add(post);
  }
  for(const[x,y,w,h]of[
    [0,2.45,1.9,.12],[0,.75,1.9,.12],[-.85,1.6,.12,1.7],[.85,1.6,.12,1.7]
  ]){
    const bar=new THREE.Mesh(new THREE.BoxGeometry(w,h,.12),trimM);
    bar.position.set(x,y,0);g.add(bar);
  }
  const tex=saleTexture(sold);
  for(const[z,ry,flip]of[[.08,0,1],[-.08,Math.PI,-1]]){
    const board=new THREE.Mesh(new THREE.PlaneGeometry(1.58,1.58),
      new THREE.MeshBasicMaterial({map:tex,side:THREE.DoubleSide}));
    board.position.set(0,1.6,z);board.rotation.y=ry;board.scale.x=flip;g.add(board);
  }
  return g;
}

// ----- mobília simples do interior -----
function makeFridge(){
  const g=new THREE.Group();
  const body=new THREE.Mesh(new THREE.BoxGeometry(1.1,2.2,1),
    new THREE.MeshStandardMaterial({color:0xd9dde2,roughness:.4,metalness:.4}));
  body.position.y=1.1;g.add(body);
  // duas portas com puxadores cromados
  for(const[y,h]of[[1.6,1.1],[.55,.95]]){
    const door=new THREE.Mesh(new THREE.BoxGeometry(1.06,h-.06,.06),
      new THREE.MeshStandardMaterial({color:0xeef1f4,roughness:.35,metalness:.5}));
    door.position.set(0,y,.5);g.add(door);
    const handle=new THREE.Mesh(new THREE.BoxGeometry(.05,h*.6,.05),metalM);
    handle.position.set(-.42,y,.56);g.add(handle);
  }
  return g;
}
// comida (prato + sanduíche) que flutua e gira (animada por js/property.js)
function makeFood(){
  const g=new THREE.Group();
  const plate=new THREE.Mesh(new THREE.CylinderGeometry(.32,.28,.05,16),
    new THREE.MeshStandardMaterial({color:0xf4f4f0,roughness:.5}));
  g.add(plate);
  const bun=new THREE.MeshStandardMaterial({color:0xd9a14e,roughness:.8});
  const bot=new THREE.Mesh(new THREE.CylinderGeometry(.2,.2,.07,14),bun);bot.position.y=.07;g.add(bot);
  const patty=new THREE.Mesh(new THREE.CylinderGeometry(.21,.21,.06,14),
    new THREE.MeshStandardMaterial({color:0x5a3826,roughness:.9}));patty.position.y=.13;g.add(patty);
  const sal=new THREE.Mesh(new THREE.CylinderGeometry(.23,.23,.03,14),
    new THREE.MeshStandardMaterial({color:0x4caf50,roughness:.8}));sal.position.y=.17;g.add(sal);
  const top=new THREE.Mesh(new THREE.SphereGeometry(.2,14,8,0,Math.PI*2,0,Math.PI/2),bun);
  top.position.y=.19;g.add(top);
  return g;
}
function makeSofa(){
  const g=new THREE.Group();
  const m=new THREE.MeshStandardMaterial({color:0x4a6a8a,roughness:.9});
  const base=new THREE.Mesh(new THREE.BoxGeometry(2.6,.5,1),m);base.position.y=.35;g.add(base);
  const back=new THREE.Mesh(new THREE.BoxGeometry(2.6,.8,.25),m);back.position.set(0,.75,-.45);g.add(back);
  for(const sx of[-1.25,1.25]){
    const arm=new THREE.Mesh(new THREE.BoxGeometry(.25,.6,1),m);arm.position.set(sx,.55,0);g.add(arm);
  }
  for(const sx of[-.45,.45]){
    const pillow=new THREE.Mesh(new THREE.BoxGeometry(.55,.28,.16),
      new THREE.MeshStandardMaterial({color:sx<0?0xf0c15d:0xce6f7b,roughness:.9}));
    pillow.position.set(sx,.78,-.28);g.add(pillow);
  }
  return g;
}
function makeTv(){
  const g=new THREE.Group();
  const stand=new THREE.Mesh(new THREE.BoxGeometry(1.6,.5,.5),trimM);stand.position.y=.25;g.add(stand);
  const frame=new THREE.Mesh(new THREE.BoxGeometry(1.7,1,.12),
    new THREE.MeshStandardMaterial({color:0x14161c,roughness:.5}));frame.position.y=1.2;g.add(frame);
  const screen=new THREE.Mesh(new THREE.PlaneGeometry(1.5,.82),
    new THREE.MeshBasicMaterial({color:0x2b5fae}));screen.position.set(0,1.2,.07);g.add(screen);
  ranchFx.tv=screen;
  return g;
}
function makeBed(){
  const g=new THREE.Group();
  const frame=new THREE.Mesh(new THREE.BoxGeometry(2,.4,3),trimM);frame.position.y=.2;g.add(frame);
  const mat=new THREE.Mesh(new THREE.BoxGeometry(1.9,.25,2.9),
    new THREE.MeshStandardMaterial({color:0xe7e2d6,roughness:.8}));mat.position.y=.5;g.add(mat);
  const blanket=new THREE.Mesh(new THREE.BoxGeometry(1.92,.12,1.8),
    new THREE.MeshStandardMaterial({color:0x39507a,roughness:.85}));blanket.position.set(0,.62,.5);g.add(blanket);
  const pillow=new THREE.Mesh(new THREE.BoxGeometry(1.6,.2,.5),
    new THREE.MeshStandardMaterial({color:0xf4f1ea,roughness:.8}));pillow.position.set(0,.62,-1.1);g.add(pillow);
  const headboard=new THREE.Mesh(new THREE.BoxGeometry(2.1,1,.18),trimM);
  headboard.position.set(0,.75,-1.48);g.add(headboard);
  return g;
}
function makeTable(){
  const g=new THREE.Group();
  const top=new THREE.Mesh(new THREE.BoxGeometry(1.4,.1,.9),woodDoorM);top.position.y=.75;g.add(top);
  for(const[sx,sz]of[[-.6,-.35],[.6,-.35],[-.6,.35],[.6,.35]]){
    const leg=new THREE.Mesh(new THREE.BoxGeometry(.1,.75,.1),woodDoorM);leg.position.set(sx,.37,sz);g.add(leg);
  }
  return g;
}

// monta tudo no mapa (chamado por js/world.js). Empurra colisões em `solids`.
export function addRanchHouse(solids){
  const cx=RANCH_CX,cz=RANCH_CZ;

  // ===== EXTERIOR: casa de fazenda tradicional (lambris claros, telhado de
  // duas águas, alpendre, chaminé, venezianas e quinas brancas) =====
  const W=12,H=4.6,D=10;               // largura(x), pé-direito, profundidade(z)
  const fz=cz-D/2;                     // face da frente (norte, z menor)
  // alicerce de pedra um pouco mais largo
  const base=new THREE.Mesh(new THREE.BoxGeometry(W+.5,.7,D+.5),concreteM);
  base.position.set(cx,.35,cz);base.receiveShadow=true;scene.add(base);
  // corpo de tábuas
  const body=new THREE.Mesh(new THREE.BoxGeometry(W,H,D),wallM);
  body.position.set(cx,.7+H/2,cz);body.castShadow=true;body.receiveShadow=true;scene.add(body);
  // Tudo que é detalhe preso na casa entra neste grupo. Interior.updateFacade()
  // esconde o grupo quando a câmera fica dentro da pegada da casa ao sair,
  // evitando porta/janelas/alpendre/telhado flutuando sobre a casa invisível.
  const facade=new THREE.Group();scene.add(facade);
  ranchFx.facade=facade;
  ranchFx.footprint={x0:cx-W/2-.4,x1:cx+W/2+.4,z0:cz-D/2-.4,z1:cz+D/2+.4};
  const eaveY=.7+H;                    // altura do beiral (topo da parede)
  // linhas finas de lambril: dão leitura de casa rural sem transformar a
  // fachada em uma caixa lisa.
  for(let y=1.15;y<eaveY-.25;y+=.42){
    for(const z of[fz-.08,cz+D/2+.08]){
      const strip=new THREE.Mesh(new THREE.BoxGeometry(W+.08,.035,.05),sidingM);
      strip.position.set(cx,y,z);facade.add(strip);
    }
    for(const x of[cx-W/2-.08,cx+W/2+.08]){
      const strip=new THREE.Mesh(new THREE.BoxGeometry(.05,.035,D+.08),sidingM);
      strip.position.set(x,y,cz);facade.add(strip);
    }
  }

  // ---- telhado de duas águas (cumeeira no eixo z, frontões à frente/atrás) ----
  const RISE=2.4, OVER=.6;            // altura da cumeeira acima do beiral, beiral saliente
  const half=W/2+OVER, slope=Math.hypot(half,RISE), ang=Math.atan2(RISE,half);
  for(const side of[-1,1]){
    const pane=new THREE.Mesh(new THREE.BoxGeometry(slope,.22,D+OVER*2),roofM);
    pane.position.set(cx+side*half/2,eaveY+RISE/2,cz);
    pane.rotation.z=-side*ang;        // +x para baixo no lado direito; sobe até a cumeeira
    pane.castShadow=true;facade.add(pane);
  }
  // frontões triangulares (fecham o vão sob o telhado, frente e fundo)
  const gable=new THREE.Shape();
  gable.moveTo(-W/2,0);gable.lineTo(W/2,0);gable.lineTo(0,RISE);gable.closePath();
  const gableGeo=new THREE.ShapeGeometry(gable);
  for(const[z,ry]of[[cz-D/2,Math.PI],[cz+D/2,0]]){
    const tri=new THREE.Mesh(gableGeo,wallM);
    tri.position.set(cx,eaveY,z);tri.rotation.y=ry;facade.add(tri);
  }
  const attic=new THREE.Group();
  const atticGlass=new THREE.Mesh(new THREE.CircleGeometry(.42,18),winM);
  atticGlass.position.z=.04;attic.add(atticGlass);
  const atticFrame=new THREE.Mesh(new THREE.TorusGeometry(.46,.045,8,18),whiteM);
  atticFrame.position.z=.07;attic.add(atticFrame);
  attic.position.set(cx,eaveY+1.02,fz-.1);facade.add(attic);
  // tábua de cumeeira escura
  const ridge=new THREE.Mesh(new THREE.BoxGeometry(.18,.18,D+OVER*2),trimM);
  ridge.position.set(cx,eaveY+RISE,cz);facade.add(ridge);

  // ---- chaminé de tijolo numa das águas ----
  const chim=new THREE.Mesh(new THREE.BoxGeometry(1,2.6,1),brickM);
  chim.position.set(cx+3.2,eaveY+1.4,cz+2.5);chim.castShadow=true;facade.add(chim);
  const chimCap=new THREE.Mesh(new THREE.BoxGeometry(1.2,.2,1.2),trimM);
  chimCap.position.set(cx+3.2,eaveY+2.7,cz+2.5);facade.add(chimCap);

  // ---- quinas brancas (cantos verticais) e faixa do beiral ----
  for(const sx of[-1,1])for(const sz of[-1,1]){
    const corner=new THREE.Mesh(new THREE.BoxGeometry(.22,H,.22),whiteM);
    corner.position.set(cx+sx*(W/2-.02),.7+H/2,cz+sz*(D/2-.02));facade.add(corner);
  }
  const fascia=new THREE.Mesh(new THREE.BoxGeometry(W+.1,.2,D+.1),whiteM);
  fascia.position.set(cx,eaveY+.02,cz);facade.add(fascia);

  // ---- porta da frente com moldura e dois degraus ----
  const door=new THREE.Mesh(new THREE.BoxGeometry(1.1,2.4,.14),woodDoorM);
  door.position.set(cx,.7+1.2,fz-.02);facade.add(door);
  for(const[ox,oy,w,h]of[[-.72,1.35,.12,2.72],[.72,1.35,.12,2.72],[0,2.72,1.56,.12]]){
    const dframe=new THREE.Mesh(new THREE.BoxGeometry(w,h,.12),whiteM);
    dframe.position.set(cx+ox,.7+oy,fz-.11);facade.add(dframe);
  }
  const knob=new THREE.Mesh(new THREE.SphereGeometry(.09,10,8),metalM);
  knob.position.set(cx+.36,.7+1.15,fz-.15);facade.add(knob);
  const lantern=new THREE.Mesh(new THREE.SphereGeometry(.13,10,8),warmLampM);
  lantern.position.set(cx-1.0,.7+2.25,fz-.18);facade.add(lantern);
  const lanternCap=new THREE.Mesh(new THREE.BoxGeometry(.22,.08,.12),metalM);
  lanternCap.position.set(cx-1.0,.7+2.43,fz-.18);facade.add(lanternCap);
  for(let s=0;s<2;s++){
    const step=new THREE.Mesh(new THREE.BoxGeometry(2.2-s*.6,.22,.5-s*.0),concreteM);
    step.position.set(cx,.22+s*.24,fz-.55-s*.45);facade.add(step);
  }

  // ---- janelas com moldura branca, cruzeta e venezianas verdes ----
  const addWindow=(wx,wz,ry)=>{
    const pane=new THREE.Mesh(new THREE.PlaneGeometry(1.18,1.05),winM);
    const barV=new THREE.Mesh(new THREE.BoxGeometry(.08,1.1,.07),whiteM);
    const barH=new THREE.Mesh(new THREE.BoxGeometry(1.2,.08,.07),whiteM);
    const g=new THREE.Group();
    pane.position.z=.055;g.add(pane);
    for(const[x,y,w,h]of[[-.68,0,.1,1.32],[.68,0,.1,1.32],[0,.66,1.46,.1],[0,-.66,1.46,.1]]){
      const fr=new THREE.Mesh(new THREE.BoxGeometry(w,h,.08),whiteM);
      fr.position.set(x,y,.075);g.add(fr);
    }
    barV.position.z=.06;barH.position.z=.06;g.add(barV,barH);
    for(const sx of[-.92,.92]){       // venezianas dos lados
      const sh=new THREE.Mesh(new THREE.BoxGeometry(.3,1.3,.08),shutterM);
      sh.position.set(sx,0,0);g.add(sh);
    }
    const box=new THREE.Mesh(new THREE.BoxGeometry(1.35,.16,.22),trimM);
    box.position.set(0,-.88,.12);g.add(box);
    for(const sx of[-.42,0,.42]){
      const fl=new THREE.Mesh(new THREE.SphereGeometry(.08,8,6),flowerM);
      fl.position.set(sx,-.78,.24);g.add(fl);
      const lf=new THREE.Mesh(new THREE.SphereGeometry(.07,8,6),leafAccentM);
      lf.position.set(sx+.08,-.86,.23);g.add(lf);
    }
    g.position.set(wx,.7+2,wz);g.rotation.y=ry;facade.add(g);
  };
  addWindow(cx-3.4,fz-.02,Math.PI);addWindow(cx+3.4,fz-.02,Math.PI); // frente
  addWindow(cx-W/2+.02,cz-2.6,-Math.PI/2);                       // laterais
  addWindow(cx-W/2+.02,cz+2.6,-Math.PI/2);
  addWindow(cx+W/2-.02,cz+2.6,Math.PI/2);

  // ---- alpendre coberto na frente (assoalho, colunas, telhado e guarda-corpo) ----
  const pz=fz-2;                       // profundidade do alpendre pra fora
  const pfloor=new THREE.Mesh(new THREE.BoxGeometry(8,.2,2.4),trimM);
  pfloor.position.set(cx,.7,pz);pfloor.receiveShadow=true;facade.add(pfloor);
  for(const sx of[-3.4,3.4]){
    const col=new THREE.Mesh(new THREE.CylinderGeometry(.12,.14,2.75,10),whiteM);
    col.position.set(cx+sx,.7+1.375,fz-3);col.castShadow=true;facade.add(col);
    // guarda-corpo baixo entre a coluna e a borda
    const rail=new THREE.Mesh(new THREE.BoxGeometry(.1,.7,2.2),whiteM);
    rail.position.set(cx+sx,.7+.5,pz);facade.add(rail);
  }
  for(const sx of[-2.25,2.25]){
    const topRail=new THREE.Mesh(new THREE.BoxGeometry(2.2,.12,.12),whiteM);
    topRail.position.set(cx+sx,.7+1.0,fz-3.08);facade.add(topRail);
    const lowRail=new THREE.Mesh(new THREE.BoxGeometry(2.2,.08,.1),whiteM);
    lowRail.position.set(cx+sx,.7+.48,fz-3.08);facade.add(lowRail);
    for(const bx of[-.8,-.4,0,.4,.8]){
      const bal=new THREE.Mesh(new THREE.BoxGeometry(.07,.52,.08),whiteM);
      bal.position.set(cx+sx+bx,.7+.68,fz-3.08);facade.add(bal);
    }
  }
  const bench=new THREE.Mesh(new THREE.BoxGeometry(1.5,.18,.45),trimM);
  bench.position.set(cx+2.15,1.05,fz-2.25);facade.add(bench);
  for(const lx of[-.55,.55]){
    const leg=new THREE.Mesh(new THREE.BoxGeometry(.1,.45,.1),trimM);
    leg.position.set(cx+2.15+lx,.78,fz-2.25);facade.add(leg);
  }
  // telhadinho inclinado do alpendre
  const proof=new THREE.Mesh(new THREE.BoxGeometry(8.4,.16,3),roofM);
  proof.position.set(cx,.7+2.85,fz-1.55);proof.rotation.x=-.26;proof.castShadow=true;facade.add(proof);
  const ledger=new THREE.Mesh(new THREE.BoxGeometry(8.6,.22,.16),trimM);
  ledger.position.set(cx,.7+2.72,fz-.12);facade.add(ledger);
  const walk=new THREE.Mesh(new THREE.PlaneGeometry(2.4,3.2),concreteM);
  walk.rotation.x=-Math.PI/2;walk.position.set(cx,.035,fz-3.55);walk.receiveShadow=true;scene.add(walk);

  // garagem ao lado oeste (open front pro norte), centrada em (cx-11, cz)
  const gx=GARAGE_PAD.x,gz=GARAGE_PAD.z;
  const gWall=new THREE.MeshStandardMaterial({color:0xe7d9bb,roughness:.95});
  // três paredes (fundo + duas laterais), frente aberta pro carro entrar
  const back=new THREE.Mesh(new THREE.BoxGeometry(6,3.4,.3),gWall);
  back.position.set(gx,1.7,gz+3.5);back.castShadow=true;scene.add(back);
  for(const sx of[-3,3]){
    const sw=new THREE.Mesh(new THREE.BoxGeometry(.3,3.4,7),gWall);
    sw.position.set(gx+sx,1.7,gz);sw.castShadow=true;scene.add(sw);
  }
  // verga/lintel no topo da abertura + telhado da garagem
  const lintel=new THREE.Mesh(new THREE.BoxGeometry(6.6,.6,.6),trimM);
  lintel.position.set(gx,3.1,gz-3.5);scene.add(lintel);
  const gRoof=new THREE.Mesh(new THREE.BoxGeometry(7,.3,7.8),roofM);
  gRoof.position.set(gx,3.55,gz);gRoof.castShadow=true;scene.add(gRoof);
  // piso de concreto da garagem (marca a vaga)
  const slab=new THREE.Mesh(new THREE.PlaneGeometry(5.4,7),concreteM);
  slab.rotation.x=-Math.PI/2;slab.position.set(gx,.03,gz);slab.receiveShadow=true;scene.add(slab);

  // placa FOR SALE no quintal, bem onde o gatilho de compra fica (RANCH_SALE).
  // Depois da compra ela some por completo (js/property.js).
  ranchFx.saleSign=makeSign(false);
  ranchFx.saleSign.position.set(RANCH_SALE.x,0,RANCH_SALE.z);scene.add(ranchFx.saleSign);
  ranchFx.soldSign=null;
  // seta quicando na porta (só visível quando comprada — js/property.js)
  ranchFx.facadeArrow=makeDoorArrow();
  ranchFx.facadeArrow.position.set(cx,1.7,cz-6);ranchFx.facadeArrow.visible=false;facade.add(ranchFx.facadeArrow);

  // colisões: corpo da casa + três paredes da garagem (frente aberta)
  solids.push(
    {x0:cx-6,x1:cx+6,z0:cz-5,z1:cz+5,h:5.3},        // casa
    {x0:gx-3,x1:gx+3,z0:gz+3.35,z1:gz+3.65,h:3.4},  // fundo da garagem
    {x0:gx-3.15,x1:gx-2.85,z0:gz-3.5,z1:gz+3.5,h:3.4}, // lateral oeste
    {x0:gx+2.85,x1:gx+3.15,z0:gz-3.5,z1:gz+3.5,h:3.4}, // lateral leste
  );

  // ===== INTERIOR (sala a ~600m, no Group liga/desliga) =====
  const ix=INT_CENTER.x,iz=INT_CENTER.z;
  const shell=new THREE.Mesh(new THREE.BoxGeometry(16,4.4,12),
    new THREE.MeshStandardMaterial({color:0xe9ddc4,roughness:1,side:THREE.BackSide}));
  shell.position.set(ix,2.2,iz);ranchInterior.add(shell);
  const floor=new THREE.Mesh(new THREE.PlaneGeometry(15.6,11.6),
    new THREE.MeshStandardMaterial({color:0x9c7850,roughness:.85}));
  floor.rotation.x=-Math.PI/2;floor.position.set(ix,.02,iz);ranchInterior.add(floor);
  const ceil=new THREE.Mesh(new THREE.BoxGeometry(15.7,.08,11.7),
    new THREE.MeshStandardMaterial({color:0xf0e6d2,roughness:.95}));
  ceil.position.set(ix,4.36,iz);ranchInterior.add(ceil);
  // rodapés de madeira nas quatro paredes
  for(const[x,z,w,d]of[
    [ix,iz-5.92,15.6,.12],[ix,iz+5.92,15.6,.12],
    [ix-7.92,iz,.12,11.6],[ix+7.92,iz,.12,11.6],
  ]){
    const baseboard=new THREE.Mesh(new THREE.BoxGeometry(w,.16,d),trimM);
    baseboard.position.set(x,.18,z);ranchInterior.add(baseboard);
  }
  // backstop: se a câmera escapar da casca por um frame, vê escuridão
  const outer=new THREE.Mesh(new THREE.BoxGeometry(20,7,16),
    new THREE.MeshBasicMaterial({color:0x05060a,side:THREE.BackSide}));
  outer.position.set(ix,3.2,iz);ranchInterior.add(outer);

  // cozinha (canto nordeste): bancada + geladeira; a comida fica à frente
  const counter=new THREE.Mesh(new THREE.BoxGeometry(5,1,1),
    new THREE.MeshStandardMaterial({color:0xcdb594,roughness:.7}));
  counter.position.set(ix+3,.5,iz-5);ranchInterior.add(counter);
  const ctop=new THREE.Mesh(new THREE.BoxGeometry(5.2,.12,1.2),trimM);
  ctop.position.set(ix+3,1.06,iz-5);ranchInterior.add(ctop);
  for(const ox of[1.6,2.6,3.6,4.6]){
    const cab=new THREE.Mesh(new THREE.BoxGeometry(.8,.8,.22),woodDoorM);
    cab.position.set(ix+ox,2.55,iz-5.86);ranchInterior.add(cab);
    const pull=new THREE.Mesh(new THREE.BoxGeometry(.05,.32,.04),metalM);
    pull.position.set(ix+ox+.28,2.55,iz-5.72);ranchInterior.add(pull);
  }
  const sink=new THREE.Mesh(new THREE.BoxGeometry(.78,.08,.46),metalM);
  sink.position.set(ix+2.15,1.14,iz-4.92);ranchInterior.add(sink);
  const stove=new THREE.Mesh(new THREE.BoxGeometry(.9,.12,.58),
    new THREE.MeshStandardMaterial({color:0x232323,roughness:.45,metalness:.4}));
  stove.position.set(ix+3.45,1.16,iz-4.9);ranchInterior.add(stove);
  for(const dx of[-.22,.22])for(const dz of[-.13,.13]){
    const burner=new THREE.Mesh(new THREE.TorusGeometry(.1,.015,6,12),metalM);
    burner.rotation.x=Math.PI/2;burner.position.set(ix+3.45+dx,1.24,iz-4.9+dz);ranchInterior.add(burner);
  }
  const fridge=makeFridge();
  fridge.position.set(ix+7,0,iz-4.4);fridge.rotation.y=-Math.PI/2;ranchInterior.add(fridge);
  ranchFx.food=makeFood();
  ranchFx.food.position.set(FOOD.x,1.2,FOOD.z);ranchInterior.add(ranchFx.food);

  // sala de estar (sudoeste): sofá + mesa de centro + tapete + TV (divisória)
  const rug=new THREE.Mesh(new THREE.PlaneGeometry(3.2,2.4),
    new THREE.MeshStandardMaterial({color:0x7a3b3b,roughness:.95}));
  rug.rotation.x=-Math.PI/2;rug.position.set(ix-5,.03,iz+3);ranchInterior.add(rug);
  const sofa=makeSofa();sofa.position.set(ix-5,0,iz+5);sofa.rotation.y=Math.PI;ranchInterior.add(sofa); // encosto na parede sul, assento virado pra TV (norte)
  const ctable=makeTable();ctable.scale.set(.8,.6,.8);ctable.position.set(ix-5,0,iz+3.3);ranchInterior.add(ctable);
  const tv=makeTv();tv.position.set(TV.x,0,TV.z);ranchInterior.add(tv); // tela pro sul (sofá)
  const lampStand=new THREE.Mesh(new THREE.CylinderGeometry(.04,.04,1.05,8),metalM);
  lampStand.position.set(ix-2.9,.55,iz+4.7);ranchInterior.add(lampStand);
  const lampShade=new THREE.Mesh(new THREE.ConeGeometry(.34,.42,12),warmLampM);
  lampShade.position.set(ix-2.9,1.22,iz+4.7);ranchInterior.add(lampShade);

  // quarto (noroeste): cama encostada na parede norte
  const bed=makeBed();bed.position.set(ix-5,0,iz-4);ranchInterior.add(bed);
  const nightstand=makeTable();nightstand.scale.set(.38,.45,.38);
  nightstand.position.set(ix-2.9,0,iz-4.4);ranchInterior.add(nightstand);

  // copa (sudeste): mesa de jantar
  const dining=makeTable();dining.position.set(ix+5,0,iz+4);ranchInterior.add(dining);
  for(const[dx,dz,ry]of[[0,-.9,0],[0,.9,Math.PI],[-1,0,-Math.PI/2],[1,0,Math.PI/2]]){
    const chair=new THREE.Group();
    const seat=new THREE.Mesh(new THREE.BoxGeometry(.55,.12,.55),woodDoorM);seat.position.y=.48;chair.add(seat);
    const backC=new THREE.Mesh(new THREE.BoxGeometry(.55,.7,.1),woodDoorM);backC.position.set(0,.84,.27);chair.add(backC);
    for(const sx of[-.2,.2])for(const sz of[-.2,.2]){
      const leg=new THREE.Mesh(new THREE.BoxGeometry(.06,.48,.06),woodDoorM);
      leg.position.set(sx,.24,sz);chair.add(leg);
    }
    chair.position.set(ix+5+dx,0,iz+4+dz);chair.rotation.y=ry;ranchInterior.add(chair);
  }

  // quadros simples nas paredes para quebrar o visual de caixa vazia
  for(const[x,y,z,ry,col]of[
    [ix-1.8,2.35,iz+5.93,Math.PI,0x85a7c9],
    [ix+2.2,2.25,iz+5.93,Math.PI,0xd8995f],
    [ix-7.93,2.35,iz-2.0,Math.PI/2,0x8fbd7f],
  ]){
    const pic=new THREE.Group();
    const frame=new THREE.Mesh(new THREE.BoxGeometry(1.25,.86,.08),trimM);pic.add(frame);
    const art=new THREE.Mesh(new THREE.PlaneGeometry(1.05,.66),
      new THREE.MeshBasicMaterial({color:col}));
    art.position.z=.05;pic.add(art);
    pic.position.set(x,y,z);pic.rotation.y=ry;ranchInterior.add(pic);
  }

  // luz quente da sala (só existe com a casa visível)
  const light=new THREE.PointLight(0xffe6c0,55,40,1.6);
  light.position.set(ix,3.6,iz);ranchInterior.add(light);

  // porta de saída (parede oeste) + seta de saída (animada por js/interior.js)
  const exitDoor=new THREE.Mesh(new THREE.BoxGeometry(.16,2.8,1.4),woodDoorM);
  exitDoor.position.set(ix-7.95,1.4,iz);ranchInterior.add(exitDoor);
  ranchFx.exitArrow=makeDoorArrow();
  ranchFx.exitArrow.position.set(ix-7,1.7,iz);ranchInterior.add(ranchFx.exitArrow);

  scene.add(ranchInterior);

  // paredes sólidas do interior (o jogador não atravessa nem sai da sala a pé)
  solids.push(
    {x0:ix-8.3,x1:ix-7.95,z0:iz-6,z1:iz+6,h:4},   // oeste
    {x0:ix+7.95,x1:ix+8.3,z0:iz-6,z1:iz+6,h:4},   // leste
    {x0:ix-8,x1:ix+8,z0:iz-6.3,z1:iz-5.95,h:4},   // norte
    {x0:ix-8,x1:ix+8,z0:iz+5.95,z1:iz+6.3,h:4},   // sul
  );
}

// Padrão de modelo: descriptor pro model-viewer (descoberta automática).
// Preview fiel ao exterior: fundação, gable roof, varanda, janelas e garagem.
function buildExteriorPreview(){
  const g=new THREE.Group(),W=12,H=4.6,D=10,RISE=2.4,OVER=.6,fz=-D/2,eaveY=.7+H;
  const base=new THREE.Mesh(new THREE.BoxGeometry(W+.5,.7,D+.5),concreteM);
  base.position.y=.35;g.add(base);
  const body=new THREE.Mesh(new THREE.BoxGeometry(W,H,D),wallM);
  body.position.y=.7+H/2;g.add(body);
  for(let y=1.15;y<eaveY-.25;y+=.42){
    for(const z of[fz-.08,D/2+.08]){
      const strip=new THREE.Mesh(new THREE.BoxGeometry(W+.08,.035,.05),sidingM);
      strip.position.set(0,y,z);g.add(strip);
    }
  }
  const half=W/2+OVER,slope=Math.hypot(half,RISE),ang=Math.atan2(RISE,half);
  for(const s of[-1,1]){
    const p=new THREE.Mesh(new THREE.BoxGeometry(slope,.22,D+OVER*2),roofM);
    p.position.set(s*half/2,eaveY+RISE/2,0);p.rotation.z=-s*ang;g.add(p);
  }
  const gable=new THREE.Shape();
  gable.moveTo(-W/2,0);gable.lineTo(W/2,0);gable.lineTo(0,RISE);gable.closePath();
  for(const[z,ry]of[[-D/2,Math.PI],[D/2,0]]){
    const tri=new THREE.Mesh(new THREE.ShapeGeometry(gable),wallM);
    tri.position.set(0,eaveY,z);tri.rotation.y=ry;g.add(tri);
  }
  const ridge=new THREE.Mesh(new THREE.BoxGeometry(.18,.18,D+OVER*2),trimM);
  ridge.position.set(0,eaveY+RISE,0);g.add(ridge);
  const chim=new THREE.Mesh(new THREE.BoxGeometry(1,2.6,1),brickM);
  chim.position.set(3.2,eaveY+1.4,2.5);g.add(chim);
  const door=new THREE.Mesh(new THREE.BoxGeometry(1.1,2.4,.14),woodDoorM);
  door.position.set(0,.7+1.2,fz-.1);g.add(door);
  for(const[ox,oy,w,h]of[[-.72,1.35,.12,2.72],[.72,1.35,.12,2.72],[0,2.72,1.56,.12]]){
    const fr=new THREE.Mesh(new THREE.BoxGeometry(w,h,.12),whiteM);
    fr.position.set(ox,.7+oy,fz-.18);g.add(fr);
  }
  const addWin=x=>{
    const wg=new THREE.Group();
    const pane=new THREE.Mesh(new THREE.PlaneGeometry(1.18,1.05),winM);pane.position.z=.055;wg.add(pane);
    for(const[wx,wy,w,h]of[[-.68,0,.1,1.32],[.68,0,.1,1.32],[0,.66,1.46,.1],[0,-.66,1.46,.1]]){
      const fr=new THREE.Mesh(new THREE.BoxGeometry(w,h,.08),whiteM);fr.position.set(wx,wy,.075);wg.add(fr);
    }
    const shL=new THREE.Mesh(new THREE.BoxGeometry(.3,1.3,.08),shutterM);shL.position.x=-.92;wg.add(shL);
    const shR=new THREE.Mesh(new THREE.BoxGeometry(.3,1.3,.08),shutterM);shR.position.x=.92;wg.add(shR);
    wg.position.set(x,.7+2,fz-.02);wg.rotation.y=Math.PI;g.add(wg);
  };
  addWin(-3.4);addWin(3.4);
  const porch=new THREE.Mesh(new THREE.BoxGeometry(8,.2,2.4),trimM);
  porch.position.set(0,.7,fz-2);g.add(porch);
  for(const sx of[-3.4,3.4]){
    const col=new THREE.Mesh(new THREE.CylinderGeometry(.12,.14,2.75,10),whiteM);
    col.position.set(sx,2.075,fz-3);g.add(col);
  }
  const proof=new THREE.Mesh(new THREE.BoxGeometry(8.4,.16,3),roofM);
  proof.position.set(0,3.55,fz-1.55);proof.rotation.x=-.26;g.add(proof);
  const ledger=new THREE.Mesh(new THREE.BoxGeometry(8.6,.22,.16),trimM);
  ledger.position.set(0,3.42,fz-.12);g.add(ledger);
  const garage=new THREE.Group();
  for(const[sx,sz,w,d]of[[0,3.5,6,.3],[-3,0,.3,7],[3,0,.3,7]]){
    const wall=new THREE.Mesh(new THREE.BoxGeometry(w,3.4,d),wallM);
    wall.position.set(sx,1.7,sz);garage.add(wall);
  }
  const gr=new THREE.Mesh(new THREE.BoxGeometry(7,.3,7.8),roofM);
  gr.position.set(0,3.55,0);garage.add(gr);
  garage.position.set(-11,0,0);g.add(garage);
  return g;
}

// Preview do interior em corte aberto: mostra a sala sem depender da sala real
// off-map, e deixa o model-viewer girar sem paredes bloqueando tudo.
function buildInteriorPreview(){
  const g=new THREE.Group(),ix=0,iz=0;
  const floor=new THREE.Mesh(new THREE.PlaneGeometry(15.6,11.6),
    new THREE.MeshStandardMaterial({color:0x9c7850,roughness:.85}));
  floor.rotation.x=-Math.PI/2;floor.position.set(ix,.02,iz);g.add(floor);
  const wallMat=new THREE.MeshStandardMaterial({color:0xe9ddc4,roughness:1});
  for(const[x,z,w,d]of[
    [ix,iz-5.95,15.6,.18],
    [ix-7.9,iz,.18,11.6],
    [ix,iz+5.95,15.6,.18],
  ]){
    const wall=new THREE.Mesh(new THREE.BoxGeometry(w,3.6,d),wallMat);
    wall.position.set(x,1.8,z);g.add(wall);
  }
  for(const[x,z,w,d]of[
    [ix,iz-5.78,15.5,.12],
    [ix-7.78,iz,.12,11.3],
    [ix,iz+5.78,15.5,.12],
  ]){
    const baseboard=new THREE.Mesh(new THREE.BoxGeometry(w,.16,d),trimM);
    baseboard.position.set(x,.18,z);g.add(baseboard);
  }

  const counter=new THREE.Mesh(new THREE.BoxGeometry(5,1,1),
    new THREE.MeshStandardMaterial({color:0xcdb594,roughness:.7}));
  counter.position.set(ix+3,.5,iz-5);g.add(counter);
  const ctop=new THREE.Mesh(new THREE.BoxGeometry(5.2,.12,1.2),trimM);
  ctop.position.set(ix+3,1.06,iz-5);g.add(ctop);
  for(const ox of[1.6,2.6,3.6,4.6]){
    const cab=new THREE.Mesh(new THREE.BoxGeometry(.8,.8,.22),woodDoorM);
    cab.position.set(ix+ox,2.55,iz-5.86);g.add(cab);
  }
  const sink=new THREE.Mesh(new THREE.BoxGeometry(.78,.08,.46),metalM);
  sink.position.set(ix+2.15,1.14,iz-4.92);g.add(sink);
  const stove=new THREE.Mesh(new THREE.BoxGeometry(.9,.12,.58),
    new THREE.MeshStandardMaterial({color:0x232323,roughness:.45,metalness:.4}));
  stove.position.set(ix+3.45,1.16,iz-4.9);g.add(stove);
  const fridge=makeFridge();fridge.position.set(ix+7,0,iz-4.4);fridge.rotation.y=-Math.PI/2;g.add(fridge);
  const food=makeFood();food.position.set(FOOD.x-INT_CENTER.x,1.2,FOOD.z-INT_CENTER.z);g.add(food);

  const rug=new THREE.Mesh(new THREE.PlaneGeometry(3.2,2.4),
    new THREE.MeshStandardMaterial({color:0x7a3b3b,roughness:.95}));
  rug.rotation.x=-Math.PI/2;rug.position.set(ix-5,.03,iz+3);g.add(rug);
  const sofa=makeSofa();sofa.position.set(ix-5,0,iz+5);sofa.rotation.y=Math.PI;g.add(sofa);
  const ctable=makeTable();ctable.scale.set(.8,.6,.8);ctable.position.set(ix-5,0,iz+3.3);g.add(ctable);
  const tv=new THREE.Group();
  const tvStand=new THREE.Mesh(new THREE.BoxGeometry(1.6,.5,.5),trimM);tvStand.position.y=.25;tv.add(tvStand);
  const tvFrame=new THREE.Mesh(new THREE.BoxGeometry(1.7,1,.12),
    new THREE.MeshStandardMaterial({color:0x14161c,roughness:.5}));tvFrame.position.y=1.2;tv.add(tvFrame);
  const tvScreen=new THREE.Mesh(new THREE.PlaneGeometry(1.5,.82),
    new THREE.MeshBasicMaterial({color:0x2b5fae}));tvScreen.position.set(0,1.2,.07);tv.add(tvScreen);
  tv.position.set(ix-5,0,iz+1.2);g.add(tv);
  const lampStand=new THREE.Mesh(new THREE.CylinderGeometry(.04,.04,1.05,8),metalM);
  lampStand.position.set(ix-2.9,.55,iz+4.7);g.add(lampStand);
  const lampShade=new THREE.Mesh(new THREE.ConeGeometry(.34,.42,12),warmLampM);
  lampShade.position.set(ix-2.9,1.22,iz+4.7);g.add(lampShade);

  const bed=makeBed();bed.position.set(ix-5,0,iz-4);g.add(bed);
  const nightstand=makeTable();nightstand.scale.set(.38,.45,.38);
  nightstand.position.set(ix-2.9,0,iz-4.4);g.add(nightstand);

  const dining=makeTable();dining.position.set(ix+5,0,iz+4);g.add(dining);
  for(const[dx,dz,ry]of[[0,-.9,0],[0,.9,Math.PI],[-1,0,-Math.PI/2],[1,0,Math.PI/2]]){
    const chair=new THREE.Group();
    const seat=new THREE.Mesh(new THREE.BoxGeometry(.55,.12,.55),woodDoorM);seat.position.y=.48;chair.add(seat);
    const backC=new THREE.Mesh(new THREE.BoxGeometry(.55,.7,.1),woodDoorM);backC.position.set(0,.84,.27);chair.add(backC);
    for(const sx of[-.2,.2])for(const sz of[-.2,.2]){
      const leg=new THREE.Mesh(new THREE.BoxGeometry(.06,.48,.06),woodDoorM);
      leg.position.set(sx,.24,sz);chair.add(leg);
    }
    chair.position.set(ix+5+dx,0,iz+4+dz);chair.rotation.y=ry;g.add(chair);
  }
  for(const[x,y,z,ry,col]of[
    [ix-1.8,2.35,iz+5.84,Math.PI,0x85a7c9],
    [ix+2.2,2.25,iz+5.84,Math.PI,0xd8995f],
    [ix-7.84,2.35,iz-2.0,Math.PI/2,0x8fbd7f],
  ]){
    const pic=new THREE.Group();
    const frame=new THREE.Mesh(new THREE.BoxGeometry(1.25,.86,.08),trimM);pic.add(frame);
    const art=new THREE.Mesh(new THREE.PlaneGeometry(1.05,.66),
      new THREE.MeshBasicMaterial({color:col}));
    art.position.z=.05;pic.add(art);
    pic.position.set(x,y,z);pic.rotation.y=ry;g.add(pic);
  }
  const exitDoor=new THREE.Mesh(new THREE.BoxGeometry(.16,2.8,1.4),woodDoorM);
  exitDoor.position.set(ix-7.92,1.4,iz);g.add(exitDoor);
  return g;
}

export default {category:'Rural',label:'Ranch house',build:buildExteriorPreview,
  variants:[
    {label:'Ranch house - exterior',build:buildExteriorPreview,zoom:.58,yaw:Math.PI},
    {label:'Ranch house - interior',build:buildInteriorPreview,zoom:.62},
  ]};
