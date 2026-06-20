import * as THREE from 'three';
import {state,refs} from '@/core/state.ts';
import {economy} from '@/core/economy.ts';
import {scene} from '@/core/engine.ts';
import {playerPos,cur,idleCars} from '@/actors/player.ts';
import {message,bigText,hideBig} from '@/ui/hud.ts';
import {blip} from '@/audio/audio.ts';
import {N,nodeX,clamp,groundHeight} from '@/core/constants.ts';
import {makeBombGarage} from '../../assets/models/props/bomb-garage.ts';
import {MiniGame,MiniGameId} from '@/activities/minigame.ts';
import type {ZoneAction} from '@/core/types.ts';

// atividade livre (não trava o mundo): registra a identidade no enum/registro de
// mini games. As ações ARM/DETONATE já ficam indisponíveis durante uma sessão
// (trava nas zoneActions do input/hud).
new MiniGame({id:MiniGameId.BOMB_SHOP,name:'Demo Garage',exclusive:false});

// DEMO GARAGE estilo open-world (garagem clandestina do artificeiro): pare o CARRO dentro da
// garagem e pague pra instalar uma bomba. Depois saia a pé, afaste-se e DETONE —
// a explosão (refs.explodeAt) mata/danifica gangues e policiais ao redor, ótimo
// pra emboscadas. Só 1 carro armado por vez; o carro-bomba pisca em vermelho pra
// avisar que está armado. Modelo PURO vem de assets/models/props/bomb-garage.ts;
// este módulo só orquestra (zona, dinheiro, feedback, explosão).

// galpão clandestino na ORLA OESTE (fora da rua), longe dos outros mini games.
// Antes ficava no meio do cruzamento (88,-88).
const PAD={x:-198,z:60};
const PRICE=100;                     // preço pra armar o carro
const PAD_RANGE=5;                   // raio pra armar (com o carro parado)
const ARM_SPEED=3;                   // velocidade máx do carro pra poder armar
const DETONATE_RANGE=14;             // distância máx (a pé) pro botão de detonar

// referência ao carro atualmente armado ({g,speed,...} de player.cur), o tempo
// pra animar o "blink" do carro-bomba, e o beacon vermelho preso ao carro.
let armedCar: any=null;
let beacon: THREE.Mesh | null=null;     // mesh do farol vermelho que mostramos sobre o carro armado
let t=0;             // tempo global do módulo (pisca/tique)
let tickT=0;         // acumulador pro "tique-tique" da bomba armada

// veículos únicos/de missão (táxi, viatura, ambulância, bombeiro, lancha, avião,
// moto): NÃO deixamos armar — são objetos reutilizados por outros sistemas e
// destruí-los/marcá-los corromperia aquelas mini games. Lê flags/refs (só
// leitura, sem editar os outros módulos).
function isSpecialVehicle(c: any){
  if(!c)return true;
  if(c.police||c.vigilante||c.firetruck||c.boat||c.plane||c.bike)return true;
  if(refs.isTaxiCar?.(c)||refs.isVigilanteCar?.(c)||refs.isAmbulanceCar?.(c))return true;
  return false;
}

// devolve a escala vertical original do carro pra 1 (a animação de "armado"
// mexe em scale.y; é preciso restaurar ao soltar a referência, senão o carro
// fica esticado/achatado permanentemente).
function resetArmedScale(){
  if(armedCar&&armedCar.g)armedCar.g.scale.y=1;
}

// cria/remove o beacon vermelho preso ao grupo do carro armado.
function attachBeacon(g: THREE.Object3D){
  removeBeacon();
  // esfera vermelha emissiva flutuando acima do teto do carro. MeshBasic = sem
  // custo de luz; piscamos a visibilidade/escala no update (1 draw call).
  beacon=new THREE.Mesh(new THREE.SphereGeometry(.22,10,8),
    new THREE.MeshBasicMaterial({color:0xff2b2b}));
  beacon.position.set(0,1.7,0);
  g.add(beacon);
}
function removeBeacon(){
  if(beacon){beacon.parent?.remove(beacon);beacon=null;}
}

// solta a referência do carro armado de forma segura: restaura a escala, tira o
// beacon e zera o estado. Centraliza pra nunca esquecer o reset (origem do bug
// do scale.y permanente).
function clearArmed(){
  resetArmedScale();
  removeBeacon();
  armedCar=null;
}

// ----- garagem no mundo (criada no carregamento, scene.add no topo) -----
const garage=makeBombGarage();
garage.position.set(PAD.x,groundHeight(PAD.x,PAD.z),PAD.z);
// boca do galpão (-z no modelo) virada pra cidade (+x, lado de onde o carro
// chega na orla oeste): -z girado por -90° aponta pra +x.
garage.rotation.y=-Math.PI/2;
scene.add(garage);

// arma a bomba no carro atual: valida (dinheiro, veículo válido, já armado),
// cobra o preço e guarda a referência. Antes de re-armar OUTRO carro, limpa o
// anterior pra não deixar a escala/beacon presos nele.
function armBomb(){
  // guardas defensivas (a zoneAction já filtra, mas armBomb pode ser chamado
  // direto): sem dinheiro, sem carro, carro especial, ou o MESMO carro já armado.
  if(!cur||state.mode!=='car')return;
  if(armedCar===cur)return;                 // já está armado: não cobra de novo
  if(isSpecialVehicle(cur)){
    message('CANT RIG THIS VEHICLE','var(--gold)');
    return;
  }
  if(state.money<PRICE){
    message('NOT ENOUGH CASH ($'+PRICE+')','var(--gold)');
    return;
  }
  // re-armar um carro novo sem ter detonado o anterior: solta o antigo limpo.
  if(armedCar)clearArmed();
  economy.spend(PRICE,'bomb-shop');
  armedCar=cur;
  t=0;tickT=0;
  attachBeacon(armedCar.g);
  message('CAR BOMB ARMED - GET OUT AND DETONATE','var(--gold)');
  // bipe de "armado" (acorde curto) + um tom agudo de confirmação
  blip([523,392,261],.1,'square',.18);
  blip([880],.12,'sine',.12);
}

// remove the bomb car from the world and from every list it may be in (an exited
// car goes to idleCars; defensive for traffic/cops too). The explosion itself
// (blastDamage) only DENTS parked cars, so this is what actually destroys the
// rigged car — without it the bomb "doesn't blow up" the car you paid to rig.
function removeBombCar(c: any){
  if(!c||!c.g)return;
  scene.remove(c.g);
  for(const arr of[idleCars,refs.traffic,refs.cops]){
    if(!Array.isArray(arr))continue;
    const i=arr.indexOf(c);
    if(i>=0)arr.splice(i,1);
  }
}

// detona o carro-bomba: explosão na posição dele (mata gangues/policiais ao
// redor), feedback grande e limpa a referência com segurança.
function detonate(){
  if(!armedCar)return;
  const car=armedCar;                 // capture before clearArmed() nulls it
  const pos=car.g.position.clone();
  // restaura escala/beacon ANTES da explosão pra não deixar resíduo caso o carro
  // sobreviva (explodeAt não remove o próprio carro do jogador).
  clearArmed();
  // destroy the rigged car ourselves: the blast wave only dents idle cars, so
  // remove it before the FX so the detonation actually consumes the car.
  removeBombCar(car);
  refs.explodeAt?.(pos);
  bigText('BOOM!','var(--gold)');
  setTimeout(hideBig,1100);
  // BOOM em camadas: estouro grave (sawtooth caindo) + estalo agudo de detonação
  blip([200,150,90,60],.16,'sawtooth',.24);
  blip([1200,300],.08,'square',.16);
}

// ----- registries (preenchidos via refs no carregamento) -----

// 1) ARMAR: dentro do carro, parado na garagem.
(refs.zoneActions||(refs.zoneActions=[])).push(()=>{
  if(state.mode!=='car'||!cur)return null;
  const p=cur.g.position;
  if(Math.hypot(p.x-PAD.x,p.z-PAD.z)>PAD_RANGE||Math.abs(cur.speed)>ARM_SPEED)return null;
  if(armedCar===cur)return{label:'ARMED',prompt:'BOMB ALREADY ARMED',enabled:false} as ZoneAction;
  // veículo único/de missão: mostra o prompt mas desabilitado (não corrompe).
  if(isSpecialVehicle(cur))
    return{label:'BOMB',prompt:'CANT RIG THIS VEHICLE',enabled:false} as ZoneAction;
  return{label:'BOMB',prompt:'ARM CAR BOMB ($'+PRICE+')',enabled:state.money>=PRICE,
    run(){armBomb();}};
});

// 2) DETONAR: a pé, perto do carro armado.
(refs.zoneActions||(refs.zoneActions=[])).push(()=>{
  if(state.mode!=='foot'||!armedCar)return null;
  if(playerPos().distanceTo(armedCar.g.position)>DETONATE_RANGE)return null;
  return{label:'DETONATE',prompt:'DETONATE CAR BOMB',enabled:true,
    run(){detonate();}};
});

// POI fixo no radar (ícone 'bomb'; se desconhecido o hud cai no genérico, ok).
(refs.miniBlips||(refs.miniBlips=[])).push(()=>
  [{x:PAD.x,z:PAD.z,icon:'bomb',color:'#ff3b3b',label:'DEMO GARAGE'}]);

// debug: estado pro render_game_to_text
refs.getBombShopState=()=>({armed:!!armedCar});

export function updateBombShop(dt: number){
  t+=dt;
  if(!armedCar)return;
  // carro armado saiu da cena (destruído/recolhido por outro sistema): solta a
  // referência de forma segura. resetArmedScale roda dentro de clearArmed mas
  // como o grupo não está mais na cena, o efeito é só zerar nosso estado e o
  // beacon (que será removido junto ao grupo de qualquer modo).
  if(!armedCar.g.parent){clearArmed();return;}
  // feedback de "armado": (1) pulso vertical leve no carro pra chamar atenção
  // sem mexer na física, e (2) beacon vermelho piscando no teto.
  const pulse=Math.sin(t*9);
  armedCar.g.scale.y=1+pulse*.04;
  if(beacon){
    // piscada do farol: alterna visibilidade num ritmo nervoso + leve "respiro".
    const on=Math.floor(t*4)%2===0;
    beacon.visible=on;
    beacon.scale.setScalar(on?1+Math.abs(pulse)*.25:1);
  }
  // "tique-tique" da bomba: um clique grave periódico enquanto o carro está
  // armado, pra dar tensão. Frequência fixa (~2.5 Hz).
  tickT+=dt;
  if(tickT>=.4){
    tickT-=.4;
    blip([140],.04,'square',.05);
  }
}
