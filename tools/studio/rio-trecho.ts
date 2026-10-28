import * as THREE from 'three';
import {nearGrid,divinoHeight,divData as D,DIV_OX,DIV_OZ,RIO_FINE_CELLS,RIO_BRIDGES,RIO_DEPTH,RIO} from '../../src/js/world/divinolandia/data.ts';
import {waterLines,riverAt} from '../../src/js/world/divinolandia/water.ts';
import {riverBankSpots} from '../../src/js/world/divinolandia/rio-margem.ts';
import {makeTerrainMesh,makeTerrainFine,type HeightGrid,type FineCells} from '../../src/assets/models/divinolandia/terreno.ts';
import {makeStreets,makeWater,type StreetLine} from '../../src/assets/models/divinolandia/rua.ts';
import Ponte from '../../src/assets/models/divinolandia/ponte-rio.ts';
import {makeRiverBank} from '../../src/assets/models/divinolandia/mata-ciliar.ts';
import {makeTrees} from '../../src/assets/models/divinolandia/vegetacao.ts';

// Rio do Peixe (trecho) — the model studio's view of a real stretch of the river as the game
// builds it (dev tool, not part of the game: model.html?rio=<arc>&half=<m>) (world/divinolandia: data.ts carves the channel and the bridges, water.ts the
// water, rio-margem.ts the banks): terrain (the grid and the corridor's finer relief), the
// streets crossing it, the bridges, the water and the bank vegetation, within `half` m of
// the river point at arc `s`, centred on the origin. For checking the river by eye.
export function buildRio(o:{s?:number;half?:number}={}):THREE.Group{
  const s=o.s??RIO.len/2,half=o.half??70,c=riverAt(s);
  const box={x0:c.x-half,x1:c.x+half,z0:c.z-half,z1:c.z+half};
  const g0=nearGrid,i0=Math.max(0,Math.floor((box.x0-g0.x0)/g0.cell)),i1=Math.min(g0.nx-1,Math.ceil((box.x1-g0.x0)/g0.cell));
  const j0=Math.max(0,Math.floor((box.z0-g0.z0)/g0.cell)),j1=Math.min(g0.nz-1,Math.ceil((box.z1-g0.z0)/g0.cell));
  const nx=i1-i0+1,nz=j1-j0+1,h=new Float32Array(nx*nz);
  for(let j=0;j<nz;j++)for(let i=0;i<nx;i++)h[j*nx+i]=g0.h[(j+j0)*g0.nx+i+i0];
  const sub:HeightGrid={x0:g0.x0+i0*g0.cell,z0:g0.z0+j0*g0.cell,cell:g0.cell,nx,nz,h};
  const fine:FineCells={n:RIO_FINE_CELLS.n,at:(i,j)=>RIO_FINE_CELLS.at(i+i0,j+j0)};
  const world=new THREE.Group();
  world.add(makeTerrainMesh(sub,{fine}),makeTerrainFine(sub,fine));
  // streets within the box (draped on the same ground as in the game), cut at its edge
  const inBox=([x,z]:[number,number]):boolean=>x>box.x0+4&&x<box.x1-4&&z>box.z0+4&&z<box.z1-4;
  const lines:StreetLine[]=D.roads.flatMap(r=>{
    const out:StreetLine[]=[];let cur:[number,number][]=[];
    for(const p of r.pts.map(q=>[q[0]+DIV_OX,q[1]+DIV_OZ] as [number,number])){
      if(inBox(p))cur.push(p);else{if(cur.length>1)out.push({pts:cur,hw:r.hw,paved:!!r.p,sett:r.sf==='sett',sidewalk:!!r.p});cur=[];}
    }
    if(cur.length>1)out.push({pts:cur,hw:r.hw,paved:!!r.p,sett:r.sf==='sett',sidewalk:!!r.p});
    return out;
  });
  world.add(makeStreets(lines,divinoHeight,{...sub,fine:{n:fine.n,at:(i,j)=>!!fine.at(i,j)}}));
  // the water, clipped to the box
  world.add(makeWater(waterLines.flatMap(w=>{
    const runs:{pts:[number,number,number][];wl:number[];wr:number[]}[]=[];let cur:typeof runs[0]|null=null;
    w.pts.forEach((p,k)=>{
      const inside=p[0]>box.x0&&p[0]<box.x1&&p[1]>box.z0&&p[1]<box.z1;
      if(inside){if(!cur){cur={pts:[],wl:[],wr:[]};runs.push(cur);}cur.pts.push(p);cur.wl.push(w.wl[k]);cur.wr.push(w.wr[k]);}else cur=null;
    });
    return runs;
  })));
  for(const b of RIO_BRIDGES){
    if(b.cx<box.x0||b.cx>box.x1||b.cz<box.z0||b.cz>box.z1)continue;
    const len=2*b.L,mid=(b.y0+b.y1)/2,p=Ponte.build({len,road:b.hw-3.4,depth:mid-(riverAt(b.s).y-RIO_DEPTH)+.6,style:/Rodovia/.test(b.name)?'balaustre':'tubo'});
    p.position.set(b.cx,mid,b.cz);p.rotation.order='YXZ';p.rotation.y=Math.atan2(-b.uz,b.ux);p.rotation.z=Math.atan2(b.y1-b.y0,len);world.add(p);
  }
  const{bank,trees}=riverBankSpots(divinoHeight,()=>true,box);
  for(const m of makeRiverBank(bank))world.add(m);
  for(const m of makeTrees(trees))world.add(m);
  world.position.set(-c.x,-c.y,-c.z);
  const g=new THREE.Group();g.add(world);
  g.traverse(q=>{q.matrixAutoUpdate=true;});
  return g;
}
