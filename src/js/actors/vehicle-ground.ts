// How a vehicle sits on uneven ground — PURE (no THREE, no DOM), unit-tested in
// test/unit/vehicle-ground.test.ts and measured by tools/terrain-report.ts.
//
// The model is the classic RAY-CAST VEHICLE (Bullet's btRaycastVehicle, which Rapier's
// DynamicRayCastVehicleController ports): each wheel casts a ray straight down from its
// hard point and the chassis is held up by what the four rays hit. Our ground is a
// heightfield, so a "ray" is an exact height lookup on the same triangles the terrain mesh
// draws (data.ts divinoHeight), which keeps it cheap (4 + 9 lookups) and makes what you
// see and what you drive on the same surface.
//
// The ground function given to it must be the DRAWN surface (groundHeight: terrain + paving),
// or the wheels sink into the streets drawn over the terrain.
//   poseOnGround — the resting pose: height, pitch and roll from the four wheel contacts
//     (a plane through the axle mid-points), then raised just enough that no point of the
//     underside dips into the ground (a crest under the floor pan lifts the car instead of
//     sinking through it). Used as-is by the traffic and parked cars.
//   VehicleBody / stepBody — the driven car: the same contacts plus gravity and vertical
//     velocity, sub-stepped at a fixed rate (Gaffer on Games, "Fix Your Timestep"): over
//     a crest at speed the car flies and lands instead of being glued to the ground, and it
//     never ends a step below the ground; on its wheels the body takes the contacts' pitch
//     and roll, in the air it keeps its attitude and lands back onto them.
//
// Car frame: +Z forward (heading h → world (sin h, cos h)), +X the car's LEFT, +Y up.
// pitch > 0 = nose up; roll > 0 = left side up. Apply to a THREE object with rotation
// order 'YXZ' as rotation.set(-pitch, heading, roll).

export type GroundFn=(x: number,z: number)=>number;

export interface Chassis{
  halfBase: number;     // axle distance from the centre (m)
  halfTrack: number;    // wheel distance from the centreline (m)
  halfLen: number;      // body half-length (bumpers)
  halfWidth: number;    // body half-width
  clearance: number;    // underside height above the wheel contact plane (m)
  twoWheel?: boolean;   // motorbike: no roll from the ground (it leans by itself)
}
export const CAR: Chassis={halfBase:1.3,halfTrack:.78,halfLen:2.1,halfWidth:.88,clearance:.16};
export const BIKE: Chassis={halfBase:.72,halfTrack:0,halfLen:1.05,halfWidth:.3,clearance:.18,twoWheel:true};

export interface Pose{y: number;pitch: number;roll: number;penetration: number;float: number;}

// underside probe points, as fractions of (halfLen, halfWidth)
const PROBES: [number,number][]=[[1,1],[1,-1],[-1,1],[-1,-1],[1,0],[-1,0],[0,1],[0,-1],[0,0]];

// Height offset of a car-frame point (forward a, left b) on a body pitched/rolled by
// tan values tp/tr (small-slope plane: dy = a·tp + b·tr).
const off=(a: number,b: number,tp: number,tr: number)=>a*tp+b*tr;

// The lowest body height (y of the contact-plane centre) at which no wheel is below the
// ground and no underside probe is below it either, for a given pitch/roll.
function requiredY(H: GroundFn,x: number,z: number,h: number,tp: number,tr: number,c: Chassis): number{
  const fx=Math.sin(h),fz=Math.cos(h),lx=Math.cos(h),lz=-Math.sin(h);   // forward, left
  let need=-1e9;
  const wheels=c.twoWheel?[[c.halfBase,0],[-c.halfBase,0]]:[[c.halfBase,c.halfTrack],[c.halfBase,-c.halfTrack],[-c.halfBase,c.halfTrack],[-c.halfBase,-c.halfTrack]];
  for(const[a,b]of wheels){
    const g=H(x+fx*a+lx*b,z+fz*a+lz*b);
    need=Math.max(need,g-off(a,b,tp,tr));
  }
  for(const[ua,ub]of PROBES){
    const a=ua*c.halfLen,b=ub*c.halfWidth;
    const g=H(x+fx*a+lx*b,z+fz*a+lz*b);
    need=Math.max(need,g-off(a,b,tp,tr)-c.clearance);
  }
  return need;
}

// Resting pose of a chassis centred at (x,z) facing `h`.
export function poseOnGround(H: GroundFn,x: number,z: number,h: number,c: Chassis=CAR): Pose{
  const fx=Math.sin(h),fz=Math.cos(h),lx=Math.cos(h),lz=-Math.sin(h);
  const at=(a: number,b: number)=>H(x+fx*a+lx*b,z+fz*a+lz*b);
  let pitch: number,roll: number,mid: number;
  if(c.twoWheel){
    const f=at(c.halfBase,0),r=at(-c.halfBase,0);
    pitch=Math.atan2(f-r,2*c.halfBase);roll=0;mid=(f+r)/2;
  }else{
    const fl=at(c.halfBase,c.halfTrack),fr=at(c.halfBase,-c.halfTrack),rl=at(-c.halfBase,c.halfTrack),rr=at(-c.halfBase,-c.halfTrack);
    pitch=Math.atan2((fl+fr)-(rl+rr),4*c.halfBase);
    roll=Math.atan2((fl+rl)-(fr+rr),4*c.halfTrack);
    mid=(fl+fr+rl+rr)/4;
  }
  const tp=Math.tan(pitch),tr=Math.tan(roll);
  const y=Math.max(mid,requiredY(H,x,z,h,tp,tr,c));
  return{y,pitch,roll,...contactReport(H,x,z,h,y,tp,tr,c)};
}

// How the posed body meets the ground: deepest underside point below it (should be 0)
// and the highest wheel left hanging above it.
function contactReport(H: GroundFn,x: number,z: number,h: number,y: number,tp: number,tr: number,c: Chassis): {penetration: number;float: number}{
  const fx=Math.sin(h),fz=Math.cos(h),lx=Math.cos(h),lz=-Math.sin(h);
  let pen=0,float=0;
  for(const[ua,ub]of PROBES){
    const a=ua*c.halfLen,b=ub*c.halfWidth;
    pen=Math.max(pen,H(x+fx*a+lx*b,z+fz*a+lz*b)-(y+off(a,b,tp,tr)+c.clearance));
  }
  const wheels=c.twoWheel?[[c.halfBase,0],[-c.halfBase,0]]:[[c.halfBase,c.halfTrack],[c.halfBase,-c.halfTrack],[-c.halfBase,c.halfTrack],[-c.halfBase,-c.halfTrack]];
  for(const[a,b]of wheels){
    pen=Math.max(pen,H(x+fx*a+lx*b,z+fz*a+lz*b)-(y+off(a,b,tp,tr)));
    float=Math.max(float,y+off(a,b,tp,tr)-H(x+fx*a+lx*b,z+fz*a+lz*b));
  }
  return{penetration:pen,float};
}

// ---- the driven car --------------------------------------------------------------
export interface VehicleBody{y: number;vy: number;pitch: number;roll: number;air: number;lastNeed?: number;}
export const newBody=(y: number): VehicleBody=>({y,vy:0,pitch:0,roll:0,air:0});

const G=9.81;
const STEP=1/120;              // fixed physics step
const ATTITUDE_RATE=12;        // in the air, how fast the body turns toward the ground's slope (×.2, 1/s)
const MAX_RISE_V=9;            // m/s: a car lifted by the slope keeps at most this much upward speed

// Advance the body from (x0,z0) to (x1,z1) over dt (the horizontal move is the caller's
// arcade handling). Sub-steps at 120 Hz along the path. Returns true if it landed this call.
export function stepBody(b: VehicleBody,H: GroundFn,x0: number,z0: number,x1: number,z1: number,h: number,dt: number,c: Chassis=CAR): boolean{
  const n=Math.max(1,Math.ceil(dt/STEP)),sdt=dt/n;
  let landed=false;
  for(let i=1;i<=n;i++){
    const t=i/n,x=x0+(x1-x0)*t,z=z0+(z1-z0)*t;
    const target=poseOnGround(H,x,z,h,c);
    // ballistic vertical motion, then the ground pushes back (never ends inside it)
    b.vy-=G*sdt;
    b.y+=b.vy*sdt;
    const need=target.y;                                        // resting height on the four contacts
    if(b.air>0){                                                // in the air the body keeps its attitude,
      const k=1-Math.exp(-ATTITUDE_RATE*.2*sdt);               // drifting slowly toward the ground's
      b.pitch+=(target.pitch-b.pitch)*k;b.roll+=(target.roll-b.roll)*k;
    }
    if(b.y<=need){
      b.pitch=target.pitch;b.roll=target.roll;                 // on the wheels: the body sits on them
      if(b.air>.25)landed=true;
      // in contact: the body moves with the ground under it (up a ramp it keeps that upward
      // speed, so a crest taken fast throws the car; down a slope it keeps descending, so it
      // only leaves the ground where the slope falls away faster than gravity can follow)
      // (at the ground's own rise rate under the car: setting it down a few cm low or landing
      // on it gives no launch from that correction)
      b.vy=b.lastNeed!==undefined?Math.min(MAX_RISE_V,Math.max(-30,(need-b.lastNeed)/sdt)):0;
      b.y=need;b.air=0;
    }else b.air+=sdt;
    b.lastNeed=need;
  }
  return landed;
}

// Park a vehicle object (THREE group) at (x,z) facing `h`, resting on its wheels.
interface Placeable{position: {set(x: number,y: number,z: number): unknown};rotation: {order: string;set(x: number,y: number,z: number): unknown}}
export function parkOnGround(o: Placeable,H: GroundFn,x: number,z: number,h: number,c: Chassis=CAR): void{
  const p=poseOnGround(H,x,z,h,c);
  o.position.set(x,p.y,z);
  o.rotation.order='YXZ';
  o.rotation.set(-p.pitch,h,p.roll);
}
