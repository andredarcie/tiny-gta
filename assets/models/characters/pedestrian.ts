import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {scene} from '@/core/engine.ts';

// Character dolls. The player and every NPC are the SAME smooth skinned doll
// (buildToonPlayer): one continuous surface deformed by a small bone skeleton, so
// the limbs bend at the elbow/knee with no part seams. It exposes userData.limbs
// (the bones, by name), userData.mouth and userData.fadeMats, which animatePed, the
// driving/aiming poses and attachHandGun all drive. The mouth is a separate mesh
// because story.js animates its scale.y while an NPC talks.

// Shared part geometries for the doll. One model per moving segment; the limbs are
// continuous tubes bent by the bone skeleton.
const pedNeckG=new THREE.CylinderGeometry(.08,.09,.16,7);
const noseG=new THREE.ConeGeometry(.04,.12,6);
const mouthG=new THREE.BoxGeometry(.15,.025,.018);
const browG=new THREE.BoxGeometry(.12,.025,.02);
const hairG=new THREE.SphereGeometry(.255,8,5);
// Toon (Schedule I-style) face: a big pale eyeball with a small dark pupil, a heavy
// upper eyelid for the half-lidded look, a small ear and a smooth egg head.
const toonScleraG=new THREE.SphereGeometry(.07,16,12);
const toonPupilG=new THREE.SphereGeometry(.03,12,10);
const toonEarG=new THREE.SphereGeometry(.05,10,8);
const toonEyelidG=new THREE.SphereGeometry(.07,16,12);
const toonHeadG=new THREE.SphereGeometry(.24,28,20);
const toonHandG=new THREE.SphereGeometry(.062,12,10);
const toonFootG=new THREE.SphereGeometry(.1,12,10);
// Smooth skinned body. Each limb is ONE continuous surface (no thigh-stuck-to-shin
// seam): the torso is a single capsule (rigid, so rounded caps suffice), and the
// arms/legs are cylinders with many HEIGHT segments so skinning bends the single
// tube smoothly at the elbow/knee — like a real human limb.
const skTorsoG=new THREE.CapsuleGeometry(.15,.4,12,22);
const skArmG=new THREE.CylinderGeometry(.06,.033,.58,16,16);    // wide shoulder -> thin wrist (tapered)
const skLegG=new THREE.CylinderGeometry(.072,.05,.9,18,16);     // hip -> ankle
const skShoulderG=new THREE.SphereGeometry(.058,14,12);        // small rounded shoulder (sleeve cap)
const skYokeG=new THREE.CapsuleGeometry(.062,.32,8,16);        // horizontal shoulder yoke (broad shoulders)
// Female-look add-ons (see addFemaleLook): a long hairstyle (crown cap + a length
// down the back + two side locks framing the face) plus a subtle bust. They are
// extra meshes layered over the unisex doll — the same trick the redneck hat uses.
const femHairCapG=new THREE.SphereGeometry(.185,14,12);
const femHairBackG=new THREE.SphereGeometry(.15,12,12);
const femLockG=new THREE.SphereGeometry(.085,10,10);
const femBustG=new THREE.SphereGeometry(.06,12,10);

const skinColors=[0xf0c08b,0xd9a06b,0xb8754c,0x8f5637,0x6f3e2a];
const pantsColors=[0x202435,0x263454,0x2e2a24,0x3d3f46,0x18191f];
const shoeColors=[0x111117,0x33251e,0xe8e3d2,0x1f2733];
const facialHairColors=[0x17100c,0x2a1911,0x4a2b18,0x6b5137,0x0d0d12];
export const shirtColors=[0xc23b4e,0x3b7ac2,0xcf9a3a,0x3aa06b,0xd96fae,0xe8e3d2,0x7a4f9e,0x40c8c0];

const SCLERA_COLOR=0xece6da,PUPIL_COLOR=0x15101e;

const _p=new THREE.Vector3(),_q=new THREE.Quaternion(),_s=new THREE.Vector3(),
  _e=new THREE.Euler(),_c=new THREE.Color();

function partM(p: number[],r?: number[]|null,s?: number[]|null): THREE.Matrix4{
  return new THREE.Matrix4().compose(
    _p.set(p[0],p[1],p[2]),
    _q.setFromEuler(_e.set(r?r[0]:0,r?r[1]:0,r?r[2]:0)),
    _s.set(s?s[0]:1,s?s[1]:1,s?s[2]:1));
}

// Clona a geometria base já transformada e com a cor cozida por vértice
function tinted(geo: THREE.BufferGeometry,m: THREE.Matrix4,c: THREE.ColorRepresentation): THREE.BufferGeometry{
  const g=geo.clone();
  g.applyMatrix4(m);
  _c.set(c);
  const n=g.attributes.position.count,col=new Float32Array(n*3);
  for(let i=0;i<n;i++){col[i*3]=_c.r;col[i*3+1]=_c.g;col[i*3+2]=_c.b;}
  g.setAttribute('color',new THREE.BufferAttribute(col,3));
  return g;
}

// Like tinted() but blends two colors along world-Y, so a single continuous mesh
// can show a clothing line (shirt over pants) without a seam.
function tintedY(geo: THREE.BufferGeometry,m: THREE.Matrix4,colBot: THREE.ColorRepresentation,colTop: THREE.ColorRepresentation,yMid: number,band: number): THREE.BufferGeometry{
  const g=geo.clone();g.applyMatrix4(m);
  const p=g.attributes.position,nn=p.count,col=new Float32Array(nn*3);
  const cB=new THREE.Color(colBot),cT=new THREE.Color(colTop),c=new THREE.Color();
  for(let i=0;i<nn;i++){
    const t=Math.max(0,Math.min(1,(p.getY(i)-(yMid-band))/(2*band)));
    c.copy(cB).lerp(cT,t);
    col[i*3]=c.r;col[i*3+1]=c.g;col[i*3+2]=c.b;
  }
  g.setAttribute('color',new THREE.BufferAttribute(col,3));
  return g;
}

function pickOf(arr: number[]): number{return arr[Math.floor(Math.random()*arr.length)];}

// ===========================================================================
// The character doll (Schedule I look) as a single SMOOTH SkinnedMesh.
// One continuous surface deformed by a bone skeleton — no joint balls, no part
// seams: the limbs are seamless tubes that bend smoothly, like the real game. The
// rig API is userData.limbs (bones with .rotation), userData.mouth and
// userData.fadeMats, so animatePed, the driving/aiming poses and attachHandGun
// all work against it.
// ===========================================================================
export function buildToonPlayer({color=0x19e3ff,pantsColor,skin}: {color?: number; pantsColor?: number; skin?: number}={}): THREE.Group{
  skin=skin??pickOf(skinColors);
  const pants=pantsColor??pickOf(pantsColors);
  const shoe=pickOf(shoeColors);
  const hairColor=pickOf(facialHairColors);
  // human proportions (~6.5 heads tall, H≈1.80): smaller head, longer limbs,
  // legs ≈ half the height, arms reaching mid-thigh
  const hsx=.5,hsy=.58,hsz=.52;                       // small egg head (correct head:body ratio)
  const headM=partM([0,1.66,0],null,[hsx,hsy,hsz]);  // center → crown ~1.80, chin ~1.52
  const onHead=(p: number[],r?: number[]|null,s?: number[]|null)=>headM.clone().multiply(partM(p,r,s));
  const SX=.22,LX=.09;                                // shoulder (broad) / leg x offsets

  // bone indices (must match the `bones` array below)
  const HIPS=0,SPINE=1,HEAD=2,UAL=3,LAL=4,UAR=5,LAR=6,ULL=7,LLL=8,ULR=9,LLR=10;

  // PER-PART skinning: every part is bound to a FIXED bone (or, for a limb tube,
  // blends along Y between the two bones of THAT SAME limb at the elbow/knee).
  // Because a torso vertex is never assigned to an arm bone, the shoulder/hip is a
  // clean cut — swinging a limb can't stretch a web of skin ("bat wing").
  const parts: THREE.BufferGeometry[]=[];
  // Garment recolor map: each clothing part records its vertex range in the merged
  // geometry plus a recipe (flat colour from a role, or a Y-gradient between two roles),
  // so g.userData.setClothing() can rewrite ONLY those vertices at runtime — no rebuild.
  const recolorOps: {start:number;count:number;kind:'flat'|'yblend';role?:string;bot?:string;top?:string;yMid?:number;band?:number}[]=[];
  let voff=0;
  const add=(geo: THREE.BufferGeometry,top: number,bot: number,yJ=0,band=0,recolor?: {kind:'flat'|'yblend';role?:string;bot?:string;top?:string;yMid?:number;band?:number})=>{
    const p=geo.attributes.position,nn=p.count;
    const si=new Uint16Array(nn*4),sw=new Float32Array(nn*4);
    for(let i=0;i<nn;i++){
      const w=(top===bot)?1:Math.max(0,Math.min(1,(p.getY(i)-(yJ-band))/(2*band)));
      si[i*4]=top;sw[i*4]=w;si[i*4+1]=bot;sw[i*4+1]=1-w;
    }
    geo.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(si,4));
    geo.setAttribute('skinWeight',new THREE.Float32BufferAttribute(sw,4));
    if(recolor)recolorOps.push({start:voff,count:nn,...recolor});
    voff+=nn;
    parts.push(geo);
  };

  // torso (→spine) + broad shoulder yoke + neck/head/nose (→head bone); all static
  // during walking. Yoke makes the shoulders wider than the chest so the arms hang
  // OUTSIDE the torso (a real armpit gap, not arms glued to the sides).
  add(tintedY(skTorsoG,partM([0,1.13,0],null,[.98,1,.7]),pants,color,1.0,.05),SPINE,SPINE,0,0,{kind:'yblend',bot:'pants',top:'shirt',yMid:1.0,band:.05});
  add(tinted(skYokeG,partM([0,1.43,0],[0,0,Math.PI/2],[1,1,.82]),color),SPINE,SPINE,0,0,{kind:'flat',role:'shirt'});
  add(tinted(pedNeckG,partM([0,1.49,0],null,[.6,.7,.6]),skin),HEAD,HEAD);
  add(tinted(toonHeadG,headM,skin),HEAD,HEAD);
  add(tinted(noseG,onHead([0,-.03,.246],[Math.PI/2,0,0],[.42,.42,.42]),skin),HEAD,HEAD);
  for(const sx of[-1,1]){
    const UA=sx<0?UAL:UAR,LA=sx<0?LAL:LAR,UL=sx<0?ULL:ULR,LL=sx<0?LLL:LLR;
    add(tinted(skShoulderG,partM([sx*SX,1.44,0]),color),UA,UA,0,0,{kind:'flat',role:'shirt'});      // small shoulder = shirt sleeve
    add(tintedY(skArmG,partM([sx*SX,1.17,0]),skin,color,1.3,.05),UA,LA,1.13,.07,{kind:'yblend',bot:'skin',top:'shirt',yMid:1.3,band:.05}); // sleeve top, bare arm below; bends at elbow
    add(tinted(toonHandG,partM([sx*SX,.85,.005],null,[.82,1.3,.46]),skin),LA,LA);   // flat paddle palm
    add(tinted(toonHandG,partM([sx*(SX-.045),.88,.03],null,[.42,.62,.42]),skin),LA,LA); // thumb
    add(tinted(skLegG,partM([sx*LX,.5,0]),pants),UL,LL,.52,.06,{kind:'flat',role:'pants'});         // leg: PANTS only (the shoe is its own mesh below)
    // SHOE: the original-size foot mesh (realistic proportions), its own geometry separate
    // from the leg/pants, on the ankle bone — recoloured by the clothing store (subtle, but
    // it keeps the realistic look the player preferred).
    add(tinted(toonFootG,partM([sx*LX,.05,.06],null,[.78,.5,1.7]),shoe),LL,LL,0,0,{kind:'flat',role:'shoe'});
  }
  for(const sx of[-1,1]){
    add(tinted(toonScleraG,onHead([sx*.089,.026,.196],null,[.95,.74,.42]),SCLERA_COLOR),HEAD,HEAD);
    add(tinted(toonPupilG,onHead([sx*.089-.006,.014,.224],null,[.9,.95,.5]),PUPIL_COLOR),HEAD,HEAD);
    add(tinted(toonEyelidG,onHead([sx*.089,.07,.2],[-.28,0,0],[.98,.5,.42]),skin),HEAD,HEAD);
    add(tinted(browG,onHead([sx*.089,.136,.197],[0,0,-sx*.08],[.92,.8,1]),hairColor),HEAD,HEAD);
    add(tinted(toonEarG,onHead([sx*.226,-.015,-.02],null,[.5,1,.95]),skin),HEAD,HEAD);
  }
  add(tinted(hairG,onHead([0,.16,-.055],null,[1.0,.6,1.05]),hairColor),HEAD,HEAD);
  add(tinted(hairG,onHead([0,.03,-.14],null,[.9,.66,.62]),hairColor),HEAD,HEAD);

  const geo=mergeGeometries(parts,false);

  // ---- skeleton (bones at rest = identity rotation, child offset down -Y, so the
  // existing animation code that sets limb.rotation.x/z behaves exactly as before) ----
  const mk=(x: number,y: number,z: number)=>{const bo=new THREE.Bone();bo.position.set(x,y,z);return bo;};
  const root=mk(0,.97,0);
  const spine=mk(0,.27,0);root.add(spine);                              // world 1.24
  const head=mk(0,.26,0);spine.add(head);                               // world 1.50
  const uaL=mk(-SX,.21,0);spine.add(uaL);const laL=mk(0,-.32,0);uaL.add(laL); // 1.45 / 1.13
  const uaR=mk(SX,.21,0);spine.add(uaR);const laR=mk(0,-.32,0);uaR.add(laR);
  const ulL=mk(-LX,-.02,0);root.add(ulL);const llL=mk(0,-.43,0);ulL.add(llL);  // .95 / .52
  const ulR=mk(LX,-.02,0);root.add(ulR);const llR=mk(0,-.43,0);ulR.add(llR);
  const bones=[root,spine,head,uaL,laL,uaR,laR,ulL,llL,ulR,llR];

  const mat=new THREE.MeshStandardMaterial({roughness:.92,vertexColors:true});
  const mesh=new THREE.SkinnedMesh(geo,mat);
  mesh.castShadow=true;
  mesh.add(root);
  mesh.updateMatrixWorld(true);              // bone world matrices before binding
  mesh.bind(new THREE.Skeleton(bones));
  mesh.onBeforeRender=()=>mesh.skeleton.update();   // keep the deform current each frame

  const g=new THREE.Group();
  g.add(mesh);

  // mouth stays a separate mesh (story.js animates its scale.y when the NPC talks)
  const mouthMat=new THREE.MeshBasicMaterial({color:0x3a2622});
  const mouth=new THREE.Mesh(mouthG,mouthMat);
  mouth.position.setFromMatrixPosition(onHead([0,-.1,.232]));
  mouth.scale.set(.42*hsx,.3,1);   // small, subtle line — not an open mouth
  g.add(mouth);
  g.userData.mouth=mouth;

  // rig API: limbs are BONES (Object3D with .rotation) under the same names. `head` is
  // exposed too so the gore layer can collapse it on a decapitation (js/combat/gore.ts).
  g.userData.limbs={
    head,
    leftArm:uaL,rightArm:uaR,leftForearm:laL,rightForearm:laR,
    leftLeg:ulL,rightLeg:ulR,leftCalf:llL,rightCalf:llR,
  };
  g.userData.fadeMats=[mat,mouthMat];

  // Runtime re-clothing (used by the clothing store): rewrite the per-vertex colour for
  // each tagged garment range without rebuilding the mesh. Roles map to live colours; the
  // skin/hair/face vertices were never tagged, so they stay. Y-gradient parts (torso line,
  // sleeve cuff) are recomputed from the merged position so the clothing seam stays clean.
  const colAttr=geo.getAttribute('color') as THREE.BufferAttribute;
  const posAttr=geo.getAttribute('position') as THREE.BufferAttribute;
  const _rc=new THREE.Color(),_rcA=new THREE.Color(),_rcB=new THREE.Color();
  g.userData.clothing={shirt:color,pants,shoe,skin};
  g.userData.hairColor=hairColor; // exposed so addFemaleLook can match the brows/hair
  g.userData.setClothing=(cols: {shirt?: number;pants?: number;shoe?: number})=>{
    const c=Object.assign(g.userData.clothing,cols) as Record<string,number>;
    for(const op of recolorOps){
      if(op.kind==='flat'){
        _rc.set(c[op.role!]);
        for(let i=op.start;i<op.start+op.count;i++)colAttr.setXYZ(i,_rc.r,_rc.g,_rc.b);
      }else{
        _rcA.set(c[op.bot!]);_rcB.set(c[op.top!]);
        const yMid=op.yMid!,band=op.band!;
        for(let i=op.start;i<op.start+op.count;i++){
          const t=Math.max(0,Math.min(1,(posAttr.getY(i)-(yMid-band))/(2*band)));
          _rc.copy(_rcA).lerp(_rcB,t);colAttr.setXYZ(i,_rc.r,_rc.g,_rc.b);
        }
      }
    }
    colAttr.needsUpdate=true;
  };
  return g;
}

// Padrão de modelo: build() puro; descriptor pro model-viewer (descoberta automática).
export default {category:'Characters',label:'Pedestrian',build:buildToonPlayer};

// Compat: gameplay usa makePed(color,pantsColor) e espera o ped já na cena.
// Jogador e NPCs usam a MESMA base skinada (buildToonPlayer), variando só a cor de
// roupa/pele.
export function makePed(color: number,pantsColor?: number): THREE.Group{
  const g=buildToonPlayer({color,pantsColor});scene.add(g);return g;
}

// Player-only helper: the smooth Schedule I skinned figure (see buildToonPlayer).
export function makePlayerPed(color: number): THREE.Group{
  const g=buildToonPlayer({color});scene.add(g);return g;
}

// Give an already-built doll a FEMALE appearance — MANDATORY for every female NPC.
// Two unmistakable cues: BIG HAIR (a full crown + a long mane down the back + thick
// side locks framing the face) and bright LIPSTICK, plus a subtle bust. Layered as a
// single extra mesh over the unisex doll (same approach as the redneck hat), so it
// works on ANY doll regardless of how it was spawned — the Npc base calls this once
// for every female NPC. Idempotent guard via userData.femaleLook so it never doubles.
const LIPSTICK=0xe23a64; // vivid red lipstick
export function addFemaleLook(g: THREE.Object3D): void{
  if(g.userData.femaleLook)return;
  g.userData.femaleLook=true;
  const hairColor=(g.userData.hairColor as number)??0x2a1911;
  const shirt=(g.userData.clothing?.shirt as number)??0xc23b4e;
  const parts: THREE.BufferGeometry[]=[];
  // HAIR: a neat crown hugging the egg head (front kept clear of the eyes), a
  // shoulder-length mane down the back, and a soft lock framing each side. Scales kept
  // proportionate so it reads clearly as female without ballooning over the head.
  parts.push(tinted(femHairCapG,partM([0,1.70,-.04],null,[.96,.95,1.04]),hairColor));          // crown, close to the head
  parts.push(tinted(femHairBackG,partM([0,1.34,-.11],null,[1.08,1.7,.55]),hairColor));         // shoulder-length mane
  for(const sx of[-1,1]){
    parts.push(tinted(femLockG,partM([sx*.17,1.46,.03],null,[.62,1.5,.92]),hairColor));         // side lock framing the face
    parts.push(tinted(femBustG,partM([sx*.07,1.255,.085],null,[1,.85,.95]),shirt));             // subtle bust
  }
  const merged=mergeGeometries(parts,false);
  const mat=new THREE.MeshStandardMaterial({roughness:.9,vertexColors:true});
  const mesh=new THREE.Mesh(merged,mat);
  mesh.castShadow=true;
  g.add(mesh);
  // the long hair is a SEPARATE (non-skinned) mesh, so a decapitation must hide it by
  // hand — expose it for the gore layer (js/combat/gore.ts severHead).
  g.userData.femaleHairMesh=mesh;
  // fade with the body on death (setOpacity drives userData.fadeMats)
  (g.userData.fadeMats as THREE.Material[]|undefined)?.push(mat);
  // bright LIPSTICK — the mouth is its own mesh; recolour it and widen it a touch so
  // the lips read clearly as made-up.
  const mouth=g.userData.mouth as THREE.Mesh|undefined;
  if(mouth){
    (mouth.material as THREE.MeshBasicMaterial).color.set(LIPSTICK);
    mouth.scale.x*=1.3;mouth.scale.y*=1.5;
  }
}
