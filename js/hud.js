import {N,ROAD,BLOCK,GROUND,BEACH,nodeX,WATER,SWIM_BOUND,
  RURAL_X0,RURAL_GAP,RURAL_X1,RURAL_HALF,MOUNT_X,MOUNT_R} from './constants.js';
import {state,input,refs} from './state.js';
import {isPark} from './world.js';
import {getTod} from './daynight.js';

const $=id=>document.getElementById(id);
export const hudMoney=$('money'),hudClock=$('clock'),hudHealth=$('health-val'),
  hudStars=[...document.querySelectorAll('#stars .s')],
  hudCar=$('carname'),hudPrompt=$('prompt'),hudMsg=$('msg'),hudBig=$('bigtext'),
  hudWeaponIcon=$('weapon-icon'),hudWeaponAmmo=$('weapon-ammo'),hudWeaponName=$('weapon-name'),
  hudAmmoNow=$('ammo-now'),hudAmmoMax=$('ammo-max'),hudCrosshair=$('crosshair'),
  hudSpeedo=$('speedo'),hudSpeedoVal=$('speedo-val'),
  hudBreath=$('breath'),hudBreathFill=$('breath-fill');
const weaponIconCtx=hudWeaponIcon&&hudWeaponIcon.getContext('2d');
let weaponIconKey='';

let shownMoney=250,msgT=0;
// Cache dos últimos valores escritos no DOM do HUD: setar textContent/innerHTML
// troca nós de texto e invalida layout mesmo quando o valor não mudou. Só
// escrevemos quando muda de fato (a maioria dos frames não muda nada).
let _money='',_clock='',_health=-1,_wanted=-1,_wname='',_prompt='',_promptShown=null;
let _breath=-1,_breathShown=null;

// Medidor de FPS: conta frames reais e só toca no DOM 2x por segundo —
// atualizar texto todo frame custaria mais que aquilo que o medidor mede
const hudFps=$('fps');
let fpsFrames=0,fpsLast=performance.now();
export function tickFps(){
  fpsFrames++;
  const now=performance.now();
  if(now-fpsLast<500)return;
  const fps=Math.round(fpsFrames*1000/(now-fpsLast));
  hudFps.textContent=fps+' FPS';
  hudFps.style.color=fps>=50?'#41ce62':fps>=30?'#ffd24a':'#ff2e88';
  fpsFrames=0;fpsLast=now;
}

export function message(t,col){
  hudMsg.textContent=t;hudMsg.style.color=col||'var(--cream)';
  hudMsg.style.opacity=1;msgT=2.6;
}
export function bigText(t,col){
  hudBig.textContent=t;hudBig.style.color=col;
  hudBig.style.textShadow=`4px 4px 0 #000,0 0 40px ${col}`;
  hudBig.classList.add('show');
}
export function hideBig(){hudBig.classList.remove('show');}

// A ação de interação (label/prompt do botão E) é consultada por updateHUD e
// pelo touch-controls TODO frame, e percorre uma cascata de refs + nearestCar
// (loop por carros/tráfego/viaturas). O alvo muda devagar do ponto de vista do
// jogador, então memoizamos ~12fps: corta esse custo da maioria dos frames sem
// atraso perceptível no HUD.
let _iaCache=null,_iaT=-1;
export function getInteractAction(){
  const now=performance.now();
  if(_iaCache&&now-_iaT<80)return _iaCache;
  _iaT=now;
  return _iaCache=computeInteractAction();
}
function computeInteractAction(){
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
    const gym=refs.gymTrainState?.(); // perto do supino dentro da academia
    if(gym)return gym;
    const dance=refs.clubDanceState?.(); // no meio da pista dentro da boate
    if(dance)return dance;
    const shop=refs.gunShopState?.(); // perto de uma arma dentro da loja de armas
    if(shop)return shop;
    const ov=refs.overkillNear?.(); // perto do totem do modo overkill
    if(ov)return{label:'OVERKILL',prompt:ov,enabled:true};
  }
  if(state.mode==='foot'){
    const rk=refs.rickNear?.(); // acampamento secreto do Rick (sem blip no mapa)
    if(rk)return{label:'TALK',prompt:'TALK TO '+rk,enabled:true};
    const sn=refs.storyNear?.();
    if(sn)return{label:'TALK',prompt:'TALK TO '+sn,enabled:true};
  }
  if(state.mode==='foot'){
    const near=refs.nearestCar?.(3.6);
    if(near){
      const c=near.c;
      if(refs.isTaxiCar?.(c))return{label:'TAXI',prompt:'START TAXI SHIFT',enabled:true};
      if(refs.isVigilanteCar?.(c))return{label:'VIGILANTE',prompt:'START VIGILANTE DUTY',enabled:true};
      if(refs.isAmbulanceCar?.(c))return{label:'PARAMEDIC',prompt:'START PARAMEDIC',enabled:true};
      return c.boat
        ?{label:'BOAT',prompt:'RIDE THE BOAT',enabled:true}
        :c.bike
          ?{label:'BIKE',prompt:'RIDE THE BIKE',enabled:true}
          :{label:'CAR',prompt:'TAKE THE CAR',enabled:true};
    }
  }
  if(state.mode==='car'){
    if(refs.raceNear?.())return{label:'RACE',prompt:'START THE RACE',enabled:true};
    if(refs.boatRaceNear?.())return{label:'RACE',prompt:'START THE BOAT RACE',enabled:true};
    const mod=refs.modShopState?.(); // carro parado na plataforma da oficina de custom
    if(mod)return mod;
    const garage=refs.houseGarageState?.(); // carro parado dentro da garagem da casa
    if(garage)return garage;
    const c=refs.getCur?.();
    const speed=Math.abs(c?.speed||0);
    return speed<6
      ?{label:'EXIT',prompt:c?.boat?'GET OFF THE BOAT':c?.bike?'GET OFF THE BIKE':'EXIT THE CAR',enabled:true}
      :{label:'...',prompt:'',enabled:false};
  }
  return{label:'...',prompt:'',enabled:false};
}

// Vice City-style radar: circular, fixed north-up, player arrow rotating at
// the center, square blips clamped to the rim
const mmCanvas=$('minimap');
export const mm=mmCanvas.getContext('2d');
const MMW=GROUND+BEACH*2;            // world span covered by the static map
const MM_C=85,MM_R=80,MM_RANGE=105;  // center px, radius px, radar reach in meters
const MM_POI_REVEAL=90;              // POIs fixos só aparecem dentro de N metros (declutter)
const mmStatic=document.createElement('canvas');mmStatic.width=512;mmStatic.height=512;
{
  const x=mmStatic.getContext('2d'),s=512/MMW,M=v=>(v+MMW/2)*s;
  x.fillStyle='#d8c08a';x.fillRect(0,0,512,512);             // areia da praia
  x.fillStyle='#e8dcc4';                                      // ruas claras
  x.fillRect(M(-GROUND/2),M(-GROUND/2),GROUND*s,GROUND*s);
  for(let i=0;i<N;i++)for(let j=0;j<N;j++){
    x.fillStyle=isPark(i,j)?'#5d7c3e':'#8a6f4d';              // parque / quarteirão
    x.fillRect(M(nodeX(i)+ROAD/2),M(nodeX(j)+ROAD/2),BLOCK*s,BLOCK*s);
  }
}

// mapa estático da zona rural + montanha (a península fica fora do canvas da cidade)
const RRW=RURAL_X1-RURAL_X0,RRD=RURAL_HALF*2;
const mmRural=document.createElement('canvas');mmRural.width=260;mmRural.height=240;
{
  const x=mmRural.getContext('2d'),sx=260/RRW,sz=240/RRD;
  const U=v=>(v-RURAL_X0)*sx,W=v=>(v+RURAL_HALF)*sz;
  x.fillStyle='#6a9a50';x.fillRect(0,0,260,240);                // pasto
  x.fillStyle='#8a6a3e';                                        // roças
  for(const[a,b,d,e]of[[202,250,14,62],[200,244,-64,-22],[262,310,30,86],[258,300,-90,-42]]
    .map(f=>[f[0]+RURAL_GAP,f[1]+RURAL_GAP,f[2],f[3]]))
    x.fillRect(U(a),W(d),(b-a)*sx,(e-d)*sz);
  x.fillStyle='#b08a5e';                                        // estrada de terra
  x.fillRect(U(RURAL_X0),W(-3.4),(MOUNT_X-MOUNT_R+16-RURAL_X0)*sx,6.8*sz);
  // montanha em níveis de elevação
  for(const[r,col]of[[MOUNT_R,'#8d8f99'],[MOUNT_R*.62,'#a9adb8'],[MOUNT_R*.28,'#c9ccd4']]){
    x.fillStyle=col;x.beginPath();
    x.ellipse(U(MOUNT_X),W(0),r*sx,r*sz,0,0,Math.PI*2);x.fill();
  }
}

// world offset → radar screen offset (north-up), clamped to the rim
function mmBlip(wx,wz,pp,scale){
  let px=(wx-pp.x)*scale,py=(wz-pp.z)*scale;
  const d=Math.hypot(px,py),max=MM_R-8;
  if(d>max){px*=max/d;py*=max/d;}
  return[MM_C+px,MM_C+py];
}
function mmSquare(ctx,px,py,size,col){
  ctx.fillStyle=col;ctx.strokeStyle='rgba(0,0,0,.75)';ctx.lineWidth=1.5;
  ctx.fillRect(px-size/2,py-size/2,size,size);
  ctx.strokeRect(px-size/2,py-size/2,size,size);
}
function mmCircleIcon(ctx,px,py,b,scale=1){
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
    default:
      ctx.lineWidth=1.8;ctx.strokeRect(-3.6,-5,7.2,10);
      ctx.beginPath();ctx.arc(1.7,.2,.65,0,Math.PI*2);ctx.fill();
  }
  ctx.restore();
}
function drawHudWeaponIcon(wh){
  if(!weaponIconCtx)return;
  const key=wh.id||wh.name;
  if(weaponIconKey===key)return;
  weaponIconKey=key;
  const c=weaponIconCtx;
  c.setTransform(1,0,0,1,0,0);
  c.clearRect(0,0,64,64);
  const grad=c.createLinearGradient(10,8,54,56);
  grad.addColorStop(0,'#8ceefb');grad.addColorStop(1,'#ff9bd1');
  const gold=c.createLinearGradient(12,10,54,56);
  gold.addColorStop(0,'#fff1a6');gold.addColorStop(1,'#f5a63a');
  const dark='#09030d';
  const ink='rgba(9,3,13,.92)';
  const fillPath=()=>{
    c.fill();
    c.strokeStyle=ink;c.lineWidth=2.4;c.stroke();
  };
  const gunBody=(scale=1)=>{
    c.scale(scale,scale);
    c.beginPath();
    c.moveTo(-25,-8);c.lineTo(16,-8);c.lineTo(16,-1);
    c.lineTo(4,-1);c.lineTo(1,6);c.lineTo(-16,6);
    c.lineTo(-19,13);c.lineTo(-25,13);c.closePath();fillPath();
    c.fillStyle=grad;c.fillRect(13,-11,10,4);c.strokeRect(13,-11,10,4);
    c.beginPath();c.moveTo(-1,6);c.lineTo(11,6);c.lineTo(6,25);
    c.lineTo(-7,25);c.closePath();fillPath();
    c.strokeStyle=dark;c.lineWidth=2;
    c.beginPath();c.arc(-8,13,6,-.7,1.55);c.stroke();
  };
  c.save();c.translate(32,32);c.fillStyle=grad;c.strokeStyle=ink;
  c.lineCap='round';c.lineJoin='round';
  switch(wh.id){
    case'fist':
      c.fillStyle=grad;
      for(const x of[-13,-4,5,14]){
        c.beginPath();c.arc(x,-9,6,0,Math.PI*2);fillPath();
      }
      c.beginPath();c.rect(-18,-6,31,23);fillPath();
      c.beginPath();c.roundRect?c.roundRect(8,-2,13,17,6):c.rect(8,-2,13,17);
      fillPath();
      break;
    case'bat':
      c.rotate(-.55);c.strokeStyle=ink;c.lineWidth=9;
      c.beginPath();c.moveTo(-19,16);c.lineTo(21,-18);c.stroke();
      c.strokeStyle=grad;c.lineWidth=5.5;
      c.beginPath();c.moveTo(-19,16);c.lineTo(21,-18);c.stroke();
      c.fillStyle=gold;c.beginPath();c.arc(23,-20,5,0,Math.PI*2);fillPath();
      c.strokeStyle=ink;c.lineWidth=3;c.beginPath();c.moveTo(-24,20);c.lineTo(-15,12);c.stroke();
      break;
    case'pistol':
      c.fillStyle=grad;gunBody(.86);break;
    case'uzi':
      c.fillStyle=grad;
      c.fillRect(-24,-9,34,14);c.strokeRect(-24,-9,34,14);
      c.fillRect(8,-12,14,4);c.strokeRect(8,-12,14,4);
      c.beginPath();c.moveTo(-4,5);c.lineTo(5,5);c.lineTo(1,25);c.lineTo(-7,25);c.closePath();fillPath();
      c.fillRect(-21,4,7,11);c.strokeRect(-21,4,7,11);
      c.strokeStyle=dark;c.lineWidth=2;c.beginPath();c.arc(-9,10,5,-.55,1.55);c.stroke();
      break;
    case'shotgun':
      c.fillStyle=grad;
      c.fillRect(-27,-6,48,5);c.strokeRect(-27,-6,48,5);
      c.fillRect(-22,1,24,5);c.strokeRect(-22,1,24,5);
      c.beginPath();c.moveTo(-27,-4);c.lineTo(-18,-14);c.lineTo(-9,-10);c.lineTo(-15,-2);c.closePath();fillPath();
      c.fillRect(18,-8,8,3);c.strokeRect(18,-8,8,3);
      break;
    case'ak47':
      c.fillStyle=grad;
      c.rotate(-.05);
      c.fillRect(-23,-7,35,7);c.strokeRect(-23,-7,35,7);
      c.fillRect(10,-10,14,3);c.strokeRect(10,-10,14,3);
      c.beginPath();c.moveTo(-24,-5);c.lineTo(-12,-18);c.lineTo(-6,-14);c.lineTo(-15,-3);c.closePath();fillPath();
      c.beginPath();c.moveTo(-1,0);c.quadraticCurveTo(7,14,-2,25);c.lineTo(-8,22);
      c.quadraticCurveTo(-1,12,-7,1);c.closePath();fillPath();
      c.fillRect(-7,-13,10,4);c.strokeRect(-7,-13,10,4);
      break;
    case'm16':
      c.fillStyle=grad;
      c.fillRect(-25,-6,41,7);c.strokeRect(-25,-6,41,7);
      c.fillRect(14,-9,13,3);c.strokeRect(14,-9,13,3);
      c.beginPath();c.moveTo(-23,-4);c.lineTo(-13,-15);c.lineTo(-5,-11);c.lineTo(-13,-2);c.closePath();fillPath();
      c.fillRect(-3,1,7,18);c.strokeRect(-3,1,7,18);
      c.strokeStyle=ink;c.lineWidth=3;c.beginPath();c.moveTo(-6,-11);c.quadraticCurveTo(2,-18,10,-10);c.stroke();
      break;
    case'sniper':
      c.fillStyle=grad;
      c.fillRect(-28,-5,47,5);c.strokeRect(-28,-5,47,5);
      c.fillRect(18,-7,10,2.7);c.strokeRect(18,-7,10,2.7);
      c.fillRect(-10,-14,18,5);c.strokeRect(-10,-14,18,5);
      c.beginPath();c.moveTo(-26,-4);c.lineTo(-15,-14);c.lineTo(-7,-11);c.lineTo(-15,-2);c.closePath();fillPath();
      c.strokeStyle=ink;c.lineWidth=2.3;c.beginPath();c.moveTo(7,0);c.lineTo(13,18);c.moveTo(12,0);c.lineTo(22,17);c.stroke();
      break;
    case'grenade':
      c.fillStyle=grad;
      c.beginPath();c.ellipse(0,6,16,19,0,0,Math.PI*2);fillPath();
      c.fillStyle=gold;c.fillRect(-7,-17,14,9);c.strokeRect(-7,-17,14,9);
      c.strokeStyle=ink;c.lineWidth=2;
      c.beginPath();c.arc(8,-16,7,-.35,Math.PI*1.35);c.stroke();
      c.beginPath();c.moveTo(-11,-1);c.lineTo(11,-1);c.moveTo(-12,9);c.lineTo(12,9);c.moveTo(-4,-11);c.lineTo(-4,22);c.moveTo(5,-10);c.lineTo(5,22);c.stroke();
      break;
    case'molotov':
      c.fillStyle=grad;
      c.beginPath();c.moveTo(-7,-20);c.lineTo(6,-20);c.lineTo(9,15);
      c.quadraticCurveTo(0,25,-10,15);c.closePath();fillPath();
      c.fillStyle=gold;c.fillRect(-9,-16,18,7);c.strokeRect(-9,-16,18,7);
      c.fillStyle='#ff5a2e';c.beginPath();c.moveTo(4,-24);c.quadraticCurveTo(17,-12,4,-6);
      c.quadraticCurveTo(-7,-13,4,-24);fillPath();
      break;
    case'rocket':
      c.fillStyle=grad;
      c.rotate(-.06);
      c.fillRect(-25,-7,40,14);c.strokeRect(-25,-7,40,14);
      c.beginPath();c.moveTo(15,-8);c.lineTo(28,0);c.lineTo(15,8);c.closePath();fillPath();
      c.fillStyle=gold;c.fillRect(-25,-10,8,20);c.strokeRect(-25,-10,8,20);
      c.strokeStyle=ink;c.lineWidth=3;c.beginPath();c.moveTo(-4,7);c.lineTo(-11,22);c.moveTo(7,7);c.lineTo(12,20);c.stroke();
      break;
    case'flame':
      c.fillStyle=grad;
      c.beginPath();c.ellipse(-12,4,9,19,0,0,Math.PI*2);fillPath();
      c.fillRect(-2,-7,21,7);c.strokeRect(-2,-7,21,7);
      c.strokeStyle=ink;c.lineWidth=4;c.beginPath();c.moveTo(-4,8);c.quadraticCurveTo(7,18,18,7);c.stroke();
      c.fillStyle='#ff5a2e';c.beginPath();c.moveTo(21,-6);c.quadraticCurveTo(34,-1,22,8);
      c.quadraticCurveTo(27,0,21,-6);fillPath();
      break;
    case'detonator':
      c.fillStyle=grad;
      c.fillRect(-16,-11,32,28);c.strokeRect(-16,-11,32,28);
      c.fillStyle=gold;c.beginPath();c.arc(0,0,7,0,Math.PI*2);fillPath();
      c.strokeStyle=ink;c.lineWidth=3;c.beginPath();c.moveTo(10,-12);c.lineTo(22,-25);c.stroke();
      c.beginPath();c.arc(24,-27,3,0,Math.PI*2);c.fill();
      c.fillStyle=dark;c.fillRect(-10,10,20,3);
      break;
    default:
      c.fillStyle=grad;gunBody(.86);
  }
  c.restore();
}

const mapWrap=$('mapwrap');
export function drawMinimap(){
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
  const raceOn=((refs.getRaceState?.()?.phase||'idle')!=='idle')
    ||((refs.getBoatRaceState?.()?.phase||'idle')!=='idle');

  mm.clearRect(0,0,170,170);
  mm.save();
  mm.beginPath();mm.arc(MM_C,MM_C,MM_R,0,Math.PI*2);mm.clip();
  mm.fillStyle='#2e8a96';mm.fillRect(0,0,170,170);           // mar ao fundo

  mm.save();
  mm.translate(MM_C,MM_C);mm.scale(scale,scale);
  mm.translate(-pp.x,-pp.z);
  mm.drawImage(mmStatic,-MMW/2,-MMW/2,MMW,MMW);
  mm.drawImage(mmRural,RURAL_X0,-RURAL_HALF,RRW,RRD);
  // territórios das gangues (círculos coloridos que encolhem conforme você mata)
  const gangsArr=refs.gangs;
  if(!raceOn&&gangsArr)for(const g of gangsArr){
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
    mmCircleIcon(mm,px,py,{icon:'cop',color:'#3e7bff'},.78);
  }
  // Demais objetivos/minigames ficam ESCONDIDOS durante a corrida de rua
  if(!raceOn){
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
      pm&&{...pm,icon:'cross',color:'#19e3ff'}]){
      if(!m||Math.hypot(m.x-pp.x,m.z-pp.z)>MM_POI_REVEAL)continue;
      mmCircleIcon(mm,MM_C+(m.x-pp.x)*scale,MM_C+(m.z-pp.z)*scale,m);
    }
    const delivery=refs.getDelivery?.();
    if(delivery){
      const[px,py]=mmBlip(delivery.x,delivery.z,pp,scale);
      mmCircleIcon(mm,px,py,{icon:'package',color:'#ffd24a'});
    }
    const taxiT=refs.taxiTarget?.(); // táxi livre / passageiro / destino
    if(taxiT){
      const[px,py]=mmBlip(taxiT.x,taxiT.z,pp,scale);
      mmCircleIcon(mm,px,py,{
        icon:taxiT.kind==='taxi'?'taxi':taxiT.kind==='pickup'?'person':'flag',
        color:taxiT.kind==='taxi'?'#f5c518':'#5eff8a'});
    }
    for(const b of refs.vigilanteBlips?.()||[]){ // criminoso em fuga (vigilante)
      const[px,py]=mmBlip(b.x,b.z,pp,scale);
      mmCircleIcon(mm,px,py,{icon:'target',color:b.col||'#ff3b56'},b.current?1:.82);
    }
    for(const b of refs.paramedicBlips?.()||[]){ // feridos / hospital (paramedic)
      const[px,py]=mmBlip(b.x,b.z,pp,scale);
      mmCircleIcon(mm,px,py,{icon:'cross',color:b.col||'#5eff8a'},b.current?1:.82);
    }
    // Missão da história: blip no NPC atual (letra) ou no item (losango) quando ativa;
    // o piscar de retorno já vem resolvido de storyBlips()
    for(const b of refs.storyBlips?.()||[]){
      const[px,py]=mmBlip(b.x,b.z,pp,scale);
      mmCircleIcon(mm,px,py,{icon:b.letter?'letter':'diamond',letter:b.letter,color:b.col});
    }
  }
  // Corrida (rua/lanchas): bandeira no checkpoint atual + próximos como anéis apagados
  for(const b of[...(refs.raceBlips?.()||[]),...(refs.boatRaceBlips?.()||[])]){
    const[px,py]=mmBlip(b.x,b.z,pp,scale);
    if(b.current)mmCircleIcon(mm,px,py,{icon:'flag',color:'#ff8a1e'});
    else{
      mm.fillStyle='rgba(255,138,30,.5)';mm.strokeStyle='rgba(20,9,31,.8)';mm.lineWidth=1.4;
      mm.beginPath();mm.arc(px,py,3.4,0,Math.PI*2);mm.fill();mm.stroke();
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
const fmCanvas=$('fullmap-canvas');
const fm=fmCanvas&&fmCanvas.getContext('2d');
// O mapa grande inclui uma faixa de MAR ao redor da cidade: a corrida de lanchas
// roda num anel no mar (raio ~ (WATER+SWIM_BOUND)/2), então o mapa precisa
// alcançar além da linha d'água pra mostrar as boias/largada da prova.
const FM_SEA=Math.round((WATER+SWIM_BOUND)/2)+24;
const FM_MINX=-FM_SEA,FM_MAXX=RURAL_X1+20,FM_MINZ=-FM_SEA,FM_MAXZ=FM_SEA;
const FM_WW=FM_MAXX-FM_MINX,FM_WH=FM_MAXZ-FM_MINZ;
// Resolução interna seguindo a proporção real do mundo (sem barras); o CSS
// reescala isso pra caber em qualquer tela mantendo a proporção.
if(fmCanvas){fmCanvas.width=1280;fmCanvas.height=Math.round(1280*FM_WH/FM_WW);}
function fmFit(){
  const s=Math.min(fmCanvas.width/FM_WW,fmCanvas.height/FM_WH);
  return{s,ox:(fmCanvas.width-FM_WW*s)/2,oy:(fmCanvas.height-FM_WH*s)/2};
}
export function drawFullMap(){
  if(!fm)return;
  const{s,ox,oy}=fmFit();
  const P=(wx,wz)=>[ox+(wx-FM_MINX)*s,oy+(wz-FM_MINZ)*s];
  fm.setTransform(1,0,0,1,0,0);
  fm.clearRect(0,0,fmCanvas.width,fmCanvas.height);
  fm.fillStyle='#2e8a96';fm.fillRect(0,0,fmCanvas.width,fmCanvas.height); // mar ao fundo
  fm.drawImage(mmStatic,...P(-MMW/2,-MMW/2),MMW*s,MMW*s);
  fm.drawImage(mmRural,...P(RURAL_X0,-RURAL_HALF),RRW*s,RRD*s);
  // territórios das gangues
  const gangsArr=refs.gangs;
  if(gangsArr)for(const g of gangsArr){
    if(g.defeated)continue; // gangue eliminada: some do mapa
    const[cx,cy]=P(g.x,g.z);
    fm.fillStyle=g.cssA;fm.beginPath();fm.arc(cx,cy,g.r*s,0,Math.PI*2);fm.fill();
    fm.strokeStyle=g.css;fm.lineWidth=2;fm.stroke();
  }
  // ---- REGRA: todo ícone do mapa grande leva um rótulo embaixo ----
  // Junta TODOS os marcadores num formato único {x,z,icon,color,label,letter},
  // incluindo os pontos de início de cada minigame (corrida, lanchas, táxi,
  // vigilante, paramédico, overkill), e desenha ícone + descrição pra todos.
  const marks=[];
  const push=(b,icon,color,label,faded)=>{
    if(b)marks.push({x:b.x,z:b.z,icon,color,label,letter:b.letter,faded});
  };
  for(const b of refs.interiorBlips?.()||[])marks.push({...b});  // lojas/serviços (já têm label)
  const ws=refs.workshopBlip?.();if(ws)marks.push({...ws});      // oficina de custom
  // minigames de ponto fixo
  push(refs.overkillBlip?.(),'skull','#ff2e88','OVERKILL');
  push(refs.vigilanteStart?.(),'cop','#3e7bff','VIGILANTE');
  push(refs.paramedicStart?.(),'cross','#19e3ff','PARAMEDIC');
  // táxi: livre / passageiro / destino
  const tx=refs.taxiTarget?.();
  if(tx)push(tx,tx.kind==='taxi'?'taxi':tx.kind==='pickup'?'person':'flag',
              tx.kind==='taxi'?'#f5c518':'#5eff8a',
              tx.kind==='taxi'?'TAXI':tx.kind==='pickup'?'PASSENGER':'DROP OFF');
  // entrega
  push(refs.getDelivery?.(),'package','#ffd24a','DELIVERY');
  // plantões ativos
  for(const b of refs.vigilanteBlips?.()||[])push(b,'target',b.col||'#ff3b56','SUSPECT');
  for(const b of refs.paramedicBlips?.()||[])
    push(b,'cross',b.col||'#5eff8a',b.col==='#19e3ff'?'HOSPITAL':'PATIENT');
  // história
  for(const b of refs.storyBlips?.()||[])push(b,b.letter?'letter':'diamond',b.col,'MISSION');
  // corridas: largada nomeada quando ociosa; durante a prova, checkpoint atual +
  // boias seguintes (anel apagado, sem rótulo)
  const rOn=(refs.getRaceState?.()?.phase||'idle')!=='idle';
  for(const b of refs.raceBlips?.()||[])
    push(b,'flag','#ff8a1e',rOn?(b.current?'CHECKPOINT':null):'STREET RACE',rOn&&!b.current);
  const bOn=(refs.getBoatRaceState?.()?.phase||'idle')!=='idle';
  for(const b of refs.boatRaceBlips?.()||[])
    push(b,'flag','#1ec8ff',bOn?(b.current?'NEXT BUOY':null):'BOAT RACE',bOn&&!b.current);

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

export function updateHUD(dt){
  shownMoney+=(state.money-shownMoney)*Math.min(1,8*dt);
  if(Math.abs(shownMoney-state.money)<1)shownMoney=state.money;
  const moneyS='$'+String(Math.max(0,Math.round(shownMoney))).padStart(8,'0');
  if(moneyS!==_money){hudMoney.textContent=moneyS;_money=moneyS;}
  const min=Math.floor(getTod()*1440);              // relógio segue o ciclo de dia/noite
  const clockS=String(Math.floor(min/60)).padStart(2,'0')+':'+String(min%60).padStart(2,'0');
  if(clockS!==_clock){hudClock.textContent=clockS;_clock=clockS;}
  const hp=Math.max(0,Math.round(state.health));
  if(hp!==_health){hudHealth.textContent=hp;_health=hp;}
  const w=Math.floor(state.wanted);
  if(w!==_wanted){hudStars.forEach((s,i)=>s.classList.toggle('on',i<w));_wanted=w;}
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
  // Painel da arma: ícone (punho p/ melee, pistola p/ o resto), nome e munição
  // (∞ para punho/lança-chamas/detonador). Lê a arma atual via refs.
  const wh=refs.getWeaponHud?.();
  if(wh){
    drawHudWeaponIcon(wh);
    if(hudWeaponName&&wh.name!==_wname){hudWeaponName.textContent=wh.name;hudWeaponName.style.display='block';_wname=wh.name;}
    if(wh.infinite){hudWeaponAmmo.style.display='none';}
    else{
      hudWeaponAmmo.style.display='block';
      hudAmmoNow.textContent=wh.ammo;
      hudAmmoMax.textContent='/'+wh.max;
      hudWeaponAmmo.classList.toggle('low',wh.low);
    }
  }
  // velocímetro (canto inferior direito): SÓ no modo corrida
  if(hudSpeedo){
    const racing=((refs.getRaceState?.()?.phase||'idle')!=='idle')
      ||((refs.getBoatRaceState?.()?.phase||'idle')!=='idle');
    if(racing&&state.mode==='car'){
      const kmh=Math.round(Math.abs(refs.getCur?.()?.speed||0)*5);
      hudSpeedoVal.textContent=kmh;
      hudSpeedo.style.display='flex';
    }else hudSpeedo.style.display='none';
  }
  const aiming=state.started&&refs.isWeaponHeld?.()&&!state.paused&&!state.dlgActive&&!state.orientationBlocked;
  hudCrosshair.classList.toggle('show',aiming);
  hudCrosshair.classList.toggle('target',aiming&&state.crosshairTarget);
  hudCrosshair.classList.toggle('shoot',state.crosshairKick>.01);
  if(state.crosshairKick>0)state.crosshairKick=Math.max(0,state.crosshairKick-dt*7);
  if(msgT>0){msgT-=dt;if(msgT<=0)hudMsg.style.opacity=0;}
  const action=getInteractAction();
  const showPrompt=action.enabled&&!input.touchActive;
  if(showPrompt){
    const html=`<b>E</b> - ${action.prompt}`;
    if(html!==_prompt){hudPrompt.innerHTML=html;_prompt=html;}
  }
  if(showPrompt!==_promptShown){hudPrompt.style.display=showPrompt?'block':'none';_promptShown=showPrompt;}
}
