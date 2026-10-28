import * as THREE from 'three';
import {leafMat,leafMass} from './copa.ts';
import {Kit,P,STONE,CORR,plain,holedWall,holeOf,fillOpening,wallX,wallZ,dirt,railing,roof,shade,setRoomBounds,
  meterBox,houseNumber,waterTank,dish,acUnit,solarHeater,FH,type Op,type RoofKind} from './kit-fachada.ts';

// Fachada — one REAL lot of a Divinolândia street, described from Street View: the house
// (or the wall of an empty lot) with its true colours, storeys, roof, garage doors, gates,
// windows (aluminium sliding / louvred shutters / grilles), balconies, stone-clad panels,
// awnings, shop signs, the front wall with its gates when the house sits back, and the
// little things on every Brazilian house (meter box, number plate, water tank, dish, AC).
// Built with the detailed parts of kit-fachada.ts: walls have REAL holes with reveals,
// windows have frames, sashes, sills and sky-reflecting glass, roofs are clay tile with
// ridge caps, fascia and soffits. Parametric: each lot of a surveyed street
// (src/js/world/divinolandia/ruas/) is one FachadaOpts record.
//
// Frame: the façade (or the front wall) is the plane z=0 facing +z (the street); the body
// goes back to z=-d. x runs left→right AS SEEN FROM THE STREET (centre 0). y=0 is the
// sidewalk level at the façade; `base` (<0) extends the walls down for sloping lots.
export type {Op};
export type Extra='tank'|'dish'|'ac'|'heater';
export type FachadaOpts={
  w:number;d?:number;floors?:number;wall:string;upper?:string;base?:number;
  roof?:RoofKind;roofColor?:string;fascia?:string;eave?:number;parapet?:boolean;
  plinth?:{h:number;c?:string;stone?:boolean};
  setback?:number;
  front?:{h:number;c?:string;style?:'plain'|'stone'|'panel'|'corrugated'|'hedge'|'lattice'|'bars';rail?:{h:number;c?:string;style:'lattice'|'bars'|'arame'};gates?:Op[]};
  open?:Op[];
  panels?:{x:number;w:number;c?:string;stone?:boolean;y0?:number;y1?:number}[];
  balcony?:{x:number;w:number;fl:number;rail:'white'|'glass'|'iron';depth?:number};
  sign?:{text:string;bg:string;fg:string;x:number;y:number;w:number;h:number};
  band?:string;
  wallOnly?:boolean;
  behind?:{w?:number;d?:number;at?:number;roofColor:string;wall:string;floors?:number;roof?:RoofKind};
  x?:Extra[];
  seed?:number;
};
export const FLOOR_H=FH;
const leafM=leafMat(0x3e5a32);
const glassRail=new THREE.MeshLambertMaterial({color:'#8fc0b2',transparent:true,opacity:.45,side:THREE.DoubleSide,depthWrite:false});

// the front wall (muro) at the sidewalk: plaster/stone/panels/corrugated/hedge/railing + gates
function frontWall(k:Kit,o:FachadaOpts,base:number):void{
  const f=o.front||{h:2.2},w=o.w,fh=f.h,st=f.style||'plain',fc=f.c||o.wall,gates=f.gates||[];
  if(st==='hedge'){
    for(let x=-w/2+.6;x<w/2;x+=1.1){const b=new THREE.Mesh(leafMass(1,.24,2),leafM);
      b.position.set(x,fh*.55,-.5);b.scale.set(.9,.9*fh/1.6,.68);b.castShadow=true;k.add(b);}
    return;
  }
  if(st==='corrugated'){
    k.quad(CORR(),[-w/2,0,0],[w/2,0,0],[w/2,fh,0],[-w/2,fh,0]);k.quad(CORR(),[w/2,0,-.05],[-w/2,0,-.05],[-w/2,fh,-.05],[w/2,fh,-.05]);
    for(let x=-w/2;x<=w/2+.01;x+=2.4)k.box(plain('#6a6f73'),x-.04,x+.04,base,fh+.05,-.1,.02);
    k.box(plain('#7e8386'),-w/2,w/2,base,.05,-.08,-.02);
    return;
  }
  const low=st==='lattice'||st==='bars',top=low?.35:fh;
  const m=P(fc);
  holedWall(k,m,-w/2,w/2,base,top,0,gates.map(holeOf),.2);
  if(st==='stone')holedWall(k,STONE(),-w/2,w/2,Math.max(base,-.4),top,.012,gates.map(holeOf),.012);
  wallZ(k,P(shade(fc,.92)),-.2,w/2,-w/2,base,top);
  wallX(k,m,-w/2,-.2,0,base,top);wallX(k,m,w/2,-.2,0,base,top);
  k.box(plain('#d6d2c9'),-w/2-.03,w/2+.03,top,top+.06,-.24,.04);                     // pingadeira cap
  if(st==='panel')for(let x=-w/2;x<=w/2+.01;x+=2.6)k.box(m,x-.14,x+.14,base,top+.12,-.26,.06);
  for(const g of gates){const x0=g.x-g.w/2,x1=g.x+g.w/2;
    for(const px of[x0-.15,x1+.15])k.box(P(fc),px-.15,px+.15,base,top+.15,-.25,.08);}   // gate pillars
  for(const g of gates)fillOpening(k,g,0,m);
  if(low)railing(k,-w/2,w/2,top,fh-top,-.1,f.rail?.c||'#f2f2ee',st==='lattice'?'lattice':'bars');
  else if(f.rail)railing(k,-w/2,w/2,top+.06,f.rail.h,-.1,f.rail.c||'#f2f2ee',f.rail.style);
  dirt(k,-w/2,w/2,Math.max(base,-.3),.9,0);
}

// a simple house standing back behind a wall (seen over it)
function behindHouse(k:Kit,b:NonNullable<FachadaOpts['behind']>,w:number,base:number):void{
  const bw=b.w??w*.8,bd=b.d??10,bz=-(b.at??6),bH=(b.floors??1)*FH,m=P(b.wall);
  holedWall(k,m,-bw/2,bw/2,base,bH,bz,[{x0:-bw/4-.6,x1:-bw/4+.6,y0:1,y1:2.2},{x0:bw/4-.6,x1:bw/4+.6,y0:1,y1:2.2}]);
  for(const x of[-bw/4,bw/4])fillOpening(k,{t:'window',x,w:1.2},bz,m);
  wallX(k,m,-bw/2,bz-bd,bz,base,bH);wallX(k,m,bw/2,bz-bd,bz,base,bH);wallZ(k,m,bz-bd,bw/2,-bw/2,base,bH);
  roof(k,b.roof||'hip',bw,bd,bH,bz,{tile:b.roofColor,wall:b.wall,ov:.45});
}

export function buildFachada(o:FachadaOpts):THREE.Group{
  const k=new Kit();
  const w=o.w,d=o.d??12,fl=o.floors??1,base=o.base??-1.2,H=fl*FH,set=o.setback??0,seed=o.seed??Math.round(w*7.3);
  if(o.front||o.wallOnly)frontWall(k,o,base);
  if(o.behind)behindHouse(k,o.behind,w,base);
  if(!o.wallOnly){
    const z0=-set,ops=o.open||[];
    setRoomBounds(-w/2,w/2,z0-d);                         // shop rooms stay inside this building
    // storeys: each its own skin (colour) with the holes of its openings
    for(let f=0;f<fl;f++){
      const y0=f===0?base:f*FH,y1=(f+1)*FH,c=f===0?o.wall:(o.upper||o.wall),m=P(c);
      const mine=ops.filter(op=>(op.fl||0)===f);
      holedWall(k,m,-w/2,w/2,y0,y1,z0,mine.map(holeOf));
      for(const op of mine)fillOpening(k,op,z0,m);
      if(f>0)k.box(plain('#e7e3da'),-w/2-.05,w/2+.05,f*FH-.07,f*FH+.07,z0-.02,z0+.08); // storey band
      wallX(k,m,-w/2,z0-d,z0,y0,y1);wallX(k,m,w/2,z0-d,z0,y0,y1);wallZ(k,m,z0-d,w/2,-w/2,y0,y1);
    }
    // cladding panels over the skin (they keep the same holes)
    for(const p of o.panels||[]){
      const x0=p.x-p.w/2,x1=p.x+p.w/2,py0=p.y0??0,py1=p.y1??H;
      holedWall(k,p.stone?STONE():P(p.c||'#b04a3c'),x0,x1,py0,py1,z0+.015,ops.map(holeOf),.015);
    }
    if(o.plinth){
      if(o.plinth.stone)holedWall(k,STONE(),-w/2,w/2,Math.max(base,-.4),o.plinth.h,z0+.012,ops.map(holeOf),.012);
      else{const pm=P(o.plinth.c||shade(o.wall,.72));holedWall(k,pm,-w/2-.02,w/2+.02,base,o.plinth.h,z0+.03,ops.map(holeOf),.03);
        k.box(plain('#d8d4cb'),-w/2-.03,w/2+.03,o.plinth.h,o.plinth.h+.04,z0+.004,z0+.06);}
    }
    dirt(k,-w/2,w/2,Math.max(base,-.3),.8,z0+.035);
    if(o.band){k.box(plain(o.band),-w/2,w/2,2.75,3.0,z0,z0+.9);k.box(plain(shade(o.band,.8)),-w/2,w/2,2.7,2.75,z0+.85,z0+.9);}
    if(o.balcony){
      const b=o.balcony,y=b.fl*FH,dp=b.depth??1.1,bx0=b.x-b.w/2,bx1=b.x+b.w/2,rc=b.rail==='iron'?'#2b2b2e':'#f2f2ee';
      k.box(plain('#ebe8e1'),bx0,bx1,y-.2,y,z0+.012,z0+dp);           // (its back face off the wall)
      if(b.rail==='glass'){const gl=new THREE.Mesh(new THREE.PlaneGeometry(b.w,1),glassRail);gl.position.set(b.x,y+.5,z0+dp);k.add(gl);
        k.box(plain('#c9ccce'),bx0,bx1,y+.98,y+1.03,z0+dp-.03,z0+dp+.03);}
      else railing(k,bx0,bx1,y,1.05,z0+dp-.05,rc,'bars');
    }
    if(o.sign&&typeof document!=='undefined'){
      const s=o.sign,c=document.createElement('canvas');c.width=512;c.height=Math.max(64,Math.round(512*s.h/s.w));
      const x=c.getContext('2d')!;x.fillStyle=s.bg;x.fillRect(0,0,c.width,c.height);
      x.strokeStyle=s.fg;x.lineWidth=4;x.strokeRect(6,6,c.width-12,c.height-12);
      x.fillStyle=s.fg;x.textAlign='center';x.textBaseline='middle';
      x.font=`700 ${Math.round(c.height*.42)}px "Barlow Condensed",monospace`;x.fillText(s.text,c.width/2,c.height/2,c.width-24);
      const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;
      const edge=plain('#d0d0d0');
      const p=new THREE.Mesh(new THREE.BoxGeometry(s.w,s.h,.06),[edge,edge,edge,edge,new THREE.MeshLambertMaterial({map:t}),edge]);
      p.position.set(s.x,s.y,z0+.06);k.add(p);
    }
    const top=roof(k,o.roof||'hip',w,d,H,z0,{tile:o.roofColor,fascia:o.fascia,wall:o.wall,ov:o.eave,parapet:o.parapet});
    // services and clutter, deterministic per lot
    const r=(i:number):number=>{const v=Math.sin(seed*12.9898+i*78.233)*43758.5453;return v-Math.floor(v);};
    const xs:Extra[]=o.x??[...(r(1)<.55?['tank' as const]:[]),...(r(2)<.4?['dish' as const]:[]),...(r(3)<.3&&fl>1?['ac' as const]:[])];
    const roofY=o.roof==='flat'?top:H+.4;
    for(const e of xs){
      if(e==='tank')waterTank(k,(r(4)-.5)*w*.4,o.roof==='flat'?top:H+(top-H)*.35,z0-d*.65);
      if(e==='dish')dish(k,w/2-1,roofY,z0-d*.3,r(5)*2);
      if(e==='ac')acUnit(k,(r(6)-.5)*(w-2),FH+1.4,z0+.01);
      if(e==='heater')solarHeater(k,0,H+(top-H)*.5,z0-d*.75);
    }
    if(!o.front)meterBox(k,w/2-.6,.9,z0+.01);
    houseNumber(k,-w/2+.7,2.3,z0+.01);
  }else if(o.front?.gates?.length){const g0=o.front.gates[0];meterBox(k,g0.x+g0.w/2+.6,.9,.01);}
  const g=k.finish();
  g.userData.w=o.w;g.userData.d=d+set;g.userData.h=H+2;
  return g;
}

// Model-viewer sample: the typical fronts of the street.
function build(opts:Partial<FachadaOpts>={}):THREE.Group{
  return buildFachada({w:9,wall:'#4f6c50',roof:'gable',roofColor:'#8e4632',fascia:'#7a5232',plinth:{h:.4,c:'#5f5e5a'},
    open:[{t:'window',x:-2.4,w:1.3,shutters:'#ecebe5'},{t:'window',x:1.8,w:1.7,grille:true,frame:'#9a9a96'}],...opts});
}
export default {category:'Divinolândia',label:'Fachada (lote real)',build,variants:[
  {label:'Casa verde (grafiato, oitão)',opts:{}},
  {label:'Sobrado com garagem e sacada',opts:{w:10,floors:2,wall:'#e9e2d4',roof:'flat',
    open:[{t:'garage',x:1.5,w:3,grille:true},{t:'door',x:-2.6,w:1},{t:'glass',x:0,w:3,fl:1}],balcony:{x:0,w:4,fl:1,rail:'white'}}},
  {label:'Muro de terreno vazio',opts:{w:14,wall:'#d8d2c4',wallOnly:true,front:{h:2.2,style:'panel'}}},
]};
