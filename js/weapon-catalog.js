// Catálogo das armas do GTA III. Cada entrada é uma instância de uma subclasse
// de Weapon (ver js/weapon-types.js) com seus stats e o factory do modelo 3D.
// Ordem = ordem do ciclo (roda do mouse / botão); `slot` = tecla numérica.
//
// GTA III tem 13 armas. Já existiam Pistol e o lança-foguetes (Rocket Launcher,
// antiga "bazuca"); as outras 11 foram criadas aqui (modelos em
// assets/models/weapons/).

import {MeleeWeapon,FirearmWeapon,RocketWeapon,FlamethrowerWeapon,ThrownWeapon,DetonatorWeapon}
  from './weapon-types.js';
import {makePistolModel} from '../assets/models/weapons/pistol.js';
import {makeRocketLauncherModel} from '../assets/models/weapons/rocket-launcher.js';
import {makeBaseballBatModel} from '../assets/models/weapons/baseball-bat.js';
import {makeUziModel} from '../assets/models/weapons/uzi.js';
import {makeShotgunModel} from '../assets/models/weapons/shotgun.js';
import {makeAk47Model} from '../assets/models/weapons/ak47.js';
import {makeM16Model} from '../assets/models/weapons/m16.js';
import {makeSniperRifleModel} from '../assets/models/weapons/sniper-rifle.js';
import {makeFlamethrowerModel} from '../assets/models/weapons/flamethrower.js';
import {makeMolotovModel} from '../assets/models/weapons/molotov.js';
import {makeGrenadeModel} from '../assets/models/weapons/grenade.js';
import {makeDetonatorModel} from '../assets/models/weapons/detonator.js';

// Melee --------------------------------------------------------------------
export const FIST=new MeleeWeapon({
  id:'fist',name:'FIST',slot:1,fireRate:.5,
  extra:{range:1.5,knock:5,lethal:true}});

const BAT=new MeleeWeapon({
  id:'bat',name:'BASEBALL BAT',slot:2,fireRate:.55,price:50,
  makeModel:makeBaseballBatModel,hold:{scale:1},
  extra:{range:2.1,knock:9,lethal:true}});

// Small firearms -----------------------------------------------------------
const PISTOL=new FirearmWeapon({
  id:'pistol',name:'PISTOL',slot:3,fireRate:.18,maxAmmo:90,price:250,
  makeModel:makePistolModel,
  recoil:{kick:.09,shake:.08,crosshair:1},
  extra:{range:52,speed:86,damage:1}});

const UZI=new FirearmWeapon({
  id:'uzi',name:'UZI',slot:4,fireRate:.08,automatic:true,maxAmmo:200,price:800,
  makeModel:makeUziModel,hold:{z:.02},
  recoil:{kick:.06,shake:.05,crosshair:1},
  extra:{range:42,speed:88,damage:1,spread:.045}});

const SHOTGUN=new FirearmWeapon({
  id:'shotgun',name:'SHOTGUN',slot:5,fireRate:.8,maxAmmo:30,price:1200,
  makeModel:makeShotgunModel,hold:{z:-.04,scale:.95},
  recoil:{kick:.18,shake:.13,crosshair:1},
  extra:{range:30,speed:84,damage:1,pellets:8,spread:.1,vol:1.1}});

// Large firearms -----------------------------------------------------------
const AK47=new FirearmWeapon({
  id:'ak47',name:'AK47',slot:6,fireRate:.11,automatic:true,maxAmmo:150,price:2500,
  makeModel:makeAk47Model,hold:{z:-.04,scale:.95},
  recoil:{kick:.1,shake:.09,crosshair:1},
  extra:{range:55,speed:92,damage:2,spread:.035}});

const M16=new FirearmWeapon({
  id:'m16',name:'M16',slot:7,fireRate:.09,automatic:true,maxAmmo:150,price:3500,
  makeModel:makeM16Model,hold:{z:-.04,scale:.95},
  recoil:{kick:.09,shake:.08,crosshair:1},
  extra:{range:62,speed:96,damage:2,spread:.025}});

const SNIPER=new FirearmWeapon({
  id:'sniper',name:'SNIPER RIFLE',slot:8,fireRate:1.2,maxAmmo:20,price:4000,
  makeModel:makeSniperRifleModel,hold:{z:-.06,scale:.9},
  recoil:{kick:.22,shake:.16,crosshair:1},
  extra:{range:130,speed:140,damage:4,vol:1.2}});

// Thrown -------------------------------------------------------------------
const GRENADE=new ThrownWeapon({
  id:'grenade',name:'GRENADE',slot:9,maxAmmo:12,price:300,
  makeModel:makeGrenadeModel,hold:{x:.02,y:-.02},
  extra:{kind:'grenade',fuse:1.7,power:15}});

const MOLOTOV=new ThrownWeapon({
  id:'molotov',name:'MOLOTOV COCKTAIL',slot:10,maxAmmo:12,price:250,
  makeModel:makeMolotovModel,hold:{x:.02,y:-.04},
  extra:{kind:'molotov',power:15}});

// Heavy --------------------------------------------------------------------
const ROCKET=new RocketWeapon({
  id:'rocket',name:'ROCKET LAUNCHER',maxAmmo:15,price:5000,
  makeModel:makeRocketLauncherModel,hold:{z:-.08,scale:.9}});

const FLAME=new FlamethrowerWeapon({
  id:'flame',name:'FLAMETHROWER',maxAmmo:500,price:4500,
  makeModel:makeFlamethrowerModel,hold:{z:-.02,scale:.9},
  extra:{range:7}});

// Special ------------------------------------------------------------------
const DETONATOR=new DetonatorWeapon({
  id:'detonator',name:'DETONATOR',price:750,
  makeModel:makeDetonatorModel,hold:{y:-.06}});

// Ordem do ciclo (Fist primeiro, mais "leves" → mais "pesadas").
export const WEAPONS=[
  FIST,BAT,PISTOL,UZI,SHOTGUN,AK47,M16,SNIPER,GRENADE,MOLOTOV,ROCKET,FLAME,DETONATOR
];

// Todas menos o punho — é o arsenal que o pickup do mundo concede.
export const ARSENAL=WEAPONS.filter(w=>w!==FIST);

export const byId=Object.fromEntries(WEAPONS.map(w=>[w.id,w]));
export const bySlot=slot=>WEAPONS.find(w=>w.slot===slot&&slot>0);
