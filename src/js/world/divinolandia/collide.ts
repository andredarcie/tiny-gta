// Divinolândia collision: ORIENTED boxes (the real streets run at every angle, so the
// houses do too — the old map's axis-aligned `solids` can't describe them) in a
// spatial hash, plus the playable-area clamp. Pure (no THREE). physics.ts routes
// collideStatics() here whenever the body is inside the Divinolândia region, so the
// old map's solids/bounds never apply there and vice versa.
// No data import on purpose: physics.ts imports this module, and the baked town data
// (~1 MB) must stay in the lazily-loaded Divinolândia chunk. The bounds are pushed in
// by setPlayBounds() when the town is built.
const PLAY={x0:0,x1:0,z0:0,z1:0};
export function setPlayBounds(b:{x0:number;x1:number;z0:number;z1:number}):void{Object.assign(PLAY,b);}

type Obb={x:number;z:number;hw:number;hd:number;c:number;s:number;h:number}; // h = top (world y)
const CELL=24;
const grid=new Map<number,Obb[]>();
const key=(i:number,j:number):number=>i*73856093^j*19349663;
export const obbCount={n:0};

// Register a box centred at (x,z), full size w×d, yaw `rot` (rotation of its local
// +x axis toward +z, as the bake writes it), top at world y `top`.
export function addObb(x:number,z:number,w:number,d:number,rot:number,top:number):void{
  const o:Obb={x,z,hw:w/2,hd:d/2,c:Math.cos(rot),s:Math.sin(rot),h:top};
  const r=Math.hypot(w,d)/2+2;                             // +2: bodies (r ≤ 1.4) query only their own cell
  for(let i=Math.floor((x-r)/CELL);i<=Math.floor((x+r)/CELL);i++)
    for(let j=Math.floor((z-r)/CELL);j<=Math.floor((z+r)/CELL);j++){
      const k=key(i,j);let a=grid.get(k);if(!a){a=[];grid.set(k,a);}a.push(o);
    }
  obbCount.n++;
}

// Push a circle (radius r) out of every box it overlaps; clamp to the playable area.
// Returns true on any contact (same contract as collideStatics).
export function divinoCollide(p:{x:number;y:number;z:number},r:number):boolean{
  let hit=false;
  const arr=grid.get(key(Math.floor(p.x/CELL),Math.floor(p.z/CELL)));
  if(arr)for(const o of arr){
    if(p.y>o.h)continue;                                   // above the roof
    const dx=p.x-o.x,dz=p.z-o.z;
    const lu=dx*o.c+dz*o.s,lv=-dx*o.s+dz*o.c;               // into the box frame
    const cu=lu<-o.hw?-o.hw:lu>o.hw?o.hw:lu,cv=lv<-o.hd?-o.hd:lv>o.hd?o.hd:lv;
    let eu=lu-cu,ev=lv-cv;const d2=eu*eu+ev*ev;
    if(d2>=r*r)continue;
    let nu:number,nv:number;
    if(d2<1e-8){                                           // centre inside: exit by the nearest face
      const pu=o.hw-Math.abs(lu),pv=o.hd-Math.abs(lv);
      if(pu<pv){nu=(lu<0?-o.hw:o.hw)+(lu<0?-r:r);nv=lv;}else{nu=lu;nv=(lv<0?-o.hd:o.hd)+(lv<0?-r:r);}
    }else{
      const d=Math.sqrt(d2);eu/=d;ev/=d;nu=cu+eu*r;nv=cv+ev*r;
    }
    p.x=o.x+nu*o.c-nv*o.s;p.z=o.z+nu*o.s+nv*o.c;
    hit=true;
  }
  if(p.x<PLAY.x0){p.x=PLAY.x0;hit=true;}else if(p.x>PLAY.x1){p.x=PLAY.x1;hit=true;}
  if(p.z<PLAY.z0){p.z=PLAY.z0;hit=true;}else if(p.z>PLAY.z1){p.z=PLAY.z1;hit=true;}
  return hit;
}
