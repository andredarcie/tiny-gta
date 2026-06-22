import * as THREE from 'three';
import {state,refs} from '@/core/state.ts';
import {economy} from '@/core/economy.ts';
import {scene} from '@/core/engine.ts';
import {playerPos} from '@/actors/player.ts';
import {message,bigText,hideBig} from '@/ui/hud.ts';
import {blip} from '@/audio/audio.ts';
import {N,nodeX,groundHeight} from '@/core/constants.ts';
import {REWARDS} from '@/core/minigame-rewards.ts';
import {makeHiddenPackage} from '../../assets/models/props/hidden-package.ts';
import {MiniGame,MiniGameId} from '@/activities/minigame.ts';

// coletável livre (não trava o mundo): registra a identidade no enum/registro de
// mini games. Os pacotes NÃO aparecem no mapa/radar — o jogador descobre sozinho.
new MiniGame({id:MiniGameId.HIDDEN_PACKAGES,name:'Hidden Stashes',exclusive:false});

// HIDDEN STASHES: colecionáveis escondidos espalhados pela cidade (estilo open-world).
// Coleta a pé ou de carro; pequenos prêmios por pacote, bônus a cada 10, e um
// grande bônus ao achar todos.
const TOTAL=24;
const PER_PACKAGE=REWARDS.hiddenPackages.perPackage;  // dinheiro por pacote
const BONUS_EACH=REWARDS.hiddenPackages.bonusPer10;   // bônus a cada 10 coletados
const BONUS_ALL=REWARDS.hiddenPackages.bonusAll;      // bônus ao achar todos
const PICK_R=3.2;         // raio de coleta (a pé ou de carro)
const STORE_KEY='tinygta_packages';

// pacote: posição, modelo 3D, halo opcional, altura base e se já foi coletado
interface Pack{x:number;z:number;g:THREE.Object3D;halo:THREE.Object3D|null;baseY:number;taken:boolean;}

const packs: Pack[]=[];
let found=0;
const fx: THREE.Object3D[]=[];  // efeitos de "pop" ativos (estouro do pacote ao coletar)

// PRNG determinístico (mulberry32): as POSIÇÕES dos pacotes precisam ser IGUAIS
// em todo carregamento, senão a persistência por índice (abaixo) apontaria pra
// lugares diferentes a cada refresh. Usamos uma semente fixa em vez de Math.random.
function makeRng(seed: number): ()=>number{
  let a=seed>>>0;
  return ()=>{
    a|=0;a=(a+0x6D2B79F5)|0;
    let t=Math.imul(a^(a>>>15),1|a);
    t=(t+Math.imul(t^(t>>>7),61|t))^t;
    return ((t^(t>>>14))>>>0)/4294967296;
  };
}

// Persistência: guarda os índices já coletados pra não resetar no refresh. JSON
// sempre dentro de try/catch (localStorage pode falhar/estar sujo). Filtra pra
// só aceitar índices válidos (inteiros em [0,TOTAL)).
function loadTaken(): Set<number>{
  try{
    const raw=localStorage.getItem(STORE_KEY);
    if(!raw)return new Set();
    const arr=JSON.parse(raw);
    if(!Array.isArray(arr))return new Set();
    const s=new Set<number>();
    for(const v of arr)if(Number.isInteger(v)&&v>=0&&v<TOTAL)s.add(v);
    return s;
  }catch(e){return new Set();}
}
function saveTaken(): void{
  try{
    const arr: number[]=[];
    for(let i=0;i<packs.length;i++)if(packs[i].taken)arr.push(i);
    localStorage.setItem(STORE_KEY,JSON.stringify(arr));
  }catch(e){}
}

// Gera posições FIXAS (semente constante) e variadas: mistura interseções exatas
// e pontos perto de quarteirões (com offset). Evita o spawn (0,0) e dois pacotes
// quase no mesmo lugar. Determinístico -> o pacote de índice k é sempre o mesmo
// lugar, então a coleta persistida por índice continua válida entre refreshes.
function buildPositions(): {x:number;z:number}[]{
  const rng=makeRng(0x7ACE51);
  const ri=(a: number,b: number)=>a+Math.floor(rng()*(b-a+1)); // inteiro em [a,b]
  const rf=(a: number,b: number)=>a+rng()*(b-a);               // float em [a,b)
  const pos: {x:number;z:number}[]=[];
  const seen=new Set<string>();
  let guard=0;
  while(pos.length<TOTAL&&guard<5000){
    guard++;
    const i=ri(0,N),j=ri(0,N);
    let x=nodeX(i),z=nodeX(j);
    // parte dos pacotes ganha offset pra cair perto do quarteirão, não na
    // interseção exata — espalha melhor.
    if(rng()<.55){
      x+=rf(-16,16);
      z+=rf(-16,16);
    }
    // longe do spawn (0,0)
    if(Math.hypot(x,z)<14)continue;
    // sem dois pacotes praticamente no mesmo lugar (grade de ~5m)
    const key=Math.round(x/5)+','+Math.round(z/5);
    if(seen.has(key))continue;
    seen.add(key);
    pos.push({x,z});
  }
  return pos;
}

// Inicialização no carregamento: cria os pacotes e adiciona à cena os que ainda
// não foram coletados. `found` é recomputado do storage (NÃO refazemos bônus).
const takenSet=loadTaken();
const positions=buildPositions();
for(let idx=0;idx<positions.length;idx++){
  const p=positions[idx];
  const g=makeHiddenPackage();
  const baseY=groundHeight(p.x,p.z)+1.1;
  g.position.set(p.x,baseY,p.z);
  const taken=takenSet.has(idx);
  const halo=g.getObjectByName('halo')||null;
  const pack: Pack={x:p.x,z:p.z,g,halo,baseY,taken};
  if(taken){found++;}
  else{scene.add(g);}
  packs.push(pack);
}

// Sem blip no radar/mapa de propósito: pacotes são "escondidos" mesmo — o jogador
// descobre por conta própria.

// Debug hook.
refs.getHiddenPackagesState=()=>({found,total:TOTAL});

// ----- SAVE: pacotes coletados (js/core/save.ts) -----
// Guarda os ÍNDICES coletados (as posições são determinísticas — semente fixa —
// então o índice k é sempre o mesmo lugar). Restaurar só MARCA como coletado
// (sem repagar dinheiro/bônus) e tira o pacote da cena.
refs.getPackagesSave=()=>{
  const a: number[]=[];
  for(let i=0;i<packs.length;i++)if(packs[i].taken)a.push(i);
  return a;
};
refs.restorePackages=(arr: unknown)=>{
  if(!Array.isArray(arr))return;
  let changed=false;
  for(const v of arr){
    if(!Number.isInteger(v)||v<0||v>=packs.length)continue;
    const p=packs[v];
    if(p.taken)continue;
    p.taken=true;found++;changed=true;
    if(p.g.parent)scene.remove(p.g);
  }
  if(changed)saveTaken();
};

// Dispara o efeito de "pop" no lugar do pacote coletado: o group reaproveitado
// cresce e some em ~0.4s. Reaproveitamos o próprio modelo (já na cena) pra não
// criar geometria nova; só reanimamos escala antes de remover de vez.
function popAt(g: THREE.Object3D): void{
  g.userData._pop=0;
  fx.push(g);
}

export function updateHiddenPackages(dt: number): void{
  const pp=playerPos();
  const r2=PICK_R*PICK_R;
  const ANIM2=70*70; // longe: nem anima (não cabe na tela) nem checa coleta
  for(let k=0;k<packs.length;k++){
    const p=packs[k];
    if(p.taken)continue;
    // distância 2D ao quadrado, calculada uma vez (sem sqrt no hot loop).
    const dx=pp.x-p.x,dz=pp.z-p.z,d2=dx*dx+dz*dz;
    if(d2>ANIM2)continue; // pacote distante: pula animação cosmética E coleta
    // gira, balança e pulsa o halo pra chamar atenção
    p.g.rotation.y+=2.2*dt;
    p.g.position.y=p.baseY+Math.sin(state.time*2.6+k)*0.18;
    if(p.halo){
      const s=1+Math.sin(state.time*4+k*1.7)*0.12;
      p.halo.scale.set(s,s,s);
      p.halo.rotation.y-=1.4*dt;
    }
    // coleta (a pé ou de carro), vale mesmo dentro do carro. Durante uma sessão de
    // mini game exclusivo não dá pra coletar (sem misturar atividades).
    if(!MiniGame.busy&&d2<r2){
      p.taken=true;            // nunca mais recoletável
      found++;
      economy.earn(PER_PACKAGE,'hidden-package');
      saveTaken();
      blip([660,990],0.07,'sine',.16);
      popAt(p.g);              // estoura no lugar (depois sai da cena)
      if(found>=TOTAL){
        economy.earn(BONUS_ALL,'hidden-package-all');
        bigText('ALL '+TOTAL+' PACKAGES FOUND! +$'+BONUS_ALL,'var(--gold)');
        blip([880,1320,1760],0.09,'triangle',.2);
        setTimeout(hideBig,1500);
      }else if(found%10===0){
        economy.earn(BONUS_EACH,'hidden-package-bonus');
        bigText('PACKAGE BONUS! +$'+BONUS_EACH,'var(--gold)');
        blip([784,1175],0.08,'triangle',.18);
        setTimeout(hideBig,1300);
        message('HIDDEN STASH '+found+'/'+TOTAL,'var(--cyan)');
      }else{
        message('HIDDEN STASH '+found+'/'+TOTAL,'var(--cyan)');
      }
    }
  }
  // atualiza os "pops": cresce e some; ao terminar, remove o group da cena.
  for(let f=fx.length-1;f>=0;f--){
    const g=fx[f];
    const t=(g.userData._pop+=dt)/0.4;
    if(t>=1){
      scene.remove(g);
      fx.splice(f,1);
      continue;
    }
    const s=1+t*1.8;          // estoura crescendo
    g.scale.set(s,s,s);
    g.position.y+=dt*2.2;     // sobe um pouco enquanto some
    g.rotation.y+=8*dt;       // gira rápido no estouro
  }
}
