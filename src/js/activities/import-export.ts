import * as THREE from 'three';
import {state,refs,carNames} from '@/core/state.ts';
import {economy} from '@/core/economy.ts';
import {scene} from '@/core/engine.ts';
import {playerPos,cur,idleCars} from '@/actors/player.ts';
import {message,bigText,hideBig} from '@/ui/hud.ts';
import {blip} from '@/audio/audio.ts';
import {N,nodeX,pick,irand,clamp,groundHeight} from '@/core/constants.ts';
import {REWARDS} from '@/core/minigame-rewards.ts';
import {makeExportGarage} from '../../assets/models/props/export-garage.ts';
import {MiniGame,MiniGameId} from '@/activities/minigame.ts';

// atividade livre (não trava o mundo): registra a identidade no enum/registro de
// mini games. A ação EXPORT já fica indisponível durante uma sessão (trava nas
// zoneActions do input/hud).
new MiniGame({id:MiniGameId.IMPORT_EXPORT,name:'Dock Exports',exclusive:false});

// Minigame DOCK EXPORTS (garagem da doca que compra carros, estilo open-world): uma
// garagem fica numa interseccao do mapa. Ela mantem uma "lista de procurados"
// (um nome de carro sorteado de carNames). O jogador leva QUALQUER carro comum
// ate a zona, para dentro dela e exporta: ganha um pagamento base; se o carro
// bater com o procurado da vez, leva um BONUS de demanda. Depois sorteia o
// proximo pedido. Sem expulsar/forcar nada — so dirige ate la e aperta E parado.
// Veiculos especiais/unicos (taxi, viatura, vigilante, ambulancia, bombeiro,
// lancha, moto, aviao, RC) NAO podem ser exportados — sao recusados.

// PAD = doca de exportacao na ORLA NORTE (a beira-mar, fora da rua): exportar
// carros "pelo mar" faz sentido na orla. Antes ficava no cruzamento (88,88), em
// cima da ambulancia do paramedico; agora sai de cima dela com folga de sobra.
const PAD={x:120,z:-198};
const ZONE_R=5;          // raio da zona de entrega
const STOP_SPEED=3;      // velocidade maxima pra contar como "parado"

// Estado da garagem.
let wanted=pick(carNames); // carro pedido agora (bonus se entregar este)
let exported=0;            // total exportado nesta sessao
let wasNear=false;         // jogador estava dentro da zona no frame anterior?
let t=0;                   // relogio interno (animacao do guindaste)

// Maquina de estado da exportacao (sequencia para nao remover o carro com o
// jogador ainda sentado nele). Fases: 'exiting' espera o jogador desembarcar,
// 'lift' anima o guindaste levantando o carro, depois paga e some com ele.
interface ExportJob{car:any;total:number;match:boolean;phase:string;t:number;x0?:number;z0?:number;y0?:number;}
let job: ExportJob | null=null;  // {car,total,match,phase,t} ou null

// Cria a garagem no carregamento e posiciona no chao do PAD (a marca aponta o
// portao para -z; aqui fica de frente pra rua, mas a orientacao e cosmetica).
const garage=makeExportGarage();
garage.position.set(PAD.x,groundHeight(PAD.x,PAD.z),PAD.z);
garage.rotation.y=Math.PI; // portao (-z no modelo) virado pra cidade (+z), de onde o carro chega
scene.add(garage);
// guindaste e gancho expostos pelo modelo para a animacao de export
const hook=garage.userData.hook||null;
const crane=garage.userData.crane||null;
// posicao de repouso do gancho (no espaco local do guindaste) para restaurar
// depois de cada export.
const hookRestY=hook?hook.position.y:0;

// Lista de flags que marcam veiculos especiais/unicos que NAO podem virar
// exportacao (perderiamos o veiculo unico do mundo para sempre). Os nomes foram
// confirmados lendo taxi.js, vigilante.js, paramedic.js, firefighter.js,
// rc-toyz.js e player.js.
function isSpecial(car: any){
  return !!(car&&(car.taxi||car.police||car.vigilante||car.ambulance||
    car.firetruck||car.boat||car.bike||car.plane||car.name==='RC RAGER'));
}

// Sorteia um novo pedido diferente do atual. Se a lista so tiver um nome, sai do
// laco pelo limite e mantem o mesmo (sem loop infinito).
function nextWanted(){
  if(carNames.length<2)return;          // nada a sortear: evita laco eterno
  let w=wanted;
  for(let i=0;i<8&&w===wanted;i++)w=pick(carNames);
  wanted=w;
}

// Comeca a exportar o carro atual: valida, calcula o pagamento e inicia a
// sequencia (sair do carro -> guindaste -> sumir). NAO remove nada aqui: a
// remocao acontece no fim da fase 'lift', com o jogador ja fora do carro.
function startExport(){
  if(job)return;                        // ja exportando
  // regra 1x/dia: já exportou hoje? avisa e não começa.
  if(refs.mgPlayedToday?.(MiniGameId.IMPORT_EXPORT)){message('ALREADY EXPORTED TODAY - COME BACK TOMORROW','var(--gold)');return;}
  const car=cur;
  if(!car)return;
  // veiculo especial/unico: recusa e avisa (nunca destroi o unico do mundo)
  if(isSpecial(car)){
    message('CAN\'T EXPORT THIS VEHICLE','var(--gold)');
    blip([220,165],.1,'square',.14);
    return;
  }
  // pagamento base + bonus de demanda se for o carro procurado
  let total=REWARDS.importExport.baseMin+irand(0,REWARDS.importExport.baseRandomSpan);
  const match=car.name===wanted;
  if(match)total+=REWARDS.importExport.matchBonus;

  job={car,total,match,phase:'exiting',t:0};
  // manda o jogador desembarcar (animacao de porta). Quando terminar, o player.js
  // devolve o carro para idleCars e volta para o modo 'foot' — so entao seguimos.
  refs.exitCar?.();
  blip([392,330],.07,'square',.14); // confirmacao do "negocio fechado"
}

// Conclui a exportacao depois do guindaste: remove o carro do mundo e das listas,
// paga, atualiza placar e sorteia o proximo pedido.
function finishExport(j: ExportJob){
  const car=j.car;
  // remove o carro do mundo e das listas (idleCars / traffic / cops por garantia)
  scene.remove(car.g);
  for(const arr of[idleCars,refs.traffic,refs.cops]){
    if(!arr)continue;
    const i=arr.indexOf(car);
    if(i>=0)arr.splice(i,1);
  }

  economy.earn(j.total,'import-export');
  refs.mgMarkPlayed?.(MiniGameId.IMPORT_EXPORT); // concluído: trava até o próximo dia
  exported++;

  if(j.match){
    message('PERFECT MATCH!  +$'+j.total,'var(--gold)');
    bigText('PERFECT MATCH!','var(--gold)');
    blip([523,659,784,1047],.09,'square',.2);
  }else{
    message('EXPORTED  +$'+j.total,'var(--gold)');
    bigText('+$'+j.total,'var(--gold)');
    blip([392,523,659],.08,'square',.16);
  }
  setTimeout(hideBig,1100);

  // puff de poeira no lugar do carro (cosmetico, baixo custo, auto-removivel)
  dustPuff(car.g.position.x,car.g.position.z);

  wasNear=false;       // forca remostrar o WANTED na proxima aproximacao
  nextWanted();
}

// Poeira do export: um punhado de quads claros que sobem e somem. Usa um unico
// grupo temporario, removido sozinho no fim — nada fica preso na cena.
const puffMat=new THREE.SpriteMaterial({color:0xcfcabf,transparent:true,opacity:.8,depthWrite:false});
function dustPuff(x: number,z: number){
  const grp=new THREE.Group();
  const gy=groundHeight(x,z);
  const parts: {s:THREE.Sprite;vy:number;vr:number}[]=[];
  for(let i=0;i<8;i++){
    const s=new THREE.Sprite(puffMat.clone());
    const a=Math.random()*Math.PI*2,r=Math.random()*1.4;
    s.position.set(Math.cos(a)*r,.4+Math.random()*.6,Math.sin(a)*r);
    const sc=1.1+Math.random()*1.1;s.scale.set(sc,sc,sc);
    grp.add(s);
    parts.push({s,vy:1.6+Math.random()*1.4,vr:r*1.2});
  }
  grp.position.set(x,gy,z);
  scene.add(grp);
  let life=0;
  const dur=.9;
  const tick=(dt: number)=>{
    life+=dt;
    const k=clamp(life/dur,0,1);
    for(const p of parts){
      p.s.position.y+=p.vy*dt;
      p.s.material.opacity=.8*(1-k);
    }
    if(k>=1){
      scene.remove(grp);
      for(const p of parts)p.s.material.dispose();
      const idx=puffs.indexOf(tick);if(idx>=0)puffs.splice(idx,1);
    }
  };
  puffs.push(tick);
}
const puffs: ((dt: number)=>void)[]=[]; // animacoes de poeira ativas (avancadas no update)

// Avanca a sequencia de export (chamada do update). Retorna quando o job acaba.
function updateJob(dt: number){
  const j=job;
  if(!j)return;
  if(j.phase==='exiting'){
    // espera o jogador terminar de desembarcar (player.js volta para 'foot' e
    // larga o carro). So avanca quando ele REALMENTE saiu — nunca ergue um carro
    // com o jogador dentro.
    j.t+=dt;
    const out=state.mode==='foot'&&!cur;
    if(!out){
      // timeout de seguranca: se o desembarque travou (ex.: cut-scene), aborta o
      // negocio sem cobrar nem sumir com o carro.
      if(j.t>3){job=null;}
      return;
    }
    {
      j.phase='lift';j.t=0;
      // tira o carro das listas JA no inicio do lift: assim o jogador nao
      // consegue reentrar/colidir com o carro suspenso (o mesh continua na cena
      // ate o fim do lift, removido em finishExport).
      for(const arr of[idleCars,refs.traffic,refs.cops]){
        if(!arr)continue;
        const i=arr.indexOf(j.car);
        if(i>=0)arr.splice(i,1);
      }
      // empurra o carro pra dentro do portao da garagem antes de erguer
      j.x0=j.car.g.position.x;j.z0=j.car.g.position.z;j.y0=j.car.g.position.y;
    }
  }else if(j.phase==='lift'){
    j.t+=dt;
    const dur=1.1;
    const k=clamp(j.t/dur,0,1);
    // o carro desliza para o centro do PAD e sobe (guindaste o iça)
    const car=j.car;
    car.g.position.x=j.x0!+(PAD.x-j.x0!)*Math.min(1,k*1.4);
    car.g.position.z=j.z0!+(PAD.z-j.z0!)*Math.min(1,k*1.4);
    car.g.position.y=j.y0!+k*k*3.2;        // sobe acelerando
    car.g.rotation.z=Math.sin(k*Math.PI)*.08; // leve balanco ao ser erguido
    // gancho do guindaste desce ate o carro e acompanha a subida
    if(hook)hook.position.y=hookRestY-1.4+k*3.2;
    if(k>=1){
      car.g.rotation.z=0;
      if(hook)hook.position.y=hookRestY; // restaura o gancho
      finishExport(j);
      job=null;
    }
  }
}

// Acao de zona (E, no carro parado dentro da zona). Checa o modo internamente.
(refs.zoneActions||(refs.zoneActions=[])).push(()=>{
  if(state.mode!=='car'||!cur||job)return null;
  const p=cur.g.position;
  if(Math.hypot(p.x-PAD.x,p.z-PAD.z)>ZONE_R||Math.abs(cur.speed)>STOP_SPEED)return null;
  // veiculo especial: ainda mostra o prompt, mas explicando que e recusado
  if(isSpecial(cur))
    return{label:'EXPORT',prompt:'CAN\'T EXPORT THIS VEHICLE',enabled:true,run(){startExport();}};
  const tag=cur.name===wanted?'PERFECT MATCH — BONUS!':wanted;
  return{label:'EXPORT',prompt:'EXPORT THIS CAR ('+tag+')',enabled:true,run(){startExport();}};
});

// Blip fixo no radar/mapa (POI da garagem).
(refs.miniBlips||(refs.miniBlips=[])).push(()=>[
  {x:PAD.x,z:PAD.z,icon:'package',color:'#7ad0ff',label:'DOCK EXPORTS'}
]);

// Snapshot pro render_game_to_text.
refs.getImportExportState=()=>({wanted,exported,busy:!!job});

// Loop: dispara a mensagem WANTED uma vez por aproximacao (so com carro comum) e
// balanca o gancho do guindaste de leve quando ocioso; avanca export e poeira.
export function updateImportExport(dt: number){
  t+=dt;
  // poeira do export (independe de haver job ativo)
  for(let i=puffs.length-1;i>=0;i--)puffs[i](dt);
  // sequencia de export em andamento tem prioridade sobre o balanco ocioso
  if(job){updateJob(dt);return;}

  // balanco cosmetico do gancho do guindaste (espaco local), so quando ocioso
  if(hook)hook.position.y=hookRestY;
  if(crane)crane.rotation.z=Math.sin(t*1.3)*.02;

  // deteccao de aproximacao: so dentro de um carro comum e parado/quase parado.
  // veiculos especiais nao disparam a oferta WANTED (nao da pra exportar).
  const inCar=state.mode==='car'&&!!cur&&!isSpecial(cur);
  const pp=playerPos();
  const near=inCar&&Math.hypot(pp.x-PAD.x,pp.z-PAD.z)<=ZONE_R&&Math.abs(cur!.speed)<=STOP_SPEED;
  if(near&&!wasNear){
    if(cur!.name===wanted){
      message('PERFECT MATCH! THIS IS THE '+wanted+' — EXPORT FOR A BONUS','var(--gold)');
      blip([523,659,784],.07,'square',.14);
    }else{
      message('WANTED: '+wanted+' — EXPORT ANY CAR FOR CASH','var(--cyan)');
      blip([523,392],.06,'square',.12);
    }
  }
  wasNear=near;
}
