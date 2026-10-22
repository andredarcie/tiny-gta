import * as THREE from 'three';

// Procedural canvas textures for Divinolândia's surfaces — the photoreal art direction's
// material detail (grain, wear, joints, weathering), painted in code from what the town's
// photos show (no image files are loaded: the game ships no binary assets). Drawn once,
// tiled with RepeatWrapping; geometry supplies UVs in metres (1 texture tile = TILE_M m).
// The "multiply" textures (terrain, asphalt, dirt, foliage) are near-white detail that the
// surface colour multiplies, so the palette still sets the colour.
const cache=new Map<string,THREE.CanvasTexture>();
// linear=true: a "multiply" detail map whose pixel values are used as-is (no sRGB decode),
// so a pixel of 217 multiplies the colour by 0.85 exactly
function make(key:string,size:number,paint:(x:CanvasRenderingContext2D,s:number)=>void,linear=false):THREE.CanvasTexture{
  const hit=cache.get(key);if(hit)return hit;
  // outside a browser (Node unit tests build the geometry) there is no canvas: blank texture
  if(typeof document==='undefined')return new THREE.Texture() as THREE.CanvasTexture;
  const c=document.createElement('canvas');c.width=c.height=size;
  paint(c.getContext('2d')!,size);
  const t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.colorSpace=linear?THREE.NoColorSpace:THREE.SRGBColorSpace;t.anisotropy=4;
  cache.set(key,t);return t;
}
// deterministic noise so every load paints the same pattern
function rng(seed:number):()=>number{let a=seed>>>0;return()=>{a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}

// Irregular flagstone cladding (pedra São Tomé / Miracema style): pale grey-beige slabs
// of random polygon shapes separated by dark mortar joints. 1 tile = 2 m.
export const STONE_TILE_M=2;
export function stoneTexture():THREE.CanvasTexture{
  return make('stone',256,(x,s)=>{
    const r=rng(7);
    x.fillStyle='#5d5a55';x.fillRect(0,0,s,s);
    const cells=7;
    for(let j=0;j<cells;j++)for(let i=0;i<cells;i++){
      const cx=(i+.5+(r()-.5)*.5)*s/cells,cy=(j+.5+(r()-.5)*.5)*s/cells,R=s/cells*.62;
      const n=5+Math.floor(r()*3),g=150+Math.floor(r()*55),warm=Math.floor(r()*14);
      x.fillStyle=`rgb(${g+warm},${g+warm*.6|0},${g-6})`;
      x.beginPath();
      for(let k=0;k<n;k++){const a=k/n*Math.PI*2+r()*.5,rr=R*(.7+r()*.45);
        const px=cx+Math.cos(a)*rr,py=cy+Math.sin(a)*rr;k?x.lineTo(px,py):x.moveTo(px,py);}
      x.closePath();x.fill();
      // wrap the stones that cross an edge so the tile repeats seamlessly
      for(const[ox,oy]of[[s,0],[-s,0],[0,s],[0,-s]]){x.save();x.translate(ox,oy);x.fill();x.restore();}
    }
  });
}
// Paralelepípedo: grey-brown granite blocks laid in staggered courses across the street, each
// with a sunlit top, worn rounded edges and a shadowed lower side, and earth or moss in some
// joints. 1 tile = 2 m.
export const SETT_TILE_M=2;
export function settTexture():THREE.CanvasTexture{
  return make('sett2',512,(x,s)=>{
    const r=rng(11);
    x.fillStyle='#3a3530';x.fillRect(0,0,s,s);
    const rows=12,h=s/rows;
    for(let j=0;j<rows;j++){
      let px=(j%2)*h*.6-h;
      while(px<s){
        const w=h*(1.1+r()*.6),g=112+Math.floor(r()*48),warm=Math.floor(r()*10);
        const x0=px+2,y0=j*h+1.5+r()*1.5,ww=w-4,hh=h-3.5-r()*1.5;
        x.fillStyle=`rgb(${g-14+warm},${g-18+warm},${g-24})`;                     // shadowed lower side
        x.beginPath();x.roundRect(x0,y0,ww,hh,5);x.fill();
        const gr=x.createLinearGradient(x0,y0,x0+ww*.3,y0+hh);                    // sunlit, worn top
        gr.addColorStop(0,`rgb(${g+22+warm},${g+18+warm},${g+10})`);gr.addColorStop(1,`rgb(${g+warm},${g-3+warm},${g-10})`);
        x.fillStyle=gr;x.beginPath();x.roundRect(x0+1,y0+1,ww-3,hh-3.5,5);x.fill();
        for(let q=0;q<26;q++){const k=g+Math.floor((r()-.5)*50);x.fillStyle=`rgba(${k},${k-3},${k-8},.6)`;x.fillRect(x0+2+r()*(ww-5),y0+2+r()*(hh-6),1.5,1.5);}
        px+=w;
      }
    }
    for(let k=0;k<70;k++){x.fillStyle=r()<.5?'rgba(70,58,44,.55)':'rgba(64,74,46,.45)';x.fillRect(r()*s,Math.floor(r()*rows)*h-1.5,3+r()*8,3);}
  });
}
// Corrugated galvanised sheet (site hoarding): vertical ribs. 1 tile = 1 m.
export function corrugatedTexture():THREE.CanvasTexture{
  return make('corrugated',128,(x,s)=>{
    const rib=s/8;
    for(let i=0;i<8;i++){                                    // one light→dark→light gradient per rib
      const g=x.createLinearGradient(i*rib,0,(i+1)*rib,0);
      g.addColorStop(0,'#8e9397');g.addColorStop(.5,'#c9cdd0');g.addColorStop(1,'#8e9397');
      x.fillStyle=g;x.fillRect(i*rib,0,rib,s);
    }
  });
}
// UV helper: scale a geometry's 0..1 UVs to metres / tile size (planes and boxes).
export function uvMetres(geo:THREE.BufferGeometry,w:number,h:number,tile:number):THREE.BufferGeometry{
  const uv=geo.getAttribute('uv') as THREE.BufferAttribute;
  for(let i=0;i<uv.count;i++)uv.setXY(i,uv.getX(i)*w/tile,uv.getY(i)*h/tile);
  return geo;
}

// Telha colonial (clay "capa e canal" tiles): columns of half-round tiles, each shaded
// light→dark across its curve, with the overlap line of every course. 1 tile = 1 m.
export const ROOF_TILE_M=1;
export function telhaTexture():THREE.CanvasTexture{
  return make('telha',256,(x,s)=>{
    const r=rng(5),cols=5,cw=s/cols,rows=3,rh=s/rows;
    x.fillStyle='#6b2f1f';x.fillRect(0,0,s,s);
    for(let j=0;j<rows;j++)for(let i=0;i<cols;i++){
      const v=.85+r()*.3,g=x.createLinearGradient(i*cw,0,(i+1)*cw,0);
      const c=(k:number):string=>`rgb(${Math.min(255,168*v*k)|0},${Math.min(255,104*v*k)|0},${Math.min(255,82*v*k)|0})`;
      g.addColorStop(0,c(.55));g.addColorStop(.35,c(1.05));g.addColorStop(.7,c(.9));g.addColorStop(1,c(.5));
      x.fillStyle=g;x.fillRect(i*cw+1,j*rh,cw-2,rh-2);
      x.fillStyle='rgba(30,10,5,.45)';x.fillRect(i*cw,j*rh+rh-5,cw,5);          // course shadow
      if(r()<.6){x.fillStyle=`rgba(38,36,30,${.12+r()*.22})`;x.fillRect(i*cw+2,j*rh,cw-4,rh*(.3+r()*.6));} // weathering
      if(r()<.3){x.fillStyle='rgba(120,120,105,.18)';x.fillRect(i*cw+3,j*rh+rh*.5,cw-6,rh*.35);}            // lichen
    }
  });
}
// Reboco (painted render): near-white with soft blotches — multiplied by the wall colour.
export const PLASTER_TILE_M=3;
export function rebocoTexture():THREE.CanvasTexture{
  return make('reboco',256,(x,s)=>{
    const r=rng(3);
    x.fillStyle='#f4f4f4';x.fillRect(0,0,s,s);
    for(let k=0;k<900;k++){const g=225+Math.floor(r()*30);x.fillStyle=`rgba(${g},${g},${g},.35)`;
      const R=2+r()*14;x.beginPath();x.arc(r()*s,r()*s,R,0,Math.PI*2);x.fill();}
    for(let k=0;k<3000;k++){const g=200+Math.floor(r()*55);x.fillStyle=`rgb(${g},${g},${g})`;x.fillRect(r()*s,r()*s,1,1);}
  });
}
// Dirt band at the foot of walls ("encardido"): dark at the bottom fading up (alpha).
export function sujeiraTexture():THREE.CanvasTexture{
  return make('sujeira',64,(x,s)=>{
    const g=x.createLinearGradient(0,s,0,0);
    g.addColorStop(0,'rgba(60,52,44,.55)');g.addColorStop(.35,'rgba(70,62,52,.22)');g.addColorStop(1,'rgba(80,70,60,0)');
    x.fillStyle=g;x.fillRect(0,0,s,s);
  });
}
// Window glass: the sky reflection — lighter at the top, dark below.
export function vidroTexture():THREE.CanvasTexture{
  return make('vidro',64,(x,s)=>{
    const g=x.createLinearGradient(0,0,0,s);
    g.addColorStop(0,'#9db3c4');g.addColorStop(.45,'#4c6273');g.addColorStop(1,'#26323d');
    x.fillStyle=g;x.fillRect(0,0,s,s);
    x.fillStyle='rgba(255,255,255,.12)';x.beginPath();x.moveTo(s*.1,0);x.lineTo(s*.35,0);x.lineTo(s*.05,s);x.lineTo(0,s);x.fill();
  });
}
// Sidewalk pavings seen on the street: ceramic tiles, irregular stone, cement, and the
// black-and-white "mosaico" wave of the old corners. 1 tile = 1 m.
export function calcadaTexture(kind:'ceramica'|'pedra'|'cimento'|'mosaico'|'ladrilho'):THREE.CanvasTexture{
  return make('calcada-'+kind,256,(x,s)=>{
    const r=rng(kind.length*13);
    if(kind==='pedra'){
      x.fillStyle='#6b6458';x.fillRect(0,0,s,s);
      for(let j=0;j<6;j++)for(let i=0;i<6;i++){
        const cx=(i+.5+(r()-.5)*.5)*s/6,cy=(j+.5+(r()-.5)*.5)*s/6,R=s/6*.6,g=150+Math.floor(r()*50),n=5+Math.floor(r()*3);
        x.fillStyle=`rgb(${g+18},${g+8},${g-12})`;x.beginPath();
        for(let k=0;k<n;k++){const a=k/n*Math.PI*2+r()*.5,rr=R*(.7+r()*.4);k?x.lineTo(cx+Math.cos(a)*rr,cy+Math.sin(a)*rr):x.moveTo(cx+Math.cos(a)*rr,cy+Math.sin(a)*rr);}
        x.closePath();x.fill();
      }
      return;
    }
    if(kind==='mosaico'){
      x.fillStyle='#ece9e2';x.fillRect(0,0,s,s);x.fillStyle='#22201e';
      for(let j=0;j<8;j++)for(let i=0;i<8;i++)if((i+j)%2===0)x.fillRect(i*s/8,j*s/8,s/8,s/8);
      return;
    }
    const base=kind==='cimento'?'#a8a49b':kind==='ladrilho'?'#9a4c3c':'#c9bfae';
    x.fillStyle=base;x.fillRect(0,0,s,s);
    const n=kind==='cimento'?2:4;
    for(let j=0;j<n;j++)for(let i=0;i<n;i++){const v=(r()-.5)*16;x.fillStyle=`rgba(${128+v},${120+v},${110+v},.12)`;x.fillRect(i*s/n+2,j*s/n+2,s/n-4,s/n-4);}
    x.strokeStyle='rgba(60,55,50,.55)';x.lineWidth=2;
    for(let k=0;k<=n;k++){x.beginPath();x.moveTo(k*s/n,0);x.lineTo(k*s/n,s);x.stroke();x.beginPath();x.moveTo(0,k*s/n);x.lineTo(s,k*s/n);x.stroke();}
    if(kind==='ladrilho'){x.fillStyle='rgba(240,230,210,.5)';for(let j=0;j<n;j++)for(let i=0;i<n;i++){x.beginPath();x.arc((i+.5)*s/n,(j+.5)*s/n,s/n*.22,0,Math.PI*2);x.fill();}}
  });
}
// Veneziana (louvred wooden/aluminium shutter): horizontal slats with a light top edge and
// a shadow under each — white, multiplied by the shutter colour. 1 tile = 0.5 m.
export function venezianaTexture():THREE.CanvasTexture{
  return make('veneziana',64,(x,s)=>{
    const n=7,h=s/n;
    for(let i=0;i<n;i++){
      const g=x.createLinearGradient(0,i*h,0,(i+1)*h);
      g.addColorStop(0,'#ffffff');g.addColorStop(.6,'#d9d9d9');g.addColorStop(.85,'#8e8e8e');g.addColorStop(1,'#5e5e5e');
      x.fillStyle=g;x.fillRect(0,i*h,s,h);
    }
  });
}
// Ribbed steel garage / roll-up door: horizontal ribs. White, multiplied by the door colour. 1 tile = 0.5 m.
export function frisoTexture():THREE.CanvasTexture{
  return make('friso',64,(x,s)=>{
    const n=4,h=s/n;
    for(let i=0;i<n;i++){
      const g=x.createLinearGradient(0,i*h,0,(i+1)*h);
      g.addColorStop(0,'#c8c8c8');g.addColorStop(.3,'#ffffff');g.addColorStop(.8,'#e6e6e6');g.addColorStop(1,'#9a9a9a');
      x.fillStyle=g;x.fillRect(0,i*h,s,h);
    }
  });
}
// Bloquete sextavado (hexagonal concrete pavers ~25 cm): the red-pink paths of the town
// squares and the grey sidewalks and squares' borders. Seamless (8 hexes across, 8 rows);
// the tile is SEXT_W × SEXT_H metres, so geometry maps uv = (x/SEXT_W, z/SEXT_H).
export const SEXT_W=2.0,SEXT_H=2.0*240/277;
export function sextavadoTexture(kind:'vermelho'|'cinza'|'rosa'):THREE.CanvasTexture{
  const hit=cache.get('sext-'+kind);if(hit)return hit;
  if(typeof document==='undefined')return new THREE.Texture() as THREE.CanvasTexture;
  const R=20,DX=Math.sqrt(3)*R,W=Math.round(DX*8),H=240,c=document.createElement('canvas');c.width=W;c.height=H;
  const x=c.getContext('2d')!,r=rng(kind.length*7+3);
  const base=kind==='vermelho'?[176,92,80]:kind==='rosa'?[196,128,116]:[156,154,148];
  x.fillStyle=kind==='cinza'?'#6f6d68':'#6e3a32';x.fillRect(0,0,W,H);
  for(let j=-1;j<=8;j++)for(let i=-1;i<=8;i++){
    const cx=i*DX+(j%2?DX/2:0),cy=j*1.5*R,v=.88+r()*.22;
    x.fillStyle=`rgb(${base[0]*v|0},${base[1]*v|0},${base[2]*v|0})`;x.beginPath();
    for(let k=0;k<6;k++){const a=Math.PI/6+k*Math.PI/3,px=cx+Math.cos(a)*(R-1.6),py=cy+Math.sin(a)*(R-1.6);k?x.lineTo(px,py):x.moveTo(px,py);}
    x.closePath();x.fill();
  }
  const t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=4;
  cache.set('sext-'+kind,t);return t;
}
// Calçada portuguesa in zigzag (the chevron band of the Praça Dr. Alcindo's dry square):
// white limestone with dark basalt chevrons, small cubes. 1 tile = 4 m along the band.
export const ZIGZAG_TILE_M=4;
export function zigzagTexture():THREE.CanvasTexture{
  return make('zigzag',256,(x,s)=>{
    const r=rng(11);
    x.fillStyle='#e2ddd2';x.fillRect(0,0,s,s);
    x.fillStyle='#4a4743';
    for(const y0 of[s*.18,s*.62]){                         // two chevron rows per tile
      x.beginPath();
      for(let k=0;k<=4;k++){const px=k*s/4,py=y0+(k%2?s*.16:0);k?x.lineTo(px,py):x.moveTo(px,py);}
      for(let k=4;k>=0;k--){const px=k*s/4,py=y0+s*.08+(k%2?s*.16:0);x.lineTo(px,py);}
      x.closePath();x.fill();
    }
    for(let k=0;k<2200;k++){const g=r()<.5?'rgba(0,0,0,.10)':'rgba(255,255,255,.12)';x.fillStyle=g;x.fillRect(r()*s,r()*s,3,3);}  // the stone cubes
  });
}
// Lawn: soft mottled green, multiplied by the grass colour. 1 tile = 3 m.
export const GRAMA_TILE_M=3;
export function gramaTexture():THREE.CanvasTexture{
  return make('grama',128,(x,s)=>{
    const r=rng(17);x.fillStyle='#f0f0f0';x.fillRect(0,0,s,s);
    for(let k=0;k<700;k++){const g=200+Math.floor(r()*55);x.fillStyle=`rgba(${g},${g},${g},.5)`;x.beginPath();x.arc(r()*s,r()*s,1+r()*5,0,Math.PI*2);x.fill();}
  });
}
// Degraus: a flight of light stone steps seen on a slope — tread, nosing shadow, riser.
// 1 tile = 1 m across, 2 steps (tread .5 m) along v.
export function degrausTexture():THREE.CanvasTexture{
  return make('degraus',64,(x,s)=>{
    for(let k=0;k<2;k++){const y=k*s/2;
      x.fillStyle='#d7d2c6';x.fillRect(0,y,s,s/2);x.fillStyle='#a9a397';x.fillRect(0,y+s/2-9,s,6);x.fillStyle='#7e786d';x.fillRect(0,y+s/2-3,s,3);}
  });
}

// ---- photoreal "multiply" details ----
// soft tileable blots: each drawn at the 9 wrap offsets so the tile repeats seamlessly
function blot(x:CanvasRenderingContext2D,s:number,px:number,py:number,R:number,style:string):void{
  x.fillStyle=style;
  for(const ox of[-s,0,s])for(const oy of[-s,0,s]){x.beginPath();x.arc(px+ox,py+oy,R,0,Math.PI*2);x.fill();}
}
// Ground: grass tufts, bare patches and pebbles at the scale you see from a car or on foot.
// 1 tile = 8 m. Mean ≈ 0.85 — terreno.ts lifts the vertex colours to match.
export const GROUND_TILE_M=8;
export function soloTexture():THREE.CanvasTexture{
  return make('solo',512,(x,s)=>{
    const r=rng(23);
    x.fillStyle='#dadada';x.fillRect(0,0,s,s);
    for(let k=0;k<260;k++){const g=170+Math.floor(r()*80);blot(x,s,r()*s,r()*s,8+r()*40,`rgba(${g},${g},${g},.28)`);}
    for(let k=0;k<9000;k++){                              // blades / clods
      const g=120+Math.floor(r()*135),px=r()*s,py=r()*s;
      x.fillStyle=`rgba(${g},${g},${g},.55)`;x.fillRect(px,py,1+r()*2,1+r()*3);
    }
    for(let k=0;k<500;k++){const g=235+Math.floor(r()*20);x.fillStyle=`rgba(${g},${g},${g},.6)`;x.fillRect(r()*s,r()*s,2,2);}
  },true);
}
// Tileable value noise over a W×H canvas: a cells × cellsY lattice, smoothstepped.
function noise2(seed:number,cells:number,cellsY:number):(px:number,py:number,W:number,H:number)=>number{
  const r=rng(seed),g=new Float32Array(cells*cellsY);for(let i=0;i<g.length;i++)g[i]=r();
  const at=(i:number,j:number):number=>g[((j%cellsY+cellsY)%cellsY)*cells+((i%cells+cells)%cells)];
  return(px,py,W,H)=>{
    const fx=px/W*cells,fy=py/H*cellsY,ix=Math.floor(fx),iy=Math.floor(fy),tx=fx-ix,ty=fy-iy;
    const sx=tx*tx*(3-2*tx),sy=ty*ty*(3-2*ty);
    const a=at(ix,iy),b=at(ix+1,iy),c=at(ix,iy+1),d=at(ix+1,iy+1);
    return a+(b-a)*sx+(c-a)*sy+(a-b-c+d)*sx*sy;
  };
}
// a smooth noise sampled once per st × st pixel block (painting a 1-Mpixel road texture
// evaluates its noises at every pixel otherwise — a few hundred ms of boot)
function field(fn:(px:number,py:number,W:number,H:number)=>number,W:number,H:number,st:number):(px:number,py:number)=>number{
  const w=Math.ceil(W/st),h=Math.ceil(H/st),a=new Float32Array(w*h);
  for(let j=0;j<h;j++)for(let i=0;i<w;i++)a[j*w+i]=fn(i*st,j*st,W,H);
  return(px,py)=>a[(py/st|0)*w+(px/st|0)];
}
// scale a grey "multiply" canvas so its mean is exactly `mean` (0..255)
function normalise(x:CanvasRenderingContext2D,W:number,H:number,mean:number):void{
  const im=x.getImageData(0,0,W,H),d=im.data;let t=0;
  for(let i=0;i<d.length;i+=4)t+=d[i];
  const k=mean/(t/(d.length/4));
  for(let i=0;i<d.length;i+=4){const v=Math.min(255,d[i]*k);d[i]=d[i+1]=d[i+2]=v;}
  x.putImageData(im,0,0);
}
// make() for a non-square canvas
function makeWH(key:string,W:number,H:number,paint:(x:CanvasRenderingContext2D,W:number,H:number)=>void,linear:boolean):THREE.CanvasTexture{
  const hit=cache.get(key);if(hit)return hit;
  if(typeof document==='undefined')return new THREE.Texture() as THREE.CanvasTexture;
  const c=document.createElement('canvas');c.width=W;c.height=H;
  paint(c.getContext('2d')!,W,H);
  const t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.colorSpace=linear?THREE.NoColorSpace:THREE.SRGBColorSpace;t.anisotropy=4;
  cache.set(key,t);return t;
}
// sRGB 0..255 channels of a palette colour
const rgb255=(c:string):number[]=>{const k=new THREE.Color(c);return[k.r,k.g,k.b].map(v=>Math.pow(v,1/2.2)*255);};

// The street textures span the whole cross-section: u is the LATERAL offset from the
// centreline (u = 0 at the centre, wrapping at ±ROAD_TILE_U/2) and v runs along the street,
// so the wear sits where the wheels actually go (rua.ts lays the UVs). Long tiles (32 m)
// hide the repetition.
export const ROAD_TILE_U=8,ROAD_TILE_V=32;
const lateral=(px:number,W:number):number=>{const m=px/W*ROAD_TILE_U;return m<=ROAD_TILE_U/2?m:m-ROAD_TILE_U;};

// Asphalt of an interior-paulista town street (Street View): sun-bleached binder with the
// aggregate showing, a darker oil-drip band down the middle of each lane, polished wheel
// tracks, the longitudinal joint crack at the centre, square-cut repair patches (remendos),
// meandering and alligator cracks, the odd small pothole. A COLOUR map painted from the
// palette (asphalt, and the gutter's concrete).
export function asfaltoTexture(asph:string,concrete:string):THREE.CanvasTexture{
  return makeWH('asfalto3-'+asph+concrete,512,2048,(x,W,H)=>{
    const r=rng(29),macro=field(noise2(5,4,16),W,H,8),mid=field(noise2(6,16,64),W,H,4),fine=field(noise2(7,64,256),W,H,2);
    const grain=new Float32Array((W>>1)*(H>>1));for(let i=0;i<grain.length;i++)grain[i]=r();
    const im=x.createImageData(W,H),d=im.data;
    for(let py=0;py<H;py++)for(let px=0;px<W;px++){
      const lane=Math.abs(Math.abs(lateral(px,W))-1.8);
      let v=.86+(macro(px,py)-.5)*.10+(mid(px,py)-.5)*.06;
      const oil=Math.exp(-lane*lane/(2*.25*.25))*(.5+.5*fine(px,py));       // drips at the lane centre
      const track=Math.exp(-(lane-.8)*(lane-.8)/(2*.25*.25));                   // the two wheel tracks
      v-=oil*.12+track*.03;
      // aggregate: 2-3 cm stones (pixel pairs) in the binder, fewer in the polished tracks
      const q=grain[((py>>1)*(W>>1)+(px>>1))%grain.length];
      v+=(q-.5)*(.22-track*.10)+(r()-.5)*.06+(q>.97?.16:0);
      const i=(py*W+px)*4,g=Math.max(0,Math.min(255,v*255));d[i]=d[i+1]=d[i+2]=g;d[i+3]=255;
    }
    x.putImageData(im,0,0);
    const pm=W/ROAD_TILE_U;                                                      // pixels per metre
    // repair patches: a darker, smoother rectangle with a sealed (light) seam
    for(let k=0;k<6;k++){
      const w=(.8+r()*2)*pm,h=(.6+r()*2.4)*pm,cx=r()*W,cy=r()*H,rot=(r()-.5)*.08,g=110+r()*30|0;
      for(const ox of[-W,0,W])for(const oy of[-H,0,H]){
        x.save();x.translate(cx+ox,cy+oy);x.rotate(rot);
        x.fillStyle=`rgba(${g},${g},${g},.22)`;x.fillRect(-w/2,-h/2,w,h);
        x.strokeStyle='rgba(60,60,60,.3)';x.lineWidth=1.5;x.strokeRect(-w/2,-h/2,w,h);
        x.restore();
      }
    }
    const crack=(px:number,py:number,n:number,step:number,dir:number,wiggle:number,a:number):void=>{
      x.strokeStyle=`rgba(50,50,50,${a*.6})`;x.lineWidth=1;
      const seed=Math.floor(px*7+py*3);
      for(const ox of[-W,0,W])for(const oy of[-H,0,H]){
        const rr=rng(seed);let cx=px,cy=py;x.beginPath();x.moveTo(cx+ox,cy+oy);
        for(let q=0;q<n;q++){cx+=Math.sin(dir)*step+(rr()-.5)*wiggle;cy+=Math.cos(dir)*step+(rr()-.5)*wiggle;x.lineTo(cx+ox,cy+oy);}
        x.stroke();
      }
    };
    // the longitudinal joint along the centreline, in broken stretches
    for(let py=0;py<H;py+=pm*(3+r()*5))if(r()<.6)crack((r()-.5)*.2*pm,py,10,pm*.3,0,pm*.12,.7);
    for(let k=0;k<14;k++)crack(r()*W,r()*H,6+r()*12|0,pm*.25,r()*Math.PI*2,pm*.3,.55);
    // alligator cracking: a cluster of short cracks in a wheel track
    for(let k=0;k<4;k++){
      const lat=(r()<.5?-1:1)*(1.8+(r()<.5?-.8:.8)),cx=((lat+ROAD_TILE_U)%ROAD_TILE_U)*pm,cy=r()*H;
      for(let q=0;q<22;q++)crack(cx+(r()-.5)*pm*.9,cy+(r()-.5)*pm*1.8,3,pm*.12,r()*Math.PI*2,pm*.05,.5);
    }
    // a few small potholes: a dark hollow with a ravelled light rim
    for(let k=0;k<3;k++){
      const cx=r()*W,cy=r()*H,R=(.12+r()*.18)*pm;
      blot(x,W,cx,cy,R*1.35,'rgba(225,225,225,.25)');blot(x,W,cx,cy,R,'rgba(30,30,30,.65)');
    }
    normalise(x,W,H,217);
    // colour: the palette asphalt carries the grey detail above (mean 0.85 → the palette value),
    // and past GUTTER_LAT - GUTTER_W the concrete gutter (sarjeta) of the kerbed streets — rua.ts
    // maps their edge onto GUTTER_LAT, other roads stop short of it — with road grime against it
    const im2=x.getImageData(0,0,W,H),e=im2.data;
    const lut=(c:string):Uint8ClampedArray[]=>{
      const k=new THREE.Color(c);
      return[k.r,k.g,k.b].map(l=>Uint8ClampedArray.from({length:256},(_,g)=>Math.pow(Math.min(1,l*g/217),1/2.2)*255));
    };
    const A=lut(asph),Cc=lut(concrete);
    for(let py=0;py<H;py++)for(let px=0;px<W;px++){
      const lat=Math.abs(lateral(px,W)),i=(py*W+px)*4,g=e[i];
      if(lat>GUTTER_LAT-GUTTER_W){
        // smoother concrete: half the asphalt's grain, a dark seam at the asphalt and a joint every metre
        let k=217+(g-217)*.4;
        if(lat<GUTTER_LAT-GUTTER_W+.03||py%pm<1.5)k*=.72;
        const q=Math.max(0,Math.min(255,Math.round(k)));
        for(let c=0;c<3;c++)e[i+c]=Cc[c][q];
      }else{
        const grime=Math.max(0,1-(GUTTER_LAT-GUTTER_W-lat)/.5);             // dust and leaves along the kerb
        const q=Math.max(0,Math.min(255,Math.round(g*(1-grime*.12))));
        for(let c=0;c<3;c++)e[i+c]=A[c][q];
      }
    }
    x.putImageData(im2,0,0);
  },false);
}
// Where the kerbed streets' edge falls in the asphalt texture (metres from the centreline),
// and the width of the concrete gutter painted inside it.
export const GUTTER_LAT=3.6,GUTTER_W=.4;
// The sidewalk of the town's kerbed streets, across its whole width: u = 0 at the kerb → 1 at
// the outer edge (2.1 m, rua.ts), v along (1 tile = 2 m). The kerb's light concrete top with
// a joint every metre, then the cement slabs (1 m squares, tone changes, stains, a cracked one).
export function calcadaRuaTexture():THREE.CanvasTexture{
  return make('calcada-rua',256,(x,s)=>{
    const r=rng(47),pmU=s/2.1,pmV=s/2,kerb=Math.round(.15*pmU);
    x.fillStyle='#a8a39a';x.fillRect(0,0,s,s);
    const cols=[kerb,kerb+(s-kerb)/2,s];
    for(let j=0;j<2;j++)for(let c=0;c<2;c++){                                     // slabs
      const v=(r()-.5)*18;x.fillStyle=`rgb(${168+v},${163+v},${154+v})`;
      x.fillRect(cols[c]+1,j*pmV+1,cols[c+1]-cols[c]-2,pmV-2);
    }
    for(let k=0;k<3000;k++){const g=130+Math.floor(r()*90);x.fillStyle=`rgba(${g},${g-2},${g-6},.35)`;x.fillRect(kerb+r()*(s-kerb),r()*s,1,1);}
    for(let k=0;k<10;k++)blot(x,s,kerb+r()*(s-kerb),r()*s,3+r()*12,'rgba(80,72,62,.12)');   // stains
    x.strokeStyle='rgba(70,64,56,.55)';x.lineWidth=1;x.beginPath();               // a cracked slab
    {let cx=kerb+r()*(s-kerb),cy=r()*s;x.moveTo(cx,cy);for(let q=0;q<6;q++){cx+=(r()-.5)*30;cy+=(r()-.3)*20;x.lineTo(cx,cy);}}
    x.stroke();
    x.strokeStyle='rgba(60,55,50,.6)';x.lineWidth=2;                               // joints
    for(const c of cols.slice(1,2)){x.beginPath();x.moveTo(c,0);x.lineTo(c,s);x.stroke();}
    for(const j of[0,pmV]){x.beginPath();x.moveTo(kerb,j);x.lineTo(s,j);x.stroke();}
    // the kerb top: light concrete, a joint every metre, the seam to the slabs
    x.fillStyle='#c4bfb5';x.fillRect(0,0,kerb,s);
    for(let k=0;k<600;k++){const g=170+Math.floor(r()*60);x.fillStyle=`rgba(${g},${g-2},${g-6},.4)`;x.fillRect(r()*kerb,r()*s,1,1);}
    x.fillStyle='rgba(60,55,50,.5)';x.fillRect(kerb-1,0,2,s);
    for(let j=0;j<4;j++)x.fillRect(0,j*s/4,kerb,1.5);
  });
}
// Dirt road (estrada de terra, terra roxa batida): rosy dust, the two darker compacted ruts
// of the wheels, a crown with sparse grass, grass taking over the edges, loose stones. A
// COLOUR map painted from the palette (dirt + grass), with the asphalt's lateral UVs.
export function terraTexture(dirt:string,grass:string):THREE.CanvasTexture{
  return makeWH('terra2-'+dirt+grass,512,2048,(x,W,H)=>{
    const r=rng(31),macro=field(noise2(8,4,16),W,H,8),mid=field(noise2(9,24,96),W,H,4),tuft=field(noise2(10,96,384),W,H,2);
    const dc=rgb255(dirt),gc=rgb255(grass);
    const im=x.createImageData(W,H),d=im.data;
    for(let py=0;py<H;py++)for(let px=0;px<W;px++){
      const lat=Math.abs(lateral(px,W)),rut=Math.abs(lat-.8);
      let v=1+(macro(px,py)-.5)*.16+(mid(px,py)-.5)*.10;
      v-=Math.exp(-rut*rut/(2*.2*.2))*.10;                                        // compacted, darker ruts
      v+=(r()-.5)*.12+(r()>.992?.25:0);                                           // grit + light stones
      // grass: sparse on the crown, taking over beyond ~2.3 m from the centre
      const t=tuft(px,py);
      const gm=Math.max(Math.exp(-lat*lat/(2*.25*.25))*.75,Math.min(1,Math.max(0,(lat-2.3)/1.3)))*(t>.45?1:t/.45*.4);
      const blade=.75+r()*.5,i=(py*W+px)*4;
      for(let c=0;c<3;c++)d[i+c]=Math.max(0,Math.min(255,dc[c]*v*(1-gm)+gc[c]*blade*gm));
      d[i+3]=255;
    }
    x.putImageData(im,0,0);
  },false);
}
// The dusty verge where a dirt or rural road meets the grass: road dust thinning out into
// clumps with a ragged edge (alpha, cut out at 0.5). u = 0 at the road's edge → 1 at the
// verge's outer edge; 1 tile = 8 m along. Colour from the palette dirt.
export function acostamentoTexture(dirt:string):THREE.CanvasTexture{
  return makeWH('acostamento-'+dirt,128,512,(x,W,H)=>{
    const r=rng(37),n=noise2(12,6,24),f=noise2(13,24,96),dc=rgb255(dirt);
    const im=x.createImageData(W,H),d=im.data;
    for(let py=0;py<H;py++)for(let px=0;px<W;px++){
      const u=px/(W-1),edge=.3+.5*n(px,py,W,H)+(f(px,py,W,H)-.5)*.45;
      const a=Math.max(0,Math.min(1,(edge-u)/.25+(r()-.5)*.5)),i=(py*W+px)*4;
      // dust tone varies, darkens toward the grass it thins into, and carries pebbles
      const v=.9+(n(px*3%W,py*3%H,W,H)-.5)*.25-Math.max(0,.45-a)*.4+(r()-.5)*.18+(r()>.985?.25:0);
      for(let c=0;c<3;c++)d[i+c]=Math.min(255,dc[c]*v);
      d[i+3]=a*235;
    }
    x.putImageData(im,0,0);
  },false);
}
// Road paint (sinalização horizontal): near-white, with the tyres' wear — speckled gaps where
// the paint has gone. 1 tile = 0.5 m across × 4 m along. Mean ≈ 0.85.
export function pinturaTexture():THREE.CanvasTexture{
  return makeWH('pintura',64,512,(x,W,H)=>{
    const r=rng(43),n=noise2(14,4,32);
    const im=x.createImageData(W,H),d=im.data;
    for(let py=0;py<H;py++)for(let px=0;px<W;px++){
      const v=r()<n(px,py,W,H)*.55?.45+r()*.2:.92+(r()-.5)*.1,i=(py*W+px)*4;
      d[i]=d[i+1]=d[i+2]=v*255;d[i+3]=255;
    }
    x.putImageData(im,0,0);normalise(x,W,H,217);
  },true);
}
// Foliage: leaf clusters — light-catching tops and dark gaps — for the tree crowns.
// Mean ≈ 0.8; wrapped round the crown by its own UVs.
export function folhagemTexture():THREE.CanvasTexture{
  return make('folhagem',256,(x,s)=>{
    const r=rng(37);
    x.fillStyle='#9a9a9a';x.fillRect(0,0,s,s);
    for(let k=0;k<2600;k++){
      const g=Math.floor(110+r()*145),px=r()*s,py=r()*s,R=2+r()*5;
      blot(x,s,px,py,R,`rgba(${g},${g},${g},.75)`);
    }
    for(let k=0;k<600;k++){blot(x,s,r()*s,r()*s,1.5+r()*3,'rgba(40,40,40,.6)');}
  },true);
}
// Gas-station forecourt (pátio de concreto): poured slabs with saw-cut joints every 2 m,
// trowel grain, tyre-dark patches and oil drips round where cars stop. 1 tile = 4 m.
export const CONCRETO_TILE_M=4;
export function concretoTexture():THREE.CanvasTexture{
  return make('concreto',256,(x,s)=>{
    const r=rng(41);
    x.fillStyle='#b9b6af';x.fillRect(0,0,s,s);
    for(let k=0;k<60;k++){const g=150+Math.floor(r()*70);blot(x,s,r()*s,r()*s,8+r()*36,`rgba(${g},${g-2},${g-6},.22)`);}
    for(let k=0;k<5000;k++){const g=140+Math.floor(r()*100);x.fillStyle=`rgba(${g},${g},${g},.5)`;x.fillRect(r()*s,r()*s,1,1);}
    for(let k=0;k<14;k++){blot(x,s,r()*s,r()*s,2+r()*7,'rgba(45,42,38,.35)');}    // oil drips
    x.strokeStyle='rgba(70,66,60,.7)';x.lineWidth=2;
    for(const p of[0,s/2]){x.beginPath();x.moveTo(p,0);x.lineTo(p,s);x.stroke();x.beginPath();x.moveTo(0,p);x.lineTo(s,p);x.stroke();}
  });
}
// Exposed brick (tijolo à vista) of the upper floors: red-orange bricks, pale mortar,
// brick-to-brick tone changes. 1 tile = 1 m (4 bricks × 13 courses).
export function tijoloTexture():THREE.CanvasTexture{
  return make('tijolo',256,(x,s)=>{
    const r=rng(43),rows=13,bh=s/rows,bw=s/4;
    x.fillStyle='#c9bfb2';x.fillRect(0,0,s,s);
    for(let j=0;j<rows;j++)for(let i=-1;i<5;i++){
      const ox=(j%2)*bw/2,v=Math.floor((r()-.5)*40);
      x.fillStyle=`rgb(${168+v},${86+v/2},${58+v/3})`;x.fillRect(i*bw+ox+1.5,j*bh+1.5,bw-3,bh-3);
    }
  });
}
// Glazed white wall tiles (azulejo 15×15) of the station shops and pillars: thin grey
// grout, a slight sheen variation. 1 tile = 0.6 m (4 × 4 tiles).
export function azulejoTexture():THREE.CanvasTexture{
  return make('azulejo',128,(x,s)=>{
    const r=rng(47),n=4,t=s/n;
    x.fillStyle='#b9bcbd';x.fillRect(0,0,s,s);
    for(let j=0;j<n;j++)for(let i=0;i<n;i++){const v=Math.floor(r()*10);x.fillStyle=`rgb(${236+v},${238+v},${236+v})`;x.fillRect(i*t+1,j*t+1,t-2,t-2);}
  });
}
