// Terrain quality report for Divinolândia's streets — run: npx tsx tools/terrain-report.ts
// Walks every street centreline (2 m stations) on the live ground function
// (data.ts divinoHeight = what is drawn and what is driven on) and measures:
//   - cross slope: height difference between the road edges / road width;
//   - bumpiness: the change of grade between consecutive 4 m spans (a "kink");
//   - a car on it: a 4.2 × 1.8 m body posed the way the game poses it, and how deep its
//     underside corners go below the ground (penetration) or float above it.
// The same numbers back the unit test that guards the street surface
// (test/unit/terrain-quality.test.ts).
import {divData as D,divinoHeight,DIV_OX,DIV_OZ,PLAY} from '../src/js/world/divinolandia/data.ts';
import {poseOnGround} from '../src/js/actors/vehicle-ground.ts';

const H=divinoHeight;
const pct=(a: number[],p: number)=>{const s=[...a].sort((x,y)=>x-y);return s[Math.min(s.length-1,Math.floor(p*s.length))]??0;};

const cross: number[]=[],kink: number[]=[],pen: number[]=[],penOld: number[]=[],flo: number[]=[];
const worst: {k: number;x: number;z: number;n: string}[]=[];
let km=0;
for(const r of D.roads){
  if(!r.p)continue;                                  // paved streets (the drivable town)
  const P=r.pts.map(p=>[p[0]+DIV_OX,p[1]+DIV_OZ]);
  for(let i=1;i<P.length;i++){
    const[ax,az]=P[i-1],[bx,bz]=P[i];
    const len=Math.hypot(bx-ax,bz-az);if(len<.5)continue;
    km+=len/1000;
    const fx=(bx-ax)/len,fz=(bz-az)/len,nx=-fz,nz=fx;
    for(let s=0;s<=len;s+=2){
      const x=ax+fx*s,z=az+fz*s;
      if(x<PLAY.x0||x>PLAY.x1||z<PLAY.z0||z>PLAY.z1)continue;   // the drivable town only
      cross.push(Math.abs(H(x+nx*r.hw,z+nz*r.hw)-H(x-nx*r.hw,z-nz*r.hw))/(2*r.hw));
      const g1=(H(x,z)-H(x-fx*4,z-fz*4))/4,g2=(H(x+fx*4,z+fz*4)-H(x,z))/4;
      kink.push(Math.abs(g2-g1));
      if(Math.abs(g2-g1)>.25)worst.push({k:Math.abs(g2-g1),x:x-DIV_OX,z:z-DIV_OZ,n:r.n});
      // a car driving here, in each lane direction
      for(const dir of[1,-1]){
        const lx=x+nx*r.hw*.45*dir,lz=z+nz*r.hw*.45*dir,h=Math.atan2(fx*dir,fz*dir);
        const ps=poseOnGround(H,lx,lz,h);pen.push(ps.penetration);flo.push(ps.float);
        penOld.push(oldPose(lx,lz,h));
      }
    }
  }
}
// the game's former pose: height at the centre, pitch from two samples 1.3 m ahead/behind, no roll
function oldPose(x: number,z: number,h: number): number{
  const fx=Math.sin(h),fz=Math.cos(h);
  const y=H(x,z),pitch=Math.atan2(H(x+fx*1.3,z+fz*1.3)-H(x-fx*1.3,z-fz*1.3),2.6);
  let worst=0;
  for(const[a,b]of[[2.1,.9],[2.1,-.9],[-2.1,.9],[-2.1,-.9],[0,.9],[0,-.9],[1.05,0],[-1.05,0]]){
    const px=x+fx*a+fz*b,pz=z+fz*a-fx*b;
    const by=y+.18+Math.tan(pitch)*a;                 // underside .18 m above the contact
    worst=Math.max(worst,H(px,pz)-by);
  }
  return worst;
}
const f=(n: number,d=3)=>n.toFixed(d);
console.log(`streets: ${km.toFixed(1)} km paved, ${cross.length} stations`);
console.log(`cross slope   p50 ${f(pct(cross,.5))}  p95 ${f(pct(cross,.95))}  max ${f(Math.max(...cross))}  (rise/run)`);
console.log(`grade kink    p50 ${f(pct(kink,.5))}  p95 ${f(pct(kink,.95))}  max ${f(Math.max(...kink))}  (Δgrade per 4 m)`);
console.log(`car, old pose  penetration p95 ${f(pct(penOld,.95))} m  max ${f(Math.max(...penOld))} m  >5cm ${(penOld.filter(v=>v>.05).length/penOld.length*100).toFixed(1)}%`);
console.log(`car, new pose  penetration p95 ${f(pct(pen,.95))} m  max ${f(Math.max(...pen))} m  >5cm ${(pen.filter(v=>v>.05).length/pen.length*100).toFixed(1)}%`);
console.log(`car, new pose  wheel left hanging p95 ${f(pct(flo,.95))} m  max ${f(Math.max(...flo))} m`);
worst.sort((a,b)=>b.k-a.k);
console.log('worst kinks (town-local):',worst.slice(0,12).map(w=>`${w.n||'?'} (${w.x.toFixed(0)},${w.z.toFixed(0)}) ${w.k.toFixed(2)}`).join(' | '));
