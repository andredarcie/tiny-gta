import * as THREE from 'three';
import {matte} from '../matte.ts';
import {buildFachada,type FachadaOpts} from './fachada.ts';
import {canvasTex,brLogo} from './posto-kit.ts';
import {telhaTexture,stoneTexture,corrugatedTexture,ROOF_TILE_M,STONE_TILE_M} from './texturas.ts';
import Palmeira from './palmeira-fenix.ts';
import type {ShopOpts,Sign,Awning,Clad,Extra,Logo,Kind} from '@/world/divinolandia/comercio/spec.ts';
import type {Interior,Op} from './kit-fachada.ts';

// Loja (comércio) — a real business front of Divinolândia, as Street View shows it: the
// building is a Fachada (fachada.ts: storeys, openings with real holes, roof, balcony) and
// this file dresses its ground floor as the shop it is:
//  - SIGNBOARDS painted on canvas: lettering in the shop's own colours and type (sans,
//    serif, script, stencil, italic), the brand marks drawn in code (the Bradesco tree, the
//    Banco do Brasil square, Sicoob, Sicredi, the CAIXA clover, a shopping trolley, the
//    pharmacy cross, the Formiga ant…), boxes, light boxes and blade signs;
//  - AWNINGS: the curved aluminium toldo, the canvas toldo with its valance, the clay-tile
//    pent roof on brackets, the concrete marquise, the flat sheet, smoked polycarbonate;
//  - CLADDINGS over the wall: white wall tiles, small mosaic tiles (pastilha), flagstone,
//    exposed brick, polished black granite, the multicolour mosaic, ACM panels, timber
//    slats, grafiato render;
//  - EXTRAS: rows of shopping trolleys, crates, benches, pots and palms, shop-window
//    mannequins, totems, floodlights, the steel pergola of the bank, battlements on a
//    parapet, a warehouse gable, a tarpaulin, a corrugated upper front, the tower box,
//    coolers, bollards, railings.
// Frame (as fachada.ts): the façade is the plane z = 0 facing +z (the street), x across it
// (centre 0, left = negative as seen from the street), y = 0 the shop floor.
export type LojaOpts={w:number;f:Omit<FachadaOpts,'w'>;shop:ShopOpts;base?:number;seed?:number;kind?:Kind;theme?:Interior};

const cache=new Map<string,THREE.Material>();
const get=(k:string,f:()=>THREE.Material):THREE.Material=>{let m=cache.get(k);if(!m){m=f();cache.set(k,m);}return m;};
const col=(c:string):THREE.Material=>get('c'+c,()=>matte({color:c}));
const colD=(c:string):THREE.Material=>get('d'+c,()=>matte({color:c,side:THREE.DoubleSide}));

// ---------------- brand marks (canvas) ----------------
function logo(x:CanvasRenderingContext2D,kind:Logo,cx:number,cy:number,s:number,c:string):void{
  x.save();x.translate(cx,cy);
  const C=(r:number):void=>{x.beginPath();x.arc(0,0,r,0,Math.PI*2);x.fill();};
  switch(kind){
    case'cart':{x.strokeStyle=c;x.lineWidth=s*.07;x.beginPath();x.moveTo(-s*.5,-s*.35);x.lineTo(-s*.32,-s*.35);x.lineTo(-s*.18,s*.15);x.lineTo(s*.38,s*.15);x.lineTo(s*.48,-s*.2);x.lineTo(-s*.26,-s*.2);x.stroke();
      x.fillStyle=c;x.beginPath();x.arc(-s*.1,s*.32,s*.08,0,7);x.fill();x.beginPath();x.arc(s*.3,s*.32,s*.08,0,7);x.fill();break;}
    case'cross':{x.fillStyle=c;x.fillRect(-s*.15,-s*.45,s*.3,s*.9);x.fillRect(-s*.45,-s*.15,s*.9,s*.3);break;}
    case'bradesco':{x.fillStyle='#ffffff';C(s*.48);x.fillStyle=c;x.fillRect(-s*.07,-s*.05,s*.14,s*.36);
      x.beginPath();x.ellipse(0,-s*.12,s*.3,s*.14,0,Math.PI,0);x.fill();x.fillStyle='#ffffff';x.beginPath();x.ellipse(0,-s*.08,s*.2,s*.08,0,Math.PI,0);x.fill();break;}
    case'bb':{x.fillStyle='#f6d10f';x.fillRect(-s/2,-s/2,s,s);x.strokeStyle='#26408c';x.lineWidth=s*.09;
      for(const sg of[-1,1]){x.beginPath();x.moveTo(sg*s*.05,-s*.32);x.lineTo(sg*s*.3,-s*.08);x.lineTo(sg*s*.05,s*.16);x.lineTo(sg*s*.3,s*.38);x.stroke();}break;}
    case'sicoob':{x.fillStyle='#7db843';x.beginPath();x.moveTo(-s*.45,-s*.35);x.lineTo(s*.45,-s*.35);x.lineTo(0,s*.4);x.closePath();x.fill();
      x.fillStyle='#00a4a7';x.beginPath();x.moveTo(-s*.1,-s*.35);x.lineTo(s*.45,-s*.35);x.lineTo(s*.18,s*.08);x.closePath();x.fill();break;}
    case'sicredi':{x.fillStyle=c;for(let i=0;i<8;i++){x.save();x.rotate(i*Math.PI/4);x.beginPath();x.ellipse(s*.2,0,s*.2,s*.08,.4,0,7);x.fill();x.restore();}x.fillStyle='#ffffff';C(s*.08);break;}
    case'caixa':{const cs=['#f39200','#0070af','#f39200','#0070af'];for(let i=0;i<4;i++){x.fillStyle=cs[i];x.save();x.rotate(i*Math.PI/2);x.beginPath();x.arc(s*.18,s*.18,s*.17,0,7);x.fill();x.restore();}break;}
    case'ant':{x.fillStyle=c;for(const[dx,r]of[[-s*.28,s*.13],[0,s*.1],[s*.27,s*.16]] as [number,number][]){x.beginPath();x.arc(dx,0,r,0,7);x.fill();}
      x.strokeStyle=c;x.lineWidth=s*.04;for(const sx of[-.15,0,.15]){x.beginPath();x.moveTo(sx*s,0);x.lineTo(sx*s-s*.12,s*.3);x.moveTo(sx*s,0);x.lineTo(sx*s+s*.1,s*.3);x.stroke();}
      x.beginPath();x.moveTo(-s*.35,-s*.1);x.lineTo(-s*.45,-s*.38);x.stroke();break;}
    case'crown':{x.fillStyle=c;x.beginPath();x.moveTo(-s*.4,s*.25);x.lineTo(-s*.45,-s*.25);x.lineTo(-s*.2,0);x.lineTo(0,-s*.35);x.lineTo(s*.2,0);x.lineTo(s*.45,-s*.25);x.lineTo(s*.4,s*.25);x.closePath();x.fill();break;}
    case'house':{x.strokeStyle=c;x.lineWidth=s*.1;x.beginPath();x.moveTo(-s*.48,s*.05);x.lineTo(0,-s*.4);x.lineTo(s*.48,s*.05);x.moveTo(-s*.32,-s*.08);x.lineTo(-s*.32,s*.38);x.lineTo(s*.32,s*.38);x.lineTo(s*.32,-s*.08);x.stroke();break;}
    case'credisan':{x.strokeStyle='#ee6b2b';x.lineWidth=s*.16;x.beginPath();x.arc(0,0,s*.36,Math.PI*.25,Math.PI*1.75);x.stroke();break;}
    case'star':{x.fillStyle=c;x.beginPath();for(let i=0;i<10;i++){const r=i%2?s*.2:s*.48,a=-Math.PI/2+i*Math.PI/5;x.lineTo(Math.cos(a)*r,Math.sin(a)*r);}x.closePath();x.fill();break;}
    case'pedrilho':{x.fillStyle='#283b6a';x.beginPath();for(let i=0;i<6;i++){const a=i*Math.PI/3;x.lineTo(Math.cos(a)*s*.48,Math.sin(a)*s*.48);}x.fill();
      x.fillStyle='#f39a23';x.font=`900 ${s*.62}px Arial`;x.textAlign='center';x.textBaseline='middle';x.fillText('P',0,s*.04);break;}
    case'drop':{x.fillStyle=c;x.beginPath();x.moveTo(0,-s*.45);x.quadraticCurveTo(s*.4,s*.1,0,s*.42);x.quadraticCurveTo(-s*.4,s*.1,0,-s*.45);x.fill();break;}
    case'tooth':{x.fillStyle=c;x.beginPath();x.moveTo(-s*.32,-s*.3);x.quadraticCurveTo(0,-s*.45,s*.32,-s*.3);x.lineTo(s*.2,s*.4);x.lineTo(0,s*.05);x.lineTo(-s*.2,s*.4);x.closePath();x.fill();break;}
    case'pin':{brLogo(x,0,0,s*.9);break;}
    case'circle':{x.fillStyle=c;C(s*.45);break;}
  }
  x.restore();
}
const FONT:{[k:string]:string}={sans:'800 {S}px Arial, Helvetica, sans-serif',serif:'700 {S}px Georgia, "Times New Roman", serif',
  script:'italic 700 {S}px "Brush Script MT", "Segoe Script", cursive',stencil:'900 {S}px Impact, "Arial Black", sans-serif',italic:'italic 900 {S}px Arial, sans-serif'};
// a sign's face (canvas): background, frame, logo and the lines of text, scaled to fit
function signTexture(s:Sign):THREE.Texture{
  const PX=96,W=Math.max(32,Math.round(s.w*PX)),H=Math.max(16,Math.round(s.h*PX));
  return canvasTex(W,H,(x,w,h)=>{
    x.fillStyle=s.bg;x.fillRect(0,0,w,h);
    if(s.frame){x.strokeStyle=s.frame;x.lineWidth=Math.max(2,h*.05);x.strokeRect(x.lineWidth/2,x.lineWidth/2,w-x.lineWidth,h-x.lineWidth);}
    let x0=w*.04,x1=w*.96;
    if(s.logo){
      const ls=Math.min(h*.8,w*.3),at=s.logoAt??(s.lines.length?'left':'centre');
      const lx=at==='left'?x0+ls/2:at==='right'?x1-ls/2:w/2;
      logo(x,s.logo,lx,h/2,ls,s.logoC??s.fg);
      if(at==='left')x0+=ls*1.1;else if(at==='right')x1-=ls*1.1;
    }
    const n=s.lines.length;if(!n)return;
    x.fillStyle=s.fg;x.textAlign='center';x.textBaseline='middle';
    const tmpl=FONT[s.font??'sans'];
    s.lines.forEach((line,i)=>{
      const big=n>1&&i===0&&line.length<14?1.25:1,lh=h/n*(n>1?.9:1);
      let size=lh*.7*big;
      x.font=tmpl.replace('{S}',String(size));
      const tw=x.measureText(line).width;if(tw>(x1-x0)*.96){size*=(x1-x0)*.96/tw;x.font=tmpl.replace('{S}',String(size));}
      x.fillText(line,(x0+x1)/2,h*(i+.5)/n+(n>1?(i-(n-1)/2)*-h*.02:0));
    });
  });
}
function addSign(g:THREE.Group,s:Sign):void{
  const d=s.depth??.08,face=matte({map:signTexture(s),emissive:s.lit?0x262626:0x000000});
  const edge=col(s.bg);
  // a blade sign stands out from the wall, its face on both sides; a wall sign faces the street
  const m=new THREE.Mesh(new THREE.BoxGeometry(s.w,s.h,d),[edge,edge,edge,edge,face,s.side?face:edge]);
  if(s.side){m.rotation.y=Math.PI/2;m.position.set(s.x??0,s.y+s.h/2,(s.out??.1)+s.w/2);}
  else m.position.set(s.x??0,s.y+s.h/2,(s.out??.065)+d/2);     // (clear of a parapet's cap, 5 cm out)
  m.castShadow=d>.1;g.add(m);
}

// ---------------- awnings ----------------
function addAwning(g:THREE.Group,a:Awning):void{
  const d=a.depth??(a.kind==='slab'?1.2:1),x=a.x??0;
  if(a.kind==='curved'||a.kind==='glass'){
    // a quarter-round sheet from the wall out and down (the "toldo de alumínio" of every shop)
    const sh=new THREE.CylinderGeometry(d,d,a.w,14,1,true,0,Math.PI/2);sh.rotateZ(Math.PI/2);
    const m=a.kind==='glass'?get('glassAw'+a.c,()=>matte({color:a.c,transparent:true,opacity:.55,side:THREE.DoubleSide,depthWrite:false})):colD(a.c);
    const mesh=new THREE.Mesh(sh,m);mesh.position.set(x,a.y-d*.45,0);mesh.scale.set(1,.45,1);mesh.castShadow=a.kind!=='glass';g.add(mesh);
    for(let i=0;i<=Math.max(2,Math.round(a.w/1.6));i++){const xx=x-a.w/2+i*a.w/Math.max(2,Math.round(a.w/1.6));
      const rib=new THREE.Mesh(new THREE.TorusGeometry(d,.02,4,10,Math.PI/2),col('#e8e8e6'));rib.rotation.y=Math.PI/2;rib.position.set(xx,a.y-d*.45,0);rib.scale.set(1,.45,1);g.add(rib);}
  }else if(a.kind==='lona'){
    const L=Math.hypot(d,.5),p=new THREE.Mesh(new THREE.PlaneGeometry(a.w,L),colD(a.c));p.rotation.x=-Math.PI/2+Math.atan2(.5,d);p.position.set(x,a.y-.25,d/2);p.castShadow=true;g.add(p);
    const val=new THREE.Mesh(new THREE.PlaneGeometry(a.w,.28),a.label?matte({map:signTexture({lines:[a.label],bg:a.c,fg:a.fg??'#ffffff',w:a.w,h:.28,y:0}),side:THREE.DoubleSide}):colD(a.c));
    val.position.set(x,a.y-.64,d);g.add(val);
  }else if(a.kind==='tile'){
    // clay-tile pent roof on timber brackets ("telhadinho")
    const L=Math.hypot(d,.55),tm=get('telhaAw',()=>matte({color:'#b0603f',map:telhaTexture(),side:THREE.DoubleSide}));
    const geo=new THREE.PlaneGeometry(a.w,L),uv=geo.getAttribute('uv') as THREE.BufferAttribute;for(let i=0;i<uv.count;i++)uv.setXY(i,uv.getX(i)*a.w/ROOF_TILE_M,uv.getY(i)*L/ROOF_TILE_M);
    const p=new THREE.Mesh(geo,tm);p.rotation.x=-Math.PI/2+Math.atan2(.55,d);p.position.set(x,a.y+.27,d/2);p.castShadow=true;g.add(p);
    const n=Math.max(2,Math.round(a.w/2));
    for(let i=0;i<=n;i++){const xx=x-a.w/2+.15+i*(a.w-.3)/n;const b=new THREE.Mesh(new THREE.BoxGeometry(.08,.08,d*1.1),col('#5a3b26'));
      b.position.set(xx,a.y-.15,d*.45);b.rotation.x=.55;g.add(b);}
    const fb=new THREE.Mesh(new THREE.BoxGeometry(a.w,.12,.04),col('#6a4630'));fb.position.set(x,a.y,d);g.add(fb);
  }else if(a.kind==='slab'){
    const b=new THREE.Mesh(new THREE.BoxGeometry(a.w,.18,d),col(a.c));b.position.set(x,a.y,d/2);b.castShadow=true;g.add(b);
  }else{
    const p=new THREE.Mesh(new THREE.BoxGeometry(a.w,.05,d),col(a.c));p.position.set(x,a.y,d/2);p.rotation.x=.12;p.castShadow=true;g.add(p);
    const f=new THREE.Mesh(new THREE.BoxGeometry(a.w,.16,.04),col(a.c));f.position.set(x,a.y-.1,d);g.add(f);
  }
}

// ---------------- claddings ----------------
function cladTex(c:Clad):{map:THREE.Texture|null;tile:number;color?:string}{
  switch(c.kind){
    case'pedra':return{map:stoneTexture(),tile:STONE_TILE_M};
    case'azulejo':return{map:gridTex('#ffffff','#b9bcbd',4),tile:.6,color:c.c??'#f1f1ee'};
    case'pastilha':return{map:gridTex('#ffffff','#9da09e',8),tile:.4,color:c.c??'#9cc8a8'};
    case'tijolinho':return{map:brickTex(),tile:1,color:c.c};
    case'granito':return{map:graniteTex(),tile:1.2,color:c.c};
    case'mosaico':return{map:mosaicTex(c.c??'#2c5aa8',c.c2??'#f2c418'),tile:1.2};
    case'ripado':return{map:slatTex(),tile:1,color:c.c??'#9a6a44'};
    case'grafiato':return{map:grafTex(),tile:1.5,color:c.c};
    default:return{map:null,tile:1,color:c.c};
  }
}
const gridTex=(base:string,joint:string,n:number):THREE.Texture=>texCache('grid'+n+joint,()=>canvasTex(128,128,(x,w,h)=>{x.fillStyle=joint;x.fillRect(0,0,w,h);
  for(let j=0;j<n;j++)for(let i=0;i<n;i++){const v=245-((i*7+j*13)%4)*6;x.fillStyle=base==='#ffffff'?`rgb(${v},${v},${v})`:base;x.fillRect(i*w/n+1,j*h/n+1,w/n-2,h/n-2);}}));
const brickTex=():THREE.Texture=>texCache('brick',()=>canvasTex(128,128,(x,w,h)=>{x.fillStyle='#d8cfc3';x.fillRect(0,0,w,h);
  for(let r=0;r<13;r++)for(let i=-1;i<5;i++){const v=((r*5+i*3)%7)*6-18;x.fillStyle=`rgb(${176+v},${92+v/2},${62+v/3})`;x.fillRect(i*w/4+(r%2)*w/8+1,r*h/13+1,w/4-2,h/13-2);}}));
const graniteTex=():THREE.Texture=>texCache('granite',()=>canvasTex(128,128,(x,w,h)=>{x.fillStyle='#2a2a2c';x.fillRect(0,0,w,h);
  for(let i=0;i<1600;i++){const v=40+(i*37)%90;x.fillStyle=`rgb(${v},${v},${v+4})`;x.fillRect((i*53)%w,(i*29+i*i)%h,2,2);}x.fillStyle='rgba(255,255,255,.08)';x.fillRect(0,0,w,h/3);}));
const mosaicTex=(a:string,b:string):THREE.Texture=>texCache('mos'+a+b,()=>canvasTex(128,128,x=>{const cs=[a,b,'#f4f4f2',a,b];
  for(let j=0;j<8;j++)for(let i=0;i<8;i++){x.fillStyle=cs[(i*3+j*7+(i*j)%5)%cs.length];x.fillRect(i*16+1,j*16+1,14,14);}}));
const slatTex=():THREE.Texture=>texCache('slat',()=>canvasTex(64,64,(x,w,h)=>{for(let i=0;i<8;i++){x.fillStyle=i%2?'#e9e9e9':'#bdbdbd';x.fillRect(i*8,0,8,h);}}));
const grafTex=():THREE.Texture=>texCache('graf',()=>canvasTex(128,128,(x,w,h)=>{x.fillStyle='#e6e6e6';x.fillRect(0,0,w,h);
  for(let i=0;i<3000;i++){const v=170+(i*41)%85;x.fillStyle=`rgb(${v},${v},${v})`;x.fillRect((i*67)%w,(i*31+i*7)%h,2,1);}}));
const tc=new Map<string,THREE.Texture>();
const texCache=(k:string,f:()=>THREE.Texture):THREE.Texture=>{let t=tc.get(k);if(!t){t=f();t.wrapS=t.wrapT=THREE.RepeatWrapping;tc.set(k,t);}return t;};
function addClad(g:THREE.Group,c:Clad):void{
  const t=cladTex(c),w=c.x1-c.x0,h=c.y1-c.y0,geo=new THREE.PlaneGeometry(w,h);
  const uv=geo.getAttribute('uv') as THREE.BufferAttribute;for(let i=0;i<uv.count;i++)uv.setXY(i,uv.getX(i)*w/t.tile,uv.getY(i)*h/t.tile);
  const m=get('clad'+c.kind+(c.c??'')+(c.c2??''),()=>matte({color:t.color??'#ffffff',map:t.map??undefined,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2}));
  const p=new THREE.Mesh(geo,m);p.position.set((c.x0+c.x1)/2,(c.y0+c.y1)/2,.025);p.receiveShadow=true;g.add(p);
}

// ---------------- extras ----------------
function addExtra(g:THREE.Group,e:Extra,o:LojaOpts):void{
  const box=(c:string|THREE.Material,w:number,h:number,d:number,x:number,y:number,z:number):THREE.Mesh=>{
    const b=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),typeof c==='string'?col(c):c);b.position.set(x,y+h/2,z);b.castShadow=true;g.add(b);return b;};
  switch(e.t){
    case'carts':for(let i=0;i<e.n;i++){const c=col(e.c??'#c9cbcc'),x=e.x+i*.22;
      const basket=new THREE.Mesh(new THREE.BoxGeometry(.5,.42,.85),get('cartM'+(e.c??''),()=>matte({color:e.c??'#c9cbcc',wireframe:true})));basket.position.set(x,.75,.9);g.add(basket);
      box(c,.04,.55,.04,x,0,.55);box(c,.04,.55,.04,x,0,1.25);}break;
    case'crates':for(let i=0;i<e.n;i++)box(e.c??(i%2?'#e5b521':'#2c2c2c'),.55,.3,.38,e.x+Math.floor(i/3)*.6,(i%3)*.31,.4);break;
    case'bench':box(e.c??'#8a8a86',1.6,.08,.45,e.x,.42,.6);box(e.c??'#8a8a86',.1,.42,.4,e.x-.7,0,.6);box(e.c??'#8a8a86',.1,.42,.4,e.x+.7,0,.6);break;
    case'vase':{const v=new THREE.Mesh(new THREE.CylinderGeometry(.28,.2,.55,10),col('#d9d4c9'));v.position.set(e.x,.27,.45);g.add(v);
      if(e.palm){const p=Palmeira.build({h:.4,seed:Math.round(e.x*7)});p.scale.setScalar(.55);p.position.set(e.x,.5,.45);g.add(p);}
      else{const b=new THREE.Mesh(new THREE.SphereGeometry(.32,8,6),col('#47693a'));b.position.set(e.x,.8,.45);b.scale.y=.8;g.add(b);}break;}
    case'mannequins':for(let i=0;i<e.n;i++){const c=col(e.c?.[i%e.c.length]??'#eeeeec'),x=e.x+i*.55;
      box(c,.3,.7,.18,x,.85,-.6);box(c,.36,.5,.22,x,.4,-.6);const h=new THREE.Mesh(new THREE.SphereGeometry(.1,8,6),col('#eeeeec'));h.position.set(x,1.68,-.6);g.add(h);
      box('#bdbdbd',.04,.4,.04,x,0,-.6);}break;
    case'totem':{const s=e.sign,b=new THREE.Mesh(new THREE.BoxGeometry(e.w,e.h,.35),[col(s.bg),col(s.bg),col(s.bg),col(s.bg),matte({map:signTexture({...s,w:e.w,h:e.h})}),matte({map:signTexture({...s,w:e.w,h:e.h})})]);
      b.position.set(e.x,e.h/2,e.out??1.6);b.castShadow=true;g.add(b);break;}
    case'spots':for(const x of e.xs){box('#202020',.06,.06,.5,x,e.y,.25);const l=new THREE.Mesh(new THREE.BoxGeometry(.22,.16,.12),matte({color:0x2a2a2a,emissive:0x111111}));l.position.set(x,e.y-.05,.55);l.rotation.x=.5;g.add(l);}break;
    case'pergola':{const W=o.w,c=col(e.c);
      for(const x of[-W/2+.2,-W/6,W/6,W/2-.2])box(c,.3,e.h,.3,x,0,e.d);
      box(c,W,.35,.35,0,e.h,e.d);for(let x=-W/2+.4;x<W/2;x+=1)box(c,.15,.25,e.d,x,e.h+.05,e.d/2);break;}
    case'crenel':{const W=o.w,top=(o.f.floors??1)*3+.97;for(let x=-W/2;x<W/2-.4;x+=1.1)box(e.c,.6,.5,.25,x+.3,top,-.1);
      box(e.c2,W,.9,.06,0,top-.9,.03);break;}
    case'gable':{const W=o.w,top=(o.f.floors??1)*3+.97,sh=new THREE.Shape([new THREE.Vector2(-W/2,0),new THREE.Vector2(W/2,0),new THREE.Vector2(0,e.h)]);
      const m=new THREE.Mesh(new THREE.ShapeGeometry(sh),colD(e.c));m.position.set(0,top,-1.5);g.add(m);break;}
    case'tarp':{const p=new THREE.Mesh(new THREE.PlaneGeometry(e.w,e.h,6,4),colD(e.c));const pos=p.geometry.getAttribute('position') as THREE.BufferAttribute;
      for(let i=0;i<pos.count;i++)pos.setZ(i,Math.sin(pos.getX(i)*2)*.04+(pos.getY(i)<-e.h/2+.1?.15:0));p.geometry.computeVertexNormals();p.position.set(e.x,e.h/2+.05,.15);g.add(p);break;}
    case'corrugated':{const W=o.w,h=e.y1-e.y0,geo=new THREE.PlaneGeometry(W,h),uv=geo.getAttribute('uv') as THREE.BufferAttribute;
      for(let i=0;i<uv.count;i++)uv.setXY(i,uv.getX(i)*W,uv.getY(i));
      const m=get('corrF'+e.c,()=>matte({color:e.c,map:corrugatedTexture(),side:THREE.DoubleSide}));const p=new THREE.Mesh(geo,m);p.position.set(0,(e.y0+e.y1)/2,.06);g.add(p);break;}
    case'tower':box(e.c,e.w,e.h,e.w,e.x,(o.f.floors??1)*3+.3,-2);break;
    case'cooler':{const f=e.label?matte({map:signTexture({lines:[e.label],bg:e.c,fg:'#ffffff',w:.8,h:1.7,y:0})}):col(e.c);
      const b=new THREE.Mesh(new THREE.BoxGeometry(.8,1.75,.7),[col(e.c),col(e.c),col(e.c),col(e.c),f,col(e.c)]);b.position.set(e.x,.88,.5);b.castShadow=true;g.add(b);break;}
    case'bollards':for(let x=e.x0;x<=e.x1+.01;x+=1.6){const b=new THREE.Mesh(new THREE.CylinderGeometry(.08,.08,.8,8),col(e.c??'#e3c23a'));b.position.set(x,.4,1.9);g.add(b);}break;
    case'rail':{const y=e.y??0,c=col(e.c);box(c,e.x1-e.x0,.05,.05,(e.x0+e.x1)/2,y+1,.9);for(let x=e.x0;x<=e.x1+.01;x+=.12)box(c,.025,1,.025,x,y,.9);break;}
    case'motos':for(let i=0;i<e.n;i++){const m=new THREE.Group(),c=['#c42b2b','#1d1d1d','#2a4fa0','#e8e6df'][i%4];
      m.position.set(e.x+i*.9,0,1.45);m.rotation.y=Math.PI/2+.25;g.add(m);   // (on the 2.1 m sidewalk)
      for(const wx of[-.65,.65]){const w=new THREE.Mesh(new THREE.TorusGeometry(.28,.07,6,14),col('#151515'));w.position.set(wx,.32,0);m.add(w);}
      const b=new THREE.Mesh(new THREE.BoxGeometry(1,.3,.28),col(c));b.position.set(0,.65,0);m.add(b);
      const t=new THREE.Mesh(new THREE.BoxGeometry(.45,.22,.3),col(c));t.position.set(.2,.85,0);m.add(t);
      const s2=new THREE.Mesh(new THREE.BoxGeometry(.55,.1,.26),col('#1d1d1d'));s2.position.set(-.2,.86,0);m.add(s2);
      const h=new THREE.Mesh(new THREE.BoxGeometry(.05,.05,.7),col('#2a2a2a'));h.position.set(.55,1.05,0);m.add(h);}break;
    case'balls':for(let i=0;i<e.n;i++){const b=new THREE.Mesh(new THREE.SphereGeometry(.12,10,8),col(['#f2c418','#e8e6df','#d42c2c','#2a4fa0','#3a9a4a','#ee7a2a'][i%6]));
      b.position.set(e.x+(i%2)*.26,2.3-Math.floor(i/2)*.26,.18);g.add(b);}box('#2a2a2a',.02,.02,.2,e.x+.13,2.45,.08);break;
    case'racks':{const c=e.c??['#c43c5a','#3b6fb0','#e9e6e0','#2a2a2a','#e8b421'];box('#9a9c9e',1.2,.03,.03,e.x,1.5,1);
      for(const sx of[-.6,.6])box('#9a9c9e',.03,1.5,.03,e.x+sx,0,1);
      for(let i=0;i<9;i++)box(c[i%c.length],.1,.75,.4,e.x-.5+i*.125,.72,1);break;}
    case'sacks':for(let i=0;i<e.n;i++){const s3=new THREE.Mesh(new THREE.BoxGeometry(.6,.2,.42),col(e.c??(i%2?'#e8e2cf':'#cfd8c2')));
      s3.position.set(e.x+Math.floor(i/4)*.65,.1+(i%4)*.2,.45);g.add(s3);}break;
    case'aframe':{const m=matte({map:signTexture({lines:e.lines,bg:e.bg??'#1d1d1d',fg:e.fg??'#f2f2ee',w:.6,h:.9,y:0,font:'script'})});
      for(const sd of[-1,1]){const p=new THREE.Mesh(new THREE.PlaneGeometry(.6,.9),m);p.position.set(e.x,.45,1.4+sd*.14);p.rotation.set(sd*.18,sd<0?Math.PI:0,0,'YXZ');g.add(p);}break;}
    case'plants':for(let x=e.x0;x<=e.x1+.01;x+=1.1){const v=new THREE.Mesh(new THREE.CylinderGeometry(.22,.16,.4,10),col('#a0583a'));v.position.set(x,.2,.35);g.add(v);
      const b=new THREE.Mesh(new THREE.SphereGeometry(.3,8,6),col('#4a7a3a'));b.position.set(x,.62,.35);b.scale.set(1,.85,1);g.add(b);}break;
    case'drums':for(let i=0;i<e.n;i++){const d=new THREE.Mesh(new THREE.CylinderGeometry(.29,.29,.88,12),col(e.c??'#2d5aa0'));d.position.set(e.x+i*.62,.44,.5);g.add(d);}break;
    case'bin':{const b=new THREE.Mesh(new THREE.CylinderGeometry(.2,.2,.75,12,1,true),get('binM'+(e.c??''),()=>matte({color:e.c??'#3a9a4a',wireframe:true})));
      b.position.set(e.x,.95,1.75);g.add(b);box('#3a9a4a',.05,.6,.05,e.x,0,1.75);break;}
  }
}

// the goods a kind of business shows through its windows and doors
const THEME:{[k in Kind]:Interior}={supermercado:'super',banco:'banco',loja:'roupa',farmacia:'farma',construcao:'casa',servico:'geral'};
export function buildLoja(o:LojaOpts):THREE.Group{
  const theme=o.theme??(o.kind?THEME[o.kind]:'geral');
  // the ground-floor shop windows become see-through, with the shop's room behind them
  const open:Op[]=(o.f.open??[]).map(op=>!(op.fl??0)&&op.t==='glass'&&(op.y??.5)<.9&&(op.h??1.9)>1.4?{...op,t:'vitrine' as const,c:theme}
    :op.t==='open'&&!op.c?{...op,c:theme}:op);
  const g=buildFachada({...o.f,open,w:o.w,base:o.base??o.f.base,seed:o.seed});
  const s=o.shop,front=new THREE.Group();front.position.z=-(o.f.setback??0);g.add(front);
  // a sign or an awning that would run into the balcony slab over the shop (fachada.ts: the
  // slab hangs 0.2 m under the upper floor and reaches `depth` out) goes under it instead
  const bal=o.f.balcony,slab=bal?{y0:bal.fl*3-.2,x0:bal.x-bal.w/2,x1:bal.x+bal.w/2,dp:bal.depth??1.1}:null;
  const under=(x:number,w:number,y0:number,y1:number,out:number):boolean=>!!slab&&x+w/2>slab.x0&&x-w/2<slab.x1&&y1>slab.y0-.02&&y0<slab.y0+.2&&out<slab.dp;
  const fitSign=(sg:Sign):Sign=>{
    if(sg.side||!under(sg.x??0,sg.w,sg.y,sg.y+sg.h,sg.out??.04))return sg;
    const top=slab!.y0-.04,h=Math.min(sg.h,Math.max(.3,top-2.15));
    return{...sg,y:top-h,h};
  };
  const fitAwning=(a:Awning):Awning=>under(a.x??0,a.w,a.y-.3,a.y+.5,0)?{...a,y:Math.min(a.y,slab!.y0-.5)}:a;
  for(const c of s.clad??[])addClad(front,c);
  for(const a of s.awnings??[])addAwning(front,fitAwning(a));
  for(const sg of s.signs??[])addSign(front,fitSign(sg));
  for(const e of s.extras??[])addExtra(front,e,o);
  details(front,o,open);
  return g;
}

// The small things every shop front in town has, placed deterministically from the seed:
// a granite step at each door, the number plate, the card / PIX stickers and the
// opening-hours plate on the glass, an AC unit, a security camera under the eaves, the
// rainwater downpipe at one end; and by trade: a green litter bin and trolleys for the
// supermarkets, the lit green-cross blade sign of a pharmacy, bollards in front of a bank.
function details(g:THREE.Group,o:LojaOpts,open:Op[]):void{
  const seed=o.seed??Math.round(o.w*7),r=(i:number):number=>{const v=Math.sin(seed*12.9898+i*78.233)*43758.5453;return v-Math.floor(v);};
  const W=o.w,fl=o.f.floors??1,ground=open.filter(op=>!(op.fl??0));
  const box=(c:string,w:number,h:number,d:number,x:number,y:number,z:number):THREE.Mesh=>{
    const b=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),col(c));b.position.set(x,y+h/2,z);g.add(b);return b;};
  const doors=ground.filter(op=>op.t==='open'||op.t==='door'||op.t==='vitrine'&&op.w<2.4);
  for(const d of doors)box('#cfccc4',d.w+.2,.06,.35,d.x,-.04,.17);                    // the step
  const d0=doors[0]??ground[0];
  if(d0){
    const nx=Math.min(W/2-.2,d0.x+d0.w/2+.3);
    box('#2c3e66',.26,.16,.02,nx,2.05,.01);box('#f2f2f2',.16,.06,.025,nx,2.1,.01);      // number plate
    box('#e9e6dc',.28,.36,.01,nx,1.4,.01);box('#3a3a3a',.2,.03,.012,nx,1.62,.01);       // opening hours
  }
  for(const[i,v]of ground.filter(op=>op.t==='vitrine').entries()){                     // stickers on the glass
    const sx=v.x-v.w/2+.25+r(i)*.3;
    box(i%2?'#32bcad':'#1d3f8a',.18,.12,.005,sx,1.1,-.12);box('#f2c418',.18,.12,.005,sx+.22,1.1,-.12);
    if(r(i+5)>.4)box(r(i+9)>.5?'#e8302c':'#f2c418',.55,.4,.005,v.x+v.w/2-.45,1.5,-.12);
  }
  // AC unit: on the upper floor, or high on the shop front
  if(r(11)>.35){const ax=(r(12)-.5)*(W-2),ay=fl>1?4.6:2.35;box('#ecebe6',.8,.5,.28,ax,ay,.14);
    const f=new THREE.Mesh(new THREE.CircleGeometry(.17,12),col('#5a5d60'));f.position.set(ax+.15,ay+.25,.285);g.add(f);
    box('#e0ddd6',.05,ay,.05,ax-.32,0,.03);}
  box('#2b2b2b',.12,.12,.2,W/2-.3,2.75,.1);box('#d9d9d6',.1,.1,.08,W/2-.3,2.7,.24);    // camera
  box('#8f9294',.1,fl*3+.4,.1,r(13)>.5?W/2-.08:-W/2+.08,-.2,.06);                     // downpipe
  const has=(t:string):boolean=>(o.shop.extras??[]).some(e=>e.t===t);
  if(o.kind==='supermercado'){
    if(!has('bin'))addExtra(g,{t:'bin',x:W/2-1},o);
    if(!has('carts'))addExtra(g,{t:'carts',x:-W/2+.6,n:3,c:'#b8bcbf'},o);
  }
  if(o.kind==='farmacia'&&!(o.shop.signs??[]).some(sg=>sg.side))
    addSign(g,{lines:[''],bg:'#2f9a52',fg:'#ffffff',x:-W/2+.4,y:2.6,w:.8,h:.8,side:true,logo:'cross',logoC:'#ffffff',logoAt:'centre',lit:true});
  if(o.kind==='banco'&&!has('bollards'))addExtra(g,{t:'bollards',x0:-W/2+1,x1:W/2-1,c:'#9a9c9e'},o);
  if(o.kind==='loja'&&r(17)>.7&&!has('aframe'))addExtra(g,{t:'aframe',x:W/2-1.2,lines:['PROMOÇÃO','10x sem juros']},o);
}

function build():THREE.Group{
  return buildLoja({w:12,f:{floors:2,wall:'#9fd1b4',upper:'#9fd1b4',roof:'flat',parapet:true,
    open:[{t:'open',x:-2,w:3.6,h:2.6},{t:'glass',x:3,w:3.6,y:.05,h:2.6},{t:'window',x:-3,w:2.4,fl:1},{t:'window',x:3,w:2.4,fl:1}]},
    shop:{signs:[{lines:['SUPERMERCADO','EXEMPLO'],bg:'#ffffff',fg:'#1f3a6e',y:3.1,w:11,h:1.2,logo:'cart',logoC:'#2f8a4e'}],
      awnings:[{kind:'curved',c:'#f2f2ee',w:11,y:2.85}],extras:[{t:'carts',x:-5,n:5,c:'#c7302c'}]}});
}
export default {category:'Divinolândia',label:'Loja (comércio real)',build};
