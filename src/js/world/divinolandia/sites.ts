// Placing the game's buildings on their Divinolândia lots (sites-table.ts).
//
// Every place model (nightclub, gym, gun shop, …) was authored in the coordinates of
// the old grid map: its exterior meshes, door, spawn points and collision boxes all
// carry those numbers. A Site maps that MODEL frame onto the real lot — translate the
// model's centre to the lot, turn its door toward the street, lift it to the levelled
// pad — so the models keep their own numbers and the place modules read world
// positions through site.P():
//   - site.group  : add exterior meshes here, in MODEL coordinates;
//   - site.P(x,z) : model point → world point (doors, spawns, pads);
//   - site.head(h): model heading → world heading;
//   - site.box()  : a model-frame AABB becomes a town collision box (collide.ts);
//   - site.inside(): world point inside a model-frame footprint (facade hiding);
//   - site.bake() : a prop that merges into the shared prop chunks (prop-merge.ts).
import * as THREE from 'three';
import {scene} from '@/core/engine.ts';
import {bakeProp} from '../../../assets/models/props/prop-merge.ts';
import {DIV_OX,DIV_OZ,SITE_FLOOR,divinoHeight} from './data.ts';
import {SITE_TABLE,type SiteId} from './sites-table.ts';
import {addObb} from './collide.ts';

// where a model was authored: its centre and the heading its front door faces
export interface ModelFrame{cx:number;cz:number;front:number}
export interface XZ{x:number;z:number}
export interface Box{x0:number;x1:number;z0:number;z1:number}

export class Site{
  readonly id:SiteId;
  readonly x:number;readonly z:number;readonly y:number;  // world centre + floor height
  readonly yaw:number;                                    // THREE rotation.y of the model
  readonly outer=new THREE.Group();
  readonly group=new THREE.Group();                       // model-coordinate root
  private c:number;private s:number;
  constructor(id:SiteId,readonly m:ModelFrame){
    const t=SITE_TABLE[id];
    this.id=id;
    this.x=t.x+DIV_OX;this.z=t.z+DIV_OZ;this.y=SITE_FLOOR[id];
    this.yaw=t.face-m.front;
    this.c=Math.cos(this.yaw);this.s=Math.sin(this.yaw);
    this.outer.position.set(this.x,this.y,this.z);this.outer.rotation.y=this.yaw;
    this.group.position.set(-m.cx,0,-m.cz);
    this.outer.add(this.group);
    this.outer.name='site:'+id;
    scene.add(this.outer);
    this.outer.updateMatrixWorld(true);
  }
  P(mx:number,mz:number):XZ{
    const dx=mx-this.m.cx,dz=mz-this.m.cz;
    return{x:this.x+dx*this.c+dz*this.s,z:this.z-dx*this.s+dz*this.c};
  }
  // same, for a {x,z} object (keeps call sites short)
  at(p:XZ):XZ{return this.P(p.x,p.z);}
  head(h:number):number{return h+this.yaw;}
  // world → model
  local(wx:number,wz:number):XZ{
    const dx=wx-this.x,dz=wz-this.z;
    return{x:this.m.cx+dx*this.c-dz*this.s,z:this.m.cz+dx*this.s+dz*this.c};
  }
  inside(wx:number,wz:number,f:Box,margin=0):boolean{
    const p=this.local(wx,wz);
    return p.x>f.x0-margin&&p.x<f.x1+margin&&p.z>f.z0-margin&&p.z<f.z1+margin;
  }
  // collision for a model-frame box `h` metres tall above the floor
  box(f:Box,h:number):void{
    const c=this.P((f.x0+f.x1)/2,(f.z0+f.z1)/2);
    addObb(c.x,c.z,f.x1-f.x0,f.z1-f.z0,-this.yaw,this.y+h);
  }
  // a prop for the merged prop chunks, given in model coordinates
  bake(root:THREE.Object3D):void{
    this.group.add(root);
    this.outer.updateMatrixWorld(true);
    bakeProp(root);
    this.group.remove(root);
  }
  // ground height at a model point (the pad is flat, but props may sit past it)
  groundAt(mx:number,mz:number):number{
    const p=this.P(mx,mz);
    return divinoHeight(p.x,p.z)-this.y;
  }
}
