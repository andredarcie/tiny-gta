import * as THREE from 'three';

// Money pickup: a chunky bundle of banknotes instead of a flat green cube.
// A compressed brick of bills (banknote face on top/bottom, cut-paper edges on
// the sides), a few loose bills fanned on top, two kraft bank straps wrapping
// it, and an optional glow ring for the rotating/bobbing world pickup.
// Textures, materials and geometries are built ONCE at module load and shared
// across every drop — assembling a pickup is just cheap Group bookkeeping.

const W=0.58, H=0.2, D=0.26;            // bundle: width(x), stack height(y), depth(z)

function makeTex(w: number,h: number,draw: (x: CanvasRenderingContext2D,w: number,h: number)=>void): THREE.CanvasTexture{
  const c=document.createElement('canvas');c.width=w;c.height=h;
  draw(c.getContext('2d')!,w,h);
  const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;
  return t;
}

// Banknote face: FLAT green with a flat frame and a big "$".
const faceTex=makeTex(320,140,(x,w,h)=>{
  x.fillStyle='#3c9163';x.fillRect(0,0,w,h);
  x.strokeStyle='#e9f5ec';x.lineWidth=4;x.strokeRect(9,9,w-18,h-18);
  x.fillStyle='#eafaef';x.textAlign='center';x.textBaseline='middle';
  x.font='bold 70px Georgia, serif';x.fillText('$',w/2,h/2+3);
});


const faceMat=new THREE.MeshStandardMaterial({
  map:faceTex,roughness:.85,metalness:0,
  emissive:0x2f5d40,emissiveMap:faceTex,emissiveIntensity:.28}); // gentle self-glow so cash reads in shadow
const edgeMat=new THREE.MeshStandardMaterial({color:0xe6dcbc,roughness:.95,metalness:0}); // flat paper edge
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

export function makeMoneyDrop({pickup=true}: {pickup?:boolean}={}): THREE.Group{
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
