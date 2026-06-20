// Catálogo das armas do open-world. Cada entrada é uma instância de uma subclasse
// de Weapon (ver js/combat/weapon-types.ts) com seus stats e o factory do modelo 3D.
// Ordem = ordem do ciclo (roda do mouse / botão); `slot` = tecla numérica.
//
// open-world tem 13 armas. Já existiam Pistol e o lança-foguetes (Rocket Launcher,
// antiga "bazuca"); as outras 11 foram criadas aqui (modelos em
// assets/models/weapons/).

import {MeleeWeapon,FirearmWeapon,RocketWeapon,FlamethrowerWeapon,ThrownWeapon,DetonatorWeapon}
  from '@/combat/weapon-types.ts';
import type {Weapon} from '@/combat/weapon-types.ts';
import {makePistolModel} from '../../assets/models/weapons/pistol.ts';
import {makeRocketLauncherModel} from '../../assets/models/weapons/rocket-launcher.ts';
import {makeBaseballBatModel} from '../../assets/models/weapons/baseball-bat.ts';
import {makeUziModel} from '../../assets/models/weapons/uzi.ts';
import {makeShotgunModel} from '../../assets/models/weapons/shotgun.ts';
import {makeAk47Model} from '../../assets/models/weapons/ak47.ts';
import {makeM16Model} from '../../assets/models/weapons/m16.ts';
import {makeSniperRifleModel} from '../../assets/models/weapons/sniper-rifle.ts';
import {makeFlamethrowerModel} from '../../assets/models/weapons/flamethrower.ts';
import {makeMolotovModel} from '../../assets/models/weapons/molotov.ts';
import {makeGrenadeModel} from '../../assets/models/weapons/grenade.ts';
import {makeDetonatorModel} from '../../assets/models/weapons/detonator.ts';

// Melee --------------------------------------------------------------------
export const FIST=new MeleeWeapon({
  id:'fist',name:'FIST',slot:1,fireRate:.5,
  extra:{range:1.5,knock:5,lethal:false}}); // punches stagger/knock back; several down a person

// NB on `hold.scale`: the 3D models are built in their own units (a pistol ~0.9
// long, a rifle ~1.2). The player is ~1.8 units tall (≈1.8 m), so each weapon's
// hold.scale brings it to a realistic length relative to the body (pistol ~0.24 m,
// SMG ~0.52 m, rifles ~0.9–1.0 m). `hold.grip` picks the held arm posture in
// weapons.js (pistol = two-handed clasp, smg/rifle = support hand on the foregrip,
// shoulder = launcher braced on the shoulder).
const BAT=new MeleeWeapon({
  id:'bat',name:'BASEBALL BAT',slot:2,fireRate:.55,price:25,
  makeModel:makeBaseballBatModel,hold:{scale:.86},
  extra:{range:2.1,knock:9,lethal:true}});

// Small firearms -----------------------------------------------------------
const PISTOL=new FirearmWeapon({
  id:'pistol',name:'PISTOL',slot:3,fireRate:.18,maxAmmo:90,price:100,
  makeModel:makePistolModel,hold:{scale:.26,y:.02,z:.03,grip:'pistol'},
  recoil:{kick:.09,shake:.08,crosshair:1},
  extra:{range:52,speed:86,damage:1}});

const UZI=new FirearmWeapon({
  id:'uzi',name:'UZI',slot:4,fireRate:.08,automatic:true,maxAmmo:200,price:350,
  makeModel:makeUziModel,hold:{scale:.72,z:.02,grip:'smg'},
  recoil:{kick:.06,shake:.05,crosshair:1},
  extra:{range:42,speed:88,damage:1,spread:.045}});

const SHOTGUN=new FirearmWeapon({
  id:'shotgun',name:'SHOTGUN',slot:5,fireRate:.8,maxAmmo:30,price:500,
  makeModel:makeShotgunModel,hold:{z:-.03,scale:.75,grip:'rifle'},
  recoil:{kick:.18,shake:.13,crosshair:1},
  extra:{range:30,speed:84,damage:1,pellets:8,spread:.1,vol:1.1}});

// Large firearms -----------------------------------------------------------
const AK47=new FirearmWeapon({
  id:'ak47',name:'AK47',slot:6,fireRate:.11,automatic:true,maxAmmo:150,price:1000,
  makeModel:makeAk47Model,hold:{z:-.03,scale:.74,grip:'rifle'},
  recoil:{kick:.1,shake:.09,crosshair:1},
  extra:{range:55,speed:92,damage:2,spread:.035}});

const M16=new FirearmWeapon({
  id:'m16',name:'M16',slot:7,fireRate:.09,automatic:true,maxAmmo:150,price:1500,
  makeModel:makeM16Model,hold:{z:-.03,scale:.8,grip:'rifle'},
  recoil:{kick:.09,shake:.08,crosshair:1},
  extra:{range:62,speed:96,damage:2,spread:.025}});

const SNIPER=new FirearmWeapon({
  id:'sniper',name:'SNIPER RIFLE',slot:8,fireRate:1.2,maxAmmo:20,price:1800,
  makeModel:makeSniperRifleModel,hold:{z:-.05,scale:.9,grip:'rifle'},
  recoil:{kick:.22,shake:.16,crosshair:1},
  extra:{range:130,speed:140,damage:4,vol:1.2}});

// Thrown -------------------------------------------------------------------
const GRENADE=new ThrownWeapon({
  id:'grenade',name:'GRENADE',slot:9,maxAmmo:12,price:120,
  makeModel:makeGrenadeModel,hold:{x:.02,y:-.02},
  extra:{kind:'grenade',fuse:1.7,power:15}});

const MOLOTOV=new ThrownWeapon({
  id:'molotov',name:'MOLOTOV COCKTAIL',slot:10,maxAmmo:12,price:100,
  makeModel:makeMolotovModel,hold:{x:.02,y:-.04},
  extra:{kind:'molotov',power:15}});

// Heavy --------------------------------------------------------------------
const ROCKET=new RocketWeapon({
  id:'rocket',name:'ROCKET LAUNCHER',maxAmmo:15,price:2200,
  makeModel:makeRocketLauncherModel,hold:{z:-.05,y:.14,scale:.75,grip:'shoulder'}});

const FLAME=new FlamethrowerWeapon({
  id:'flame',name:'FLAMETHROWER',maxAmmo:500,price:2000,
  makeModel:makeFlamethrowerModel,hold:{z:-.02,scale:.9,grip:'rifle'},
  extra:{range:7}});

// Special ------------------------------------------------------------------
const DETONATOR=new DetonatorWeapon({
  id:'detonator',name:'DETONATOR',price:300,
  makeModel:makeDetonatorModel,hold:{y:-.06}});

// Ordem do ciclo (Fist primeiro, mais "leves" → mais "pesadas").
export const WEAPONS: Weapon[]=[
  FIST,BAT,PISTOL,UZI,SHOTGUN,AK47,M16,SNIPER,GRENADE,MOLOTOV,ROCKET,FLAME,DETONATOR
];

// Todas menos o punho — é o arsenal que o pickup do mundo concede.
export const ARSENAL=WEAPONS.filter(w=>w!==FIST);

export const byId: Record<string, Weapon>=Object.fromEntries(WEAPONS.map(w=>[w.id,w]));
export const bySlot=(slot: number)=>WEAPONS.find(w=>w.slot===slot&&slot>0);
