import * as THREE from 'three';
import {renderer,scene,camera,dlight,sunDir} from './engine.js';
import {interiors} from './interior.js';

// Pré-aquecimento de GPU no boot (tela de título), pra matar as "grandes quedas
// de FPS do nada". Dois problemas distintos, dois remédios:
//
// 1) SHADERS de modelos que só nascem em jogo (efeitos de combate, arma na mão,
//    heli, props de minigame). O THREE compila o programa GLSL na 1ª vez que o
//    material é renderizado — síncrono, no render — e o frame congela. Medido:
//    +12 programs = 705ms ao atirar. Remédio: instanciar uma cópia de cada,
//    jogar na cena e chamar renderer.compile (que percorre a cena inteira).
//
// 2) INTERIORES (academia, hospital, presídio, boate, loja de armas, casa). Eles
//    ficam na cena porém visible=false e LONGE (-800), fora do frustum da câmera
//    e da luz no título. Então: (a) renderer.compile pega o programa principal
//    deles (percorre invisíveis), MAS (b) a GEOMETRIA só sobe pro GPU no 1º
//    render e (c) o programa de SOMBRA (depth) só compila quando entram no pass
//    de sombra. Resultado: 1ª entrada congela ~400ms (medido: hospital, +8
//    programs + 74 geometrias). Remédio: renderizar cada interior UMA vez de
//    pertinho, com a luz mirando, pra subir geometria e compilar tudo (inclusive
//    sombra). A câmera olha pro interior em x=-800; a cidade (na origem) fica fora
//    do frustum, então cada render é barato.

const MODELS=import.meta.glob('../assets/models/**/*.js',{eager:true});

function builders(d:any){
  const out:Array<()=>any>=[];
  if(!d)return out;
  const variants=Array.isArray(d.variants)?d.variants:[{build:d.build}];
  for(const v of variants){
    const build=v.build||d.build;
    if(typeof build==='function')out.push(()=>build(v.opts||{}));
  }
  return out;
}
function addTo(bag:THREE.Group,out:any){
  if(!out)return;
  if(out.isObject3D){bag.add(out);return;}
  for(const part of Object.values(out))if(part&&(part as any).isObject3D)bag.add(part as THREE.Object3D);
}

function warmModels(){
  const bag=new THREE.Group();
  bag.position.set(0,-9000,0);
  for(const mod of Object.values(MODELS))
    for(const make of builders((mod as any).default))
      try{addTo(bag,make());}catch(e){} // modelo em edição/quebrado não derruba o boot
  scene.add(bag);
  try{renderer.compile(scene,camera);}catch(e){}
  scene.remove(bag);
  // NÃO damos dispose nos materiais: compile() guarda o programa GLSL no cache do
  // renderer com usedTimes=1 (só este material o usa, pois os efeitos do jogo
  // ainda nem existem). material.dispose() zeraria isso e LIBERARIA o programa —
  // desfazendo o warmup (o shader recompilaria em jogo). O bag nunca é
  // renderizado, então não subiu geometria/textura pro GPU: não há o que vazar.
  // Soltar a referência basta — o GC recolhe os objetos JS; os programas ficam.
}

function warmInteriors(){
  if(!interiors||!interiors.length)return;
  const savePos=camera.position.clone(),saveQuat=camera.quaternion.clone();
  const saveTgt=dlight.target.position.clone(),saveLit=dlight.position.clone();
  for(const it of interiors){
    const g=it.group,c=it.center;
    if(!g||!c||!g.parent)continue; // só os que já estão na cena (a casa só após comprar)
    const wasVisible=g.visible;
    g.visible=true;
    camera.position.set(c.x,3,c.z+8);camera.lookAt(c.x,2,c.z);
    dlight.target.position.set(c.x,0,c.z);
    dlight.target.updateMatrixWorld();
    dlight.position.set(c.x+sunDir.x*160,sunDir.y*160,c.z+sunDir.z*160);
    renderer.shadowMap.needsUpdate=true;
    try{renderer.render(scene,camera);}catch(e){} // sobe geometria + compila (inclui sombra)
    g.visible=wasVisible;
  }
  camera.position.copy(savePos);camera.quaternion.copy(saveQuat);
  dlight.target.position.copy(saveTgt);dlight.target.updateMatrixWorld();
  dlight.position.copy(saveLit);
  renderer.shadowMap.needsUpdate=true; // recompõe a sombra real no 1º frame de jogo
}

// 3) GEOMETRIA do mundo: o programa compila no compile(), mas a geometria só sobe
//    pro GPU quando é RENDERIZADA pela 1ª vez. O título só orbita perto da origem,
//    então chunks distantes (zona rural/montanha a leste, ou qualquer direção que
//    o jogador encare antes do título varrer) só subiam ao aparecer em jogo — e o
//    1º render deles travava o frame (medido: +200 geometrias = ~50ms ao virar a
//    câmera). Um único render de cima cobrindo o mapa inteiro força tudo a subir
//    no boot. É a causa do "virar a câmera rápido derruba o FPS".
function warmGeometry(){
  const sp=camera.position.clone(),sq=camera.quaternion.clone(),su=camera.up.clone();
  const shadowWas=renderer.shadowMap.needsUpdate;
  renderer.shadowMap.needsUpdate=false; // sombra é desnecessária só pra subir geometria
  camera.up.set(0,0,-1);                 // top-down precisa do up no plano horizontal
  camera.position.set(180,950,0);        // alto sobre o centro de cidade+zona rural
  camera.lookAt(180,0,0);                // cobre ~±570 em z e ainda mais em x (aspecto)
  camera.updateMatrixWorld(true);
  try{renderer.render(scene,camera);}catch(e){}
  camera.up.copy(su);camera.position.copy(sp);camera.quaternion.copy(sq);
  camera.updateMatrixWorld(true);
  renderer.shadowMap.needsUpdate=shadowWas;
}

export function warmupShaders(){
  warmModels();
  warmGeometry();
  warmInteriors();
}
