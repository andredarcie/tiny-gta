import * as THREE from 'three';
import {scene} from '@/core/engine.ts';

// Cull/freeze para os GRANDES marcos rurais autorais (casa de fazenda + garagem,
// celeiro + silo). Diferente do resto do campo — floresta, casinhas, igreja, poço,
// cercas, etc. — esses NÃO entram nos chunks de props fundidos (têm fachada que liga/
// desliga e interior off-map), então ficavam como dezenas de meshes soltos: ~130 draw
// calls do rancho sozinho (≈7× a cidade INTEIRA, que renderiza em ~18) pagos todo
// frame, mais o redesenho deles no shadow pass — mesmo com o jogador do outro lado do
// mapa.
//
// registerRuralStatic() congela a matriz do marco UMA vez (ele nunca se move) e o
// guarda aqui; updateRuralCulling() o esconde além da névoa, onde ele já é invisível.
// É visual-neutro (mesmo princípio do corte de carros parados no main.ts) e elimina os
// draw calls + o custo de sombra do marco sempre que o jogador não está perto dele.
interface RuralStatic{o:THREE.Object3D;x:number;z:number;}
const statics:RuralStatic[]=[];

// Congela a sub-árvore (marco estático nunca recompõe matriz) e registra pro corte.
// O chamador pode reativar matrixAutoUpdate em filhos animados DEPOIS desta chamada
// (ex.: a setinha quicante da porta do rancho).
export function registerRuralStatic(o:THREE.Object3D,x:number,z:number):void{
  o.traverse(c=>{c.updateMatrix();c.matrixAutoUpdate=false;});
  o.updateMatrixWorld(true); // calcula as matrizes de mundo uma vez, já congeladas
  statics.push({o,x,z});
}

// Esconde os marcos rurais além da névoa. Lê fog.far por frame (a névoa abre na
// altitude — ver main.ts), então o marco reaparece na distância certa ao voar alto.
export function updateRuralCulling(px:number,pz:number):void{
  const far=scene.fog?(scene.fog as THREE.Fog).far:430;
  const f2=far*far;
  for(const s of statics){
    const dx=s.x-px,dz=s.z-pz;
    s.o.visible=dx*dx+dz*dz<f2;
  }
}
