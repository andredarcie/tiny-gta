import * as THREE from 'three';
import {matte} from '../matte.ts';
import {stoneTexture,corrugatedTexture,uvMetres,STONE_TILE_M} from './texturas.ts';

// Fachada — one REAL lot of a Divinolândia street, described from Street View: the house
// (or the wall of an empty lot) with its true colours, storeys, roof type, garage doors,
// gates, windows with grilles or wooden shutters, balconies, stone-clad panels, awnings and
// shop signs, and the front wall/railing when the house sits back from the sidewalk.
// Parametric on purpose: each lot of a surveyed street (src/js/world/divinolandia/ruas/)
// is one FachadaOpts record, so the street reads like the photos without a file per house.
//
// Frame: the façade (or the front wall) is the plane z=0 facing +z (the street); the body
// goes back to z=-d. x runs left→right AS SEEN FROM THE STREET (centre 0). y=0 is the
// sidewalk level at the façade; `base` (<0) extends the walls down for sloping lots.
export type Op={t:'door'|'window'|'garage'|'gate'|'glass'|'arch'|'shop';x:number;w:number;h?:number;y?:number;fl?:number;
  c?:string;grille?:boolean;shutters?:string;frame?:string;awning?:string};
export type FachadaOpts={
  w:number;d?:number;floors?:number;wall:string;upper?:string;base?:number;
  roof?:'hip'|'gable'|'gableSide'|'flat';roofColor?:string;fascia?:string;eave?:number;
  plinth?:{h:number;c?:string;stone?:boolean};
  setback?:number;
  front?:{h:number;c?:string;style?:'plain'|'stone'|'panel'|'corrugated'|'hedge'|'lattice'|'bars';rail?:{h:number;c?:string;style:'lattice'|'bars'};gates?:Op[]};
  open?:Op[];
  panels?:{x:number;w:number;c?:string;stone?:boolean;y0?:number;y1?:number}[];
  balcony?:{x:number;w:number;fl:number;rail:'white'|'glass'|'iron';depth?:number};
  sign?:{text:string;bg:string;fg:string;x:number;y:number;w:number;h:number};
  band?:string;
  wallOnly?:boolean;
  behind?:{w?:number;d?:number;at?:number;roofColor:string;wall:string;floors?:number;roof?:'hip'|'gable'|'flat'};
};
export const FLOOR_H=3.0;

const mats=new Map<string,THREE.Material>();
const mat=(c:string):THREE.Material=>{let m=mats.get(c);if(!m){m=matte({color:c});mats.set(c,m);}return m;};
const stoneMat=matte({map:stoneTexture()});
const corrMat=matte({map:corrugatedTexture()});
const glassMat=matte({color:'#2f3a44'}),darkMat=matte({color:'#25221f'});
// double-sided (roof slopes, gable triangles) — cached per colour so whole streets merge
const glassRailMat=new THREE.MeshLambertMaterial({color:'#7fb3a4',transparent:true,opacity:.55,side:THREE.DoubleSide});
const dmats=new Map<string,THREE.Material>();
const dmat=(c:string,flat=false):THREE.Material=>{const k=c+flat;let m=dmats.get(k);if(!m){m=new THREE.MeshLambertMaterial({color:c,side:THREE.DoubleSide,flatShading:flat});dmats.set(k,m);}return m;};

function box(g:THREE.Group,m:THREE.Material,x0:number,x1:number,y0:number,y1:number,z0:number,z1:number,cast=true):THREE.Mesh{
  const b=new THREE.Mesh(new THREE.BoxGeometry(x1-x0,y1-y0,z1-z0),m);
  b.position.set((x0+x1)/2,(y0+y1)/2,(z0+z1)/2);b.castShadow=cast;b.receiveShadow=true;g.add(b);return b;
}
// textured plane on the façade (faces +z), UVs in metres
function tplane(g:THREE.Group,m:THREE.Material,x0:number,x1:number,y0:number,y1:number,z:number,tile:number,ry=0):void{
  const geo=uvMetres(new THREE.PlaneGeometry(x1-x0,y1-y0),x1-x0,y1-y0,tile);
  const p=new THREE.Mesh(geo,m);p.position.set((x0+x1)/2,(y0+y1)/2,z);p.rotation.y=ry;p.receiveShadow=true;g.add(p);
}
function quad(g:THREE.Group,m:THREE.Material,x0:number,x1:number,y0:number,y1:number,z:number):void{
  const p=new THREE.Mesh(new THREE.PlaneGeometry(x1-x0,y1-y0),m);p.position.set((x0+x1)/2,(y0+y1)/2,z);g.add(p);
}

// One opening on the plane z (+z faces out). y is the sill height above its floor.
function opening(g:THREE.Group,o:Op,z:number):void{
  const fy=(o.fl||0)*FLOOR_H;
  const kind=o.t;
  const h=o.h??(kind==='garage'||kind==='gate'?2.4:kind==='door'?2.15:kind==='shop'?2.7:kind==='glass'?1.9:1.2);
  const y0=fy+(o.y??(kind==='window'||kind==='arch'?1.0:kind==='glass'?.6:0));
  const x0=o.x-o.w/2,x1=o.x+o.w/2,y1=y0+h;
  const frame=mat(o.frame||'#efece4');
  if(kind==='garage'||kind==='gate'||kind==='shop'){
    const c=o.c||(kind==='shop'?'#b9bcbf':'#e9e7e1');
    quad(g,mat(c),x0,x1,y0,y1,z+.03);
    const slats=kind==='gate'?0:Math.floor(h/.35);
    for(let k=1;k<slats;k++){const y=y0+k*h/slats;box(g,mat(shade(c,.86)),x0+.05,x1-.05,y-.02,y+.02,z+.03,z+.06,false);}
    if(kind==='gate')for(let k=1;k<Math.floor(o.w/.18);k++){const x=x0+k*.18;box(g,mat(shade(c,.8)),x-.025,x+.025,y0,y1,z+.03,z+.06,false);}
    if(o.grille){const top=y1-.4;quad(g,darkMat,x0+.1,x1-.1,top,y1-.08,z+.04);for(let x=x0+.2;x<x1-.1;x+=.16)box(g,mat(c),x-.02,x+.02,top,y1-.08,z+.04,z+.07,false);}
  }else{
    quad(g,kind==='door'?mat(o.c||'#6a4630'):glassMat,x0,x1,y0,y1,z+.03);
    if(kind==='arch'){const a=new THREE.Mesh(new THREE.CircleGeometry(o.w/2,12,0,Math.PI),glassMat);a.position.set(o.x,y1,z+.03);g.add(a);}
    // frame
    box(g,frame,x0-.08,x1+.08,y1,y1+.09,z,z+.07,false);box(g,frame,x0-.08,x1+.08,y0-.09,y0,z,z+.1,false);
    box(g,frame,x0-.08,x0,y0,y1,z,z+.07,false);box(g,frame,x1,x1+.08,y0,y1,z,z+.07,false);
    if(o.grille)for(let x=x0+.15;x<x1-.05;x+=.2)box(g,mat(o.frame||'#efece4'),x-.02,x+.02,y0,y1,z+.05,z+.08,false);
    if(o.shutters){const sw=o.w/2;box(g,mat(o.shutters),x0-sw-.05,x0-.08,y0,y1,z,z+.06,false);box(g,mat(o.shutters),x1+.08,x1+sw+.05,y0,y1,z,z+.06,false);}
  }
  if(o.awning){const a=box(g,mat(o.awning),x0-.2,x1+.2,y1+.15,y1+.3,z,z+.8);a.rotation.x=.25;}
}
const shade=(c:string,f:number):string=>'#'+new THREE.Color(c).multiplyScalar(f).getHexString();

// railings on top of a wall: diagonal lattice (common white "grade") or vertical bars
function rail(g:THREE.Group,x0:number,x1:number,y0:number,h:number,z:number,c:string,style:'lattice'|'bars'):void{
  const m=mat(c);
  box(g,m,x0,x1,y0+h-.05,y0+h,z-.03,z+.03,false);box(g,m,x0,x1,y0,y0+.05,z-.03,z+.03,false);
  if(style==='bars'){for(let x=x0+.06;x<x1;x+=.13)box(g,m,x-.015,x+.015,y0,y0+h,z-.015,z+.015,false);return;}
  const step=.45,L=Math.hypot(step,h);
  for(let x=x0;x<x1-.01;x+=step)for(const dir of[1,-1]){
    const b=new THREE.Mesh(new THREE.BoxGeometry(.035,L,.035),m);
    b.position.set(x+step/2,y0+h/2,z);b.rotation.z=dir*Math.atan2(step,h);g.add(b);
  }
}

function roofOn(g:THREE.Group,kind:string,w:number,d:number,y:number,z0:number,col:string,fascia:string|undefined,eave:number,wallC:string):void{
  const hw=w/2+eave,front=z0+eave,back=z0-d-eave;
  if(kind==='flat'){
    box(g,mat(fascia||'#f1efe9'),-hw,hw,y,y+.25,back,front);                  // slab + white beiral
    if(!fascia)box(g,mat(wallC),-w/2,w/2,y+.25,y+.9,z0-.2,z0);                // platibanda (parapet)
    return;
  }
  const rise=kind==='gableSide'?Math.min(d,10)*.32:kind==='gable'?Math.min(w,12)*.3:Math.min(w,d)*.3;
  const pos:number[]=[];
  const T=(a:number[],b:number[],c:number[]):void=>{pos.push(...a,...b,...c);};
  if(kind==='gable'){                       // gable END faces the street: ridge runs along z
    const r=[0,y+rise];
    T([-hw,y,front],[r[0],r[1],front],[-hw,y,back]);T([-hw,y,back],[r[0],r[1],front],[r[0],r[1],back]);
    T([hw,y,front],[hw,y,back],[r[0],r[1],front]);T([hw,y,back],[r[0],r[1],back],[r[0],r[1],front]);
    // gable triangle in wall colour + decorative barge boards
    const tri=new THREE.BufferGeometry();
    tri.setAttribute('position',new THREE.Float32BufferAttribute([-w/2,y,z0,w/2,y,z0,0,y+rise*(w/2)/hw,z0],3));tri.computeVertexNormals();
    g.add(new THREE.Mesh(tri,dmat(wallC)));
    if(fascia)for(const s of[-1,1]){const L=Math.hypot(hw,rise);const b=new THREE.Mesh(new THREE.BoxGeometry(L,.22,.06),mat(fascia));
      b.position.set(s*hw/2,y+rise/2-.08,front+.03);b.rotation.z=-s*Math.atan2(rise,hw);g.add(b);}
  }else if(kind==='gableSide'){             // ridge along x, slopes toward the street and the back
    const zr=(front+back)/2;
    T([-hw,y,front],[hw,y,front],[hw,y+rise,zr]);T([-hw,y,front],[hw,y+rise,zr],[-hw,y+rise,zr]);
    T([hw,y,back],[-hw,y,back],[-hw,y+rise,zr]);T([hw,y,back],[-hw,y+rise,zr],[hw,y+rise,zr]);
    for(const s of[-1,1]){const tri=new THREE.BufferGeometry();
      tri.setAttribute('position',new THREE.Float32BufferAttribute([s*w/2,y,z0,s*w/2,y,z0-d,s*w/2,y+rise*.92,(z0+z0-d)/2],3));tri.computeVertexNormals();
      g.add(new THREE.Mesh(tri,dmat(wallC)));}
  }else{                                     // hip
    const hd=(front-back)/2,zc=(front+back)/2,along=hw>=hd,rr=Math.abs(hw-hd);
    const c0=[-hw,y,back],c1=[hw,y,back],c2=[hw,y,front],c3=[-hw,y,front];
    const r0=along?[-rr,y+rise,zc]:[0,y+rise,zc-rr],r1=along?[rr,y+rise,zc]:[0,y+rise,zc+rr];
    if(along){T(c3,c2,r1);T(c3,r1,r0);T(c1,c0,r0);T(c1,r0,r1);T(c0,c3,r0);T(c2,c1,r1);}
    else{T(c0,c3,r0);T(c3,r1,r0);T(c2,c1,r1);T(c1,r0,r1);T(c3,c2,r1);T(c1,c0,r0);}
  }
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));geo.computeVertexNormals();
  const roof=new THREE.Mesh(geo,dmat(col,true));
  roof.castShadow=true;g.add(roof);
}

export function buildFachada(o:FachadaOpts):THREE.Group{
  const g=new THREE.Group();
  const w=o.w,d=o.d??12,fl=o.floors??1,base=o.base??-1.2,H=fl*FLOOR_H,set=o.setback??0;
  // front wall at the sidewalk (houses set back, empty lots, yards)
  if(o.front||o.wallOnly){
    const f=o.front||{h:2.2};
    const fh=f.h,st=f.style||'plain',fc=f.c||o.wall;
    const gates=f.gates||[];
    if(st==='hedge'){const hb=box(g,mat('#3f6b2e'),-w/2,w/2,0,fh,-.9,0);hb.castShadow=true;}
    else if(st==='corrugated'){box(g,mat('#7f8488'),-w/2,w/2,base,0,-.1,0,false);tplane(g,corrMat,-w/2,w/2,0,fh,.01,1);
      const back=new THREE.Mesh(new THREE.PlaneGeometry(w,fh),corrMat);back.position.set(0,fh/2,-.01);back.rotation.y=Math.PI;g.add(back);}
    else if(st==='lattice'||st==='bars'){box(g,mat(fc),-w/2,w/2,base,.25,-.2,0);rail(g,-w/2,w/2,.25,fh-.25,-.1,f.rail?.c||'#f2f2ee',st);}
    else{
      box(g,mat(fc),-w/2,w/2,base,fh,-.2,0);
      if(st==='stone')tplane(g,stoneMat,-w/2,w/2,Math.max(base,-.3),fh,.01,STONE_TILE_M);
      if(st==='panel')for(let x=-w/2;x<=w/2+.01;x+=2.6)box(g,mat(shade(fc,.92)),x-.15,x+.15,0,fh+.1,-.25,.05);
      if(f.rail)rail(g,-w/2,w/2,fh,f.rail.h,-.1,f.rail.c||'#f2f2ee',f.rail.style);
    }
    for(const gt of gates)opening(g,gt,.0);
  }
  if(o.behind){
    const b=o.behind,bw=b.w??w*.8,bd=b.d??10,bz=-(b.at??6),bH=(b.floors??1)*FLOOR_H;
    box(g,mat(b.wall),-bw/2,bw/2,base,bH,bz-bd,bz);
    roofOn(g,b.roof||'hip',bw,bd,bH,bz,b.roofColor,undefined,.4,b.wall);
  }
  if(o.wallOnly)return finish(g,o);
  // the house body
  const z0=-set,upper=o.upper||o.wall;
  box(g,mat(o.wall),-w/2,w/2,base,Math.min(H,FLOOR_H),z0-d,z0);
  if(fl>1)box(g,mat(upper),-w/2,w/2,FLOOR_H,H,z0-d,z0);
  if(o.plinth){
    if(o.plinth.stone)tplane(g,stoneMat,-w/2,w/2,base<0?-.3:0,o.plinth.h,z0+.02,STONE_TILE_M);
    else box(g,mat(o.plinth.c||shade(o.wall,.75)),-w/2-.03,w/2+.03,base,o.plinth.h,z0-.1,z0+.03,false);
  }
  for(const p of o.panels||[]){
    const y0=p.y0??0,y1=p.y1??H;
    if(p.stone)tplane(g,stoneMat,p.x-p.w/2,p.x+p.w/2,y0,y1,z0+.03,STONE_TILE_M);
    else box(g,mat(p.c||'#b04a3c'),p.x-p.w/2,p.x+p.w/2,y0,y1,z0,z0+.06,false);
  }
  for(const op of o.open||[])opening(g,op,z0);
  if(o.band)box(g,mat(o.band),-w/2,w/2,2.75,3.0,z0,z0+.9);
  if(o.balcony){
    const b=o.balcony,y=b.fl*FLOOR_H,dp=b.depth??1.1;
    box(g,mat('#e9e6df'),b.x-b.w/2,b.x+b.w/2,y-.18,y,z0,z0+dp);
    const rc=b.rail==='iron'?'#2b2b2e':'#f2f2ee';
    if(b.rail==='glass'){const gl=new THREE.Mesh(new THREE.PlaneGeometry(b.w,1),glassRailMat);gl.position.set(b.x,y+.5,z0+dp);g.add(gl);}
    else rail(g,b.x-b.w/2,b.x+b.w/2,y,1,z0+dp,rc,'bars');
  }
  if(o.sign&&typeof document!=='undefined'){
    const s=o.sign;const c=document.createElement('canvas');c.width=256;c.height=Math.max(32,Math.round(256*s.h/s.w));
    const x=c.getContext('2d')!;x.fillStyle=s.bg;x.fillRect(0,0,c.width,c.height);x.fillStyle=s.fg;x.textAlign='center';x.textBaseline='middle';
    x.font=`700 ${Math.round(c.height*.5)}px "IBM Plex Mono",monospace`;x.fillText(s.text,c.width/2,c.height/2,c.width-12);
    const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;
    const p=new THREE.Mesh(new THREE.PlaneGeometry(s.w,s.h),new THREE.MeshLambertMaterial({map:t}));p.position.set(s.x,s.y,z0+.08);g.add(p);
  }
  roofOn(g,o.roof||'hip',w,d,H,z0,o.roofColor||'#a8573a',o.fascia,o.eave??.5,o.wall);
  return finish(g,o);
}
function finish(g:THREE.Group,o:FachadaOpts):THREE.Group{
  g.userData.w=o.w;g.userData.d=(o.d??12)+(o.setback??0);g.userData.h=(o.floors??1)*FLOOR_H+2;
  return g;
}

// Model-viewer sample: the three typical fronts of the street.
function build(opts:Partial<FachadaOpts>={}):THREE.Group{
  return buildFachada({w:9,wall:'#3f6b45',roof:'gable',fascia:'#6b3f2a',plinth:{h:.5,c:'#4a4a48'},
    open:[{t:'window',x:-2.2,w:1.3,shutters:'#f1efe9'},{t:'window',x:1.8,w:1.6,grille:true}],...opts});
}
export default {category:'Divinolândia',label:'Fachada (lote real)',build,variants:[
  {label:'Casa verde (grafiato, oitão)',opts:{}},
  {label:'Sobrado com garagem e sacada',opts:{w:10,floors:2,wall:'#e9e2d4',roof:'flat',fascia:'#f1efe9',
    open:[{t:'garage',x:1.5,w:3,grille:true},{t:'door',x:-2.6,w:1},{t:'glass',x:0,w:3,fl:1}],balcony:{x:0,w:4,fl:1,rail:'white'}}},
  {label:'Muro de terreno vazio',opts:{w:14,wall:'#d8d2c4',wallOnly:true,front:{h:2.2,style:'panel'},roof:'flat'}},
]};
