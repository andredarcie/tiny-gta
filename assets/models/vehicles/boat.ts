import * as THREE from 'three';
import {scene} from '@/core/engine.ts';

// Lancha estilo mundo aberto: speedboat de cockpit aberto, casco em V com proa
// pontuda, para-brisa envolvente, console/timão central, bancos, capô do motor e
// plataforma de mergulho na popa. Convenção igual ao carro/moto: +Z é a FRENTE
// (proa), largura em X, casco flutuando com o piso em y≈0 (o mar fica em y=-.32).
//
// ATENÇÃO à geometria do casco: ExtrudeGeometry extruda a forma ao longo de +Z e,
// após `rotateX(Math.PI/2)`, esse +Z vira −Y do mundo — ou seja, a extrusão
// cresce PRA BAIXO. Por isso cada peça do casco é POSICIONADA pelo topo: um casco
// que deve ocupar [y0, y1] usa depth=(y1−y0) e position.y=y1. O casco inferior é
// sólido (do fundo até ~.13) e o costado superior é um ANEL (forma com furo do
// cockpit) que sobe até o convés (~.55), conectando o fundo ao convés sem vão.
//
// O gameplay (updateBoat) senta o piloto no console via setBoatPose; o offset do
// pedestre e os pontos do banco/timão são calibrados pela proporção do ped
// (origem nos pés, quadril .55, ombro 1.26, cabeça 1.62). Ver player.js.

// ---- materiais compartilhados no módulo (poucas instâncias por sessão) ----
const hullDarkM=new THREE.MeshStandardMaterial({color:0x141d24,roughness:.5,metalness:.3}); // faixa fundo
const deckM=new THREE.MeshStandardMaterial({color:0xefe9dd,roughness:.7});                   // convés creme
const soleM=new THREE.MeshStandardMaterial({color:0x6f5034,roughness:.85});                  // piso teca
const trimM=new THREE.MeshStandardMaterial({color:0x10141a,roughness:.6,metalness:.2});      // faixa/console
const chromeM=new THREE.MeshStandardMaterial({color:0xd9dde4,roughness:.16,metalness:.95});  // corrimão/eixos
const glassM=new THREE.MeshStandardMaterial({color:0xaee0f0,roughness:.08,metalness:.2,
  transparent:true,opacity:.4,depthWrite:false});
const seatM=new THREE.MeshStandardMaterial({color:0x1c1c24,roughness:.85});
const seatTrimM=new THREE.MeshStandardMaterial({color:0xb8bcc6,roughness:.55,metalness:.4});
const engineM=new THREE.MeshStandardMaterial({color:0x23262c,roughness:.5,metalness:.55});
const dashM=new THREE.MeshStandardMaterial({color:0x0c0e12,roughness:.5});
const redLightM=new THREE.MeshBasicMaterial({color:0xd11f1f});   // luz de bombordo
const greenLightM=new THREE.MeshBasicMaterial({color:0x2bd14a}); // luz de boreste
const whiteLightM=new THREE.MeshBasicMaterial({color:0xfff4d0}); // mastro de popa
// Police boat: blue hull stripe + a flashing light bar on an arch over the helm.
// The two bar lights are exposed via userData.bar so the shared blinkBar() pulses
// them in sync with the cop cars (entities.js). Materials are basic (unlit) so the
// siren reads bright at any time of day.
const copStripeM=new THREE.MeshStandardMaterial({color:0x1b2b66,roughness:.5,metalness:.3}); // faixa azul "POLICE"
const copBarRedM=new THREE.MeshBasicMaterial({color:0xff2222});
const copBarBlueM=new THREE.MeshBasicMaterial({color:0x2266ff});
// arco do giroflex sobre o cockpit + a barra de luzes em si
const copArchPostG=new THREE.CylinderGeometry(.03,.03,.95,8);
const copArchBarG=new THREE.BoxGeometry(1.46,.05,.05);
const copLightG=new THREE.BoxGeometry(.26,.13,.34);
const copStripeG=new THREE.BoxGeometry(.06,.18,1.7); // faixa lateral nos dois bordos

const paintCache=new Map<number,THREE.MeshStandardMaterial>();
function paintFor(color: number): THREE.MeshStandardMaterial{
  if(!paintCache.has(color))
    paintCache.set(color,new THREE.MeshStandardMaterial({color,roughness:.34,metalness:.55}));
  return paintCache.get(color)!;
}

// Outline do casco visto de cima (X=largura, Y=comprimento, proa em +Y)
function hullOutline(): THREE.Shape{
  const s=new THREE.Shape();
  s.moveTo(-0.92,-2.00);  // popa esquerda
  s.lineTo( 0.92,-2.00);  // popa direita
  s.lineTo( 0.97,-0.10);
  s.lineTo( 0.90, 0.95);
  s.lineTo( 0.52, 1.72);  // afunila pra proa
  s.lineTo( 0.0,  2.40);  // ponta da proa
  s.lineTo(-0.52, 1.72);
  s.lineTo(-0.90, 0.95);
  s.lineTo(-0.97,-0.10);
  s.closePath();
  return s;
}
// abertura do cockpit (furo na forma do costado): retângulo central, popa decked
function cockpitHole(): THREE.Path{
  const h=new THREE.Path();
  h.moveTo(-0.70,-1.20);
  h.lineTo( 0.70,-1.20);
  h.lineTo( 0.70, 1.05);
  h.lineTo( 0.0,  1.32); // afunila junto da proa
  h.lineTo(-0.70, 1.05);
  h.closePath();
  return h;
}
// convés de proa: acompanha o contorno pontudo do casco (em vez de um bloco
// quadrado) — vai da frente do cockpit até a ponta da proa, afunilando.
function foredeckShape(): THREE.Shape{
  const s=new THREE.Shape();
  s.moveTo(-0.84,0.98);
  s.lineTo(-0.84,1.05);
  s.lineTo(-0.50,1.72);
  s.lineTo( 0.00,2.36); // ponta da proa (segue o casco)
  s.lineTo( 0.50,1.72);
  s.lineTo( 0.84,1.05);
  s.lineTo( 0.84,0.98);
  s.lineTo( 0.00,1.28); // recorte traseiro acompanha a ponta do cockpit
  s.closePath();
  return s;
}
// extruda a forma e gira pro plano da lancha (depth cresce em −Y, ver topo)
function extrudeHull(shape: THREE.Shape,depth: number): THREE.ExtrudeGeometry{
  const g=new THREE.ExtrudeGeometry(shape,{depth,bevelEnabled:false});
  g.rotateX(Math.PI/2);
  return g;
}
const hullSolidGeo=extrudeHull(hullOutline(),0.58);  // fundo sólido
const stripeGeo=extrudeHull(hullOutline(),0.10);     // faixa na linha d'água
function ringShape(): THREE.Shape{const s=hullOutline();s.holes.push(cockpitHole());return s;}
const hullRingGeo=extrudeHull(ringShape(),0.45);     // costado com cockpit aberto
const foredeckGeo=extrudeHull(foredeckShape(),0.06); // convés de proa pontudo

// ---- geometrias de peças ----
const soleG=new THREE.BoxGeometry(1.42,.05,2.1);
const aftDeckG=new THREE.BoxGeometry(1.78,.06,.78);
const sideDeckG=new THREE.BoxGeometry(.26,.06,2.0);
const rubrailG=new THREE.BoxGeometry(.07,.1,2.0);
const transomG=new THREE.BoxGeometry(1.8,.46,.1);
const swimG=new THREE.BoxGeometry(1.5,.07,.45);
const ladderRailG=new THREE.CylinderGeometry(.02,.02,.4,6);
const ladderStepG=new THREE.CylinderGeometry(.02,.02,.36,6);
// console/binnacle + dash
const consoleG=new THREE.BoxGeometry(.72,.88,.44);
const dashTopG=new THREE.BoxGeometry(.72,.2,.32);
const screenG=new THREE.BoxGeometry(.48,.15,.02);
const throttleBaseG=new THREE.BoxGeometry(.12,.1,.18);
const throttleLeverG=new THREE.CylinderGeometry(.02,.025,.24,8);
const throttleKnobG=new THREE.SphereGeometry(.045,8,6);
// timão (aro + raios) — espaço local do volante
const wheelRimG=new THREE.TorusGeometry(.18,.028,8,20);
const wheelSpokeG=new THREE.BoxGeometry(.32,.03,.022);
const wheelHubG=new THREE.CylinderGeometry(.05,.05,.05,10);
const wheelColumnG=new THREE.CylinderGeometry(.03,.03,.34,8);
// banco do capitão
const seatCushG=new THREE.BoxGeometry(.46,.13,.46);
const seatBackG=new THREE.BoxGeometry(.46,.5,.12);
const seatPedG=new THREE.CylinderGeometry(.1,.13,.36,10);
const benchG=new THREE.BoxGeometry(1.46,.14,.42);
const benchBackG=new THREE.BoxGeometry(1.46,.4,.12);
// para-brisa
const windPaneG=new THREE.BoxGeometry(.74,.42,.04);
const windPostG=new THREE.BoxGeometry(.05,.6,.05);
const windFrameG=new THREE.BoxGeometry(1.64,.05,.05);
// motor / popa
const engineHatchG=new THREE.BoxGeometry(1.5,.3,.84);
const exhaustG=new THREE.CylinderGeometry(.06,.06,.1,10);
// detalhes
const cleatG=new THREE.BoxGeometry(.16,.06,.06);
const bowRailG=new THREE.TorusGeometry(.42,.022,6,16,Math.PI);
const bowRailPostG=new THREE.CylinderGeometry(.02,.02,.2,6);
const navG=new THREE.SphereGeometry(.045,8,6);
const mastG=new THREE.CylinderGeometry(.015,.015,.32,6);

function buildBoat({color=0xff5a3c,police=false}: {color?: number; police?: boolean}={}): THREE.Group{
  const g=new THREE.Group();
  const paint=paintFor(color);
  // o anel do cockpit precisa de DoubleSide pra mostrar as paredes internas
  const hullSideMat=paint.clone();hullSideMat.side=THREE.DoubleSide;
  g.userData.color=color;

  // ---- casco: fundo sólido até ~.13, costado-anel sobe até o convés (~.55) ----
  // (POSICIONADO pelo topo porque a extrusão cresce pra baixo, ver topo do arquivo)
  const hullSolid=new THREE.Mesh(hullSolidGeo,paint);
  hullSolid.position.y=.13;hullSolid.castShadow=true;g.add(hullSolid); // [-.45,.13]
  const hullRing=new THREE.Mesh(hullRingGeo,hullSideMat);
  hullRing.position.y=.55;hullRing.castShadow=true;g.add(hullRing);    // [.10,.55]
  const stripe=new THREE.Mesh(stripeGeo,hullDarkM);
  stripe.position.y=.05;stripe.scale.set(1.014,1,1.014);g.add(stripe); // boot stripe

  // piso do cockpit (teca) logo acima do topo do casco sólido — o piloto pisa aqui
  const sole=new THREE.Mesh(soleG,soleM);
  sole.position.set(0,.12,-.1);g.add(sole);

  // ---- convés creme por cima do anel (proa, popa, costados); cockpit aberto ----
  // foredeckGeo já está em coordenadas da lancha (a forma traz X/Z); só sobe ao convés
  const fore=new THREE.Mesh(foredeckGeo,deckM);
  fore.position.y=.60;g.add(fore);
  const aft=new THREE.Mesh(aftDeckG,deckM);
  aft.position.set(0,.57,-1.62);g.add(aft);
  for(const sx of[-1,1]){
    const sd=new THREE.Mesh(sideDeckG,deckM);
    sd.position.set(sx*.83,.57,-.05);g.add(sd);
    const rr=new THREE.Mesh(rubrailG,trimM);
    rr.position.set(sx*.95,.5,-.05);g.add(rr);
  }

  // ---- console central + dash + timão + acelerador ----
  const consoleMesh=new THREE.Mesh(consoleG,trimM);
  consoleMesh.position.set(0,.56,.5);g.add(consoleMesh);
  const dashTop=new THREE.Mesh(dashTopG,dashM);
  dashTop.position.set(0,1.0,.42);dashTop.rotation.x=-.35;g.add(dashTop);
  const screen=new THREE.Mesh(screenG,glassM);
  screen.position.set(0,1.02,.28);screen.rotation.x=-.35;g.add(screen);
  const tb=new THREE.Mesh(throttleBaseG,engineM);
  tb.position.set(.42,.82,.5);g.add(tb);
  const tl=new THREE.Mesh(throttleLeverG,chromeM);
  tl.position.set(.42,.95,.55);tl.rotation.x=-.4;g.add(tl);
  const tk=new THREE.Mesh(throttleKnobG,trimM);
  tk.position.set(.42,1.05,.59);g.add(tk);

  // timão: grupo externo posicionado/inclinado, aro interno gira (userData.steer)
  const helm=new THREE.Group();
  helm.position.set(0,1.14,.54);helm.rotation.x=.62; // casado com as mãos do piloto
  const col=new THREE.Mesh(wheelColumnG,trimM);
  col.position.set(0,0,-.18);col.rotation.x=Math.PI/2;helm.add(col);
  const rim=new THREE.Group();
  rim.add(new THREE.Mesh(wheelRimG,trimM));
  for(let i=0;i<3;i++){
    const sp=new THREE.Mesh(wheelSpokeG,chromeM);
    sp.rotation.z=i*Math.PI/3;rim.add(sp);
  }
  const hub=new THREE.Mesh(wheelHubG,chromeM);hub.rotation.x=Math.PI/2;rim.add(hub);
  helm.add(rim);g.add(helm);
  g.userData.steer=rim;

  // ---- banco do capitão (atrás do console) ----
  const seatPed=new THREE.Mesh(seatPedG,seatTrimM);
  seatPed.position.set(0,.30,-.15);g.add(seatPed);
  const cush=new THREE.Mesh(seatCushG,seatM);
  cush.position.set(0,.5,-.15);g.add(cush);
  const back=new THREE.Mesh(seatBackG,seatM);
  back.position.set(0,.78,-.42);back.rotation.x=-.14;g.add(back);

  // ---- para-brisa envolvente na frente do console ----
  for(const sx of[-1,1]){
    const pane=new THREE.Mesh(windPaneG,glassM);
    pane.position.set(sx*.42,.88,.8);pane.rotation.set(-.45,sx*.32,0);g.add(pane);
    const post=new THREE.Mesh(windPostG,chromeM);
    post.position.set(sx*.8,.82,.75);post.rotation.x=-.45;g.add(post);
  }
  const cpost=new THREE.Mesh(windPostG,chromeM);
  cpost.position.set(0,.82,.84);cpost.rotation.x=-.45;g.add(cpost);
  const wframe=new THREE.Mesh(windFrameG,chromeM);
  wframe.position.set(0,1.08,.72);wframe.rotation.x=-.45;g.add(wframe);

  // ---- popa: capô do motor + banco corrido + transom + escapes ----
  const hatch=new THREE.Mesh(engineHatchG,paint);
  hatch.position.set(0,.7,-1.6);g.add(hatch);
  const bench=new THREE.Mesh(benchG,seatM);
  bench.position.set(0,.55,-1.0);g.add(bench);
  const benchBack=new THREE.Mesh(benchBackG,seatM);
  benchBack.position.set(0,.78,-1.2);benchBack.rotation.x=.16;g.add(benchBack);
  const transom=new THREE.Mesh(transomG,paint);
  transom.position.set(0,.32,-2.0);g.add(transom);
  for(const sx of[-1,1]){
    const ex=new THREE.Mesh(exhaustG,trimM);
    ex.rotation.x=Math.PI/2;ex.position.set(sx*.55,.16,-2.04);g.add(ex);
  }
  // plataforma de mergulho + escadinha
  const swim=new THREE.Mesh(swimG,deckM);
  swim.position.set(0,.16,-2.24);g.add(swim);
  for(const sx of[-1,1]){
    const lr=new THREE.Mesh(ladderRailG,chromeM);
    lr.position.set(sx*.18,.0,-2.42);lr.rotation.x=.3;g.add(lr);
  }
  for(const sy of[-.06,-.2]){
    const ls=new THREE.Mesh(ladderStepG,chromeM);
    ls.rotation.z=Math.PI/2;ls.position.set(0,sy,-2.46);g.add(ls);
  }

  // ---- detalhes de proa: corrimão, cleats, luzes de navegação ----
  const bowRail=new THREE.Mesh(bowRailG,chromeM);
  bowRail.rotation.set(-Math.PI/2,0,0);bowRail.position.set(0,.68,1.95);g.add(bowRail);
  for(const sx of[-1,1]){
    const brp=new THREE.Mesh(bowRailPostG,chromeM);
    brp.position.set(sx*.42,.62,1.95);g.add(brp);
    const cleat=new THREE.Mesh(cleatG,chromeM);
    cleat.position.set(sx*.83,.6,.7);g.add(cleat);
  }
  const navR=new THREE.Mesh(navG,redLightM);navR.position.set(-.8,.62,1.05);g.add(navR);
  const navGr=new THREE.Mesh(navG,greenLightM);navGr.position.set(.8,.62,1.05);g.add(navGr);
  const mast=new THREE.Mesh(mastG,chromeM);mast.position.set(0,.9,-1.95);g.add(mast);
  const mlight=new THREE.Mesh(navG,whiteLightM);mlight.position.set(0,1.08,-1.95);g.add(mlight);

  // ---- livraria de polícia: arco com giroflex vermelho/azul + faixas azuis ----
  // O arco sobe dos costados logo atrás do banco do capitão (sem encostar na
  // cabeça do piloto) e carrega a barra de luzes piscante (userData.bar).
  if(police){
    for(const sx of[-1,1]){
      const post=new THREE.Mesh(copArchPostG,chromeM);
      post.position.set(sx*.72,1.05,-.55);g.add(post);
      const stripe=new THREE.Mesh(copStripeG,copStripeM);
      stripe.position.set(sx*.965,.5,-.05);g.add(stripe); // faixa "POLICE" no costado
    }
    const bar=new THREE.Mesh(copArchBarG,trimM);
    bar.position.set(0,1.5,-.55);g.add(bar);
    const r=new THREE.Mesh(copLightG,copBarRedM);
    const b=new THREE.Mesh(copLightG,copBarBlueM);
    r.position.set(-.22,1.56,-.55);b.position.set(.22,1.56,-.55);
    g.add(r,b);g.userData.bar=[r,b]; // blinkBar() pulsa em sincronia com as viaturas
  }

  g.userData.driver=null; // o gameplay segura o timão via setBoatPose
  return g;
}

// Padrão de modelo: build() puro; descriptor com variações pro model-viewer.
export default {category:'Vehicles',label:'Speedboat',build:buildBoat,
  variants:[{label:'Speedboat — coral',opts:{color:0xff5a3c}},
            {label:'Speedboat — aqua',opts:{color:0x1fc4c4}},
            {label:'Speedboat — magenta',opts:{color:0xff2e88}},
            {label:'Speedboat — police',opts:{color:0xf2f4f8,police:true}}]};

// Compat: gameplay usa makeBoat(color,police) e espera a lancha já na cena.
export function makeBoat(color: number,police: boolean): THREE.Group{const g=buildBoat({color,police});scene.add(g);return g;}
