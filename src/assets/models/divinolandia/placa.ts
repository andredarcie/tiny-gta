import * as THREE from 'three';
import {matte} from '../matte.ts';
import {atlasSign,mapToSlot,type AtlasSlot} from './sign-atlas.ts';

// Placa — a two-post sign with painted lettering (canvas texture, readable from both
// sides). Used for the DER-green road sign at the town entrance ("DIVINOLÂNDIA"),
// the hospital name and the mirante sign. Pure build(opts); the system places it.
const postM=matte({color:0x9a9c9e});
export type PlacaOpts={lines?:string[];w?:number;h?:number;bg?:string;fg?:string;postH?:number};
// painted on the shared sign atlas (sign-atlas.ts); the same lettering reuses its slot
const slotCache=new Map<string,AtlasSlot|null>();
function signSlot(lines:string[],bg:string,fg:string,aspect:number):AtlasSlot|null{
  const key=lines.join('|')+bg+fg+aspect;
  if(slotCache.has(key))return slotCache.get(key)!;
  const slot=atlasSign(512,Math.round(512/aspect),(x,W,H)=>{
    x.fillStyle=bg;x.fillRect(0,0,W,H);
    x.strokeStyle=fg;x.lineWidth=6;x.strokeRect(10,10,W-20,H-20);
    x.fillStyle=fg;x.textAlign='center';x.textBaseline='middle';
    const n=lines.length;
    lines.forEach((t,i)=>{
      const size=Math.min(H*.62/n,(W-60)/Math.max(4,t.length)*1.7);
      x.font=`700 ${size|0}px "Barlow Condensed",monospace`;
      x.fillText(t,W/2,H*(i+.5)/n);
    });
  });
  slotCache.set(key,slot);return slot;
}
function build(o:PlacaOpts={}):THREE.Group{
  const lines=o.lines||['DIVINOLÂNDIA'],w=o.w||4.4,h=o.h||1.4,postH=o.postH??2.4;
  const g=new THREE.Group();
  for(const sx of[-w/2+.3,w/2-.3]){
    const p=new THREE.Mesh(new THREE.CylinderGeometry(.06,.06,postH+h,6),postM);
    p.position.set(sx,(postH+h)/2,0);g.add(p);
  }
  const slot=signSlot(lines,o.bg||'#1f6b3a',o.fg||'#f4f4ee',w/h);
  if(!slot)return g;
  // the lettering on both faces (two one-sided boards back to back)
  for(const back of[false,true]){
    const geo=new THREE.PlaneGeometry(w,h);mapToSlot(geo,slot);
    const board=new THREE.Mesh(geo,slot.mat);
    board.position.set(0,postH+h/2,back?-.02:0);if(back)board.rotation.y=Math.PI;g.add(board);
  }
  return g;
}
export default {category:'Divinolândia',label:'Placa (DER)',build,
  variants:[{label:'Entrada da cidade',opts:{}},{label:'Mirante',opts:{lines:['MIRANTE','MORRO DA TORRE · 1380 m'],bg:'#6b4a2a'}}]};
