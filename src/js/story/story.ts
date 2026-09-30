import * as THREE from 'three';
import {nodeX,groundHeight} from '@/core/constants.ts';
import {state,refs} from '@/core/state.ts';
import {economy} from '@/core/economy.ts';
import {scene} from '@/core/engine.ts';
import {phoneRing} from '@/audio/audio.ts';
import {message} from '@/ui/hud.ts';
import {solids} from '@/world/world.ts';
import {getTod,setTod} from '@/world/daynight.ts';
import {player,playerPos,cameraRig} from '@/actors/player.ts';
import {Beacon} from '@/core/beacon.ts';
import {MiniGame} from '@/activities/minigame.ts';
import {makeStoryArrow} from '../../assets/models/missions/story-arrow.ts';
import boothModel,{STAND} from '../../assets/models/props/phone-booth.ts';
import holyWaterModel from '../../assets/models/props/holy-water.ts';
import {playPhoneCall,playMonologue,playDialogue,fadeThrough,updateCutscene,reachHand,setTalkPose,showMissionPass,
  showStoryEnd,advanceCine,cineActive,type CineLine,type Voice} from '@/story/cutscene.ts';
import {fpAnswer,fpHangUp,fpBusy,fpOnAbort,fpHeld,fpGiveFlask,fpDropFlask,fpSprinkle,releaseHeld,setPhoneHands,
  updateStoryFocus,updateStoryHands} from '@/story/story-fp.ts';
import {CAMP,CAMP_SIZE,CAMP_NAMES,campers,buildCamp,removeCamp,updateCamp,campBuilt,campAlive,campAlarmed,
  killAllCampers} from '@/story/redneck-camp.ts';
import {startBurial,stopBurial,burialAction,burialGoal,updateBurial,burialState,restoreGraves,graveRecords,clearGraves,
  shovelSave,finishRemaining,buriedCount,setGravesOpen,BURY_TARGET} from '@/story/burial.ts';
import {setupSummit,poseSummit,endSummit,updateSummitFx,INTRO_T,OUTRO_T} from '@/story/summit.ts';
import {zombies,spawnZombies,clearZombies,updateZombies,zombiesAlive,cursedCorpses,corpseRecords,burnCorpse,
  nearestCorpse,onCorpsesBurned,mendCorpses,killAllZombies} from '@/story/zombies.ts';
import {PRIEST,MEET,spawnPriest,removePriest,priestPed,priestNear,spawnCrowd,clearCrowd,crowdOut,crowdCheer,
  updatePriest} from '@/story/priest.ts';
import {STAGES,type Stage,sanitizeStorySave,type StorySave} from '@/story/chain.ts';

// ============================================================================
// THE STORY — a chain of missions handed out by the crime BOSS over a street PAY
// PHONE (the "orelhão"). The boss is only ever a voice on the line. By the user's
// request the whole story — dialogue, prompts and messages — is in Brazilian
// Portuguese (the rest of the game stays English, see js/core/i18n.ts).
//
// MISSION 1 — O TESTE
//   call1  — A pay phone rings a block from where the player starts (a big, pulsing
//            PHONE icon on the radar/map, a light column over the booth, and the bell
//            is heard as you get close). Answer it: the receiver is lifted in first
//            person, then the cinematic call. The test: wipe out a redneck camp.
//   camp   — The camp only exists now (js/story/redneck-camp.ts). Kill all six.
//   call2  — "Você acha que isso é videogame?"... test passed. Now bury them.
// MISSION 2 — DO PÓ AO PÓ
//   burial — BURY_TARGET graves dug by hand in first person (js/story/burial.ts), then a
//            time skip: the player sits on the mountain summit and smokes a cigarette,
//            looking over the forest (js/story/summit.ts), then stands up.
//   call3  — Report back to the boss. Mission passed.
// MISSION 3 — ÁGUA BENTA
//   call4  — The phone rings again: the six rose from their graves as zombies and are
//            attacking the village.
//   zombies— Kill them again (js/story/zombies.ts): no guns, arms out, they claw.
//   call5  — The bodies are cursed: go see the priest of Pine Hollow.
//   priest — At the church door the priest preaches total submission and hands over
//            holy water (js/story/priest.ts).
//   holywater — Sprinkle each cursed body in first person: it burns away.
//   blessing — Back to the priest: the villagers kneel around the player, hailing the
//            saviour. Mission passed, respect with the priest.
//   done   — The graves stay in the woods. More calls to come.
//
// Progress is saved (stage + where the bodies lie + the graves + where the shovel is).
// ============================================================================

const BOSS: Voice={freq:78,type:'sawtooth',phone:true};
const YOU: Voice={freq:150,type:'square'};
const PADRE: Voice={freq:112,type:'triangle'};
const boss=(text: string): CineLine=>({who:'O CHEFÃO',text,voice:BOSS,by:'npc'});
const you=(text: string): CineLine=>({who:'VOCÊ',text,voice:YOU,by:'player'});
const padre=(text: string): CineLine=>({who:'PADRE ANSELMO',text,voice:PADRE,by:'npc'});
const crowd=(text: string): CineLine=>({who:'O POVO',text,voice:{freq:210,type:'square'},by:'npc'});

const CALL1: CineLine[]=[
  boss('Bem-vindo à Cidade do Pecado, meu amigo.'),
  boss('Coisas grandes acontecem nessa cidade. E você... você vai fazer coisas grandes. NÓS vamos fazer coisas grandes juntos.'),
  you('Quem tá falando?'),
  boss('Não importa quem eu sou. Importa o que você tá disposto a fazer.'),
  boss('Todo mundo que trabalha pra mim passa por um teste antes. Pode chamar de prova de admissão.'),
  boss('Lá na zona rural, depois da montanha, perto da estrada de Pine Hollow, tem um acampamento no meio do mato. Umas barracas, uma fogueira e seis caipiras armados.'),
  boss('Acaba com eles. Com os seis. Como você vai fazer isso é problema seu.'),
  boss('Deixei uns brinquedinhos em volta do acampamento pra você. Quando terminar, volta pra esse orelhão. Eu ligo.'),
];
const CALL2: CineLine[]=[
  you('Tá feito. O acampamento tá limpo. Os seis.'),
  boss('...Você fez O QUÊ?'),
  boss('Você acha que isso aqui é videogame?! Você entrou naquele mato e matou seis pessoas a sangue frio!'),
  boss('Só porque uma voz num orelhão mandou? Podia ser qualquer um! Podia ser um trote!'),
  boss('Você acha que pode sair tirando a vida das pessoas assim?'),
  boss('...'),
  boss('Relaxa. Você passou no teste. Era exatamente isso que eu queria ver.'),
  boss('Mas aquelas pessoas tinham família. Eu quero que elas sejam respeitadas.'),
  boss('Volta lá no acampamento. Tem uma pá do lado da lenha. Seis corpos, seis covas. Faz direito.'),
  you('Você tá falando sério.'),
  boss('Sério como um defunto. Vai cavar.'),
];
// after the time skip, sitting on the summit with a cigarette
const MONOLOGUE: CineLine[]=[
  you('Ufa... Foi um trabalho puxado. Trabalho pesado mesmo.'),
  you('Seis covas, seis cruzes. Mas finalmente a gente respeitou aquela gente.'),
  you('Agora é voltar lá no orelhão e avisar o chefão.'),
];
const CALL3: CineLine[]=[
  you('Pronto, chefe. Os seis tão enterrados. Cada um na sua cova, com cruz e tudo.'),
  boss('Eu sei. Eu tenho olhos em todo canto dessa cidade.'),
  boss('Você fez o serviço sujo e ainda limpou a sujeira. Isso é raro hoje em dia.'),
  boss('Gostei de você. A partir de hoje, você trabalha pra mim.'),
  boss('Fica de olho nos orelhões. Quando um deles tocar... é pra você.'),
];
const CALL4: CineLine[]=[
  boss('Temos um problema. Um problemão.'),
  boss('Aconteceu um desastre absurdo lá no mato. Nas covas que você cavou.'),
  you('Que desastre? Eles tão enterrados.'),
  boss('ESTAVAM. A terra se abriu. Os seis caipiras levantaram... como zumbis.'),
  boss('Tão indo pra vila de Pine Hollow, atacando e matando quem aparece pela frente.'),
  you('Zumbis. Você só pode tá de brincadeira.'),
  boss('Eu tenho cara de quem brinca? Vai lá e mata eles de novo. E dessa vez, mira na cabeça.'),
];
const CALL5: CineLine[]=[
  you('Pronto. Os seis tão no chão. De novo.'),
  boss('Não é tão simples. Esses corpos tão amaldiçoados. Enquanto ficarem lá, vão levantar de novo.'),
  boss('Vai até a vila, depois da montanha. Tem um padre na porta da igreja.'),
  boss('Ele entende desse tipo de coisa. Eu não mexo com isso.'),
];
const PRIEST_TALK: CineLine[]=[
  padre('Eu sei por que você veio, meu filho. Os mortos do mato não descansam.'),
  you('Disseram que os corpos tão amaldiçoados. Como eu acabo com isso?'),
  padre('Nenhuma bala mata o que já está morto. Pra livrar aquele lugar dos demônios, você precisa abraçar o caminho da submissão total.'),
  padre('Se ajoelhar e rezar todos os dias. Entregar tudo.'),
  padre('O mal que você vai resolver ali é pela cidade inteira. Você vai ser um herói, meu filho. Vão te considerar um Jesus Cristo.'),
  you('...Um Jesus Cristo. Tá bom, padre.'),
  padre('Tome esta água benta. Jogue um pouco sobre cada corpo, e o fogo do céu vai levá-los embora.'),
];
const BLESSING: CineLine[]=[
  padre('Você voltou, meu filho. Eu senti quando o mal deixou aquele mato.'),
  crowd('SALVADOR! SALVADOR!'),
  padre('Olhe à sua volta. Essa gente ajoelhada é a prova. Você livrou Pine Hollow dos demônios.'),
  you('Eu só joguei um pouco de água, padre.'),
  crowd('ABENÇOADO SEJA! NOSSO HERÓI!'),
  padre('A fé move montanhas, meu filho. E você moveu uma vila inteira. Vá em paz.'),
];
const CALLS: Partial<Record<Stage,CineLine[]>>={call1:CALL1,call2:CALL2,call3:CALL3,call4:CALL4,call5:CALL5};
const REWARD_TEST=1500, REWARD_BURIAL=800, REWARD_HOLY=1000;
const RESPECT='▲ RESPEITO COM O CHEFÃO', RESPECT_PRIEST='▲ RESPEITO COM O PADRE';
const QUIET_AFTER_CALL3=12;                 // seconds before the fourth call rings

// ---- the booth: on the sidewalk a block ahead of where the player starts ----------
const BOOTH={x:nodeX(4)+9.3,z:nodeX(4)+30,ry:-Math.PI/2};   // open front faces the street (west)
const booth=boothModel.build();
booth.position.set(BOOTH.x,groundHeight(BOOTH.x,BOOTH.z),BOOTH.z);
booth.rotation.y=BOOTH.ry;
scene.add(booth);
booth.updateMatrixWorld(true);
// only the back wall is solid (the front is open: you walk in to answer)
{const bx=BOOTH.x+.5;solids.push({x0:bx,x1:bx+.14,z0:BOOTH.z-.6,z1:BOOTH.z+.6,h:2.4});}
const handset=booth.userData.handset as THREE.Object3D;
const standWorld=booth.localToWorld(STAND.clone());
const phoneWorld=booth.localToWorld(new THREE.Vector3(0,1.46,-.5));
const hookWorld=()=>({pos:booth.localToWorld((booth.userData.hookPos as THREE.Vector3).clone()),
  quat:booth.getWorldQuaternion(new THREE.Quaternion()).multiply(booth.userData.hookQuat as THREE.Quaternion)});
let beacon: Beacon|null=null;

// ---- state ----------------------------------------------------------------------
const S: {stage: Stage;busy: boolean;onCall: boolean;ringT: number;quietT: number}=
  {stage:'call1',busy:false,onCall:false,ringT:0,quietT:0};
const ringing=()=>!!CALLS[S.stage]&&!S.busy&&S.quietT<=0;
const stageAtLeast=(s: Stage)=>STAGES.indexOf(S.stage)>=STAGES.indexOf(s);

function save(){refs.backupSave?.();}

// Where the zombies rise: at each grave (or the camp posts, if there are none).
function zombieStarts(): {x: number;z: number}[]{
  const g=graveRecords();
  return Array.from({length:CAMP_SIZE},(_,i)=>g[i]??{x:CAMP.x+Math.cos(i)*4,z:CAMP.z+Math.sin(i)*4});
}

// Enter a stage. `restore` rebuilds the world for a stage loaded from a save.
function enterStage(stage: Stage,restore?: StorySave){
  S.stage=stage;
  if(restore&&STAGES.indexOf(stage)>STAGES.indexOf('burial'))restoreGraves(restore.graves);
  if(stage==='camp'){
    buildCamp({alive:true,
      onKill:(left)=>{if(left>0)message('FALTAM '+left+' CAIPIRAS','#ff3b56');},
      onAllDead:()=>{
        enterStage('call2');
        message('ACAMPAMENTO LIMPO - VOLTE AO ORELHÃO','var(--gold)');
        save();
      }});
  }else if(stage==='call2'){
    if(restore)buildCamp({alive:false,bodies:restore.bodies});
  }else if(stage==='burial'){
    if(restore){buildCamp({alive:false,bodies:restore.bodies});restoreGraves(restore.graves);}
    startBurial({shovel:restore?.shovel,onEnough:timeSkip});
    // saved right after the last hand-dug grave (before the time skip ran): run it now
    if(restore&&buriedCount()>=BURY_TARGET)timeSkip();
  }else if(stage==='call3'||stage==='call4'){
    stopBurial();
  }else if(stage==='zombies'){
    setGravesOpen(true);
    spawnZombies({at:zombieStarts(),names:CAMP_NAMES,
      onKill:(left)=>{if(left>0)message('FALTAM '+left+' ZUMBIS','#9dff2e');},
      onAllDead:()=>{
        enterStage('call5');
        message('OS ZUMBIS CAÍRAM - VOLTE AO ORELHÃO','var(--gold)');
        save();
      }});
  }else if(stage==='call5'||stage==='priest'){
    setGravesOpen(true);
    if(restore)spawnZombies({at:zombieStarts(),names:CAMP_NAMES,corpses:restore.bodies.length?restore.bodies:zombieStarts()});
    if(stage==='priest')spawnPriest();
  }else if(stage==='holywater'){
    setGravesOpen(true);
    spawnPriest();
    const lifted=()=>{
      fpDropFlask();
      clearZombies();setGravesOpen(false);
      enterStage('blessing');
    };
    if(restore){
      spawnZombies({at:zombieStarts(),names:CAMP_NAMES,corpses:restore.bodies.length?restore.bodies:zombieStarts()});
      if(zombies.every(z=>z.gone)){lifted();return;}  // saved with every body already burned
      fpGiveFlask(holyWaterModel.build());
    }
    mendCorpses();
    onCorpsesBurned(()=>{
      lifted();
      message('A MALDIÇÃO ACABOU - VOLTE AO PADRE','var(--gold)');
      save();
    });
  }else if(stage==='blessing'){
    spawnPriest();spawnCrowd();
  }else if(stage==='done'){
    stopBurial();
    if(restore)spawnPriest();
  }
}

// ---- the time skip: after BURY_TARGET graves the rest are "done off screen", and the
// player is found smoking on the summit, looking out over the woods ------------------
function timeSkip(){
  S.busy=true;
  // hold the player still while the screen goes black (no walking off or into a car)
  state.dlgActive=true;
  fadeThrough('ALGUMAS HORAS DEPOIS...',()=>{
    finishRemaining();                       // the other bodies are found buried
    stopBurial();                            // the shovel's job is over
    setTod((getTod()+.18)%1);                // the sun has moved on
    const look=setupSummit(new THREE.Vector3(CAMP.x,0,CAMP.z));
    playMonologue({focus:look,lines:MONOLOGUE,voice:YOU,introT:INTRO_T,outroT:OUTRO_T,onFrame:poseSummit,
      onDone:()=>{
        endSummit();
        S.busy=false;
        cameraRig.yaw=player.heading;cameraRig.fpPitch=.15;
        enterStage('call3');
        message('VOLTE AO ORELHÃO E AVISE O CHEFÃO','var(--gold)');
        save();
      }});
  });
}

// ---- the phone call ---------------------------------------------------------------
const _hw=new THREE.Vector3(),_ce=new THREE.Vector3();
function layCord(){
  // the coiled cord follows the receiver whenever it is off the hook
  if(handset.parent===booth)return;
  handset.updateWorldMatrix(true,false);
  handset.localToWorld(_ce.copy(booth.userData.cordEnd as THREE.Vector3));
  booth.worldToLocal(_ce);
  (booth.userData.span as (a: THREE.Vector3,b: THREE.Vector3)=>void)(booth.userData.cordAnchor as THREE.Vector3,_ce);
}

function answer(){
  if(!ringing()||state.mode!=='foot'||state.cine||fpBusy()||MiniGame.busy)return false;
  const stage=S.stage,lines=CALLS[stage]!;
  S.busy=true;
  beacon?.dispose();beacon=null;
  booth.userData.setRinging(false,0);
  // cut short (wasted/busted mid-reach): the receiver goes back and the phone rings on
  fpOnAbort(()=>{releaseHeld();hangHandset();S.busy=false;});
  fpAnswer(handset,standWorld,{onDone:()=>{fpOnAbort(null);startCall(stage,lines);}});
  return true;
}

// Put the receiver back on its hook (and the cord back to rest).
function hangHandset(){
  booth.attach(handset);
  handset.position.copy(booth.userData.hookPos as THREE.Vector3);
  handset.quaternion.copy(booth.userData.hookQuat as THREE.Quaternion);
  (booth.userData.span as (a: THREE.Vector3,b: THREE.Vector3)=>void)(booth.userData.cordAnchor as THREE.Vector3,
    (booth.userData.cordEnd as THREE.Vector3).clone().applyQuaternion(handset.quaternion).add(handset.position));
}

function startCall(stage: Stage,lines: CineLine[]){
  // third person: the player stands in the booth facing the phone, receiver at the ear
  releaseHeld();
  const p=player.g.position;
  p.set(standWorld.x,groundHeight(standWorld.x,standWorld.z),standWorld.z);
  player.heading=BOOTH.ry+Math.PI;player.g.rotation.set(0,player.heading,0);
  const head=player.g.userData.limbs?.head as THREE.Object3D|undefined;
  if(head){
    head.add(handset);
    // at the (doll's right) ear, mouthpiece tipped toward the mouth, cups against the head
    handset.position.set(.17,.15,.02);
    handset.quaternion.setFromEuler(new THREE.Euler(-.45,0,0));
  }
  S.onCall=true;setPhoneHands(true);
  playPhoneCall({booth,lines,voice:BOSS,
    onFrame:(t,talking)=>{
      const l=player.g.userData.limbs;
      if(talking==='player')setTalkPose(player.g,t,true);          // free hand gestures, mouth moves
      else{
        setTalkPose(player.g,t,false);
        if(l?.head)l.head.rotation.x=Math.sin(t*1.3)*.05;             // listening: a slow nod
      }
      handset.getWorldPosition(_hw);
      reachHand(player.g,'right',_hw);                                // the hand holds the receiver
      layCord();
    },
    onDone:()=>endCall(stage)});
}

function endCall(stage: Stage){
  S.onCall=false;setPhoneHands(false);
  const l=player.g.userData.limbs;
  if(l){l.head.rotation.set(0,0,0);l.rightArm.rotation.set(0,0,-.12);l.rightForearm?.rotation.set(0,0,0);}
  // back to first person, looking at the phone, and hang up
  cameraRig.yaw=player.heading;cameraRig.fpPitch=.12;
  // even if the hang-up clip is cut short, the call happened: move the story on
  fpOnAbort(()=>{releaseHeld();hangHandset();finishCall(stage);});
  fpHangUp(handset,hookWorld,{onRelease:hangHandset,onDone:()=>{fpOnAbort(null);finishCall(stage);}});
}

// What the call set in motion.
function finishCall(stage: Stage){
  S.busy=false;
  if(stage==='call1'){
    enterStage('camp');
    message('ACABE COM O ACAMPAMENTO DOS CAIPIRAS - SIGA O MARCADOR VERMELHO','#ff3b56');
  }else if(stage==='call2'){
    economy.earn(REWARD_TEST,'story');
    showMissionPass('O TESTE','+$'+REWARD_TEST.toLocaleString('pt-BR')+'   '+RESPECT,()=>{
      message('ENTERRE OS CORPOS NO ACAMPAMENTO','var(--cream)');
    });
    enterStage('burial');
  }else if(stage==='call3'){
    economy.earn(REWARD_BURIAL,'story');
    showMissionPass('DO PÓ AO PÓ','+$'+REWARD_BURIAL.toLocaleString('pt-BR')+'   '+RESPECT);
    enterStage('call4');
    S.quietT=QUIET_AFTER_CALL3;               // a moment of peace... then it rings again
  }else if(stage==='call4'){
    enterStage('zombies');
    message('OS MORTOS LEVANTARAM - MATE OS 6 ZUMBIS','#9dff2e');
  }else if(stage==='call5'){
    enterStage('priest');
    message('VÁ ATÉ A IGREJA DE PINE HOLLOW E FALE COM O PADRE','var(--cream)');
  }
  save();
}

// ---- the priest ---------------------------------------------------------------------
function talkToPriest(){
  const ped=priestPed();if(!ped)return;
  S.busy=true;
  if(S.stage==='priest'){
    playDialogue(ped,PRIEST_TALK,PADRE,()=>{
      S.busy=false;
      cameraRig.yaw=player.heading;cameraRig.fpPitch=.1;
      fpGiveFlask(holyWaterModel.build());
      enterStage('holywater');
      message('ÁGUA BENTA NA MÃO - JOGUE EM CADA CORPO AMALDIÇOADO','#7fc8e8');
      save();
    });
  }else{
    // the blessing: stand among the kneeling villagers
    const p=player.g.position;
    p.set(MEET.x,groundHeight(MEET.x,MEET.z),MEET.z);
    crowdCheer();
    playDialogue(ped,BLESSING,PADRE,()=>{
      S.busy=false;
      cameraRig.yaw=player.heading;cameraRig.fpPitch=.1;
      crowdCheer();
      economy.earn(REWARD_HOLY,'story');
      showMissionPass('ÁGUA BENTA','+$'+REWARD_HOLY.toLocaleString('pt-BR')+'   '+RESPECT_PRIEST,()=>showStoryEnd());
      enterStage('done');
      save();
    },(_t,talking,_ph,_pt)=>{if(talking==='npc'&&Math.random()<.02)crowdCheer();});
  }
}

// ---- the holy water ---------------------------------------------------------------
function sprinkle(){
  const z=nearestCorpse(3);if(!z)return;
  const target=()=>z.g.position.clone();
  fpSprinkle(target,{onSplash:()=>{
    burnCorpse(z);
    const left=cursedCorpses().length;
    if(left>0)message('FALTAM '+left+' CORPOS','#7fc8e8');
  }});
}

// ---- interaction (E) ---------------------------------------------------------------
const nearBooth=()=>{const pp=playerPos();return Math.hypot(pp.x-standWorld.x,pp.z-standWorld.z)<1.9;};

export function storyAction(): {label: string;prompt: string;enabled: boolean;run?: () => void}|null{
  if(state.mode!=='foot'||state.cine||state.dlgActive||S.busy||fpBusy())return null;
  if(ringing()&&nearBooth()){
    if(MiniGame.busy)return{label:'...',prompt:'TERMINE O QUE ESTÁ FAZENDO ANTES',enabled:false};
    return{label:'ATENDER',prompt:'ATENDER O TELEFONE',enabled:true,run:answer};
  }
  if(S.stage==='burial')return burialAction();
  if((S.stage==='priest'||S.stage==='blessing')&&priestNear())
    return{label:'FALAR',prompt:'FALAR COM O PADRE',enabled:true,run:talkToPriest};
  if(S.stage==='holywater'&&fpHeld()==='flask'&&nearestCorpse(3))
    return{label:'ÁGUA',prompt:'JOGAR ÁGUA BENTA',enabled:true,run:sprinkle};
  return null;
}
export function storyInteract(): boolean{
  const a=storyAction();
  if(!a||!a.enabled||!a.run)return false;
  a.run();
  return true;
}
// The line shown when a run starts (what to do next).
export function storyHint(): string|null{
  const H: Partial<Record<Stage,string>>={
    call1:'UM ORELHÃO ESTÁ TOCANDO AQUI PERTO - SIGA O ÍCONE DO TELEFONE',
    camp:'ACABE COM O ACAMPAMENTO DOS CAIPIRAS',
    call2:'O ORELHÃO ESTÁ TOCANDO - VÁ ATENDER',
    burial:'ENTERRE OS CORPOS NO ACAMPAMENTO',
    call3:'VOLTE AO ORELHÃO E AVISE O CHEFÃO',
    call4:'O ORELHÃO ESTÁ TOCANDO DE NOVO',
    zombies:'OS MORTOS LEVANTARAM - MATE OS ZUMBIS',
    call5:'VOLTE AO ORELHÃO',
    priest:'FALE COM O PADRE NA IGREJA DE PINE HOLLOW',
    holywater:'JOGUE ÁGUA BENTA EM CADA CORPO AMALDIÇOADO',
    blessing:'VOLTE AO PADRE',
  };
  return H[S.stage]??null;
}

// ---- radar / map / navigation ----------------------------------------------------
// The current objective, drawn BIG on the radar and the map (hud.ts `big`).
interface StoryBlip{x: number;z: number;icon: string;color: string;label: string;big: true;}
function nearestOf<T extends {g: THREE.Object3D}>(list: T[]): T|null{
  const pp=playerPos();let best: T|null=null,bd=1e9;
  for(const o of list){const d=Math.hypot(o.g.position.x-pp.x,o.g.position.z-pp.z);if(d<bd){bd=d;best=o;}}
  return best;
}
export function storyBlips(): StoryBlip[]{
  if(S.onCall||S.busy)return[];
  if(ringing())return[{x:BOOTH.x,z:BOOTH.z,icon:'phone',color:'#ffd24a',label:'ORELHÃO',big:true}];
  if(S.stage==='camp')return[{x:CAMP.x,z:CAMP.z,icon:'target',color:'#ff3b56',label:'ACAMPAMENTO',big:true}];
  if(S.stage==='burial'){
    const g=burialGoal();
    if(g)return[{x:g.x,z:g.z,icon:'shovel',color:'#d9a06b',label:g.kind==='shovel'?'PÁ':'ENTERRAR',big:true}];
  }
  if(S.stage==='zombies'){
    const z=nearestOf(zombies.filter(k=>!k.dead));
    if(z)return[{x:z.g.position.x,z:z.g.position.z,icon:'skull',color:'#9dff2e',label:'ZUMBIS',big:true}];
  }
  if(S.stage==='priest'||S.stage==='blessing')
    return[{x:PRIEST.x,z:PRIEST.z,icon:'person',color:'#f4f1e8',label:'PADRE',big:true}];
  if(S.stage==='holywater'){
    const z=nearestOf(cursedCorpses());
    if(z)return[{x:z.g.position.x,z:z.g.position.z,icon:'cross',color:'#7fc8e8',label:'CORPO',big:true}];
  }
  return[];
}
function storyGoal(): {x: number;z: number;col: string}|null{
  const b=storyBlips()[0];
  return b?{x:b.x,z:b.z,col:b.color}:null;
}
// A running mini-game takes over the arrow (its current target).
function miniGameGoal(): {x: number;z: number;col: string}|null{
  if(!state.activeMiniGame)return null;
  const targets=MiniGame.activeBlips?.()||[];
  const t=targets.find((b: any)=>b.current)||targets[0];
  if(t)return{x:t.x,z:t.z,col:t.color||'#ffd24a'};
  const rb=[...(refs.raceBlips?.()||[]),...(refs.boatRaceBlips?.()||[])];
  const cp=rb.find((b: any)=>b.current);
  if(cp)return{x:cp.x,z:cp.z,col:'#ff8a1e'};
  return null;
}
// 3D navigation arrow floating over the player, pointing at the current objective.
const {arrow:navArrow,material:navMat}=makeStoryArrow();
navArrow.visible=false;scene.add(navArrow);

// ---- per-frame ---------------------------------------------------------------------
const RING_EVERY=3.4, RING_HEAR=60;
/** BEFORE the camera update (hand clips turn the view). */
export function updateStoryPre(dt: number){updateStoryFocus(dt);}

/** AFTER the camera update (the cut-scene owns the camera). */
export function updateStory(dt: number){
  updateCutscene(dt);
  updateStoryHands(dt);
  updateCamp(dt);
  updateBurial();
  updateZombies(dt);
  updatePriest(dt);
  updateSummitFx(dt);
  if(fpBusy()||S.onCall)layCord();
  if(S.quietT>0&&!state.cine)S.quietT-=dt;
  const pp=playerPos();
  // the booth rings: bell bursts heard louder as you get close, sign flashing,
  // receiver rattling on its hook, a light column over it
  if(ringing()&&state.started){
    if(!beacon)beacon=new Beacon(0xffd24a).at(BOOTH.x,BOOTH.z).mount();
    const d=Math.hypot(pp.x-BOOTH.x,pp.z-BOOTH.z);
    S.ringT-=dt;
    const burst=S.ringT>RING_EVERY-1.05;
    if(S.ringT<=0){
      S.ringT=RING_EVERY;
      if(!state.interior&&!state.paused&&d<RING_HEAR)phoneRing(Math.pow(1-d/RING_HEAR,1.6));
    }
    booth.userData.setRinging(burst,state.time);
    if(handset.parent===booth){
      const hq=booth.userData.hookQuat as THREE.Quaternion;
      handset.quaternion.copy(hq);
      if(burst)handset.rotateZ(Math.sin(state.time*48)*.05);
    }
  }else if(beacon){beacon.dispose();beacon=null;booth.userData.setRinging(false,0);}
  // once the digging is over, the empty camp packs up when nobody is watching
  if(stageAtLeast('call3')&&campBuilt()&&Math.hypot(pp.x-CAMP.x,pp.z-CAMP.z)>150)removeCamp();
  // and after the blessing the villagers get up and go home, once out of sight
  if(S.stage==='done'&&crowdOut()&&Math.hypot(pp.x-MEET.x,pp.z-MEET.z)>90)clearCrowd();
  // navigation arrow
  const goal=state.started&&!state.cine&&!state.interior?(miniGameGoal()||storyGoal()):null;
  navArrow.visible=!!goal;
  if(goal){
    navArrow.position.set(pp.x,5.4+Math.sin(state.time*3)*.25,pp.z);
    navArrow.lookAt(goal.x,navArrow.position.y,goal.z);
    navMat.color.set(goal.col);
  }
}

// ---- save ------------------------------------------------------------------------
function collect(): StorySave{
  let bodies: ({x: number;z: number}|null)[]=[];
  if((S.stage==='call2'||S.stage==='burial')&&campBuilt())
    bodies=campers.map(c=>c.buried?null:{x:+c.g.position.x.toFixed(2),z:+c.g.position.z.toFixed(2)});
  else if(S.stage==='call5'||S.stage==='priest'||S.stage==='holywater')bodies=corpseRecords();
  return{stage:S.stage,bodies,graves:graveRecords(),shovel:S.stage==='burial'?shovelSave():null};
}
// Restore a saved stage. The fresh boot is always at call1 with nothing built, so this
// resets whatever exists and rebuilds the world for the saved stage.
function restore(raw: unknown){
  const s=sanitizeStorySave(raw,CAMP_SIZE);
  if(!s)return;
  if(S.busy||S.onCall)return;
  removeCamp();stopBurial();clearGraves();clearZombies();clearCrowd();removePriest();fpDropFlask();
  S.stage='call1';S.quietT=0;
  if(s.stage!=='call1')enterStage(s.stage,s);
}
refs.getStorySave=collect;
refs.restoreStory=restore;
refs.storyAction=storyAction;
refs.storyBlips=storyBlips;

// ---- debug snapshot + test hook ------------------------------------------------------
export function getStoryState(){
  return{stage:S.stage,busy:S.busy,onCall:S.onCall,ringing:ringing(),cine:cineActive(),quiet:+S.quietT.toFixed(1),
    booth:{x:BOOTH.x,z:BOOTH.z,stand:{x:+standWorld.x.toFixed(2),z:+standWorld.z.toFixed(2)}},
    camp:{built:campBuilt(),alive:campAlive(),alarmed:campAlarmed(),x:CAMP.x,z:CAMP.z},
    burial:burialState(),buryTarget:BURY_TARGET,
    zombies:{alive:zombiesAlive(),corpses:cursedCorpses().map(z=>({x:+z.g.position.x.toFixed(2),z:+z.g.position.z.toFixed(2)}))},
    priest:{x:PRIEST.x,z:PRIEST.z,here:!!priestPed()},held:fpHeld()};
}
refs.getStoryState=getStoryState;
// __test.story(cmd): 'state' | 'stage:<name>' (jump there, as if loaded from a save) |
// 'killCamp' | 'killZombies' | 'skipCine' (run through the current scene) | 'noQuiet' |
// 'toBooth' | 'toCamp' | 'toPriest'.
export function storyTest(cmd: string): unknown{
  if(cmd.startsWith('stage:')){
    const st=cmd.slice(6) as Stage;
    if(!STAGES.includes(st))return 'bad stage';
    restore({stage:st,bodies:[],graves:[],shovel:null});
  }else if(cmd==='killCamp')killAllCampers();
  else if(cmd==='killZombies')killAllZombies();
  else if(cmd==='noQuiet')S.quietT=0;
  else if(cmd==='skipCine'){for(let i=0;i<60&&cineActive();i++){advanceCine();advanceCine();}}
  else if(cmd==='toBooth'||cmd==='toCamp'||cmd==='toPriest'){
    if(state.mode!=='foot')return 'not on foot';
    const to={toBooth:[standWorld.x-2.2,standWorld.z,phoneWorld.x,phoneWorld.z],
      toCamp:[CAMP.x-4,CAMP.z+30,CAMP.x,CAMP.z],
      toPriest:[MEET.x,MEET.z-1.5,PRIEST.x,PRIEST.z]}[cmd]!;
    const[x,z,fx,fz]=to;
    player.g.position.set(x,groundHeight(x,z),z);
    player.heading=cameraRig.yaw=Math.atan2(fx-x,fz-z);cameraRig.fpPitch=.05;
  }
  return getStoryState();
}
