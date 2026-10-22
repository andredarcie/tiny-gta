import * as THREE from 'three';
import {rand} from '@/core/constants.ts';

// Fair-weather cumulus as the town's photos show them: a cauliflower of puffs, bright where
// the sun hits the top, a flat grey base. A few painted variants shared by the sprites.
function cumulusTexture(seed:number): THREE.CanvasTexture{
  const c=document.createElement('canvas');c.width=512;c.height=256;
  const x=c.getContext('2d')!;
  let a=seed>>>0;const r=():number=>{a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};
  const base=190;                                        // flat underside
  for(let k=0;k<70;k++){
    const u=r(),px=80+u*352,h=Math.sin(u*Math.PI);       // taller in the middle
    const R=18+r()*38*(.5+h),py=base-R*.55-r()*90*h;
    const g=x.createRadialGradient(px-R*.2,py-R*.35,R*.1,px,py,R);
    g.addColorStop(0,'rgba(255,255,255,.95)');g.addColorStop(.7,'rgba(246,247,249,.8)');g.addColorStop(1,'rgba(240,242,246,0)');
    x.fillStyle=g;x.beginPath();x.arc(px,py,R,0,Math.PI*2);x.fill();
  }
  x.clearRect(0,base,512,256-base);                       // cut the base flat
  // shade: the underside and the lee of the puffs go blue-grey
  x.globalCompositeOperation='source-atop';
  const sh=x.createLinearGradient(0,60,0,base);
  sh.addColorStop(0,'rgba(150,160,175,0)');sh.addColorStop(.65,'rgba(150,160,175,.25)');sh.addColorStop(1,'rgba(120,130,148,.6)');
  x.fillStyle=sh;x.fillRect(0,0,512,base);
  x.globalCompositeOperation='source-over';
  const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;
  return t;
}

export function makeClouds(count=18): THREE.Sprite[]{
  const clouds: THREE.Sprite[]=[];
  const texs=[cumulusTexture(3),cumulusTexture(7),cumulusTexture(11)];
  for(let k=0;k<count;k++){
    const sp=new THREE.Sprite(new THREE.SpriteMaterial({map:texs[k%texs.length],transparent:true,
      opacity:rand(.75,.95),fog:false,depthWrite:false}));
    const s=rand(110,210);sp.scale.set(s,s*.5,1);
    sp.position.set(rand(-560,560),rand(95,170),rand(-560,560));
    sp.userData.v=rand(1.5,3.5);
    clouds.push(sp);
  }
  return clouds;
}

// Padrão de modelo: no jogo as nuvens são espalhadas pelo céu (makeClouds), mas
// no preview agrupamos algumas perto da origem pra enquadrar bem.
function buildPreview(): THREE.Group{
  const g=new THREE.Group();
  const sprs=makeClouds(5);
  sprs.forEach((sp,i)=>{sp.position.set((i-2)*60,rand(-10,10),rand(-30,30));g.add(sp);});
  return g;
}
export default {category:'Ambiente',label:'Nuvens',build:buildPreview};
