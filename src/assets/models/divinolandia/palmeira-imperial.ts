import * as THREE from 'three';
import {matte} from '../matte.ts';
import {canvasTex} from './posto-kit.ts';

// Royal palm (palmeira-imperial, Roystonea oleracea) — the tall palms lining the sítio drive
// and the verge of the Rua São Paulo at the masonic monument (Street View sitio-*): a smooth
// pale-grey trunk, a little swollen near the foot, ringed faintly; the glossy green
// crownshaft; a crown of long arching feather fronds, the lowest drooping. Some stand with
// the foot of the trunk whitewashed (the verge across the road). build({h,whitewash}) is
// pure; h = height to the top of the crownshaft. Origin at the foot of the trunk.
const trunkM=matte({color:0xb9b6ad,map:canvasTex(16,128,(x,w,h)=>{x.fillStyle='#ffffff';x.fillRect(0,0,w,h);
  for(let y=4;y<h;y+=9){x.fillStyle='rgba(90,85,75,.25)';x.fillRect(0,y,w,1);}})});
const lime=matte({color:0xf4f3ee}),shaft=matte({color:0x5f8a3a});
const jerivaM=matte({color:0x8e8a82}),bootM=matte({color:0x6e6248});
let frond:THREE.Material|null=null;
const frondM=():THREE.Material=>frond??=matte({side:THREE.DoubleSide,alphaTest:.5,map:canvasTex(64,256,(x,w,h)=>{
  x.clearRect(0,0,w,h);x.strokeStyle='#4f7a32';x.lineWidth=2.5;
  for(let y=6;y<h-4;y+=5){const L=(w/2-2)*Math.min(1,Math.sin(Math.PI*y/h)*1.3);
    x.beginPath();x.moveTo(w/2,y);x.lineTo(w/2-L,y+8);x.moveTo(w/2,y);x.lineTo(w/2+L,y+8);x.stroke();}
  x.strokeStyle='#8a8a5a';x.lineWidth=3;x.beginPath();x.moveTo(w/2,0);x.lineTo(w/2,h);x.stroke();})});
// one frond: a strip bent from up-and-out to drooping, its leaflets in the texture
function frondGeo(len:number,droop:number):THREE.BufferGeometry{
  const n=7,pos:number[]=[],uv:number[]=[],W=.75;
  const pt=(t:number):[number,number]=>[len*t,len*(.5*t-droop*t*t)];
  for(let i=0;i<n;i++){
    const t0=i/n,t1=(i+1)/n,[x0,y0]=pt(t0),[x1,y1]=pt(t1),w0=W*Math.sin(Math.PI*Math.max(t0,.1)),w1=W*Math.sin(Math.PI*Math.max(t1,.1));
    pos.push(x0,y0,-w0,x1,y1,-w1,x1,y1,w1, x0,y0,-w0,x1,y1,w1,x0,y0,w0);
    uv.push(0,t0,0,t1,1,t1, 0,t0,1,t1,1,t0);
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));
  g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.computeVertexNormals();return g;
}
const geos=[frondGeo(4.2,.9),frondGeo(4,.55),frondGeo(3.4,.15)];

// jeriva = the jerivá (Syagrus romanzoffiana), the common palm of the town's squares and
// gardens (Street View pub-rosario, pub-dombosco): a slender grey ringed trunk with no green
// crownshaft, the old frond bases at its top, the same arching feathery fronds.
function build(o:{h?:number;whitewash?:boolean;seed?:number;jeriva?:boolean}={}):THREE.Group{
  const g=new THREE.Group(),j=!!o.jeriva,h=o.h??(j?8.5:12),s=o.seed??1,th=j?h-.6:h-2.2,k=j?.62:1;
  // trunk: slightly swollen in the lower third, then straight
  const pts=[0,.18,.35,.6,1].map((t,i)=>new THREE.Vector2([.33,.36,.34,.27,.25][i]*k,t*th));
  const t=new THREE.Mesh(new THREE.LatheGeometry(pts,10),j?jerivaM:trunkM);t.castShadow=true;g.add(t);
  if(o.whitewash){const w=new THREE.Mesh(new THREE.CylinderGeometry(.37*k,.35*k,1.4,10),lime);w.position.y=.7;g.add(w);}
  if(j){const b=new THREE.Mesh(new THREE.CylinderGeometry(.3,.18,.9,8),bootM);b.position.y=th+.2;g.add(b);}
  else{
    const c=new THREE.Mesh(new THREE.CylinderGeometry(.24,.28,2.2,10),shaft);c.position.y=th+1.1;c.castShadow=true;g.add(c);
    const tip=new THREE.Mesh(new THREE.ConeGeometry(.24,.8,8),shaft);tip.position.y=h+.4;g.add(tip);
  }
  const m=frondM();
  for(const[tier,n]of[[0,7],[1,6],[2,4]] as [number,number][])for(let i=0;i<n;i++){
    const a=(i+tier*.4+s*.13)/n*Math.PI*2,f=new THREE.Mesh(geos[tier],m);
    f.position.set(0,h-.1+tier*.25,0);f.rotation.set(0,a,(tier-.5)*.18,'YXZ');f.castShadow=true;g.add(f);
  }
  return g;
}

export default {category:'Divinolândia',label:'Palmeira imperial',build,variants:[{label:'Caiada',opts:{whitewash:true}},{label:'Alta',opts:{h:16}},{label:'Jerivá',opts:{jeriva:true}}]};
