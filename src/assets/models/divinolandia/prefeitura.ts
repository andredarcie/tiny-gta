import * as THREE from 'three';
import {matte} from '../matte.ts';
import {DIVINO} from '@/core/palette.ts';

// Prefeitura Municipal de Divinolândia — Rua XV de Novembro, modelled from Google Street
// View (panoramas SGqi-j3SSfA-ri1jDv0C5A in front, kMP4DgpGKRrTN3gnpdJUVA to the SE and
// 9UE7RObTTHAmwuozhPU8IA to the SW, captured with tools/capture-streetview.ts; images kept
// locally in docs/divinolandia/referencias-streetview/prefeitura*/). A one-storey civic
// compound in royal-blue limewash under clay-tile hipped roofs, laid out as an L:
//   - the PAVILION on the west, deep, reaching the pavement: an open white porch behind two
//     wide arches, faint lettering on the frieze, a red stripe under the white eaves, four
//     blue-edged steps on the pavement and three barred windows along its east side; its
//     roof is two-tiered (a clay skirt, a white band, then the upper hip);
//   - behind a paved forecourt + car park, the MAIN BLOCK with the round-headed door,
//     reached by a ramp with red tubular railings that runs along the pavilion;
//   - the EAST WING, a recessed white veranda behind three arches (glass door, main door,
//     open end with a balustrade), with the same two-tier roof;
//   - three FLAGPOLES (São Paulo, Brasil, Divinolândia) at the wing's corner.
// build() is pure; the street front faces +z, x = east (the pavilion is at -x). The
// origin is at street level under the middle of the lot; PREF_FOOT are its collision
// boxes [cx, cz, w, d, height] in this frame.
const FL=.9,FW=.45;                             // floor level of the raised rooms / of the east veranda
const blueM=matte({color:DIVINO.civicBlue}),whiteM=matte({color:DIVINO.civicWhite});
const soffitM=matte({color:DIVINO.civicWhite,emissive:0x5e5c57}),stripeM=matte({color:DIVINO.civicStripe}),railM=matte({color:DIVINO.railing});
const treadM=matte({color:DIVINO.stepTread}),glassM=matte({color:0x56646e}),frameM=matte({color:0x2a2a2e});
const roofM=matte({map:tileTexture(),flatShading:true}),poleM=matte({color:0xdedede});
const paverM=matte({map:paverTexture()}),lineM=matte({color:0xd9b23a});

export const PREF_FOOT:[number,number,number,number,number][]=[
  [-11,9,10,7.6,FL+3.4],      // pavilion
  [-6.5,-4.5,19,19,FL+3.6],   // main block
  [9.5,-3.6,13,15.2,FL+3.6],  // east wing rooms (the veranda in front stays walkable)
];

function box(g:THREE.Group,m:THREE.Material,w:number,h:number,d:number,x:number,y:number,z:number):THREE.Mesh{
  const b=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m);b.position.set(x,y+h/2,z);b.castShadow=true;b.receiveShadow=true;g.add(b);return b;
}

// a flat wall (in the x-y plane, facing +z) pierced by openings: wide and flat-topped
// with rounded upper corners of radius r (the real arcade), or fully round-headed (r=w/2)
function arcadeWall(w:number,h:number,t:number,holes:{x:number;w:number;h:number;r?:number}[]):THREE.BufferGeometry{
  const s=new THREE.Shape();s.moveTo(-w/2,0);s.lineTo(w/2,0);s.lineTo(w/2,h);s.lineTo(-w/2,h);s.closePath();
  for(const o of holes){
    const hw=o.w/2,r=Math.min(o.r??hw,hw),p=new THREE.Path();
    p.moveTo(o.x-hw,0);p.lineTo(o.x-hw,o.h-r);
    p.absarc(o.x-hw+r,o.h-r,r,Math.PI,Math.PI/2,true);
    p.lineTo(o.x+hw-r,o.h);
    p.absarc(o.x+hw-r,o.h-r,r,Math.PI/2,0,true);
    p.lineTo(o.x+hw,0);p.closePath();
    s.holes.push(p);
  }
  const geo=new THREE.ExtrudeGeometry(s,{depth:t,bevelEnabled:false,curveSegments:10});
  geo.translate(0,0,-t/2);
  return geo;
}

// hipped clay roof over a w×d rectangle: eave at y, rising `rise` to a ridge along the long side
function hipRoof(w:number,d:number,rise:number):THREE.BufferGeometry{
  const hw=w/2,hd=d/2,along=w>=d,r=along?hw-hd:hd-hw;
  const A=[-hw,0,-hd],B=[hw,0,-hd],C=[hw,0,hd],D=[-hw,0,hd];
  const R1=along?[-r,rise,0]:[0,rise,-r],R2=along?[r,rise,0]:[0,rise,r];
  const tris=along
    ?[[D,C,R2],[D,R2,R1],[B,A,R1],[B,R1,R2],[A,D,R1],[C,B,R2]]
    :[[A,R1,B],[C,R2,D],[D,R2,R1],[D,R1,A],[B,R1,R2],[B,R2,C]];
  const pos:number[]=[],uv:number[]=[];
  for(const t of tris){
    // tile rows run along the eave: map each face by its own downhill direction
    const nx=(t[1][1]-t[0][1])*(t[2][2]-t[0][2])-(t[1][2]-t[0][2])*(t[2][1]-t[0][1]);
    const nz=(t[1][0]-t[0][0])*(t[2][1]-t[0][1])-(t[1][1]-t[0][1])*(t[2][0]-t[0][0]);
    const alongX=Math.abs(nz)>=Math.abs(nx);
    for(const v of t){pos.push(...v);uv.push(alongX?v[0]/1.2:v[2]/1.2,(alongX?Math.abs(v[2]):Math.abs(v[0]))/.45);}
  }
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));
  geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
  geo.computeVertexNormals();
  return geo;
}
const OVER=.6;
// hipped roof over a wall rectangle (cx,cz,w,d) whose head is at y: clay hip out to the
// overhang, the white soffit under it and the thin red stripe along the wall head
function roof(g:THREE.Group,cx:number,cz:number,w:number,d:number,y:number,rise:number):void{
  const m=new THREE.Mesh(hipRoof(w+2*OVER,d+2*OVER,rise),roofM);m.position.set(cx,y,cz);m.castShadow=true;g.add(m);
  const sf=new THREE.Mesh(new THREE.BoxGeometry(w+2*OVER,.1,d+2*OVER),soffitM);sf.position.set(cx,y-.05,cz);g.add(sf);
  const st=new THREE.Mesh(new THREE.BoxGeometry(w+.06,.12,d+.06),stripeM);st.position.set(cx,y-.3,cz);g.add(st);
}
// the two-tier roof of the pavilion and the east wing: a shallow clay skirt, a short
// white band, then the upper hip
function roof2(g:THREE.Group,cx:number,cz:number,w:number,d:number,y:number):void{
  roof(g,cx,cz,w,d,y,1.1);
  const bw=w-1.6,bd=d-1.6;
  box(g,whiteM,bw,.4,bd,cx,y+.7,cz);
  const m=new THREE.Mesh(hipRoof(bw+1.4,bd+1.4,2.1),roofM);m.position.set(cx,y+1.15,cz);m.castShadow=true;g.add(m);
  const sf=new THREE.Mesh(new THREE.BoxGeometry(bw+1.4,.08,bd+1.4),soffitM);sf.position.set(cx,y+1.11,cz);g.add(sf);
}

// weathered capa-e-canal clay tiles: one course per texture row, darker joints, soiled patches
function tileTexture():THREE.CanvasTexture{
  const c=document.createElement('canvas');c.width=64;c.height=64;const x=c.getContext('2d')!;
  const hex=(n:number)=>'#'+n.toString(16).padStart(6,'0');
  x.fillStyle=hex(DIVINO.civicRoof);x.fillRect(0,0,64,64);
  for(let r=0;r<4;r++)for(let k=0;k<4;k++){
    const ox=(r%2)*8,shade=[0,.06,-.05,.03][(r*3+k)%4];
    x.fillStyle=shade>0?`rgba(255,220,190,${shade})`:`rgba(40,20,10,${-shade})`;x.fillRect(k*16+ox,r*16,16,16);
    x.fillStyle='rgba(50,25,15,.35)';x.fillRect(k*16+ox,r*16,2,16);
  }
  x.fillStyle='rgba(45,22,14,.45)';for(let r=0;r<4;r++)x.fillRect(0,r*16+13,64,3);
  const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.wrapS=t.wrapT=THREE.RepeatWrapping;
  t.magFilter=THREE.NearestFilter;
  return t;
}

function paverTexture():THREE.CanvasTexture{
  const c=document.createElement('canvas');c.width=c.height=128;const x=c.getContext('2d')!;
  const hex=(n:number)=>'#'+n.toString(16).padStart(6,'0');
  x.fillStyle=hex(DIVINO.pavers);x.fillRect(0,0,128,128);
  x.strokeStyle=hex(DIVINO.paversDark);x.lineWidth=2;
  for(let r=0;r<8;r++)for(let k=0;k<4;k++){const ox=(r%2)*16;x.strokeRect(k*32+ox-32,r*16,32,16);x.strokeRect(k*32+ox,r*16,32,16);}
  const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(5,4);
  return t;
}

function signTexture():THREE.CanvasTexture{
  const c=document.createElement('canvas');c.width=1024;c.height=64;const x=c.getContext('2d')!;
  x.fillStyle='rgba(225,232,245,.55)';x.font='600 30px serif';x.textAlign='center';x.textBaseline='middle';
  x.fillText('PREFEITURA MUNICIPAL DE DIVINOLÂNDIA',512,34);
  const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return t;
}

// the three flags of the forecourt, painted on canvas
function flagTexture(kind:'sp'|'br'|'div'):THREE.CanvasTexture{
  const c=document.createElement('canvas');c.width=192;c.height=128;const x=c.getContext('2d')!;
  if(kind==='br'){
    x.fillStyle='#1f8a3c';x.fillRect(0,0,192,128);
    x.fillStyle='#f2c818';x.beginPath();x.moveTo(96,12);x.lineTo(180,64);x.lineTo(96,116);x.lineTo(12,64);x.fill();
    x.fillStyle='#22408c';x.beginPath();x.arc(96,64,30,0,Math.PI*2);x.fill();
    x.strokeStyle='#f1efe8';x.lineWidth=4;x.beginPath();x.arc(96,98,44,-2.3,-.84);x.stroke();
  }else if(kind==='sp'){
    for(let i=0;i<13;i++){x.fillStyle=i%2?'#f1efe8':'#1b1b1b';x.fillRect(0,i*128/13,192,128/13+1);}
    x.fillStyle='#c62a2a';x.fillRect(0,0,80,59);
    x.fillStyle='#f1efe8';x.beginPath();x.arc(40,29,19,0,Math.PI*2);x.fill();
    x.fillStyle='#22408c';x.beginPath();x.moveTo(40,14);x.lineTo(52,29);x.lineTo(40,44);x.lineTo(28,29);x.fill();
  }else{
    const bands=['#a8312c','#f1efe8','#2a4c8f','#f1efe8','#a8312c'];
    bands.forEach((b,i)=>{x.fillStyle=b;x.fillRect(0,i*128/5,192,128/5+1);});
    x.fillStyle='#2a4c8f';x.fillRect(74,10,44,108);
    x.fillStyle='#f1efe8';x.beginPath();x.arc(96,64,30,0,Math.PI*2);x.fill();
    x.strokeStyle='#1b1b1b';x.lineWidth=5;x.beginPath();x.arc(96,64,30,0,Math.PI*2);x.stroke();
    x.fillStyle='#2f78b8';x.fillRect(86,58,20,16);x.fillStyle='#c62a2a';x.fillRect(86,52,20,6);
  }
  const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return t;
}

// a round-headed door: dark glass in a white surround
function door(g:THREE.Group,x:number,y:number,z:number,w:number,h:number):void{
  const sur=new THREE.Mesh(arcadeWall(w+.6,h+.35,.12,[]),whiteM);sur.position.set(x,y,z);g.add(sur);
  const s=new THREE.Shape();const r=w/2;s.moveTo(-r,0);s.lineTo(-r,h-r);s.absarc(0,h-r,r,Math.PI,0,true);s.lineTo(r,0);s.closePath();
  const gl=new THREE.Mesh(new THREE.ShapeGeometry(s,10),glassM);gl.position.set(x,y,z+.07);g.add(gl);
  const bar=new THREE.Mesh(new THREE.BoxGeometry(.06,h-.1,.02),frameM);bar.position.set(x,y+(h-.1)/2,z+.08);g.add(bar);
}
function windowAt(g:THREE.Group,x:number,y:number,z:number,w:number,h:number):void{
  const f=new THREE.Mesh(new THREE.BoxGeometry(w+.2,h+.2,.08),whiteM);f.position.set(x,y+h/2,z);g.add(f);
  const gl=new THREE.Mesh(new THREE.PlaneGeometry(w,h),glassM);gl.position.set(x,y+h/2,z+.05);g.add(gl);
  // the white security bars of the real windows
  for(let k=1;k<5;k++){const b=new THREE.Mesh(new THREE.BoxGeometry(w,.035,.03),whiteM);b.position.set(x,y+h*k/5,z+.08);g.add(b);}
  const v=new THREE.Mesh(new THREE.BoxGeometry(.05,h,.03),whiteM);v.position.set(x,y+h/2,z+.08);g.add(v);
}
// red tubular railing between two points (posts every ~1.2 m + top and mid rails)
function railing(g:THREE.Group,ax:number,ay:number,az:number,bx:number,by:number,bz:number):void{
  const n=Math.max(2,Math.round(Math.hypot(bx-ax,bz-az)/1.2));
  for(let i=0;i<=n;i++){const t=i/n;const p=new THREE.Mesh(new THREE.CylinderGeometry(.03,.03,.95,6),railM);
    p.position.set(ax+(bx-ax)*t,ay+(by-ay)*t+.47,az+(bz-az)*t);g.add(p);}
  for(const hy of[.95,.5]){
    const a=new THREE.Vector3(ax,ay+hy,az),b=new THREE.Vector3(bx,by+hy,bz),len=a.distanceTo(b);
    const r=new THREE.Mesh(new THREE.CylinderGeometry(.035,.035,len,6),railM);
    r.position.copy(a).lerp(b,.5);r.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),b.clone().sub(a).normalize());g.add(r);
  }
}

// an arcade wall facing +z (or turned by ry), the openings as in arcadeWall()
function arcade(g:THREE.Group,w:number,h:number,t:number,holes:{x:number;w:number;h:number;r?:number}[],x:number,y:number,z:number,ry=0):void{
  const a=new THREE.Mesh(arcadeWall(w,h,t,holes),blueM);a.position.set(x,y,z);a.rotation.y=ry;a.castShadow=true;a.receiveShadow=true;g.add(a);
}
function flagpoles(g:THREE.Group,z:number):void{
  ([['sp',1.2],['br',2.1],['div',3.0]] as ['sp'|'br'|'div',number][]).forEach(([k,x],i)=>{
    const h=9.6-i*.25,p=new THREE.Mesh(new THREE.CylinderGeometry(.05,.07,h,8),poleM);p.position.set(x,h/2,z);g.add(p);
    const f=new THREE.Mesh(new THREE.PlaneGeometry(1.5,1),matte({map:flagTexture(k),side:THREE.DoubleSide}));
    f.position.set(x+.77,h-.6,z);g.add(f);
  });
}

function build():THREE.Group{
  const g=new THREE.Group();
  // ---- forecourt + car park: clay pavers out to the kerb, yellow bay lines
  {
    const court=new THREE.Mesh(new THREE.PlaneGeometry(22,14),paverM);
    court.rotation.x=-Math.PI/2;court.position.set(5,.03,12);court.receiveShadow=true;g.add(court);
    const apron=new THREE.Mesh(new THREE.PlaneGeometry(10.4,2.6),paverM);
    apron.rotation.x=-Math.PI/2;apron.position.set(-11,.03,15.9);apron.receiveShadow=true;g.add(apron);
    for(let k=0;k<6;k++){const l=new THREE.Mesh(new THREE.BoxGeometry(.12,.02,4.6),lineM);l.position.set(3.6+k*2.5,.045,10.6);g.add(l);}
  }

  // ---- MAIN BLOCK: x -16..3, z -14..5; the door just east of the pavilion
  box(g,blueM,19,FL+3.6,19,-6.5,0,-4.5);
  roof(g,-6.5,-4.5,19,19,FL+3.6,2.6);
  door(g,-3.1,FL,5.02,1.3,2.4);
  {const v=new THREE.Group();windowAt(v,0,0,0,.8,.5);v.position.set(-5.1,FL+1.9,5.03);g.add(v);}
  box(g,whiteM,.12,FL+3.5,.12,-5.86,0,5.1);                          // downspout at the corner
  // landing at the door + steps down to the courtyard
  box(g,blueM,4.6,FL,2.2,-3.7,0,6.1);
  for(let k=0;k<3;k++)box(g,treadM,1.6,FL-(k+1)*.225,.3,-.6,0,5.9+k*.3);
  // the ramp up along the pavilion: from the pavement to the landing
  {
    const L=5.6,z0=7.2,sh=new THREE.Shape();sh.moveTo(0,0);sh.lineTo(L,0);sh.lineTo(0,FL);sh.closePath();
    const wedge=new THREE.Mesh(new THREE.ExtrudeGeometry(sh,{depth:1.4,bevelEnabled:false}),blueM);
    wedge.rotation.y=-Math.PI/2;wedge.position.set(-5.9,0,z0);g.add(wedge);       // runs +z, high end at z0
    const top=new THREE.Mesh(new THREE.BoxGeometry(1.4,.04,Math.hypot(L,FL)),paverM);
    top.position.set(-5.2,FL/2+.02,z0+L/2);top.rotation.x=Math.atan2(FL,L);g.add(top);
    railing(g,-5.85,FL,z0,-5.85,0,z0+L);railing(g,-4.55,FL,z0,-4.55,0,z0+L);
  }

  // ---- PAVILION: x -16..-6, z 5..13; open porch z 9.6..13
  box(g,blueM,10,FL+.02,7.8,-11,0,8.9);                                // plinth
  arcade(g,10,3.4,.35,[{x:-2.5,w:4.3,h:2.65,r:.75},{x:2.5,w:4.3,h:2.65,r:.75}],-11,FL,12.82);
  box(g,blueM,.35,3.4,7.8,-15.83,FL,8.9);                             // west side wall
  box(g,blueM,.35,3.4,4.4,-6.17,FL,7.2);                              // east side wall (rooms)
  arcade(g,3.4,3.4,.35,[{x:0,w:1.9,h:2.65}],-6.17,FL,11.1,Math.PI/2);  // east side arch onto the forecourt
  for(const z of[5.9,7.3,8.7]){const wg=new THREE.Group();windowAt(wg,0,0,0,.95,1.05);wg.position.set(-5.95,FL+1.1,z);wg.rotation.y=Math.PI/2;g.add(wg);}
  box(g,whiteM,9.3,3.4,.2,-11,FL,9.5);                                // white porch back wall
  box(g,whiteM,.1,3.3,3.2,-15.6,FL,11.2);box(g,whiteM,.1,3.3,3.2,-6.4,FL,11.2);
  box(g,whiteM,9.3,.12,3.4,-11,FL+3.28,11.2);                          // porch ceiling
  // the porch's glass door: a plain rectangle with a dark steel grid
  {const f=new THREE.Mesh(new THREE.BoxGeometry(2.0,2.55,.06),frameM);f.position.set(-10,FL+1.275,9.62);g.add(f);
   const gl=new THREE.Mesh(new THREE.PlaneGeometry(1.8,2.4),glassM);gl.position.set(-10,FL+1.25,9.66);g.add(gl);
   for(const yy of[.8,1.6])box(g,frameM,1.8,.04,.02,-10,FL+yy,9.68);
   box(g,frameM,.04,2.4,.02,-10,FL+.05,9.68);}
  {const tag=new THREE.Mesh(new THREE.PlaneGeometry(1.1,.75),matte({map:flagTexture('div')}));tag.position.set(-7.6,FL+1.8,9.62);g.add(tag);}
  {const f=new THREE.Mesh(new THREE.PlaneGeometry(9,.45),matte({map:signTexture(),transparent:true}));f.position.set(-11,FL+3.05,13.01);g.add(f);}
  roof2(g,-11,8.9,10,7.8,FL+3.4);
  // the four steps up to the porch, all along the front
  for(let k=0;k<4;k++){
    const top=FL-k*.225,d=.4;
    box(g,blueM,10.4,top-.02,d,-11,0,13+.2+k*d);                       // blue riser block
    const t=new THREE.Mesh(new THREE.BoxGeometry(10.4,.04,d),treadM);t.position.set(-11,top-.02,13+.2+k*d);g.add(t);
  }

  // ---- EAST WING: x 3..16, z -11..7; a white veranda (z 3.8..7) behind three arches
  box(g,blueM,13,FW,3.2,9.5,0,5.4);                                   // veranda floor
  box(g,treadM,12.4,.03,3,9.5,FW,5.4);
  box(g,blueM,13,FL+3.6,14.8,9.5,0,-3.6);                             // rooms behind
  box(g,whiteM,12.4,FL+3.2-FW,.1,9.5,FW,3.85);                        // white veranda back wall
  arcade(g,13,FL+3.6-FW,.35,[{x:-4.6,w:2.4,h:2.55,r:.9},{x:-.8,w:4.2,h:2.65,r:.8},{x:4.2,w:4.6,h:2.65,r:.8}],9.5,FW,6.82);
  box(g,whiteM,12.4,.1,3.2,9.5,FL+3.5,5.4);                           // veranda ceiling
  // open east end: a white balustrade under a blue lintel
  box(g,whiteM,.25,.9,3,15.85,FW,5.4);box(g,blueM,.3,1.1,3.2,15.85,FL+2.5,5.4);
  {const gl=new THREE.Mesh(new THREE.PlaneGeometry(1.6,2.3),glassM);gl.position.set(4.9,FW+1.15,3.92);g.add(gl);}
  {const d=new THREE.Mesh(new THREE.PlaneGeometry(1.4,2.3),frameM);d.position.set(9.4,FW+1.15,3.92);g.add(d);}
  box(g,matte({color:0x8a6a4a}),1.8,.45,.45,11.3,FW,4.3);               // bench
  for(let k=0;k<2;k++)box(g,treadM,4,FW-k*.225,.35,8.7,0,7.2+k*.35);   // steps to the middle arch
  for(const x of[6.3,11.05])box(g,whiteM,.12,FL+3.5,.12,x,0,7.05);     // downspouts on the pillars
  roof2(g,9.5,1.8,13,10.4,FL+3.6);

  flagpoles(g,7.4);
  return g;
}

export default {category:'Divinolândia',label:'Prefeitura Municipal',build};
