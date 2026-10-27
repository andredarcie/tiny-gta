// Geometry audit of model builders (manual tool, Node): builds each model and reports
//  - NaN / infinite vertex positions;
//  - degenerate triangles (zero area);
//  - z-fighting: two triangles of DIFFERENT materials lying in the same plane, facing the
//    same way (or either double-sided), overlapping by more than a few cm² — unless one
//    of them uses a polygon offset or is transparent (deliberate layering);
//  - meshes far outside the model's expected box.
//   npx tsx tools/audit-geometry.ts [name-filter]
import * as THREE from 'three';
import {divinoHeight,DIV_OX,DIV_OZ,nearGrid} from '../src/js/world/divinolandia/data.ts';
import type {GroundAt} from '../src/assets/models/divinolandia/praca-chao.ts';

type Tri={a:THREE.Vector3;b:THREE.Vector3;c:THREE.Vector3;n:THREE.Vector3;m:THREE.Material;mesh:string};
const filter=process.argv[2]??'';

function trisOf(root:THREE.Object3D):{tris:Tri[];nan:number;degen:number}{
  root.updateMatrixWorld(true);
  const tris:Tri[]=[];let nan=0,degen=0;
  root.traverse(o=>{
    const m=o as THREE.Mesh;if(!m.isMesh)return;
    const geo=m.geometry,pos=geo.getAttribute('position');if(!pos)return;
    const idx=geo.index,mats=Array.isArray(m.material)?m.material:[m.material];
    const groups=geo.groups.length?geo.groups:[{start:0,count:idx?idx.count:pos.count,materialIndex:0}];
    for(const gr of groups){
      const mat=mats[gr.materialIndex??0];if(!mat)continue;
      for(let i=gr.start;i<gr.start+gr.count;i+=3){
        const v=[0,1,2].map(k=>new THREE.Vector3().fromBufferAttribute(pos,idx?idx.getX(i+k):i+k).applyMatrix4(m.matrixWorld));
        if(v.some(p=>!Number.isFinite(p.x+p.y+p.z))){nan++;continue;}
        const n=new THREE.Vector3().subVectors(v[1],v[0]).cross(new THREE.Vector3().subVectors(v[2],v[0]));
        const area=n.length()/2;if(area<1e-7){degen++;continue;}
        tris.push({a:v[0],b:v[1],c:v[2],n:n.normalize(),m:mat,mesh:m.name||m.parent?.name||'?'});
      }
    }
  });
  return{tris,nan,degen};
}
const layered=(m:THREE.Material):boolean=>m.polygonOffset||m.transparent||(m as THREE.MeshLambertMaterial).alphaTest>0;
const matKey=(m:THREE.Material):string=>{const a=m as THREE.MeshLambertMaterial;return(a.color?'#'+a.color.getHexString():'')+(a.map?' tex':'')+(m.side===THREE.DoubleSide?' 2s':'');};
// 2D triangle overlap area (approximate: clip one by the other, Sutherland–Hodgman)
function clipArea(p:[number,number][],q:[number,number][]):number{
  let out=p;
  const ccw=(t:[number,number][]):boolean=>(t[1][0]-t[0][0])*(t[2][1]-t[0][1])-(t[1][1]-t[0][1])*(t[2][0]-t[0][0])>0;
  const Q=ccw(q)?q:[q[0],q[2],q[1]] as [number,number][];
  for(let i=0;i<3&&out.length;i++){
    const A=Q[i],B=Q[(i+1)%3],inp=out;out=[];
    const side=(P:[number,number]):number=>(B[0]-A[0])*(P[1]-A[1])-(B[1]-A[1])*(P[0]-A[0]);
    for(let j=0;j<inp.length;j++){
      const P=inp[j],R=inp[(j+1)%inp.length],sp=side(P),sr=side(R);
      if(sp>=0)out.push(P);
      if(sp*sr<0){const t=sp/(sp-sr);out.push([P[0]+(R[0]-P[0])*t,P[1]+(R[1]-P[1])*t]);}
    }
  }
  let a=0;for(let i=0;i<out.length;i++){const[x1,y1]=out[i],[x2,y2]=out[(i+1)%out.length];a+=x1*y2-x2*y1;}
  return Math.abs(a)/2;
}
function zfight(tris:Tri[]):{area:number;a:string;b:string;at:THREE.Vector3;n:THREE.Vector3;mesh:string}[]{
  const planes=new Map<string,Tri[]>();
  for(const t of tris){
    // canonical plane: normal with positive first non-zero component, offset
    let n=t.n.clone();const flip=n.x<-1e-6||Math.abs(n.x)<1e-6&&(n.y<-1e-6||Math.abs(n.y)<1e-6&&n.z<0);if(flip)n=n.negate();
    const d=n.dot(t.a);
    const key=`${Math.round(n.x*50)},${Math.round(n.y*50)},${Math.round(n.z*50)},${Math.round(d/(+(process.env.TOL??.002)))}`;
    let arr=planes.get(key);if(!arr){arr=[];planes.set(key,arr);}arr.push(t);
  }
  const hits:{area:number;a:string;b:string;at:THREE.Vector3;n:THREE.Vector3;mesh:string}[]=[];
  for(const arr of planes.values()){
    if(arr.length<2)continue;
    const n=arr[0].n,u=new THREE.Vector3(),v=new THREE.Vector3();
    u.set(Math.abs(n.x)<.9?1:0,Math.abs(n.x)<.9?0:1,0).cross(n).normalize();v.crossVectors(n,u);
    const p2=(p:THREE.Vector3):[number,number]=>[p.dot(u),p.dot(v)];
    for(let i=0;i<arr.length;i++)for(let j=i+1;j<arr.length;j++){
      const A=arr[i],B=arr[j];
      if(A.m===B.m||layered(A.m)||layered(B.m))continue;
      if(matKey(A.m)===matKey(B.m))continue;                       // same look: no visible fight
      const same=A.n.dot(B.n)>0,dbl=A.m.side===THREE.DoubleSide||B.m.side===THREE.DoubleSide;
      if(!same&&!dbl)continue;                                     // back to back
      const ar=clipArea([p2(A.a),p2(A.b),p2(A.c)],[p2(B.a),p2(B.b),p2(B.c)]);
      if(ar>.004)hits.push({area:ar,a:matKey(A.m),b:matKey(B.m),at:A.a.clone().add(A.b).add(A.c).divideScalar(3),n:A.n,mesh:A.mesh+(A.mesh!==B.mesh?'/'+B.mesh:'')});
    }
  }
  return hits;
}

// ground of a town-local site, relative to its origin, with the terrain grid lines
const ground=(o:[number,number]):GroundAt=>{
  const y0=divinoHeight(o[0]+DIV_OX,o[1]+DIV_OZ),at:GroundAt=(x,z)=>divinoHeight(x+DIV_OX,z+DIV_OZ)-y0;
  at.grid=[(x,_z)=>(x+DIV_OX-nearGrid.x0)/nearGrid.cell,(_x,z)=>(z+DIV_OZ-nearGrid.z0)/nearGrid.cell];return at;
};
const M=(p:string):Promise<any>=>import('../src/assets/models/divinolandia/'+p);
const jobs:[string,()=>Promise<THREE.Object3D>][]=[
  ['posto-triangulo',async()=>{const m=await M('posto-triangulo.ts');return m.default.build({groundAt:ground(m.ORIGIN)});}],
  ['posto-passoni',async()=>{const m=await M('posto-passoni.ts');return m.default.build({groundAt:ground(m.ORIGIN)});}],
  ['posto-lurain',async()=>{const m=await M('posto-lurain.ts');return m.default.build({groundAt:ground(m.ORIGIN)});}],
  ['posto-taurus',async()=>{const m=await M('posto-taurus.ts');return m.default.build({groundAt:ground(m.ORIGIN)});}],
  ['posto-taurus-centro',async()=>{const m=await M('posto-taurus-centro.ts');return m.default.build({groundAt:ground(m.ORIGIN)});}],
  ['monumento-ciclista',async()=>{const m=await M('monumento-ciclista.ts');return m.default.build({groundAt:ground(m.ORIGIN)});}],
  ['entorno-ciclista',async()=>{const m=await M('entorno-ciclista.ts');return m.default.build({groundAt:ground(m.ORIGIN)});}],
  ['concessionaria-mahindra',async()=>{const m=await M('concessionaria-mahindra.ts');return m.default.build({groundAt:ground(m.ORIGIN)});}],
  ...['petrobras','taurus','lurain','diesel'].map(k=>['bomba-'+k,async()=>(await M('bomba-combustivel.ts')).default.build({kind:k})] as [string,()=>Promise<THREE.Object3D>]),
  ['palmeira-fenix',async()=>(await M('palmeira-fenix.ts')).default.build({h:2.2})],
  ['ciclista-aco',async()=>(await M('ciclista-aco.ts')).default.build({pedal:.3})],
  ['trator-mahindra',async()=>(await M('trator-mahindra.ts')).default.build({canopy:true})],
  ...['pulverizador','pulverizadorAzul','distribuidor','carreta','carregador'].map(k=>['implemento-'+k,async()=>(await M('implemento-agricola.ts')).default.build({kind:k})] as [string,()=>Promise<THREE.Object3D>]),
  ...['saude3','oftalmo','congregacao','espirita','saosebastiao','pm','delegacia','vicentenasser','estadio','cemiterio','dombosco','rosario','jorgegalhano','pedroribeiro']
    .map(id=>['pub-'+id,async()=>{const{PUBLICOS}=await M('publicos.ts'),{PRACAS}=await M('pracas-centro.ts');
      const p=[...PUBLICOS,...PRACAS].find((q:any)=>q.id===id);return p.build(ground(p.origin));}] as [string,()=>Promise<THREE.Object3D>]),
  ...['maconaria','sitio-entrada','sitio-sede','sitio-casinha','letreiro-entrada'].map(id=>['sitio-'+id,async()=>{const{SITIO}=await M('sitio-maconaria.ts');
    const p=SITIO.find((q:any)=>q.id===id);return p.build(ground(p.origin));}] as [string,()=>Promise<THREE.Object3D>]),
  ['palmeira-imperial',async()=>(await M('palmeira-imperial.ts')).default.build({whitewash:true})],
  ['lojas',async()=>{
    const{LOJAS}=await import('../src/js/world/divinolandia/comercio/lojas.ts');
    const{planLojas}=await import('../src/js/world/divinolandia/comercio/plan.ts');
    const{buildLoja}=await M('loja-comercio.ts');
    const g=new THREE.Group();
    planLojas(LOJAS).forEach((p:any,i:number)=>{const l=buildLoja({w:p.spec.w,f:{...p.spec.f,d:p.d-(p.spec.f.setback??0)},shop:p.spec.shop,kind:p.spec.kind,seed:i});
      l.position.x=i*60;l.name=p.spec.id;l.traverse((o:THREE.Object3D)=>{if(!o.name)o.name=p.spec.id;});g.add(l);});
    return g;}],
];
for(const[name,make]of jobs){
  if(filter&&!name.includes(filter))continue;
  const root=await make(),{tris,nan,degen}=trisOf(root),z=zfight(tris);
  const box=new THREE.Box3().setFromObject(root);
  console.log(`\n== ${name}: ${tris.length} tris, NaN ${nan}, degenerate ${degen}, z-fight pairs ${z.length}, box y ${box.min.y.toFixed(1)}..${box.max.y.toFixed(1)}`);
  const seen=new Set<string>();
  for(const h of z.sort((p,q)=>q.area-p.area)){
    const k=process.env.BYKIND?`${h.a}|${h.b}`:`${h.a}|${h.b}|${Math.round(h.at.x)},${Math.round(h.at.y)},${Math.round(h.at.z)}`;if(seen.has(k))continue;seen.add(k);
    if(seen.size>(+(process.env.TOP??14)))break;
    console.log(`   ${h.area.toFixed(3)} m²  ${h.a}  ×  ${h.b}  @ ${h.at.x.toFixed(1)},${h.at.y.toFixed(2)},${h.at.z.toFixed(1)} n=${h.n.x.toFixed(1)},${h.n.y.toFixed(1)},${h.n.z.toFixed(1)} [${h.mesh}]`);
  }
}
