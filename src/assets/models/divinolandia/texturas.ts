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
