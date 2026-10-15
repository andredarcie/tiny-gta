import * as THREE from 'three';

// Procedural canvas textures for Divinolândia surfaces that read as their MATERIAL, not
// as a photo (art direction: no photo textures, ever): the irregular grey stone cladding
// ("pedra" on base walls and façade panels), the paralelepípedo cobblestone of the old
// centre streets, and corrugated metal site fencing. Drawn once, tiled with RepeatWrapping;
// geometry supplies UVs in metres (1 texture tile = TILE_M metres).
const cache=new Map<string,THREE.CanvasTexture>();
function make(key:string,size:number,paint:(x:CanvasRenderingContext2D,s:number)=>void):THREE.CanvasTexture{
  const hit=cache.get(key);if(hit)return hit;
  // outside a browser (Node unit tests build the geometry) there is no canvas: blank texture
  if(typeof document==='undefined')return new THREE.Texture() as THREE.CanvasTexture;
  const c=document.createElement('canvas');c.width=c.height=size;
  paint(c.getContext('2d')!,size);
  const t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=4;
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
      const c=(k:number):string=>`rgb(${Math.min(255,190*v*k)|0},${Math.min(255,98*v*k)|0},${Math.min(255,66*v*k)|0})`;
      g.addColorStop(0,c(.55));g.addColorStop(.35,c(1.05));g.addColorStop(.7,c(.9));g.addColorStop(1,c(.5));
      x.fillStyle=g;x.fillRect(i*cw+1,j*rh,cw-2,rh-2);
      x.fillStyle='rgba(30,10,5,.45)';x.fillRect(i*cw,j*rh+rh-5,cw,5);          // course shadow
      if(r()<.25){x.fillStyle='rgba(40,40,30,.18)';x.fillRect(i*cw+2,j*rh,cw-4,rh*.6);} // weathering
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
