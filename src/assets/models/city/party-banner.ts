import * as THREE from 'three';
import {matte} from '../matte.ts';

// PLAZA PARTY BANNER — the giant billboard on the memorial plaza showing the
// live membership race between the RED and BLUE parties as two horizontal bars.
// build() is pure and returns the group with a `userData.redraw(red,blue)`
// closure that repaints the canvas texture; js/places/party-hq.ts places it
// (NOT baked — the texture updates at runtime) and calls redraw when the
// affiliate counts change.

const POST=matte({color:0x5b5f6b,roughness:.85});   // steel posts (FLEET grey)
const FRAME=matte({color:0x3d3f46,roughness:.9});   // dark panel frame

const RED_CSS='#c23b4e', BLUE_CSS='#3b7ac2';        // palette party colours

function draw(ctx:CanvasRenderingContext2D,red:number,blue:number){
  const W=1024,H=448;
  ctx.fillStyle='#14091f';ctx.fillRect(0,0,W,H);                 // NEON ink ground
  ctx.strokeStyle='#ffd24a';ctx.lineWidth=10;ctx.strokeRect(10,10,W-20,H-20); // gold trim
  ctx.textAlign='center';
  ctx.fillStyle='#ffe9c9';
  ctx.font='900 64px "Bowlby One SC",Impact,sans-serif';
  ctx.fillText('PARTY MEMBERSHIP',W/2,96);
  ctx.font='700 30px "IBM Plex Mono",monospace';
  ctx.fillStyle='#ffd24a';
  ctx.fillText('AFFILIATE AT A PARTY DESK - $100',W/2,142);
  // two horizontal bars, lengths proportional to the bigger count
  const max=Math.max(1,red,blue);
  const x0=250,x1=W-120,span=x1-x0;
  const rows:[string,number,string][]= [['RED',red,RED_CSS],['BLUE',blue,BLUE_CSS]];
  rows.forEach(([name,count,css],i)=>{
    const y=210+i*104;
    ctx.textAlign='left';
    ctx.fillStyle=css;
    ctx.font='900 44px "Bowlby One SC",Impact,sans-serif';
    ctx.fillText(name,60,y+46);
    ctx.fillStyle='rgba(255,233,201,.14)';                       // empty track
    ctx.fillRect(x0,y,span,64);
    ctx.fillStyle=css;
    ctx.fillRect(x0,y,Math.max(10,span*count/max),64);           // the bar itself
    ctx.strokeStyle='#ffe9c9';ctx.lineWidth=3;ctx.strokeRect(x0,y,span,64);
    ctx.textAlign='right';
    ctx.fillStyle='#ffe9c9';
    ctx.font='900 48px "IBM Plex Mono",monospace';
    ctx.fillText(String(count),W-24,y+50);
  });
}

function build():THREE.Group{
  const g=new THREE.Group();
  // two steel posts + the panel high above the plaza
  for(const px of[-4.6,4.6]){
    const post=new THREE.Mesh(new THREE.BoxGeometry(.4,7.6,.4),POST);
    post.position.set(px,3.8,0);post.castShadow=true;g.add(post);
  }
  const frame=new THREE.Mesh(new THREE.BoxGeometry(10.4,4.8,.24),FRAME);
  frame.position.set(0,7.4,0);frame.castShadow=true;g.add(frame);
  // canvas-drawn face (front, towards +z)
  const c=document.createElement('canvas');c.width=1024;c.height=448;
  const ctx=c.getContext('2d')!;
  draw(ctx,0,0);
  const tex=new THREE.CanvasTexture(c);
  tex.colorSpace=THREE.SRGBColorSpace;tex.anisotropy=8;
  const face=new THREE.Mesh(new THREE.PlaneGeometry(10,4.4),
    new THREE.MeshBasicMaterial({map:tex}));
  face.position.set(0,7.4,.14);g.add(face);
  // repaint hook for the live membership counts (called by party-hq)
  g.userData.redraw=(red:number,blue:number)=>{draw(ctx,red,blue);tex.needsUpdate=true;};
  g.userData.r=5.2;g.userData.h=9.8;
  return g;
}

export default {category:'City',label:'Party Banner',build};
