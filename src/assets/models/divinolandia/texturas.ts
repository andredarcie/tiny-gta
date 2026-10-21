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
// Paralelepípedo: rows of roughly square granite setts, staggered, grey-brown. 1 tile = 2 m.
export const SETT_TILE_M=2;
export function settTexture():THREE.CanvasTexture{
  return make('sett',256,(x,s)=>{
    const r=rng(11);
    x.fillStyle='#3d3a36';x.fillRect(0,0,s,s);
    const rows=12,h=s/rows;
    for(let j=0;j<rows;j++){
      let px=(j%2)*h*.5-h;
      while(px<s){
        const w=h*(.8+r()*.45),g=105+Math.floor(r()*45);
        x.fillStyle=`rgb(${g+6},${g+2},${g-4})`;
        x.fillRect(px+1.5,j*h+1.5,w-3,h-3);
        px+=w;
      }
    }
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
// Asphalt: aggregate speckle, darker patches of repairs and oil, hairline cracks. 1 tile = 2 m
// (the street ribbons' UVs, rua.ts). Mean ≈ 0.85.
export function asfaltoTexture():THREE.CanvasTexture{
  return make('asfalto',256,(x,s)=>{
    const r=rng(29);
    x.fillStyle='#d8d8d8';x.fillRect(0,0,s,s);
    for(let k=0;k<40;k++){const g=150+Math.floor(r()*70);blot(x,s,r()*s,r()*s,10+r()*40,`rgba(${g},${g},${g},.25)`);}
    for(let k=0;k<7000;k++){const g=110+Math.floor(r()*145);x.fillStyle=`rgb(${g},${g},${g})`;x.fillRect(r()*s,r()*s,1,1);}
    x.strokeStyle='rgba(60,60,60,.55)';x.lineWidth=1;
    for(let k=0;k<5;k++){let px=r()*s,py=r()*s;x.beginPath();x.moveTo(px,py);
      for(let q=0;q<8;q++){px+=(r()-.5)*40;py+=(r()-.5)*40;x.lineTo(px,py);}x.stroke();}
  },true);
}
// Dirt road (terra roxa batida): fine dust, darker ruts along the travel direction (v), small
// stones. 1 tile = 2 m. Mean ≈ 0.85.
export function terraTexture():THREE.CanvasTexture{
  return make('terra',256,(x,s)=>{
    const r=rng(31);
    x.fillStyle='#dcdcdc';x.fillRect(0,0,s,s);
    for(let k=0;k<70;k++){const g=165+Math.floor(r()*80);blot(x,s,r()*s,r()*s,6+r()*30,`rgba(${g},${g},${g},.3)`);}
    for(let k=0;k<6000;k++){const g=140+Math.floor(r()*115);x.fillStyle=`rgba(${g},${g},${g},.7)`;x.fillRect(r()*s,r()*s,1,1);}
    for(let k=0;k<120;k++){const g=245;x.fillStyle=`rgba(${g},${g},${g},.7)`;x.fillRect(r()*s,r()*s,2+r()*2,2);}
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
