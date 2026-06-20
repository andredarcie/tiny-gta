// Classe base das armas + subclasses por categoria do open-world.
//
// As armas são DECLARATIVAS: guardam metadados (nome, slot, cadência, munição,
// modelo 3D, offset na mão, recuo) e implementam só `onFire(api)`. Toda a parte
// "suja" (raio de mira, spawn de bala/míssil/projétil, dano, efeitos, som) mora
// no js/weapons.js e é injetada via objeto `api` — assim as classes não importam
// o sistema de jogo e não criam ciclo de import. Ver js/weapon-catalog.js para
// as instâncias e js/weapons.js para o `api`.

import type * as THREE from 'three';

// Recuo aplicado no disparo (kick/shake da câmera + abertura da mira).
export interface Recoil{
  kick: number;
  shake: number;
  crosshair: number;
}

// Offset/postura da arma na mão (e no pickup). Campos extras (grip…) são livres.
export interface Hold{
  x?: number;
  y?: number;
  z?: number;
  rx?: number;
  ry?: number;
  rz?: number;
  scale?: number;
  grip?: string;
  [k: string]: unknown;
}

// Descritor declarativo passado ao construtor de cada arma.
export interface WeaponDef{
  id?: string;
  name?: string;
  category?: string;
  slot?: number;
  makeModel?: ((opts?: any)=>THREE.Object3D)|null;
  hold?: Hold|null;
  fireRate?: number;
  automatic?: boolean;
  aimed?: boolean;
  infiniteAmmo?: boolean;
  maxAmmo?: number;
  price?: number;
  recoil?: Recoil;
  extra?: Record<string, unknown>; // stats próprios da subclasse (range, damage, pellets…)
}

// Objeto `api` injetado pelo weapons.js no disparo (toda a parte "suja").
export interface WeaponApi{
  now: number;
  outOfAmmo: (w: Weapon)=>void;
  aimPose: ()=>void;
  recoil: (r: Recoil)=>void;
  melee: (range: number, knock: number, lethal: boolean)=>void;
  swoosh: ()=>void;
  bullet: (opts: {range: number; speed: number; damage: number; spread: number})=>void;
  gunshot: (vol: number)=>void;
  missile: ()=>void;
  boom: ()=>void;
  flame: (range: number)=>void;
  throwProjectile: (kind: string|undefined, opts: {power: number; fuse?: number})=>void;
  toss: ()=>void;
  detonator: ()=>void;
  [k: string]: any;
}

export class Weapon{
  id: string|undefined;
  name: string;
  category: string;
  slot: number;
  makeModel: ((opts?: any)=>THREE.Object3D)|null;
  hold: Hold|null;
  fireRate: number;
  automatic: boolean;
  aimed: boolean;
  infiniteAmmo: boolean;
  maxAmmo: number;
  price: number;
  recoil: Recoil;
  ammo: number;
  _last: number;
  // stats próprios das subclasses, vindos de def.extra via Object.assign
  range?: number;
  knock?: number;
  lethal?: boolean;
  pellets?: number;
  speed?: number;
  damage?: number;
  spread?: number;
  vol?: number;
  kind?: string;
  power?: number;
  fuse?: number;
  [k: string]: any;

  constructor(def: WeaponDef={}){
    this.id=def.id;
    this.name=def.name||def.id!;
    this.category=def.category||'firearm'; // melee|firearm|heavy|thrown|special
    this.slot=def.slot||0;                 // tecla numérica (0 = só no ciclo)
    this.makeModel=def.makeModel||null;     // (opts)=>Object3D do modelo na mão / pickup
    this.hold=def.hold||null;               // {x,y,z,rx,ry,rz,scale} offset na mão
    this.fireRate=def.fireRate??.3;         // segundos entre disparos
    this.automatic=!!def.automatic;         // segurar pra manter o fogo
    this.aimed=def.aimed??(this.category!=='melee'&&this.category!=='special'); // mostra mira/crosshair
    this.infiniteAmmo=!!def.infiniteAmmo;
    this.maxAmmo=def.maxAmmo||0;
    this.price=def.price||0;                // preço na loja de armas (js/gun-shop.js)
    this.recoil=def.recoil||{kick:.09,shake:.08,crosshair:1};
    Object.assign(this,def.extra||{});      // stats próprios da subclasse (range, damage, pellets…)
    this.ammo=this.infiniteAmmo?Infinity:this.maxAmmo;
    this._last=-999;
  }
  reset(){this.ammo=this.infiniteAmmo?Infinity:this.maxAmmo;this._last=-999;}
  refill(){if(!this.infiniteAmmo)this.ammo=this.maxAmmo;}
  hasAmmo(){return this.infiniteAmmo||this.ammo>0;}
  canFire(now: number){return now-this._last>=this.fireRate;}
  ammoLabel(){return this.infiniteAmmo?'∞':String(Math.max(0,this.ammo));}

  // Chamado pelo weapons.js no disparo (clique/segurar). Retorna true se atirou.
  tryFire(api: WeaponApi){
    const now=api.now;
    if(!this.canFire(now))return false;
    // sem munição: avisa só nas semi-automáticas (a automática spammaria o HUD)
    if(!this.hasAmmo()){if(!this.automatic)api.outOfAmmo(this);return false;}
    this._last=now;
    api.aimPose();
    const fired=this.onFire(api)!==false;
    if(fired){
      if(!this.infiniteAmmo)this.ammo=Math.max(0,this.ammo-1);
      api.recoil(this.recoil);
    }else this._last=-999; // não disparou de fato: libera a cadência
    return fired;
  }
  // implementado pelas subclasses
  onFire(_api?: WeaponApi): boolean|void{}
}

// ---- Corpo a corpo (Fist, Baseball Bat): golpe curto à frente ----
export class MeleeWeapon extends Weapon{
  constructor(def?: WeaponDef){
    super({category:'melee',infiniteAmmo:true,fireRate:.45,
      recoil:{kick:.16,shake:.05,crosshair:1},...def});
  }
  override onFire(api: WeaponApi){api.melee(this.range||1.8,this.knock||7,this.lethal!==false);api.swoosh();}
}

// ---- Armas de fogo hitscan (Pistol, Uzi, Shotgun, AK47, M16, Sniper) ----
export class FirearmWeapon extends Weapon{
  constructor(def?: WeaponDef){
    super({category:'firearm',recoil:{kick:.09,shake:.08,crosshair:1},...def});
  }
  override onFire(api: WeaponApi){
    const pellets=this.pellets||1;
    for(let i=0;i<pellets;i++)
      api.bullet({range:this.range||52,speed:this.speed||86,
        damage:this.damage||1,spread:this.spread||0});
    api.gunshot(this.vol||1);
  }
}

// ---- Lança-foguetes (Rocket Launcher): míssil com explosão ----
export class RocketWeapon extends Weapon{
  constructor(def?: WeaponDef){
    super({category:'heavy',fireRate:1.15,maxAmmo:15,
      recoil:{kick:.16,shake:.2,crosshair:1},...def});
  }
  override onFire(api: WeaponApi){api.missile();api.boom();}
}

// ---- Lança-chamas: jato contínuo de fogo de curto alcance ----
export class FlamethrowerWeapon extends Weapon{
  constructor(def?: WeaponDef){
    super({category:'heavy',automatic:true,fireRate:.06,maxAmmo:500,
      recoil:{kick:.02,shake:.03,crosshair:1},...def});
  }
  override onFire(api: WeaponApi){api.flame(this.range||7);}
}

// ---- Arremessáveis (Grenade, Molotov): projétil em arco ----
export class ThrownWeapon extends Weapon{
  constructor(def?: WeaponDef){
    super({category:'thrown',fireRate:.9,maxAmmo:12,
      recoil:{kick:.12,shake:.05,crosshair:1},...def});
  }
  override onFire(api: WeaponApi){api.throwProjectile(this.kind,{power:this.power||16,fuse:this.fuse});api.toss();}
}

// ---- Detonador: planta a carga no 1º uso, detona no 2º ----
export class DetonatorWeapon extends Weapon{
  constructor(def?: WeaponDef){
    super({category:'special',infiniteAmmo:true,fireRate:.5,aimed:false,
      recoil:{kick:.05,shake:.03,crosshair:0},...def});
  }
  override onFire(api: WeaponApi){api.detonator();}
}
