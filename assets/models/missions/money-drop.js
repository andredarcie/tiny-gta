import * as THREE from 'three';

// Money pickup: a chunky bundle of banknotes instead of a flat green cube.
// A compressed brick of bills (banknote face on top/bottom, cut-paper edges on
// the sides), a few loose bills fanned on top, two kraft bank straps wrapping
// it, and an optional glow ring for the rotating/bobbing world pickup.
// Textures, materials and geometries are built ONCE at module load and shared
// across every drop — assembling a pickup is just cheap Group bookkeeping.

const W=0.58, H=0.2, D=0.26;            // bundle: width(x), stack height(y), depth(z)

function makeTex(w,h,draw){
  const c=document.createElement('canvas');c.width=w;c.height=h;
  draw(c.getContext('2d'),w,h);
  const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;
  return t;
}

// Banknote face: green gradient, guilloché waves, double frame, central seal
// with a big "$", and "100" in the four corners.
const faceTex=makeTex(320,140,(x,w,h)=>{
  const g=x.createLinearGradient(0,0,0,h);
  g.addColorStop(0,'#4ea877');g.addColorStop(.5,'#3c9163');g.addColorStop(1,'#2f7a51');
  x.fillStyle=g;x.fillRect(0,0,w,h);
  // fine guilloché line-work
  x.strokeStyle='rgba(255,255,255,0.07)';x.lineWidth=1;
  for(let i=4;i<h;i+=6){
    x.beginPath();
    for(let px=0;px<=w;px+=4){const y=i+Math.sin((px/w)*Math.PI*7+i)*2.2;px?x.lineTo(px,y):x.moveTo(px,y);}
    x.stroke();
  }
  // double frame
  x.strokeStyle='#e9f5ec';x.lineWidth=4;x.strokeRect(9,9,w-18,h-18);
  x.strokeStyle='rgba(233,245,236,.45)';x.lineWidth=1.5;x.strokeRect(17,17,w-34,h-34);
  // central seal
  x.fillStyle='rgba(255,255,255,0.10)';x.beginPath();x.ellipse(w/2,h/2,36,42,0,0,Math.PI*2);x.fill();
  x.strokeStyle='#dff3e4';x.lineWidth=2;x.stroke();
  // big dollar sign
  x.fillStyle='#eafaef';x.textAlign='center';x.textBaseline='middle';
  x.font='bold 70px Georgia, serif';x.fillText('$',w/2,h/2+3);
  // corner denominations
  x.font='bold 22px Georgia, serif';
  x.fillText('100',42,30);x.fillText('100',w-42,30);
  x.fillText('100',42,h-28);x.fillText('100',w-42,h-28);
});

// Cut-paper edge: cream stock with thin horizontal lines = individual bill
// layers seen edge-on (V runs along the stack axis on every box side face).
const edgeTex=makeTex(48,128,(x,w,h)=>{
  const g=x.createLinearGradient(0,0,w,0);
  g.addColorStop(0,'#d8cca6');g.addColorStop(.5,'#efe6c9');g.addColorStop(1,'#d2c6a0');
  x.fillStyle=g;x.fillRect(0,0,w,h);
  for(let y=0;y<h;y+=3){
    x.strokeStyle=(y%6)?'rgba(120,104,70,0.30)':'rgba(150,135,95,0.18)';
    x.lineWidth=1;x.beginPath();x.moveTo(0,y+.5);x.lineTo(w,y+.5);x.stroke();
  }
  // faint green bleed from the printed faces at top and bottom edges
  x.fillStyle='rgba(70,150,100,0.22)';x.fillRect(0,0,w,4);x.fillRect(0,h-4,w,4);
});

const faceMat=new THREE.MeshStandardMaterial({
  map:faceTex,roughness:.85,metalness:0,
  emissive:0x2f5d40,emissiveMap:faceTex,emissiveIntensity:.28}); // gentle self-glow so cash reads in shadow
const edgeMat=new THREE.MeshStandardMaterial({map:edgeTex,roughness:.95,metalness:0});
const bandMat=new THREE.MeshStandardMaterial({color:0xc99a5b,roughness:.8,metalness:0}); // kraft bank strap
const glowMat=new THREE.MeshBasicMaterial({color:0x4dff7a,transparent:true,opacity:.28,depthWrite:false});

// Box material order is [+X,-X,+Y,-Y,+Z,-Z]: printed faces up/down, paper edges around.
const brickMats=[edgeMat,edgeMat,faceMat,faceMat,edgeMat,edgeMat];

const brickGeo=new THREE.BoxGeometry(W,H,D);
const billGeo=new THREE.BoxGeometry(W*0.96,0.014,D*0.94);
const bandGeo=new THREE.BoxGeometry(0.07,H+0.03,D+0.03);
const glowGeo=new THREE.TorusGeometry(0.5,0.04,8,28);

// Loose bills fanned on top of the brick (deterministic offsets/rotations).
const looseBills=[
  {x: 0.02,y:H/2+0.014,z:-0.015,ry: 0.10,rz: 0.00},
  {x:-0.03,y:H/2+0.030,z: 0.020,ry:-0.14,rz: 0.03},
  {x: 0.00,y:H/2+0.046,z:-0.030,ry: 0.05,rz:-0.02},
];

export function makeMoneyDrop({pickup=true}={}){
  const g=new THREE.Group();

  const brick=new THREE.Mesh(brickGeo,brickMats);
  brick.castShadow=true;g.add(brick);

  for(const b of looseBills){
    const bill=new THREE.Mesh(billGeo,brickMats);
    bill.position.set(b.x,b.y,b.z);
    bill.rotation.set(0,b.ry,b.rz);
    bill.castShadow=true;g.add(bill);
  }

  for(const sx of[-0.16,0.16]){
    const band=new THREE.Mesh(bandGeo,bandMat);
    band.position.x=sx;band.castShadow=true;g.add(band);
  }

  if(pickup){
    const glow=new THREE.Mesh(glowGeo,glowMat);
    glow.rotation.x=Math.PI/2;
    glow.position.y=-H/2-0.015;
    g.add(glow); // transparent ground glow, kept out of shadow casting
  }
  return g;
}

// Model descriptor for the model-viewer (auto-discovered). No glow ring in the gallery.
export default {category:'Missions',label:'Money drop',build:()=>makeMoneyDrop({pickup:false})};
