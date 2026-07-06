import {scene} from '@/core/engine.ts';
import {state,refs} from '@/core/state.ts';
import {economy} from '@/core/economy.ts';
import {groundHeight,rand,pick} from '@/core/constants.ts';
import {playerPos,applyPlayerClothing} from '@/actors/player.ts';
import {makePed} from '@/core/entities.ts';
import {Npc} from '@/actors/npc.ts';
import {gangs,gangPeds} from '@/actors/gangs.ts';
import {solids} from '@/world/world.ts';
import {message} from '@/ui/hud.ts';
import {say} from '@/ui/speech.ts';
import {blip} from '@/audio/audio.ts';
import {playCutscene} from '@/story/story.ts';
import {PARTIES,PARTY_FEE,partyRelation,membershipCounts,type PartyId} from '@/places/party-data.ts';
import partyDesk from '../../assets/models/props/party-desk.ts';
import partyBanner from '../../assets/models/city/party-banner.ts';

// ============================================================================
// PARTY HQs — the affiliation desk at each party's turf and the giant plaza
// banner with the live membership bars. Flow: walk to a desk → E → the
// recruiter's cut-scene pitch → the sign-up sheet overlay (what the party
// stands for + the $100 fee) → agree = you're a member, wearing the party's
// colours. The same desk de-affiliates a member. Membership lives in
// state.party and persists in the save (js/core/save.ts).
// Pure data (names, colours, satire, relation logic): js/places/party-data.ts.
// ============================================================================

const TALK_R=3.4;   // distance to use a desk
const PLAZA={x:-110,z:-110}; // memorial plaza centre (first park block, world.ts)

interface Desk{party:PartyId;x:number;z:number;rep:Npc;chatT:number;}
const desks:Desk[]=[];

// ---- the two desks + recruiters (one per HQ, at the turf centre) ----
for(const gang of gangs){
  const def=PARTIES[gang.party];
  const x=gang.x,z=gang.z;
  const ry=Math.atan2(-x,-z); // desk front towards the city centre
  const desk=partyDesk.build({color:def.color});
  desk.position.set(x,groundHeight(x,z),z);
  desk.rotation.y=ry;
  scene.add(desk);
  // the recruiter stands behind the table, facing the front
  const dx=Math.sin(ry),dz=Math.cos(ry);
  const g=makePed(def.color,def.pants);
  g.position.set(x-dx*.85,groundHeight(x-dx*.85,z-dz*.85),z-dz*.85);
  g.rotation.y=ry;
  scene.add(g);
  const rep=new Npc(g,{kind:'partyrep',register:false,showLabel:true,name:def.repName,
    gender:'M',femaleLook:false,area:def.title+' HQ',personality:'friendly',
    dialogues:def.pitch});
  // block walking through the table (approximate AABB; the desk is small)
  solids.push({x0:x-1.0,x1:x+1.0,z0:z-.55,z1:z+.55,h:1.1});
  desks.push({party:gang.party,x,z,rep,chatT:rand(4,9)});
}

// ---- the plaza membership banner (dynamic — NOT baked; see updatePartyHq) ----
const banner=partyBanner.build();
banner.position.set(PLAZA.x,groundHeight(PLAZA.x,PLAZA.z-10),PLAZA.z-10);
scene.add(banner);
for(const px of[PLAZA.x-4.6,PLAZA.x+4.6]) // the two posts block movement
  solids.push({x0:px-.3,x1:px+.3,z0:PLAZA.z-10.3,z1:PLAZA.z-9.7,h:7.5});

// ---- sign-up sheet overlay (DOM, self-contained; world freezes while open) ----
let uiOpen=false;
let uiMode:'join'|'leave'='join';
let uiParty:PartyId='red';
let uiOpenedAt=0;
let ui:{root:HTMLElement;panel:HTMLElement;title:HTMLElement;sub:HTMLElement;
  list:HTMLElement;fee:HTMLElement;yes:HTMLButtonElement;no:HTMLButtonElement}|null=null;

function ensureUi(){
  if(ui)return ui;
  const root=document.createElement('div');
  root.id='partyov';
  root.style.cssText='position:fixed;inset:0;z-index:4000;display:none;'
    +'align-items:center;justify-content:center;background:rgba(10,4,18,.72);';
  const panel=document.createElement('div');
  panel.style.cssText='background:#14091f;color:#ffe9c9;max-width:500px;width:92vw;'
    +'border:3px solid #ffd24a;border-radius:14px;padding:22px 26px;'
    +'font:500 15px/1.5 "IBM Plex Mono",monospace;box-shadow:0 12px 44px rgba(0,0,0,.6);';
  const title=document.createElement('div');
  title.style.cssText='font:400 30px/1.1 "Bowlby One SC",Impact,sans-serif;margin-bottom:6px;';
  const sub=document.createElement('div');
  sub.style.cssText='color:#ffd24a;font-weight:700;margin-bottom:10px;';
  const list=document.createElement('ul');
  list.style.cssText='margin:0 0 14px;padding:0;list-style:none;';
  const fee=document.createElement('div');
  fee.style.cssText='margin-bottom:16px;font-weight:700;';
  const row=document.createElement('div');
  row.style.cssText='display:flex;gap:12px;';
  const yes=document.createElement('button');
  const no=document.createElement('button');
  for(const b of[yes,no])b.style.cssText='flex:1;padding:12px 8px;border-radius:10px;'
    +'font:700 15px "IBM Plex Mono",monospace;cursor:pointer;border:2px solid transparent;';
  no.style.background='transparent';no.style.borderColor='#8a7f96';no.style.color='#cfc4dc';
  yes.addEventListener('pointerdown',e=>{e.preventDefault();uiAgree();});
  no.addEventListener('pointerdown',e=>{e.preventDefault();closeUi();});
  row.append(yes,no);
  panel.append(title,sub,list,fee,row);
  root.appendChild(panel);
  document.body.appendChild(root);
  ui={root,panel,title,sub,list,fee,yes,no};
  return ui;
}

// Keyboard drive for the sheet (capture phase so the game's own key handlers
// never see these presses while it is open).
window.addEventListener('keydown',e=>{
  if(!uiOpen)return;
  if(e.code==='Enter'||e.code==='KeyE'||e.code==='Space'){e.preventDefault();e.stopPropagation();uiAgree();}
  else if(e.code==='Escape'||e.code==='KeyQ'||e.code==='KeyF'){e.preventDefault();e.stopPropagation();closeUi();}
  else e.stopPropagation();
},true);

function openUi(mode:'join'|'leave',id:PartyId){
  const u=ensureUi();
  const def=PARTIES[id];
  uiMode=mode;uiParty=id;
  u.panel.style.borderColor=def.css;
  u.title.style.color=def.css;
  u.list.innerHTML='';
  if(mode==='join'){
    u.title.textContent='JOIN THE '+def.title;
    u.sub.textContent='THE PARTY STANDS FOR:';
    for(const item of def.platform){
      const li=document.createElement('li');
      li.textContent='» '+item;
      li.style.cssText='margin:5px 0;';
      u.list.appendChild(li);
    }
    u.fee.textContent=`MEMBERSHIP FEE: $${PARTY_FEE}  ·  YOU HAVE $${Math.floor(state.money)}`;
    u.yes.textContent=`I AGREE - PAY $${PARTY_FEE}`;
    u.no.textContent='NO WAY';
  }else{
    u.title.textContent='LEAVE THE '+def.title+'?';
    u.sub.textContent='THINK IT OVER, MEMBER:';
    for(const item of['The street wing will no longer back you up.',
      'The HQ gun perk goes away.','Membership fees are NOT refunded.']){
      const li=document.createElement('li');
      li.textContent='» '+item;
      li.style.cssText='margin:5px 0;';
      u.list.appendChild(li);
    }
    u.fee.textContent='';
    u.yes.textContent='LEAVE THE PARTY';
    u.no.textContent='STAY';
  }
  u.yes.style.background=def.css;u.yes.style.color='#14091f';
  u.root.style.display='flex';
  uiOpen=true;
  uiOpenedAt=performance.now();
}

function closeUi(){
  if(ui)ui.root.style.display='none';
  uiOpen=false;
}

function uiAgree(){
  if(performance.now()-uiOpenedAt<350)return; // swallow the key-repeat that opened it
  const def=PARTIES[uiParty];
  if(uiMode==='join'){
    if(state.party){closeUi();return;}
    if(!economy.canAfford(PARTY_FEE)){
      message(`NOT ENOUGH MONEY - NEED $${PARTY_FEE}`,'var(--pink)');
      closeUi();return;
    }
    economy.spend(PARTY_FEE,'party');
    state.party=uiParty;
    // the granted uniform: shirt + pants in the party colours (persists with the outfit)
    state.clothing.shirt=def.color;
    state.clothing.pants=def.pants;
    applyPlayerClothing();
    refs.backupSave?.();
    message(`WELCOME TO THE ${def.title} - UNIFORM GRANTED!`,def.css);
    blip([523,659,784,1047],.1,'square',.2);
    const d=desks.find(x=>x.party===uiParty);
    if(d)say(d.rep.g,uiParty==='red'?'Welcome, comrade!':'Welcome, patriot!',{life:4});
  }else{
    state.party=null;
    refs.backupSave?.();
    message(`YOU LEFT THE ${def.title}`,def.css);
    blip([392,330,262],.09,'sine',.16);
  }
  closeUi();
}

// World freeze while the sign-up sheet is open (same idiom as the clothing
// store): main.ts early-returns the frame when this is true.
export function updatePartyUi():boolean{return uiOpen;}

// ---- desk interaction (zero-wiring zone action: HUD prompt + E press) ----
(refs.zoneActions||(refs.zoneActions=[])).push(()=>{
  if(state.mode!=='foot'||state.cine||state.dlgActive||uiOpen)return null;
  const pp=playerPos();
  for(const d of desks){
    if(Math.hypot(pp.x-d.x,pp.z-d.z)>TALK_R)continue;
    const def=PARTIES[d.party];
    if(state.party===d.party)
      return{label:'PARTY',prompt:`LEAVE THE ${def.title}`,enabled:true,
        run:()=>openUi('leave',d.party)};
    if(state.party) // a member of the rival party gets turned away
      return{label:'PARTY',prompt:`${def.title}: TRAITORS NOT WELCOME`,enabled:false,run:()=>{}};
    return{label:'JOIN',prompt:`JOIN THE ${def.title} - $${PARTY_FEE}`,enabled:true,
      run:()=>startJoin(d.party)};
  }
  return null;
});

function startJoin(id:PartyId){
  if(state.cine||state.dlgActive)return;
  const d=desks.find(x=>x.party===id)!;
  // the recruiter's pitch runs on the story cut-scene machine (letterbox,
  // film cameras, typed subtitles); the sign-up sheet opens when it ends
  playCutscene(d.rep.g,PARTIES[id].voice,PARTIES[id].pitch,()=>openUi('join',id));
}

// ---- per-frame: live banner bars + recruiters greeting passers-by ----
let acc=0,lastRed=-1,lastBlue=-1;
export function updatePartyHq(dt:number){
  acc+=dt;
  if(acc<.5)return;
  acc=0;
  let redAlive=0,blueAlive=0;
  for(const m of gangPeds)if(!m.dead){if(m.gang.party==='red')redAlive++;else blueAlive++;}
  const gr=gangs.find(g=>g.party==='red')!,gb=gangs.find(g=>g.party==='blue')!;
  const c=membershipCounts({redAlive,redReserve:Math.max(0,gr.remaining),
    blueAlive,blueReserve:Math.max(0,gb.remaining),player:state.party});
  if(c.red!==lastRed||c.blue!==lastBlue){
    lastRed=c.red;lastBlue=c.blue;
    (banner.userData.redraw as (r:number,b:number)=>void)?.(c.red,c.blue);
  }
  // recruiters call out to unaffiliated passers-by
  if(state.started&&!state.cine){
    const pp=playerPos();
    for(const d of desks){
      d.chatT-=.5;
      if(d.chatT>0)continue;
      d.chatT=rand(9,16);
      if(Math.hypot(pp.x-d.x,pp.z-d.z)<9&&partyRelation(state.party,d.party)!=='enemy')
        say(d.rep.g,pick(PARTIES[d.party].pitch) as string,{life:5});
    }
  }
}

// Debug/test snapshot (render_game_to_text)
export function getPartyState(){
  return{
    party:state.party,
    counts:{red:lastRed,blue:lastBlue},
    fee:PARTY_FEE,
    uiOpen,
    desks:desks.map(d=>({party:d.party,x:d.x,z:d.z})),
    banner:{x:PLAZA.x,z:PLAZA.z-10},
  };
}
