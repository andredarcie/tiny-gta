import * as THREE from 'three';

// Shared atlas for the painted signs (façade signs, road and direction boards). Each sign
// used to be its own canvas texture, hence its own material and its own draw call — a
// hundred two-triangle draws in the centre alone. Signs are now painted side by side on
// 2048 × 2048 pages (shelf packing) and share the page's material, so a block of the town
// merges all its signs into one draw. alloc() returns the page material and the UV rect
// the caller maps its face onto.
const PAGE=2048,PAD=4;
interface Page{canvas:HTMLCanvasElement;ctx:CanvasRenderingContext2D;tex:THREE.CanvasTexture;mat:THREE.MeshLambertMaterial;
  matDouble:THREE.MeshLambertMaterial;x:number;y:number;rowH:number}
const pages:Page[]=[];
function newPage():Page{
  const canvas=document.createElement('canvas');canvas.width=canvas.height=PAGE;
  const ctx=canvas.getContext('2d')!;
  const tex=new THREE.CanvasTexture(canvas);tex.colorSpace=THREE.SRGBColorSpace;tex.anisotropy=4;
  const p={canvas,ctx,tex,mat:new THREE.MeshLambertMaterial({map:tex}),matDouble:new THREE.MeshLambertMaterial({map:tex,side:THREE.DoubleSide}),x:0,y:0,rowH:0};
  pages.push(p);return p;
}
export type AtlasSlot={mat:THREE.MeshLambertMaterial;matDouble:THREE.MeshLambertMaterial;u0:number;v0:number;u1:number;v1:number};
// a w × h px slot painted by `paint` (in slot coordinates); null without a DOM
export function atlasSign(w:number,h:number,paint:(x:CanvasRenderingContext2D,w:number,h:number)=>void):AtlasSlot|null{
  if(typeof document==='undefined')return null;
  w=Math.min(PAGE-2*PAD,Math.ceil(w));h=Math.min(PAGE-2*PAD,Math.ceil(h));
  let p=pages[pages.length-1]??newPage();
  if(p.x+w+2*PAD>PAGE){p.x=0;p.y+=p.rowH;p.rowH=0;}
  if(p.y+h+2*PAD>PAGE){p=newPage();}
  const x0=p.x+PAD,y0=p.y+PAD;
  p.ctx.save();p.ctx.translate(x0,y0);p.ctx.beginPath();p.ctx.rect(0,0,w,h);p.ctx.clip();paint(p.ctx,w,h);p.ctx.restore();
  // bleed the slot's edge pixels into its padding (no seams once mipmapped)
  p.ctx.drawImage(p.canvas,x0,y0,w,1,x0,y0-PAD,w,PAD);p.ctx.drawImage(p.canvas,x0,y0+h-1,w,1,x0,y0+h,w,PAD);
  p.ctx.drawImage(p.canvas,x0,y0-PAD,1,h+2*PAD,x0-PAD,y0-PAD,PAD,h+2*PAD);p.ctx.drawImage(p.canvas,x0+w-1,y0-PAD,1,h+2*PAD,x0+w,y0-PAD,PAD,h+2*PAD);
  p.x+=w+2*PAD;p.rowH=Math.max(p.rowH,h+2*PAD);
  p.tex.needsUpdate=true;
  // canvas y runs down, texture v up (flipY)
  return{mat:p.mat,matDouble:p.matDouble,u0:x0/PAGE,u1:(x0+w)/PAGE,v0:1-(y0+h)/PAGE,v1:1-y0/PAGE};
}
// remap a geometry's UVs (0..1) — all of them, or the vertices [start, start+count) — into the slot
export function mapToSlot(g:THREE.BufferGeometry,s:AtlasSlot,start=0,count=Infinity):void{
  const uv=g.getAttribute('uv') as THREE.BufferAttribute,end=Math.min(uv.count,start+count);
  for(let i=start;i<end;i++)uv.setXY(i,s.u0+uv.getX(i)*(s.u1-s.u0),s.v0+uv.getY(i)*(s.v1-s.v0));
  uv.needsUpdate=true;
}
