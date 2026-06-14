import {N,ROAD,BLOCK,GROUND,BEACH,nodeX,
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
  hudSpeedo=$('speedo'),hudSpeedoVal=$('speedo-val');
const weaponIconCtx=hudWeaponIcon&&hudWeaponIcon.getContext('2d');
let weaponIconKey='';

let shownMoney=250,msgT=0;
// Cache dos últimos valores escritos no DOM do HUD: setar textContent/innerHTML
// troca nós de texto e invalida layout mesmo quando o valor não mudou. Só
// escrevemos quando muda de fato (a maioria dos frames não muda nada).
let _money='',_clock='',_health=-1,_wanted=-1,_wname='',_prompt='',_promptShown=null;

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
    if(near)return refs.isTaxiCar?.(near.c)
      ?{label:'TAXI',prompt:'START TAXI SHIFT',enabled:true}
      :near.c.boat
        ?{label:'BOAT',prompt:'RIDE THE BOAT',enabled:true}
        :near.c.bike
          ?{label:'BIKE',prompt:'RIDE THE BIKE',enabled:true}
          :{label:'CAR',prompt:'TAKE THE CAR',enabled:true};
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
function mmSquare(px,py,size,col){
  mm.fillStyle=col;mm.strokeStyle='rgba(0,0,0,.75)';mm.lineWidth=1.5;
  mm.fillRect(px-size/2,py-size/2,size,size);
  mm.strokeRect(px-size/2,py-size/2,size,size);
}
function mmCircleIcon(px,py,b){
  const r=8.6;
  mm.save();
  mm.translate(px,py);
  mm.fillStyle='rgba(5,3,8,.9)';
  mm.beginPath();mm.arc(0,0,r+2,0,Math.PI*2);mm.fill();
  mm.fillStyle=b.color||'#f5c518';
  mm.strokeStyle='rgba(255,255,255,.78)';mm.lineWidth=1.15;
  mm.beginPath();mm.arc(0,0,r,0,Math.PI*2);mm.fill();mm.stroke();
  mm.fillStyle='#120916';mm.strokeStyle='#120916';mm.lineCap='round';mm.lineJoin='round';
  switch(b.icon){
    case'gun':
      mm.beginPath();
      mm.moveTo(-6.4,-3.1);mm.lineTo(4.9,-3.1);mm.lineTo(4.9,-1.2);
      mm.lineTo(1.4,-1.2);mm.lineTo(.6,.5);mm.lineTo(-4.2,.5);
      mm.lineTo(-4.8,2.3);mm.lineTo(-6.4,2.3);mm.closePath();mm.fill();
      mm.fillRect(3.9,-4.0,3.0,1.25);
      mm.beginPath();mm.moveTo(-.7,.6);mm.lineTo(2.4,.6);mm.lineTo(1.1,5.7);
      mm.lineTo(-2.2,5.7);mm.closePath();mm.fill();
      mm.strokeStyle='#120916';mm.lineWidth=1.25;
      mm.beginPath();mm.arc(-1.8,2.0,1.8,-.6,1.55);mm.stroke();
      break;
    case'gym':
      mm.lineWidth=2;mm.beginPath();mm.moveTo(-4.8,0);mm.lineTo(4.8,0);mm.stroke();
      for(const x of[-6.2,-4.5,4.5,6.2])mm.fillRect(x-.55,-3.8,1.1,7.6);
      break;
    case'hospital':
      mm.fillRect(-2.1,-5.4,4.2,10.8);
      mm.fillRect(-5.4,-2.1,10.8,4.2);
      break;
    case'prison':
      mm.fillRect(-5.5,-4.7,11,1.35);mm.fillRect(-5.5,3.35,11,1.35);
      for(const x of[-3.6,0,3.6])mm.fillRect(x-.55,-4.7,1.1,9.4);
      break;
    case'club':
      mm.lineWidth=1.8;
      mm.beginPath();mm.moveTo(.8,-5.3);mm.lineTo(.8,2.2);mm.stroke();
      mm.beginPath();mm.moveTo(.8,-5.3);mm.quadraticCurveTo(4.9,-4.7,5.1,-2.6);mm.stroke();
      mm.beginPath();mm.ellipse(-2.2,3.0,2.6,1.8,-.25,0,Math.PI*2);mm.fill();
      break;
    case'house':
      mm.beginPath();mm.moveTo(-6,.2);mm.lineTo(0,-5.3);mm.lineTo(6,.2);
      mm.lineTo(4.7,.2);mm.lineTo(4.7,5);mm.lineTo(-4.7,5);mm.lineTo(-4.7,.2);
      mm.closePath();mm.fill();
      mm.fillStyle=b.color||'#f5c518';mm.fillRect(-1.2,1.5,2.4,3.5);
      break;
    case'wrench':
      mm.lineWidth=2.4;mm.lineCap='round';
      mm.beginPath();mm.moveTo(-3.4,-3.4);mm.lineTo(3.4,3.4);mm.stroke(); // cabo
      mm.lineWidth=1.6;
      mm.beginPath();mm.arc(-3.8,-3.8,2.2,-1.0,2.2);mm.stroke();           // boca
      mm.beginPath();mm.arc(3.8,3.8,2.2,2.1,5.3);mm.stroke();
      break;
    default:
      mm.lineWidth=1.8;mm.strokeRect(-3.6,-5,7.2,10);
      mm.beginPath();mm.arc(1.7,.2,.65,0,Math.PI*2);mm.fill();
  }
  mm.restore();
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
    mm.fillStyle=g.cssA;
    mm.beginPath();mm.arc(g.x,g.z,g.r,0,Math.PI*2);mm.fill();
    mm.strokeStyle=g.css;mm.lineWidth=2/scale;mm.stroke();
  }
  mm.restore();

  // blips quadrados (presos na borda quando longe)
  const cops=refs.cops||[];
  for(const c of cops){
    const[px,py]=mmBlip(c.g.position.x,c.g.position.z,pp,scale);
    mmSquare(px,py,6,'#3e7bff');
  }
  // Demais objetivos/minigames ficam ESCONDIDOS durante a corrida de rua
  if(!raceOn){
    for(const b of refs.interiorBlips?.()||[]){
      const[px,py]=mmBlip(b.x,b.z,pp,scale);
      mmCircleIcon(px,py,b);
    }
    const ws=refs.workshopBlip?.(); // oficina de custom (não é Interior)
    if(ws){const[px,py]=mmBlip(ws.x,ws.z,pp,scale);mmCircleIcon(px,py,ws);}
    const delivery=refs.getDelivery?.();
    if(delivery){
      const[px,py]=mmBlip(delivery.x,delivery.z,pp,scale);
      mmSquare(px,py,8,'#ffd24a');
    }
    const taxiT=refs.taxiTarget?.(); // corrida de táxi: passageiro ou destino
    if(taxiT){
      const[px,py]=mmBlip(taxiT.x,taxiT.z,pp,scale);
      mmSquare(px,py,8,'#5eff8a');
    }
    // Missão da história: blip no NPC atual (letra) ou no item quando ativa;
    // o piscar de retorno já vem resolvido de storyBlips()
    for(const b of refs.storyBlips?.()||[]){
      const[px,py]=mmBlip(b.x,b.z,pp,scale);
      if(b.letter){
        mmSquare(px,py,9,b.col);
        mm.fillStyle='#14091f';mm.font='bold 7px monospace';
        mm.textAlign='center';mm.textBaseline='middle';
        mm.fillText(b.letter,px,py+.5);
      }else mmSquare(px,py,8,b.col);
    }
  }
  // Corrida (rua/lanchas): checkpoint/boia atual (forte) + próximos (apagados)
  for(const b of[...(refs.raceBlips?.()||[]),...(refs.boatRaceBlips?.()||[])]){
    const[px,py]=mmBlip(b.x,b.z,pp,scale);
    mmSquare(px,py,b.current?9:6,b.current?'#ff8a1e':'rgba(255,138,30,.55)');
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
