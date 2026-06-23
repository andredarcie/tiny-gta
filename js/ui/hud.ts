import {N,ROAD,BLOCK,GROUND,nodeX,WATER,SWIM_BOUND,
  RURAL_X0,RURAL_GAP,RURAL_TIP,MOUNT_X,MOUNT_R,TOWN_CX,ruralRoadPath,
  cityCoastR,isLand,ISLAND_CX,ISLAND_CZ,ISLAND_MAXR,islandCoastR} from '@/core/constants.ts';
import {state,input,refs} from '@/core/state.ts';
import {isPark} from '@/world/world.ts';
import {getTod} from '@/world/daynight.ts';
import {paintWeaponGlyph} from '@/combat/weapon-icon.ts';
import {MiniGame} from '@/activities/minigame.ts';
import {inGangTerritory} from '@/actors/gangs.ts';
import {getNpcMapBlips} from '@/actors/npc.ts';
import {regionAt,mapRegionLabels} from '@/world/regions.ts';

// The interact prompt descriptor computed for the E button (HUD label + prompt +
// whether it is actionable). Some sources (zone actions) also carry a `run`
// callback; the pure label entries do not, so it is optional here.
interface InteractAction { label: string; prompt?: string; enabled?: boolean; run?: () => void; }

// A radar/map blip with the extra render hints used by the icon painter (letter
// for mission markers, kind for the taxi, col, current/faded flags). Loose by
// design — many producers add a couple of their own fields.
interface HudBlip {
  x: number; z: number;
  icon?: string; color?: string; col?: string;
  label?: string; letter?: string; kind?: string;
  current?: boolean; reveal?: boolean; faded?: boolean;
  [k: string]: any;
}
// 2D point the world->radar transform returns.
type Pt = [number, number];
// The weapon HUD mirror produced by refs.getWeaponHud().
interface WeaponHud { id?: string; name: string; ammo?: number; max?: number; low?: boolean; infinite?: boolean; }

const $=(id: string): HTMLElement | null=>document.getElementById(id);
export const hudMoney=$('money')!,hudClock=$('clock')!,hudHealth=$('health-val')!,
  hudStarsBox=$('stars'),hudStars=[...document.querySelectorAll('#stars .s')] as HTMLElement[],
  hudCar=$('carname'),hudPrompt=$('prompt')!,hudMsg=$('msg')!,hudBig=$('bigtext')!,
  hudWeaponIcon=$('weapon-icon') as HTMLCanvasElement | null,hudWeaponAmmo=$('weapon-ammo')!,hudWeaponName=$('weapon-name'),
  hudAmmoNow=$('ammo-now')!,hudAmmoMax=$('ammo-max')!,hudCrosshair=$('crosshair')!,
  hudSpeedo=$('speedo'),hudSpeedoVal=$('speedo-val')!,
  hudBreath=$('breath'),hudBreathFill=$('breath-fill')!;
const weaponIconCtx=hudWeaponIcon&&hudWeaponIcon.getContext('2d');
let weaponIconKey='';

let shownMoney=250,msgT=0;
// Cache dos últimos valores escritos no DOM do HUD: setar textContent/innerHTML
// troca nós de texto e invalida layout mesmo quando o valor não mudou. Só
// escrevemos quando muda de fato (a maioria dos frames não muda nada).
let _money='',_clock='',_health=-1,_wanted=-1,_wname='',_prompt='',_promptShown: boolean | null=null;
let _breath=-1,_breathShown: boolean | null=null;
// Letreiro de localização (estilo open-world): anuncia o nome do bairro/região ao
// entrar numa nova e some depois de alguns segundos. _region guarda a última
// região mostrada pra disparar a troca só quando o jogador cruza pra outra.
const hudLocation=$('location');
let _region: string | null=null,_regionT=0;

// Medidor de FPS: conta frames reais e só toca no DOM 2x por segundo —
// atualizar texto todo frame custaria mais que aquilo que o medidor mede
const hudFps=$('fps')!;
let fpsFrames=0,fpsLast=performance.now();
export function tickFps(): void {
  fpsFrames++;
  const now=performance.now();
  if(now-fpsLast<500)return;
  const fps=Math.round(fpsFrames*1000/(now-fpsLast));
  hudFps.textContent=fps+' FPS';
  hudFps.style.color=fps>=50?'#41ce62':fps>=30?'#ffd24a':'#ff2e88';
  fpsFrames=0;fpsLast=now;
}

export function message(t: string,col?: string): void {
  hudMsg.textContent=t;hudMsg.style.color=col||'var(--cream)';
  hudMsg.style.opacity='1';msgT=2.6;
}
refs.message=message; // exposto p/ módulos que não podem importar hud sem ciclo (ex.: minigame.js)
export function bigText(t: string,col: string): void {
  hudBig.textContent=t;hudBig.style.color=col;
  hudBig.style.textShadow=`4px 4px 0 #000,0 0 40px ${col}`;
  hudBig.classList.add('show');
}
export function hideBig(): void {hudBig.classList.remove('show');}

// Police radio caption (bottom of screen). The sheriff dispatches units over it,
// always by name — pass <b>Name</b> for emphasis. Auto-hides after `dur` ms.
const hudRadio=$('police-radio');
let radioTimer: ReturnType<typeof setTimeout>|null=null;
export function radioMessage(html: string,dur=8000): void {
  if(!hudRadio)return;
  hudRadio.innerHTML=html; // styled as a discreet movie-style subtitle (no emoji/label)
  hudRadio.classList.add('show');
  // linger long enough to read comfortably: a generous floor that scales with length.
  const plain=html.replace(/<[^>]+>/g,'');
  const shown=Math.max(dur,Math.min(15000,4500+plain.length*60));
  if(radioTimer)clearTimeout(radioTimer);
  radioTimer=setTimeout(()=>hudRadio.classList.remove('show'),shown);
}
refs.radioMessage=radioMessage; // exposed for modules that can't import hud without a cycle

// A ação de interação (label/prompt do botão E) é consultada por updateHUD e
// pelo touch-controls TODO frame, e percorre uma cascata de refs + nearestCar
// (loop por carros/tráfego/viaturas). O alvo muda devagar do ponto de vista do
// jogador, então memoizamos ~12fps: corta esse custo da maioria dos frames sem
// atraso perceptível no HUD.
let _iaCache: InteractAction | null=null,_iaT=-1;
export function getInteractAction(): InteractAction {
  const now=performance.now();
  if(_iaCache&&now-_iaT<80)return _iaCache;
  _iaT=now;
  return _iaCache=computeInteractAction();
}
function computeInteractAction(): InteractAction {
  const tv=refs.houseTvState?.();
  if(tv)return tv;
  if(state.cine||state.dlgActive)return{label:'...',prompt:'',enabled:false}; // cut-scene: sem ações
  if(state.paused||state.mode==='cut'||state.orientationBlocked)return{label:'...',prompt:'',enabled:false};
  if(refs.canPickWeapon?.())return{label:'PICK',prompt:'PICK UP WEAPON',enabled:true};
  if(state.mode==='foot'){
    const eat=refs.houseEatState?.(); // perto da geladeira dentro de casa
    if(eat)return eat;
    const buy=refs.houseBuyState?.(); // perto da placa FOR SALE da casa de campo
    if(buy)return buy;
    // supino e dança são mini-games: o prompt some durante uma sessão (um por vez)
    if(!MiniGame.busy){
      const gym=refs.gymTrainState?.(); // perto do supino dentro da academia
      if(gym)return gym;
      const dance=refs.clubDanceState?.(); // no meio da pista dentro da boate
      if(dance)return dance;
    }
    const shop=refs.gunShopState?.(); // perto de uma arma dentro da loja de armas
    if(shop)return shop;
    const wear=refs.clothesShopState?.(); // perto do provador dentro da loja de roupas
    if(wear)return wear;
    if(!MiniGame.busy){ // num mini game não dá pra começar outro (um por vez)
      const ov=refs.overkillNear?.(); // perto do totem do modo overkill
      if(ov)return{label:'OVERKILL',prompt:ov,enabled:true};
    }
  }
  if(state.mode==='foot'){
    const rk=refs.rickNear?.(); // acampamento secreto do Rick (sem blip no mapa)
    if(rk)return{label:'TALK',prompt:'TALK TO '+rk,enabled:true};
    const sn=refs.storyNear?.();
    if(sn)return{label:'TALK',prompt:'TALK TO '+sn,enabled:true};
    // ações de zona (car-crusher/export/bomba): bloqueadas durante outra sessão
    if(!MiniGame.busy)for(const f of refs.zoneActions||[]){const a=f();if(a)return a;}
  }
  if(state.mode==='foot'){
    const near=refs.nearestCar?.(3.6);
    if(near){
      const c=near.c;
      // entrar em veículo de mini game só fora de outra sessão (um por vez)
      if(!MiniGame.busy){
        if(refs.isTaxiCar?.(c))return{label:'CAB',prompt:'START CAB SHIFT',enabled:true};
        if(refs.isVigilanteCar?.(c))return{label:'JUSTICE',prompt:'START STREET JUSTICE',enabled:true};
        if(refs.isAmbulanceCar?.(c))return{label:'MEDIC',prompt:'START AMBULANCE RUSH',enabled:true};
        for(const f of refs.carEnterLabels||[]){const a=f(c);if(a)return a;} // veículo especial de minigame
      }
      return c.boat
        ?{label:'BOAT',prompt:'RIDE THE BOAT',enabled:true}
        :c.bike
          ?{label:'BIKE',prompt:'RIDE THE BIKE',enabled:true}
          :{label:'CAR',prompt:'TAKE THE CAR',enabled:true};
    }
  }
  if(state.mode==='car'){
    if(!MiniGame.busy){ // largar uma corrida só fora de outra sessão (um por vez)
      if(refs.raceNear?.())return{label:'RACE',prompt:'START THE RACE',enabled:true};
      if(refs.boatRaceNear?.())return{label:'RACE',prompt:'START THE BOAT RACE',enabled:true};
      if(refs.offroadNear?.())return{label:'RACE',prompt:'START OFF-ROAD',enabled:true};
    }
    const mod=refs.modShopState?.(); // carro parado na plataforma da oficina de custom
    if(mod)return mod;
    const garage=refs.houseGarageState?.(); // carro parado dentro da garagem da casa
    if(garage)return garage;
    // ações de zona (car-crusher/export/bomba): bloqueadas durante outra sessão
    if(!MiniGame.busy)for(const f of refs.zoneActions||[]){const a=f();if(a)return a;}
    const c=refs.getCur?.();
    const speed=Math.abs(c?.speed||0);
    return speed<6
      ?{label:'EXIT',prompt:c?.boat?'GET OFF THE BOAT':c?.bike?'GET OFF THE BIKE':'EXIT THE CAR',enabled:true}
      :{label:'...',prompt:'',enabled:false};
  }
  return{label:'...',prompt:'',enabled:false};
}

// open-world-style radar: circular, fixed north-up, player arrow rotating at
// the center, square blips clamped to the rim
const mmCanvas=$('minimap') as HTMLCanvasElement;
export const mm=mmCanvas.getContext('2d')!;
// Atlas da cidade: cobre a ILHA inteira (inclusive as pontas/diagonais), não o
// antigo quadrado. Dimensiona pelo alcance real da costa (cityCoastR).
let _cityAxis=218;
for(let i=0;i<240;i++){const th=i/240*Math.PI*2,r=cityCoastR(th);
  _cityAxis=Math.max(_cityAxis,Math.abs(r*Math.cos(th)),Math.abs(r*Math.sin(th)));}
const MMW=Math.ceil(_cityAxis+10)*2;  // antes: GROUND+BEACH*2 (era um quadrado)
const MM_C=85,MM_R=80,MM_RANGE=105;  // center px, radius px, radar reach in meters
const MM_POI_REVEAL=90;              // POIs fixos só aparecem dentro de N metros (declutter)
const SEA_COL='#2e8a96';             // mesma cor do mar de fundo do radar/mapa
const mmStatic=document.createElement('canvas');mmStatic.width=512;mmStatic.height=512;
{
  const x=mmStatic.getContext('2d')!,s=512/MMW,M=(v: number)=>(v+MMW/2)*s;
  x.fillStyle=SEA_COL;x.fillRect(0,0,512,512);               // mar
  x.fillStyle='#d8c08a';                                      // areia: costa irregular (isLand)
  for(let py=0;py<512;py+=2)for(let px=0;px<512;px+=2)
    if(isLand(px/s-MMW/2,py/s-MMW/2))x.fillRect(px,py,2,2);
  x.fillStyle='#e8dcc4';                                      // ruas claras (miolo da cidade)
  x.fillRect(M(-GROUND/2),M(-GROUND/2),GROUND*s,GROUND*s);
  for(let i=0;i<N;i++)for(let j=0;j<N;j++){
    x.fillStyle=isPark(i,j)?'#5d7c3e':'#8a6f4d';              // parque / quarteirão
    x.fillRect(M(nodeX(i)+ROAD/2),M(nodeX(j)+ROAD/2),BLOCK*s,BLOCK*s);
  }
}

// Atlas da península: cobre as pontas onduladas (RR_HALF>RURAL_HALF) e o bico
// afunilado (RURAL_TIP). Pasto recortado pela MESMA costa irregular (isLand).
const RR_HALF=150,RR_X0=RURAL_X0,RR_X1=RURAL_TIP;
const RRW=RR_X1-RR_X0,RRD=RR_HALF*2;
const mmRural=document.createElement('canvas');
mmRural.width=Math.round(RRW*.8);mmRural.height=Math.round(RRD*.8);
{
  const Wp=mmRural.width,Hp=mmRural.height;
  const x=mmRural.getContext('2d')!,sx=Wp/RRW,sz=Hp/RRD;
  const U=(v: number)=>(v-RR_X0)*sx,W=(v: number)=>(v+RR_HALF)*sz;
  x.fillStyle=SEA_COL;x.fillRect(0,0,Wp,Hp);                    // mar
  x.fillStyle='#6a9a50';                                        // pasto (recorte isLand)
  for(let py=0;py<Hp;py+=2)for(let px=0;px<Wp;px+=2)
    if(isLand(RR_X0+px/sx,-RR_HALF+py/sz))x.fillRect(px,py,2,2);
  x.fillStyle='#8a6a3e';                                        // roças
  for(const[a,b,d,e]of[[202,250,14,62],[200,244,-64,-22],[262,310,30,86],[258,300,-90,-42]]
    .map(f=>[f[0]+RURAL_GAP,f[1]+RURAL_GAP,f[2],f[3]]))
    x.fillRect(U(a),W(d),(b-a)*sx,(e-d)*sz);
  // montanha em níveis de elevação (sob a estrada que a contorna)
  for(const[r,col]of[[MOUNT_R,'#8d8f99'],[MOUNT_R*.62,'#a9adb8'],[MOUNT_R*.28,'#c9ccd4']] as [number, string][]){
    x.fillStyle=col;x.beginPath();
    x.ellipse(U(MOUNT_X),W(0),r*sx,r*sz,0,0,Math.PI*2);x.fill();
  }
  // estrada de terra: cidade → contorno da montanha → vila (mesmo traçado do chão)
  x.strokeStyle='#b08a5e';x.lineCap='round';x.lineJoin='round';x.lineWidth=7*(sx+sz)/2;
  const rp=ruralRoadPath();
  x.beginPath();rp.forEach(([px,pz]: number[],i: number)=>i?x.lineTo(U(px),W(pz)):x.moveTo(U(px),W(pz)));x.stroke();
  x.beginPath();x.moveTo(U(TOWN_CX),W(-46));x.lineTo(U(TOWN_CX),W(34));x.stroke();
  // edifícios da vila "Pine Hollow" (quadradinhos)
  x.fillStyle='#9a6f4d';
  for(const[bx,bz,bw]of[[TOWN_CX,38,7],[TOWN_CX-30,22,6],[TOWN_CX+34,22,5],[TOWN_CX+52,22,5],
    [TOWN_CX-14,-24,5],[TOWN_CX+22,-24,5],[TOWN_CX-36,-28,4],[TOWN_CX+50,-34,5]])
    x.fillRect(U(bx-bw/2),W(bz-bw/2),bw*sx,bw*sz);
}

// O mapa NUNCA muda depois de gerado, a escala do radar é constante e o radar é
// north-up (sem rotação). Então pré-renderizamos os atlas UMA vez já na densidade
// exata do radar (px/m = MM_SCALE): no loop o blit fica 1:1, sem o filtro de
// reescala que rodava todo frame. Os atlas originais (512px etc.) continuam pro
// mapa completo (tecla M), que usa outra escala e quer a resolução maior.
const MM_SCALE=MM_R/MM_RANGE;
function prescaleRadar(src: HTMLCanvasElement,worldW: number,worldH: number): HTMLCanvasElement {
  const c=document.createElement('canvas');
  c.width=Math.max(1,Math.round(worldW*MM_SCALE));
  c.height=Math.max(1,Math.round(worldH*MM_SCALE));
  const x=c.getContext('2d')!;
  x.imageSmoothingQuality='high';
  x.drawImage(src,0,0,c.width,c.height);
  return c;
}
const mmStaticR=prescaleRadar(mmStatic,MMW,MMW);
const mmRuralR=prescaleRadar(mmRural,RRW,RRD);

// world offset → radar screen offset (north-up), clamped to the rim
function mmBlip(wx: number,wz: number,pp: {x: number; z: number},scale: number): Pt {
  let px=(wx-pp.x)*scale,py=(wz-pp.z)*scale;
  const d=Math.hypot(px,py),max=MM_R-8;
  if(d>max){px*=max/d;py*=max/d;}
  return[MM_C+px,MM_C+py];
}
function mmSquare(ctx: CanvasRenderingContext2D,px: number,py: number,size: number,col: string): void {
  ctx.fillStyle=col;ctx.strokeStyle='rgba(0,0,0,.75)';ctx.lineWidth=1.5;
  ctx.fillRect(px-size/2,py-size/2,size,size);
  ctx.strokeRect(px-size/2,py-size/2,size,size);
}
function mmCircleIcon(ctx: CanvasRenderingContext2D,px: number,py: number,b: HudBlip,scale=1): void {
  const r=8.6;
  ctx.save();
  ctx.translate(px,py);
  if(scale!==1)ctx.scale(scale,scale);
  ctx.fillStyle='rgba(5,3,8,.9)';
  ctx.beginPath();ctx.arc(0,0,r+2,0,Math.PI*2);ctx.fill();
  ctx.fillStyle=b.color||'#f5c518';
  ctx.strokeStyle='rgba(255,255,255,.78)';ctx.lineWidth=1.15;
  ctx.beginPath();ctx.arc(0,0,r,0,Math.PI*2);ctx.fill();ctx.stroke();
  ctx.fillStyle='#120916';ctx.strokeStyle='#120916';ctx.lineCap='round';ctx.lineJoin='round';
  switch(b.icon){
    case'gun':
      ctx.beginPath();
      ctx.moveTo(-6.4,-3.1);ctx.lineTo(4.9,-3.1);ctx.lineTo(4.9,-1.2);
      ctx.lineTo(1.4,-1.2);ctx.lineTo(.6,.5);ctx.lineTo(-4.2,.5);
      ctx.lineTo(-4.8,2.3);ctx.lineTo(-6.4,2.3);ctx.closePath();ctx.fill();
      ctx.fillRect(3.9,-4.0,3.0,1.25);
      ctx.beginPath();ctx.moveTo(-.7,.6);ctx.lineTo(2.4,.6);ctx.lineTo(1.1,5.7);
      ctx.lineTo(-2.2,5.7);ctx.closePath();ctx.fill();
      ctx.strokeStyle='#120916';ctx.lineWidth=1.25;
      ctx.beginPath();ctx.arc(-1.8,2.0,1.8,-.6,1.55);ctx.stroke();
      break;
    case'gym':
      ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(-4.8,0);ctx.lineTo(4.8,0);ctx.stroke();
      for(const x of[-6.2,-4.5,4.5,6.2])ctx.fillRect(x-.55,-3.8,1.1,7.6);
      break;
    case'hospital':
      ctx.fillRect(-2.1,-5.4,4.2,10.8);
      ctx.fillRect(-5.4,-2.1,10.8,4.2);
      break;
    case'prison':
      ctx.fillRect(-5.5,-4.7,11,1.35);ctx.fillRect(-5.5,3.35,11,1.35);
      for(const x of[-3.6,0,3.6])ctx.fillRect(x-.55,-4.7,1.1,9.4);
      break;
    case'club':
      ctx.lineWidth=1.8;
      ctx.beginPath();ctx.moveTo(.8,-5.3);ctx.lineTo(.8,2.2);ctx.stroke();
      ctx.beginPath();ctx.moveTo(.8,-5.3);ctx.quadraticCurveTo(4.9,-4.7,5.1,-2.6);ctx.stroke();
      ctx.beginPath();ctx.ellipse(-2.2,3.0,2.6,1.8,-.25,0,Math.PI*2);ctx.fill();
      break;
    case'house':
      ctx.beginPath();ctx.moveTo(-6,.2);ctx.lineTo(0,-5.3);ctx.lineTo(6,.2);
      ctx.lineTo(4.7,.2);ctx.lineTo(4.7,5);ctx.lineTo(-4.7,5);ctx.lineTo(-4.7,.2);
      ctx.closePath();ctx.fill();
      ctx.fillStyle=b.color||'#f5c518';ctx.fillRect(-1.2,1.5,2.4,3.5);
      break;
    case'wrench':
      ctx.lineWidth=2.4;ctx.lineCap='round';
      ctx.beginPath();ctx.moveTo(-3.4,-3.4);ctx.lineTo(3.4,3.4);ctx.stroke(); // cabo
      ctx.lineWidth=1.6;
      ctx.beginPath();ctx.arc(-3.8,-3.8,2.2,-1.0,2.2);ctx.stroke();           // boca
      ctx.beginPath();ctx.arc(3.8,3.8,2.2,2.1,5.3);ctx.stroke();
      break;
    case'cop': // distintivo policial (estrela de 5 pontas)
      ctx.beginPath();
      for(let i=0;i<10;i++){
        const a=-Math.PI/2+i*Math.PI/5,rr=i%2?2.7:6.3;
        const fx=Math.cos(a)*rr,fy=Math.sin(a)*rr;
        i?ctx.lineTo(fx,fy):ctx.moveTo(fx,fy);
      }
      ctx.closePath();ctx.fill();
      break;
    case'package': // entrega: caixa com fita
      ctx.fillRect(-5.2,-4.6,10.4,9.2);
      ctx.fillStyle=b.color||'#f5c518';
      ctx.fillRect(-1.1,-4.6,2.2,9.2);
      ctx.fillRect(-5.2,-1.1,10.4,2.2);
      break;
    case'person': // passageiro do táxi
      ctx.beginPath();ctx.arc(0,-3.3,2.4,0,Math.PI*2);ctx.fill();
      ctx.beginPath();
      ctx.moveTo(-4.3,5.3);ctx.quadraticCurveTo(-4.3,-.8,0,-.8);
      ctx.quadraticCurveTo(4.3,-.8,4.3,5.3);ctx.closePath();ctx.fill();
      break;
    case'target': // alvo (criminoso em fuga / vigilante)
      ctx.lineWidth=1.6;
      ctx.beginPath();ctx.arc(0,0,5,0,Math.PI*2);ctx.stroke();
      ctx.beginPath();ctx.arc(0,0,1.5,0,Math.PI*2);ctx.fill();
      ctx.beginPath();
      ctx.moveTo(0,-6.8);ctx.lineTo(0,-3.6);ctx.moveTo(0,3.6);ctx.lineTo(0,6.8);
      ctx.moveTo(-6.8,0);ctx.lineTo(-3.6,0);ctx.moveTo(3.6,0);ctx.lineTo(6.8,0);
      ctx.stroke();
      break;
    case'cross': // cruz médica (paramédico / feridos)
      ctx.fillRect(-1.9,-5.6,3.8,11.2);
      ctx.fillRect(-5.6,-1.9,11.2,3.8);
      break;
    case'flag': // bandeira quadriculada (checkpoint de corrida)
      ctx.fillRect(-4.7,-6,1.4,12);                 // mastro
      ctx.fillRect(-3.3,-6,7.8,5.61);               // pano
      ctx.fillStyle=b.color||'#f5c518';             // xadrez na cor do círculo
      ctx.fillRect(-3.3,-6,1.95,1.87);ctx.fillRect(.6,-6,1.95,1.87);
      ctx.fillRect(-1.35,-4.13,1.95,1.87);ctx.fillRect(2.55,-4.13,1.95,1.87);
      ctx.fillRect(-3.3,-2.26,1.95,1.87);ctx.fillRect(.6,-2.26,1.95,1.87);
      break;
    case'diamond': // objetivo genérico da história (item)
      ctx.beginPath();
      ctx.moveTo(0,-6);ctx.lineTo(5.2,0);ctx.lineTo(0,6);ctx.lineTo(-5.2,0);
      ctx.closePath();ctx.fill();
      break;
    case'letter': // marcador de missão com a inicial do NPC
      ctx.font='bold 9px monospace';ctx.textAlign='center';ctx.textBaseline='middle';
      ctx.fillText(b.letter||'?',0,.6);
      break;
    case'taxi': // ponto de táxi (carro de perfil)
      ctx.fillRect(-6,0,12,3.4);                                   // chassi
      ctx.beginPath();ctx.moveTo(-3.4,0);ctx.lineTo(-2,-3.4);
      ctx.lineTo(2.4,-3.4);ctx.lineTo(3.8,0);ctx.closePath();ctx.fill(); // cabine
      ctx.fillStyle=b.color||'#f5c518';
      ctx.beginPath();ctx.arc(-3.4,3.6,1.7,0,Math.PI*2);ctx.fill();
      ctx.beginPath();ctx.arc(3.4,3.6,1.7,0,Math.PI*2);ctx.fill();  // rodas
      ctx.fillStyle='#120916';
      ctx.beginPath();ctx.arc(-3.4,3.6,.8,0,Math.PI*2);ctx.fill();
      ctx.beginPath();ctx.arc(3.4,3.6,.8,0,Math.PI*2);ctx.fill();
      break;
    case'skull': // modo overkill (caveira)
      ctx.beginPath();ctx.arc(0,-1.4,5.2,Math.PI,0);
      ctx.lineTo(3.6,3.2);ctx.lineTo(2,3.2);ctx.lineTo(2,5);
      ctx.lineTo(-2,5);ctx.lineTo(-2,3.2);ctx.lineTo(-3.6,3.2);ctx.closePath();ctx.fill();
      ctx.fillStyle=b.color||'#ff2e88';
      ctx.beginPath();ctx.arc(-2.1,-1.2,1.5,0,Math.PI*2);ctx.fill();
      ctx.beginPath();ctx.arc(2.1,-1.2,1.5,0,Math.PI*2);ctx.fill();  // olhos
      ctx.beginPath();ctx.moveTo(0,.4);ctx.lineTo(.9,2.2);ctx.lineTo(-.9,2.2);ctx.closePath();ctx.fill();
      break;
    case'fire': // chama (bombeiro)
      ctx.beginPath();
      ctx.moveTo(0,6);
      ctx.quadraticCurveTo(-5,2.4,-2.4,-1.6);
      ctx.quadraticCurveTo(-2,-4.6,0,-6.6);
      ctx.quadraticCurveTo(2,-4.6,2.4,-1.6);
      ctx.quadraticCurveTo(5,2.4,0,6);
      ctx.closePath();ctx.fill();
      break;
    case'bomb': // bomba (loja de bombas / o artificeiro)
      ctx.beginPath();ctx.arc(-.6,1.9,4.5,0,Math.PI*2);ctx.fill();
      ctx.fillRect(1.1,-3.3,2.1,2.3);                                  // gargalo
      ctx.lineWidth=1.4;ctx.beginPath();
      ctx.moveTo(2.2,-3.3);ctx.quadraticCurveTo(5.2,-5.2,4.1,-6.6);ctx.stroke(); // pavio
      break;
    case'crusher': // prensa de sucata
      ctx.fillRect(-5.4,-5.4,10.8,2.3);                                // placa de cima
      ctx.fillRect(-5.4,3.1,10.8,2.3);                                 // base
      ctx.fillRect(-1.1,-3.1,2.2,6.2);                                 // pistão
      break;
    case'store': // sacola de compras (mercadinho rural)
      ctx.fillRect(-4.3,-1.2,8.6,7);                                   // corpo da sacola
      ctx.lineWidth=1.5;ctx.lineCap='round';
      ctx.beginPath();ctx.arc(-1.7,-1.2,1.7,Math.PI,2*Math.PI);ctx.stroke(); // alças
      ctx.beginPath();ctx.arc(1.7,-1.2,1.7,Math.PI,2*Math.PI);ctx.stroke();
      break;
    default:
      ctx.lineWidth=1.8;ctx.strokeRect(-3.6,-5,7.2,10);
      ctx.beginPath();ctx.arc(1.7,.2,.65,0,Math.PI*2);ctx.fill();
  }
  ctx.restore();
}
function drawHudWeaponIcon(wh: WeaponHud): void {
  if(!weaponIconCtx)return;
  const key=wh.id||wh.name;
  if(weaponIconKey===key)return;
  weaponIconKey=key;
  const c=weaponIconCtx;
  c.setTransform(1,0,0,1,0,0);
  c.clearRect(0,0,64,64);
  c.save();c.translate(32,32);
  paintWeaponGlyph(c,wh.id as string); // mesmo glifo usado pela roda de seleção (weapon-icon.js)
  c.restore();
}

// Desenha SÓ a janela visível de um atlas estático, no espaço-mundo já transformado
// do radar: recorta a fonte na região que cabe no alcance (vis) e PULA de vez o
// atlas que está totalmente fora (ex.: o mapa da cidade quando se está no campo, e
// vice-versa). Antes redesenhávamos os 512px inteiros (+ rural) todo redraw contando
// só com o clip do círculo — reamostragem cara. Resultado pixel a pixel idêntico:
// o que fica de fora do recorte já era área clipada/mar.
function mmBlitVisible(img: HTMLCanvasElement,minX: number,minZ: number,maxX: number,maxZ: number,pp: {x: number; z: number},vis: number): void {
  const x0=Math.max(minX,pp.x-vis),x1=Math.min(maxX,pp.x+vis);
  const z0=Math.max(minZ,pp.z-vis),z1=Math.min(maxZ,pp.z+vis);
  if(x1<=x0||z1<=z0)return;                                  // fora do alcance
  const sw=img.width/(maxX-minX),sh=img.height/(maxZ-minZ);  // px-fonte por metro
  mm.drawImage(img,(x0-minX)*sw,(z0-minZ)*sh,(x1-x0)*sw,(z1-z0)*sh, // recorte na fonte
    x0,z0,x1-x0,z1-z0);                                       // destino (coords de mundo)
}

const mapWrap=$('mapwrap');
export function drawMinimap(): void {
  // Em ambiente interno (boate/academia/hospital/presídio) o minimapa não faz sentido:
  // esconde o painel inteiro. Ver também a seta 3D de missão em story.js.
  if(mapWrap)mapWrap.style.display=state.interior?'none':'';
  if(state.interior)return;
  const pp=refs.playerPos?.();if(!pp)return;
  const cur=refs.getCur?.();
  // a seta segue para onde o jogador/veículo está virado, não a câmera
  const h=refs.getPlayerHeading?.()??cur?.heading??0;
  const th=h-Math.PI,scale=MM_R/MM_RANGE;
  // durante a corrida o radar mostra SÓ a corrida: nenhum outro objetivo/minigame
  const rOn=(refs.getRaceState?.()?.phase||'idle')!=='idle';     // corrida de rua em curso
  const bOn=(refs.getBoatRaceState?.()?.phase||'idle')!=='idle'; // corrida de lanchas em curso
  const raceOn=rOn||bOn;
  // sessão de mini game (não-corrida) em curso: o radar fica só com os alvos dela —
  // sem POIs, entregas, história ou outros mini games (mapa "limpo"). Ver
  // state.activeMiniGame / js/activities/minigame.ts.
  const mgActive=!!state.activeMiniGame&&!raceOn;

  mm.clearRect(0,0,170,170);
  mm.save();
  mm.beginPath();mm.arc(MM_C,MM_C,MM_R,0,Math.PI*2);mm.clip();
  mm.fillStyle='#2e8a96';mm.fillRect(0,0,170,170);           // mar ao fundo

  mm.save();
  mm.translate(MM_C,MM_C);mm.scale(scale,scale);
  mm.translate(-pp.x,-pp.z);
  // Só a porção visível de cada atlas (e nada quando está fora do alcance): corta
  // a reamostragem do redraw. VIS = meia-aresta do quadrado que cobre o círculo
  // do radar (raio MM_R/scale = MM_RANGE), com folga pra arredondamento.
  const VIS=MM_RANGE+4;
  mmBlitVisible(mmStaticR,-MMW/2,-MMW/2,MMW/2,MMW/2,pp,VIS);
  mmBlitVisible(mmRuralR,RR_X0,-RR_HALF,RR_X1,RR_HALF,pp,VIS);
  // territórios das gangues (círculos coloridos que encolhem conforme você mata)
  const gangsArr=refs.gangs;
  if(!raceOn&&!mgActive&&gangsArr)for(const g of gangsArr){
    if(g.defeated)continue; // gangue eliminada: sem território no radar
    mm.fillStyle=g.cssA;
    mm.beginPath();mm.arc(g.x,g.z,g.r,0,Math.PI*2);mm.fill();
    mm.strokeStyle=g.css;mm.lineWidth=2/scale;mm.stroke();
  }
  mm.restore();

  // Blips de objetivo agora usam o MESMO esquema de ícone dos POIs (em vez de
  // quadradinhos coloridos sem significado): polícia=distintivo, entrega=caixa,
  // táxi=pessoa, vigilante=alvo, paramédico=cruz, história=letra/losango.
  const cops=refs.cops||[];
  for(const c of cops){
    const[px,py]=mmBlip(c.g.position.x,c.g.position.z,pp,scale);
    mmCircleIcon(mm,px,py,{x:0,z:0,icon:'cop',color:'#3e7bff'},.78);
  }
  // lanchas da polícia na perseguição marítima: mesmo distintivo das viaturas
  for(const b of refs.policeBoats||[]){
    const[px,py]=mmBlip(b.g.position.x,b.g.position.z,pp,scale);
    mmCircleIcon(mm,px,py,{x:0,z:0,icon:'cop',color:'#3e7bff'},.78);
  }
  // Sessão de mini game (não-corrida) em curso: o radar mostra SÓ os alvos dela.
  // Nada de POIs/entregas/história/outros mini games — o mapa fica limpo.
  if(mgActive){
    for(const b of MiniGame.activeBlips() as HudBlip[]){
      if(b.reveal!==false){ // POI fixo: só perto, posição direta
        if(Math.hypot(b.x-pp.x,b.z-pp.z)>MM_POI_REVEAL)continue;
        mmCircleIcon(mm,MM_C+(b.x-pp.x)*scale,MM_C+(b.z-pp.z)*scale,b);
      }else{ // alvo ativo: sempre visível, preso na borda do radar
        const[px,py]=mmBlip(b.x,b.z,pp,scale);
        mmCircleIcon(mm,px,py,b,b.current?1:.82);
      }
    }
  }
  // Demais objetivos/minigames ficam ESCONDIDOS durante a corrida de rua
  else if(!raceOn){
    // POIs fixos (lojas/serviços): só aparecem quando o jogador chega perto —
    // antes ficavam todos presos na borda e o radar virava uma sopa de ícones.
    // O mapa completo (tecla M) continua listando todos, longe ou perto.
    for(const b of refs.interiorBlips?.()||[]){
      if(Math.hypot(b.x-pp.x,b.z-pp.z)>MM_POI_REVEAL)continue;
      mmCircleIcon(mm,MM_C+(b.x-pp.x)*scale,MM_C+(b.z-pp.z)*scale,b);
    }
    const ws=refs.workshopBlip?.(); // oficina de custom (não é Interior)
    if(ws&&Math.hypot(ws.x-pp.x,ws.z-pp.z)<=MM_POI_REVEAL)
      mmCircleIcon(mm,MM_C+(ws.x-pp.x)*scale,MM_C+(ws.z-pp.z)*scale,ws);
    // Pontos fixos de minigame (overkill/vigilante/paramédico): mesmo gate de
    // proximidade dos POIs, pra o radar não voltar a entulhar de ícone.
    const ov=refs.overkillBlip?.(),vg=refs.vigilanteStart?.(),pm=refs.paramedicStart?.();
    for(const m of[ov&&{...ov,icon:'skull',color:'#ff2e88'},
      vg&&{...vg,icon:'cop',color:'#3e7bff'},
      pm&&{...pm,icon:'cross',color:'#19e3ff'}] as (HudBlip | undefined | false)[]){
      if(!m||inGangTerritory(m.x,m.z)||Math.hypot(m.x-pp.x,m.z-pp.z)>MM_POI_REVEAL)continue;
      mmCircleIcon(mm,MM_C+(m.x-pp.x)*scale,MM_C+(m.z-pp.z)*scale,m);
    }
    const delivery=refs.getDelivery?.();
    if(delivery&&!inGangTerritory(delivery.x,delivery.z)){
      const[px,py]=mmBlip(delivery.x,delivery.z,pp,scale);
      mmCircleIcon(mm,px,py,{x:0,z:0,icon:'package',color:'#ffd24a'});
    }
    const taxiT=refs.taxiTarget?.(); // táxi livre / passageiro / destino
    if(taxiT&&!inGangTerritory(taxiT.x,taxiT.z)){
      const[px,py]=mmBlip(taxiT.x,taxiT.z,pp,scale);
      mmCircleIcon(mm,px,py,{x:0,z:0,
        icon:taxiT.kind==='taxi'?'taxi':taxiT.kind==='pickup'?'person':'flag',
        color:taxiT.kind==='taxi'?'#f5c518':'#5eff8a'});
    }
    for(const b of refs.vigilanteBlips?.()||[]){ // criminoso em fuga (vigilante)
      const[px,py]=mmBlip(b.x,b.z,pp,scale);
      mmCircleIcon(mm,px,py,{x:0,z:0,icon:'target',color:b.col||'#ff3b56'},b.current?1:.82);
    }
    for(const b of refs.paramedicBlips?.()||[]){ // feridos / hospital (paramedic)
      const[px,py]=mmBlip(b.x,b.z,pp,scale);
      mmCircleIcon(mm,px,py,{x:0,z:0,icon:'cross',color:b.col||'#5eff8a'},b.current?1:.82);
    }
    // Missão da história: blip no NPC atual (letra) ou no item (losango) quando ativa;
    // o piscar de retorno já vem resolvido de storyBlips()
    for(const b of refs.storyBlips?.()||[]){
      const[px,py]=mmBlip(b.x,b.z,pp,scale);
      mmCircleIcon(mm,px,py,{x:0,z:0,icon:b.letter?'letter':'diamond',letter:b.letter,color:b.col});
    }
    // minigames registrados (firefighter, rampage, hidden packages, etc.)
    for(const fn of refs.miniBlips||[])for(const b of fn()){
      if(inGangTerritory(b.x,b.z))continue; // mini-game nunca em território de gangue
      if(b.reveal!==false){ // POI fixo: só aparece perto, posição direta
        if(Math.hypot(b.x-pp.x,b.z-pp.z)>MM_POI_REVEAL)continue;
        mmCircleIcon(mm,MM_C+(b.x-pp.x)*scale,MM_C+(b.z-pp.z)*scale,b);
      }else{ // alvo ativo: sempre visível, preso na borda do radar
        const[px,py]=mmBlip(b.x,b.z,pp,scale);
        mmCircleIcon(mm,px,py,b,b.current?1:.82);
      }
    }
  }
  // Corrida (rua/lanchas): SÓ fora de outra sessão de mini game (regra "um por vez":
  // estando num mini game, nenhum ícone de corrida aparece no radar). Durante UMA
  // corrida, a largada ociosa da OUTRA some — antes a de rua mostrava a largada das
  // lanchas e vice-versa. Bandeira no checkpoint atual + próximos como anéis apagados.
  if(!mgActive){
    const rb: HudBlip[]=[];
    if(!bOn)rb.push(...(refs.raceBlips?.()||[]));     // corrida de rua: some durante a de lanchas
    if(!rOn)rb.push(...(refs.boatRaceBlips?.()||[])); // corrida de lanchas: some durante a de rua
    for(const b of rb){
      if(!raceOn&&inGangTerritory(b.x,b.z))continue; // largada ociosa nunca em zona de gangue
      const[px,py]=mmBlip(b.x,b.z,pp,scale);
      if(b.current)mmCircleIcon(mm,px,py,{x:0,z:0,icon:'flag',color:'#ff8a1e'});
      else{
        mm.fillStyle='rgba(255,138,30,.5)';mm.strokeStyle='rgba(20,9,31,.8)';mm.lineWidth=1.4;
        mm.beginPath();mm.arc(px,py,3.4,0,Math.PI*2);mm.fill();mm.stroke();
      }
    }
  }

  // seta do jogador no centro, girando com a direção (mapa fixo no norte)
  mm.save();
  mm.translate(MM_C,MM_C);mm.rotate(-th);
  mm.fillStyle='#fff';mm.strokeStyle='#000';mm.lineWidth=1.4;
  mm.beginPath();
  mm.moveTo(0,-7);mm.lineTo(-5,5.5);mm.lineTo(0,2.8);mm.lineTo(5,5.5);
  mm.closePath();mm.fill();mm.stroke();
  mm.restore();
  mm.restore();

  // aro do radar
  mm.strokeStyle='rgba(5,3,8,.96)';mm.lineWidth=6;
  mm.beginPath();mm.arc(MM_C,MM_C,MM_R-2,0,Math.PI*2);mm.stroke();
  mm.strokeStyle='#efa1d8';mm.lineWidth=3;
  mm.beginPath();mm.arc(MM_C,MM_C,MM_R-4,0,Math.PI*2);mm.stroke();
  mm.strokeStyle='rgba(255,255,255,.42)';mm.lineWidth=1;
  mm.beginPath();mm.arc(MM_C,MM_C,MM_R-5.8,0,Math.PI*2);mm.stroke();

  // marcador de norte no topo do aro
  const ny=MM_C-MM_R+2;
  mm.fillStyle='#08050a';
  mm.beginPath();mm.arc(MM_C,ny,7,0,Math.PI*2);mm.fill();
  mm.strokeStyle='#fff';mm.lineWidth=1.4;mm.stroke();
  mm.fillStyle='#fff';mm.font='bold 9px monospace';
  mm.textAlign='center';mm.textBaseline='middle';
  mm.fillText('N',MM_C,ny+.5);
}

// ---- Mapa completo (tecla M) ----------------------------------------------
// Visão geral do mundo inteiro (cidade + península rural) com TODOS os blips,
// inclusive os POIs que o radar esconde quando estão longe. O mundo fica
// congelado enquanto o mapa está aberto (ver state.mapOpen / main.js).
const fmCanvas=$('fullmap-canvas') as HTMLCanvasElement | null;
const fm=fmCanvas&&fmCanvas.getContext('2d');
// O mapa grande inclui uma faixa de MAR ao redor da cidade: a corrida de lanchas
// roda num anel no mar (raio ~ (WATER+SWIM_BOUND)/2), então o mapa precisa
// alcançar além da linha d'água pra mostrar as boias/largada da prova.
const FM_SEA=Math.round((WATER+SWIM_BOUND)/2)+24;
// O mapa estende a borda OESTE pra caber a ilha paradisíaca (em mar aberto a oeste).
const FM_MINX=Math.min(-FM_SEA,ISLAND_CX-ISLAND_MAXR-16),FM_MAXX=RURAL_TIP+12,
  FM_MINZ=-FM_SEA,FM_MAXZ=FM_SEA;
const FM_WW=FM_MAXX-FM_MINX,FM_WH=FM_MAXZ-FM_MINZ;
// Resolução interna seguindo a proporção real do mundo (sem barras); o CSS
// reescala isso pra caber em qualquer tela mantendo a proporção.
if(fmCanvas){fmCanvas.width=1280;fmCanvas.height=Math.round(1280*FM_WH/FM_WW);}
function fmFit(): {s: number; ox: number; oy: number} {
  const s=Math.min(fmCanvas!.width/FM_WW,fmCanvas!.height/FM_WH);
  return{s,ox:(fmCanvas!.width-FM_WW*s)/2,oy:(fmCanvas!.height-FM_WH*s)/2};
}
// "Show NPCs" overlay: live dots for every outdoor NPC plus a trail to where each
// is currently headed. Toggled by the button in the full-map header (input.ts);
// while on, main.js keeps the world simulating so the dots move in real time.
let showNpcsOnMap=false;
export function toggleMapNpcs(): boolean { showNpcsOnMap=!showNpcsOnMap; return showNpcsOnMap; }
export function mapNpcsShown(): boolean { return showNpcsOnMap; }
// Dot colour per NPC kind on the map.
const NPC_DOT: Record<string,string>={
  ped:'#ffffff',gang:'#b06bff',officer:'#3e7bff',soldier:'#8fae5a',rural:'#7ad06b',
  driver:'#f5c518',dancer:'#ff5fae',gymgoer:'#ff8a1e',guard:'#3e7bff',inmate:'#d9a06b',
  clerk:'#f4c542',medic:'#19e3ff',patient:'#ff6f6f',fare:'#5eff8a',buyer:'#9dff2e',
  criminal:'#ff3b56',story:'#ffd24a',sicko:'#9dff2e',
};
export function drawFullMap(): void {
  if(!fm)return;
  const{s,ox,oy}=fmFit();
  const P=(wx: number,wz: number): Pt=>[ox+(wx-FM_MINX)*s,oy+(wz-FM_MINZ)*s];
  const rOn=(refs.getRaceState?.()?.phase||'idle')!=='idle';
  const bOn=(refs.getBoatRaceState?.()?.phase||'idle')!=='idle';
  // sessão de mini game (não-corrida) em curso: o mapa grande mostra SÓ os alvos
  // dela — sem POIs, gangues nem outros mini games (mapa "limpo").
  const mgActive=!!state.activeMiniGame&&!rOn&&!bOn;
  fm.setTransform(1,0,0,1,0,0);
  fm.clearRect(0,0,fmCanvas!.width,fmCanvas!.height);
  fm.fillStyle='#2e8a96';fm.fillRect(0,0,fmCanvas!.width,fmCanvas!.height); // mar ao fundo
  fm.drawImage(mmStatic,...P(-MMW/2,-MMW/2),MMW*s,MMW*s);
  fm.drawImage(mmRural,...P(RR_X0,-RR_HALF),RRW*s,RRD*s);
  // Ilha paradisíaca a oeste (em mar aberto): silhueta de areia + miolo verde,
  // farol no centro e o nome — o destino que se alcança de barco.
  {
    const seg=64;
    fm.beginPath();
    for(let i=0;i<=seg;i++){const th=i/seg*Math.PI*2,r=islandCoastR(th);
      const[x,y]=P(ISLAND_CX+Math.cos(th)*r,ISLAND_CZ+Math.sin(th)*r);i?fm.lineTo(x,y):fm.moveTo(x,y);}
    fm.closePath();fm.fillStyle='#e7d29a';fm.fill();
    fm.lineWidth=2;fm.strokeStyle='rgba(60,190,200,.9)';fm.stroke();
    fm.beginPath();
    for(let i=0;i<=seg;i++){const th=i/seg*Math.PI*2,r=Math.max(6,islandCoastR(th)-14);
      const[x,y]=P(ISLAND_CX+Math.cos(th)*r,ISLAND_CZ+Math.sin(th)*r);i?fm.lineTo(x,y):fm.moveTo(x,y);}
    fm.closePath();fm.fillStyle='#5aa657';fm.fill();
    const[lx,ly]=P(ISLAND_CX,ISLAND_CZ);
    fm.fillStyle='#d23b32';fm.beginPath();fm.arc(lx,ly,3,0,Math.PI*2);fm.fill();
    fm.strokeStyle='#fff';fm.lineWidth=1;fm.stroke();
    fm.font='700 12px "IBM Plex Mono",monospace';fm.textAlign='center';fm.textBaseline='top';
    fm.lineWidth=3;fm.strokeStyle='rgba(5,3,8,.92)';fm.strokeText('PARADISE ISLE',lx,ly+8);
    fm.fillStyle='#ffe9c9';fm.fillText('PARADISE ISLE',lx,ly+8);
  }
  // territórios das gangues
  const gangsArr=refs.gangs;
  if(!mgActive&&gangsArr)for(const g of gangsArr){
    if(g.defeated)continue; // gangue eliminada: some do mapa
    const[cx,cy]=P(g.x,g.z);
    fm.fillStyle=g.cssA;fm.beginPath();fm.arc(cx,cy,g.r*s,0,Math.PI*2);fm.fill();
    fm.strokeStyle=g.css;fm.lineWidth=2;fm.stroke();
  }
  // ---- REGRA: todo ícone do mapa grande leva um rótulo embaixo ----
  // Junta TODOS os marcadores num formato único {x,z,icon,color,label,letter},
  // incluindo os pontos de início de cada minigame (corrida, lanchas, táxi,
  // vigilante, paramédico, overkill), e desenha ícone + descrição pra todos.
  const marks: HudBlip[]=[];
  const push=(b: HudBlip | undefined | false | null,icon?: string,color?: string,label?: string | null,faded?: boolean): void=>{
    if(b)marks.push({x:b.x,z:b.z,icon,color,label:label as string | undefined,letter:b.letter,faded});
  };
  // ícone de mini-game: igual ao push, mas nunca em território de gangue viva
  const pushMG=(b: HudBlip | undefined | false | null,icon?: string,color?: string,label?: string | null,faded?: boolean): void=>{
    if(b&&!inGangTerritory(b.x,b.z))push(b,icon,color,label,faded);
  };
  if(mgActive){
    // sessão de mini game em curso: o mapa grande mostra SÓ os alvos dela
    for(const b of MiniGame.activeBlips() as HudBlip[])marks.push({...b});
  }else{
    const raceOn=rOn||bOn; // numa corrida o mapa grande também fica só com a corrida
    // POIs/serviços e demais minigames: escondidos durante uma corrida (igual ao
    // radar e às sessões de mini game). Antes a largada do off-road, o táxi, as
    // entregas etc. vazavam no mapa enquanto a prova de rua/lanchas rolava.
    if(!raceOn){
      for(const b of refs.interiorBlips?.()||[])marks.push({...b});  // lojas/serviços (já têm label)
      const ws=refs.workshopBlip?.();if(ws)marks.push({...ws});      // oficina de custom
      // minigames de ponto fixo (nunca em território de gangue)
      pushMG(refs.overkillBlip?.(),'skull','#ff2e88','OVERKILL');
      pushMG(refs.vigilanteStart?.(),'cop','#3e7bff','JUSTICE');
      pushMG(refs.paramedicStart?.(),'cross','#19e3ff','MEDIC');
      // táxi: livre / passageiro / destino
      const tx=refs.taxiTarget?.();
      if(tx)pushMG(tx,tx.kind==='taxi'?'taxi':tx.kind==='pickup'?'person':'flag',
                  tx.kind==='taxi'?'#f5c518':'#5eff8a',
                  tx.kind==='taxi'?'CAB':tx.kind==='pickup'?'PASSENGER':'DROP OFF');
      // entrega
      pushMG(refs.getDelivery?.(),'package','#ffd24a','DELIVERY');
      // plantões ativos
      for(const b of refs.vigilanteBlips?.()||[])push(b,'target',b.col||'#ff3b56','SUSPECT');
      for(const b of refs.paramedicBlips?.()||[])
        push(b,'cross',b.col||'#5eff8a',b.col==='#19e3ff'?'HOSPITAL':'PATIENT');
      // história
      for(const b of refs.storyBlips?.()||[])push(b,b.letter?'letter':'diamond',b.col,'MISSION');
      // minigames registrados: o mapa completo mostra TODOS (longe ou perto), menos
      // os que caem em território de gangue (regra fundamental)
      for(const fn of refs.miniBlips||[])for(const b of fn())
        if(!inGangTerritory(b.x,b.z))marks.push({...b});
    }
    // corridas: largada nomeada quando ociosa; durante a prova, checkpoint atual +
    // boias seguintes (anel apagado, sem rótulo). Durante UMA corrida a largada da
    // OUTRA some (rua x lanchas não vazam uma na outra).
    if(!bOn)for(const b of refs.raceBlips?.()||[])
      push(b,'flag','#ff8a1e',rOn?(b.current?'CHECKPOINT':null):'STREET RACE',rOn&&!b.current);
    if(!rOn)for(const b of refs.boatRaceBlips?.()||[])
      push(b,'flag','#1ec8ff',bOn?(b.current?'NEXT BUOY':null):'BOAT RACE',bOn&&!b.current);
  }

  // Nomes das regiões (bairros + localidades): roxo temático, fonte nítida (opaca,
  // contorno escuro forte, coords inteiras pra não borrar). Desenhados AGORA, já
  // com os marks montados, pra desviar dos ícones: se um nome cai em cima de um
  // ícone de minigame/atividade, sobe acima dele até descolar — nunca dois textos
  // empilhados. A ilha já tem rótulo próprio (silhueta), então fica de fora.
  const iconPts=marks.filter(m=>!m.faded).map(m=>{const[ix,iy]=P(m.x,m.z);return{x:ix,y:iy};});
  fm.textAlign='center';fm.textBaseline='middle';
  for(const r of mapRegionLabels){
    const txt=r.name.toUpperCase();
    fm.font=`800 ${r.kind==='city'?12:14}px "IBM Plex Mono",monospace`;
    const hw=fm.measureText(txt).width/2+10;       // meia-largura do texto + folga
    const[bx,by]=P(r.cx,r.cz);
    let lx=Math.round(bx),ly=Math.round(by);
    // desvia na vertical (mantém o nome centrado no bairro): sobe acima do ícone
    // mais alto que conflita; até 3 passos, caso suba pra cima de outro.
    for(let pass=0;pass<3;pass++){
      let top=Infinity;
      for(const p of iconPts)if(Math.abs(p.x-lx)<hw&&Math.abs(p.y-ly)<18)top=Math.min(top,p.y);
      if(top===Infinity)break;
      ly=Math.round(top-22);
    }
    fm.lineWidth=4;fm.strokeStyle='rgba(13,4,24,.96)';fm.strokeText(txt,lx,ly); // contorno nítido
    fm.fillStyle='#c98bff';fm.fillText(txt,lx,ly);                              // roxo temático
  }
  for(const m of marks){
    const[px,py]=P(m.x,m.z);
    if(m.faded){ // trilha dos próximos checkpoints/boias: anel apagado, sem rótulo
      fm.fillStyle='rgba(255,138,30,.5)';fm.strokeStyle='rgba(20,9,31,.8)';fm.lineWidth=1.6;
      fm.beginPath();fm.arc(px,py,5,0,Math.PI*2);fm.fill();fm.stroke();
      continue;
    }
    mmCircleIcon(fm,px,py,m,1.25);
    if(m.label){
      fm.font='700 10px "IBM Plex Mono",monospace';fm.textAlign='center';fm.textBaseline='top';
      fm.lineWidth=3;fm.strokeStyle='rgba(5,3,8,.92)';fm.strokeText(m.label,px,py+15);
      fm.fillStyle='#ffe9c9';fm.fillText(m.label,px,py+15);
    }
  }
  // ---- live NPC overlay ("Show NPCs"): trail to the current destination, then a
  // coloured dot per NPC. Off-map points (NPCs inside interiors) are clipped out.
  if(showNpcsOnMap){
    const blips=getNpcMapBlips();
    for(const b of blips){                            // trails first, under the dots
      if(b.tx==null||b.tz==null)continue;
      const[px,py]=P(b.x,b.z),[tx,ty]=P(b.tx,b.tz);
      fm.strokeStyle=NPC_DOT[b.kind]||'#cccccc';fm.globalAlpha=.4;fm.lineWidth=1.3;
      fm.beginPath();fm.moveTo(px,py);fm.lineTo(tx,ty);fm.stroke();
    }
    fm.globalAlpha=1;
    for(const b of blips){
      const[px,py]=P(b.x,b.z);
      if(px<-4||py<-4||px>fmCanvas!.width+4||py>fmCanvas!.height+4)continue; // interiors are off-map
      fm.fillStyle=NPC_DOT[b.kind]||'#dddddd';
      fm.beginPath();fm.arc(px,py,2.4,0,Math.PI*2);fm.fill();
      fm.strokeStyle='rgba(5,3,8,.7)';fm.lineWidth=.7;fm.stroke();
    }
  }

  // jogador (seta + "YOU"), mesma convenção do radar: norte pra cima, seta gira
  const pp=refs.playerPos?.();
  if(pp){
    const[px,py]=P(pp.x,pp.z);
    const c=refs.getCur?.();
    const h=refs.getPlayerHeading?.()??c?.heading??0;
    fm.save();fm.translate(px,py);fm.rotate(-(h-Math.PI));
    fm.fillStyle='#fff';fm.strokeStyle='#000';fm.lineWidth=2;
    fm.beginPath();fm.moveTo(0,-11);fm.lineTo(-8,9);fm.lineTo(0,4.5);fm.lineTo(8,9);
    fm.closePath();fm.fill();fm.stroke();fm.restore();
    fm.font='700 11px "IBM Plex Mono",monospace';fm.textAlign='center';fm.textBaseline='top';
    fm.lineWidth=3;fm.strokeStyle='rgba(5,3,8,.92)';fm.strokeText('YOU',px,py+13);
    fm.fillStyle='#9bf0ff';fm.fillText('YOU',px,py+13);
  }
}

export function updateHUD(dt: number): void {
  shownMoney+=(state.money-shownMoney)*Math.min(1,8*dt);
  if(Math.abs(shownMoney-state.money)<1)shownMoney=state.money;
  const moneyS='$'+String(Math.max(0,Math.round(shownMoney))).padStart(8,'0');
  if(moneyS!==_money){hudMoney.textContent=moneyS;_money=moneyS;}
  const min=Math.floor(getTod()*1440);              // clock follows the day/night cycle
  const clockS=String(Math.floor(min/60)).padStart(2,'0')+':'+String(min%60).padStart(2,'0');
  if(clockS!==_clock){hudClock.textContent=clockS;_clock=clockS;}
  const hp=Math.max(0,Math.round(state.health));
  if(hp!==_health){hudHealth.textContent=String(hp);_health=hp;}
  const w=Math.floor(state.wanted);
  if(w!==_wanted){
    // As estrelas só aparecem com pelo menos 1 nível de procurado; em w=0 o
    // container inteiro some (sem estrelas vazias na HUD).
    hudStarsBox?.classList.toggle('show',w>0);
    hudStars.forEach((s,i)=>s.classList.toggle('on',i<w));
    _wanted=w;
  }
  // Fôlego: aparece nadando (e até reencher fora d'água); pisca/vermelho sem ar
  if(hudBreath){
    const showB=state.swimming||state.swimAir<.999;
    if(showB!==_breathShown){hudBreath.classList.toggle('show',showB);_breathShown=showB;}
    if(showB){
      const pct=Math.round(state.swimAir*100);
      if(pct!==_breath){hudBreathFill.style.width=pct+'%';_breath=pct;}
      hudBreath.classList.toggle('low',state.swimAir<.25);
    }
  }
  // Letreiro de localização: nome da região atual (bairro / área rural / ilha).
  // Em interior não há posição de mundo válida — esconde e zera pra reanunciar ao
  // sair. Quando o jogador cruza pra uma região nova, mostra; sai de cena após uns
  // segundos (geografia, não um alerta permanente).
  if(hudLocation){
    const pp=!state.interior?refs.playerPos?.():null;
    const reg=pp?regionAt(pp.x,pp.z):null;
    if(reg!==_region){
      _region=reg;
      if(reg){hudLocation.textContent=reg;hudLocation.classList.add('show');_regionT=5;}
      else{hudLocation.classList.remove('show');_regionT=0;}
    }
    if(_regionT>0){_regionT-=dt;if(_regionT<=0)hudLocation.classList.remove('show');}
  }
  // Painel da arma: ícone (punho p/ melee, pistola p/ o resto), nome e munição
  // (∞ para punho/lança-chamas/detonador). Lê a arma atual via refs.
  const wh=refs.getWeaponHud?.() as WeaponHud | undefined;
  if(wh){
    drawHudWeaponIcon(wh);
    if(hudWeaponName&&wh.name!==_wname){hudWeaponName.textContent=wh.name;hudWeaponName.style.display='block';_wname=wh.name;}
    if(wh.infinite){hudWeaponAmmo.style.display='none';}
    else{
      hudWeaponAmmo.style.display='block';
      hudAmmoNow.textContent=String(wh.ammo);
      hudAmmoMax.textContent='/'+wh.max;
      hudWeaponAmmo.classList.toggle('low',!!wh.low);
    }
  }
  // velocímetro (canto inferior direito): SÓ no modo corrida
  if(hudSpeedo){
    const racing=((refs.getRaceState?.()?.phase||'idle')!=='idle')
      ||((refs.getBoatRaceState?.()?.phase||'idle')!=='idle')
      ||((refs.getOffroadState?.()?.phase||'idle')!=='idle');
    if(racing&&state.mode==='car'){
      const kmh=Math.round(Math.abs(refs.getCur?.()?.speed||0)*5);
      hudSpeedoVal.textContent=String(kmh);
      hudSpeedo.style.display='flex';
    }else hudSpeedo.style.display='none';
  }
  const aiming=state.started&&refs.isWeaponHeld?.()&&(state.aiming||state.firstPerson)&&!state.paused&&!state.dlgActive&&!state.orientationBlocked&&!state.wheelOpen;
  hudCrosshair.classList.toggle('show',!!aiming);
  hudCrosshair.classList.toggle('target',!!aiming&&state.crosshairTarget);
  hudCrosshair.classList.toggle('shoot',state.crosshairKick>.01);
  if(state.crosshairKick>0)state.crosshairKick=Math.max(0,state.crosshairKick-dt*7);
  if(msgT>0){msgT-=dt;if(msgT<=0)hudMsg.style.opacity='0';}
  const action=getInteractAction();
  const showPrompt=action.enabled&&!input.touchActive;
  if(showPrompt){
    const html=`<b>E</b> - ${action.prompt}`;
    if(html!==_prompt){hudPrompt.innerHTML=html;_prompt=html;}
  }
  if(showPrompt!==_promptShown){hudPrompt.style.display=showPrompt?'block':'none';_promptShown=showPrompt as boolean;}
}
