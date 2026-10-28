// Where the Rio do Peixe's bank vegetation grows (the mata ciliar of the panoramas from its
// bridges, rio-ponte*-*, local) — PURE (no THREE): reeds in tufts right at the water's edge,
// grass clumps up the muddy bank, stones at the waterline now and then, bamboo clumps every
// few tens of metres and broadleaf trees above the bank, on both sides, never on a bridge's
// deck or approach. `free(x,z,r)` lets the caller keep them off its streets, lots and solids.
// Deterministic (its own seeded generator), so the banks look the same every run.
import {RIO,RIO_BRIDGES} from './data.ts';
import type {BankInst} from '../../../assets/models/divinolandia/mata-ciliar.ts';

export type TreeSpot={x:number;y:number;z:number;s:number;r:number};
export function riverBankSpots(H:(x:number,z:number)=>number,free:(x:number,z:number,r:number)=>boolean,
  box?:{x0:number;x1:number;z0:number;z1:number}):{bank:BankInst[];trees:TreeSpot[]}{
  let seed=20261028;const rnd=():number=>{seed=seed*1664525+1013904223>>>0;return seed/4294967296;};
  const bank:BankInst[]=[],trees:TreeSpot[]=[],R=RIO,n=R.x.length;
  const nearBridge=(x:number,z:number):boolean=>RIO_BRIDGES.some(b=>{const ex=x-b.cx,ez=z-b.cz;return Math.abs(ex*b.ux+ez*b.uz)<b.L+8&&Math.abs(-ex*b.uz+ez*b.ux)<b.hw+12;});
  const ok=(x:number,z:number,r:number):boolean=>(!box||x>box.x0&&x<box.x1&&z>box.z0&&z<box.z1)&&!nearBridge(x,z)&&free(x,z,r);
  const at=(i:number,side:number,d:number):[number,number]=>{
    const a=Math.max(0,i-1),b=Math.min(n-1,i+1),dx=R.x[b]-R.x[a],dz=R.z[b]-R.z[a],l=Math.hypot(dx,dz)||1;
    return[R.x[i]-dz/l*side*d,R.z[i]+dx/l*side*d];
  };
  const nextBamboo=[30,55],nextTree=[8,14];
  for(let i=0;i<n;i+=2){                                           // every ~4 m along the river
    for(const[si,side]of[[0,1],[1,-1]] as [number,number][]){
      const W=R.w[i],y=R.y[i];
      if(rnd()<.7){const[x,z]=at(i,side,W-.4+rnd()*1.3);const g=H(x,z);if(g>y-.45&&g<y+.9&&ok(x,z,.4))bank.push({x,y:g-.05,z,s:.75+rnd()*.5,r:rnd()*6,k:'junco'});}
      if(rnd()<.55){const[x,z]=at(i,side,W+1+rnd()*4);const g=H(x,z);if(g>y+.2&&ok(x,z,.5))bank.push({x,y:g-.05,z,s:.8+rnd()*.6,r:rnd()*6,k:'capim'});}
      if(rnd()<.09){const[x,z]=at(i,side,W-.8+rnd()*1.4);const g=H(x,z);if(ok(x,z,.6))bank.push({x,y:Math.max(g,y-.35),z,s:.6+rnd()*1.1,r:rnd()*6,k:'pedra'});}
      if(R.s[i]>=nextBamboo[si]){
        nextBamboo[si]=R.s[i]+28+rnd()*45;
        const[x,z]=at(i,side,W+2.4+rnd()*2.5);const g=H(x,z);
        if(g>y+.6&&ok(x,z,2))bank.push({x,y:g-.1,z,s:.85+rnd()*.45,r:rnd()*6,k:'bambu'});
      }
      if(R.s[i]>=nextTree[si]){
        nextTree[si]=R.s[i]+7+rnd()*12;
        const[x,z]=at(i,side,W+3+rnd()*7);const g=H(x,z);
        if(g>y+.8&&ok(x,z,2.5))trees.push({x,y:g-.1,z,s:.75+rnd()*.55,r:Math.floor(rnd()*1e6)});
      }
    }
  }
  return{bank,trees};
}
