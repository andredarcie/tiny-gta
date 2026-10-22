import {groundHeight} from '@/core/constants.ts';
import {randomRoadPoint,pavedRoad} from '@/world/divinolandia/nav.ts';
import {state,saveBest} from '@/core/state.ts';
import {economy} from '@/core/economy.ts';
import {scene} from '@/core/engine.ts';
import {blip} from '@/audio/audio.ts';
import {message} from '@/ui/hud.ts';
import {playerPos,cur} from '@/actors/player.ts';
import {makeMoneyDrop} from '../../assets/models/missions/money-drop.ts';
import {makeMarkerRing} from '../../assets/models/missions/marker-ring.ts';
import {Beacon} from '@/core/beacon.ts';
import {inGangTerritory} from '@/actors/gangs.ts';
import type * as THREE from 'three';
import type {Vehicle} from '@/core/types.ts';

// Courier jobs: a briefcase to drop at a marked spot somewhere in Divinolândia (the
// cyan ring + light beacon, a blip on the radar), plus the floating money pickups that
// kills and crashes leave behind.

// A money pickup floating in the world (collected by walking over it).
interface Drop {
  g: THREE.Object3D;
  val: number;
  t: number;
  y: number;   // ground under it
}

// A briefcase-drop courier mission (delivery marker + payout descriptor).
interface Mission {
  title: string;
  desc: string;
  reward: number;
}

// The active delivery target: ring marker, light beacon and world position.
interface Delivery {
  g: THREE.Object3D;
  beacon: Beacon;
  x: number;
  z: number;
  t0: number;
}

// Money pickups
export const drops: Drop[]=[];
export function spawnDrop(x: number,z: number,val: number){
  const y=groundHeight(x,z);
  const m=makeMoneyDrop();m.position.set(x,y+.5,z);scene.add(m);
  drops.push({g:m,val,t:0,y});
}

const MISSIONS: Mission[]=[
  {title:'TAXA DA CPI',desc:'O presidente da CPI ganhou um "agradecimento institucional" de quem ele devia investigar. Ele chama de consultoria. O Código Penal chama de outra coisa. Entrega discreta: toque a campainha, deixe o pacote e suma.',reward:210},
  {title:'CAIXA DOIS',desc:'Uma doação de campanha que legalmente não existe, para um candidato que oficialmente nunca pediu. O dinheiro veio de uma empresa de fachada do cunhado do tesoureiro. Democracia sai caro.',reward:195},
  {title:'PARAÍSO FISCAL',desc:'Papéis de uma holding nas Ilhas Cayman, passando pelo Panamá, até um apartamento em Miami que o senador jura que nunca visitou. Entregue para um homem que não existe.',reward:230},
  {title:'DESVIO DA MERENDA',desc:'Um contrato de quatro milhões de reais para uma merenda que nunca chegou às escolas. A fornecedora é a mulher do secretário. As crianças comem bolacha. O assessor come sushi. Entregue o troco.',reward:175},
  {title:'EMENDA PARLAMENTAR',desc:'Verba federal para uma ONG num endereço vazio, num bairro onde o deputado nunca pisou. O beneficiário agradece. O contribuinte nem faz ideia. Leve este envelope até lá.',reward:185},
  {title:'LICITAÇÃO DE CARTAS MARCADAS',desc:'Cinco empresas diferentes, um endereço, um contador e a mesma letra em todas as propostas. O vencedor foi escolhido antes de abrirem os envelopes. Entregue os parabéns.',reward:200},
  {title:'DIÁRIA DE VIAGEM',desc:'Um servidor em viagem oficial ficou no único hotel da cidade, que é do irmão do prefeito, a R$ 1.200 a diária. Pegue a nota assinada antes da auditoria.',reward:165},
  {title:'DOSSIÊ DO JUIZ',desc:'O magistrado pediu "material de pesquisa" sobre o réu. Veio de um detetive particular contratado pela outra parte. A sentença sai logo. Não leia, só entregue.',reward:220},
  {title:'GASOLINA DO ESTADO',desc:`Duzentos litros de gasolina pública foram para o carro do secretário adjunto, o carro da esposa e o gerador do sítio da família. Leve o vale para assinar. "Viagem oficial."`,reward:170},
  {title:'CONTRATO FANTASMA',desc:'Uma empresa aberta há três semanas, sem funcionários, sem escritório, sem histórico e com um contrato de oito milhões com a prefeitura. O dono tem 22 anos e é afilhado do vereador. Entregue a primeira parcela.',reward:240},
  {title:'PONTE INACABADA',desc:'O mesmo governador inaugurou a ponte duas vezes, em dois mandatos diferentes, e ela ainda não ficou pronta. O orçamento triplicou. A empreiteira doou para a campanha. Leve a nota da terceira licitação.',reward:190},
  {title:'CONGRESSO VIP',desc:'Voo de primeira classe, hotel cinco estrelas e verba de "representação", tudo para um congresso internacional em que o deputado ficou três horas antes de voltar para casa. Entregue o recibo.',reward:180},
  {title:'BARRACO DECLARADO',desc:'Uma mansão de R$ 3,2 milhões foi declarada como casa de madeira de dois cômodos na declaração de bens. O IPTU foi pago com o cartão corporativo. Leve as escrituras ao advogado antes do prazo.',reward:215},
  {title:'PROJETO SOCIAL',desc:'Uma ONG sem sede, sem funcionários e sem atividade recebeu R$ 600 mil para "capacitar jovens". O único capacitado foi o presidente, que comprou uma caminhonete nova. Entregue o relatório de atividades.',reward:185},
  {title:'ACORDÃO',desc:`Três ministros, dois votos decisivos e uma decisão que ninguém entende, mas todo mundo reconhece. O advogado precisa do "material de apoio" antes da sessão de amanhã. Não pergunte o que é.`,reward:225},
  {title:'VERBA DA SAÚDE',desc:'Respiradores comprados a R$ 40 mil cada, quando custam R$ 8 mil no mercado. O fabricante abriu a empresa na véspera da licitação. Aprovado em plena pandemia. Entregue os manuais "técnicos".',reward:210},
];

export let curMission: Mission | null=null;
let missionPool: number[]=[];
function nextMission(): Mission{
  if(missionPool.length===0){
    missionPool=MISSIONS.map((_,i)=>i);
    for(let i=missionPool.length-1;i>0;i--){
      const j=Math.floor(Math.random()*(i+1));
      [missionPool[i],missionPool[j]]=[missionPool[j],missionPool[i]];
    }
  }
  return MISSIONS[missionPool.pop()!];
}

export let delivery: Delivery | null=null;
export function spawnDelivery(){
  if(delivery){scene.remove(delivery.g);delivery.beacon.dispose();}
  // a street of the town a fair drive away (not inside a gang's turf)
  const px=playerPos();let x=px.x,z=px.z,tries=0;
  do{const p=randomRoadPoint({f:pavedRoad,near:{x:px.x,z:px.z},min:250,max:900});x=p.x;z=p.z;tries++;}
  while(inGangTerritory(x,z)&&tries<30);
  const ring=makeMarkerRing(0x19e3ff);
  ring.rotation.x=Math.PI/2;ring.position.set(x,groundHeight(x,z)+.4,z);scene.add(ring);
  const beacon=new Beacon(0x19e3ff).at(x,z).mount();
  curMission=nextMission();
  delivery={g:ring,beacon,x,z,t0:state.time};
  setMissionHUD();
}

// HUD minimalista estilo mundo aberto: missão atual não aparece mais na tela
export function setMissionHUD(){}

// No 3D arrow for deliveries: the radar blip is enough.
export function updatePickups(dt: number){
  const pp=playerPos();
  for(let i=drops.length-1;i>=0;i--){
    const d=drops[i];d.t+=dt;
    d.g.rotation.y+=3*dt;d.g.position.y=d.y+.5+Math.sin(d.t*4)*.12;
    if(d.t>25){scene.remove(d.g);drops.splice(i,1);continue;}
    if(pp.distanceTo(d.g.position)<2.6){
      economy.earn(d.val,'cash-drop');blip([660,990],0.07,'sine',.15);
      scene.remove(d.g);drops.splice(i,1);
    }
  }
  if(delivery){
    delivery.g.rotation.z+=2*dt;
    const sc=1+Math.sin(state.time*4)*.12;delivery.g.scale.set(sc,sc,1);
    // entrega só no chão e fora do avião (sobrevoar o marcador não conta)
    const inPlane=state.mode==='car'&&(cur as Vehicle | null)?.plane;
    if(!inPlane&&pp.y-groundHeight(pp.x,pp.z)<3&&Math.hypot(pp.x-delivery.x,pp.z-delivery.z)<3.2){
      const base=curMission?curMission.reward:150;
      const fast=Math.max(0,Math.round(120-(state.time-delivery.t0)*4));
      economy.earn(base+fast,'delivery');state.deliveries++;
      message(fast>0?`ENTREGA +R$${base+fast} - BÔNUS DE VELOCIDADE!`:`ENTREGA FEITA  +R$${base}`,'var(--gold)');
      blip([523,659,784,1047],0.09,'sine',.18);
      saveBest();spawnDelivery();
    }
  }
}
