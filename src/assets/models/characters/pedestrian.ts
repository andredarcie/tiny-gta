import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {scene} from '@/core/engine.ts';
import {SHIRT_COLORS,SKIN_TONES,HAIR_COLORS,PANTS_COLORS} from '@/core/palette.ts';

// BOX CHARACTERS. The player and every NPC are the same doll made only of boxes:
// pelvis, torso, head (+ hair, eyes), upper arm, forearm, hand, thigh, calf and shoe.
// Built purely in code — no downloaded models, no animation clips.
//
// Each box is rigidly bound to ONE bone of a tiny 11-bone skeleton and all boxes are
// merged into a single SkinnedMesh, so a character is still one draw call. The rig API
// is userData.limbs (bones with .rotation), userData.mouth and userData.fadeMats; the
// simple procedural animations (animatePed walk cycle, poseAiming, the driving/riding
// poses, the bench press, the dance, the swim stroke) just rotate those bones.

// Unit box; every part is this box scaled/placed by a matrix.
const boxG=new THREE.BoxGeometry(1,1,1);
const mouthG=new THREE.BoxGeometry(.1,.022,.012);

const skinColors=SKIN_TONES,pantsColors=PANTS_COLORS,hairColors=HAIR_COLORS;
const shoeColors=[0x111117,0x33251e,0xe8e3d2,0x1f2733];
// Shared wardrobe vocabulary — lives in the central palette (js/core/palette.ts).
export const shirtColors=SHIRT_COLORS;

const EYE_COLOR=0x15101e;

// Doll dimensions (metres). Head centre 1.66 / crown ~1.80, like the old doll, so
// hats, accessories, seat offsets and the gore layer still line up.
const HEAD_Y=1.66,HEAD=.26;
const SX=.22,LX=.09;                                  // shoulder / hip x offsets (bone pivots)

const _c=new THREE.Color();
function pickOf(arr: number[]): number{return arr[Math.floor(Math.random()*arr.length)];}

// A box of size (w,h,d) centred at (x,y,z), vertex-coloured.
function box(w: number,h: number,d: number,x: number,y: number,z: number,color: THREE.ColorRepresentation): THREE.BufferGeometry{
  const g=boxG.clone();
  g.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(x,y,z),new THREE.Quaternion(),new THREE.Vector3(w,h,d)));
  _c.set(color);
  const n=g.attributes.position.count,col=new Float32Array(n*3);
  for(let i=0;i<n;i++){col[i*3]=_c.r;col[i*3+1]=_c.g;col[i*3+2]=_c.b;}
  g.setAttribute('color',new THREE.BufferAttribute(col,3));
  return g;
}

export function buildToonPlayer({color=0x19e3ff,pantsColor,skin}: {color?: number; pantsColor?: number; skin?: number}={}): THREE.Group{
  skin=skin??pickOf(skinColors);
  const pants=pantsColor??pickOf(pantsColors);
  const shoe=pickOf(shoeColors);
  const hairColor=pickOf(hairColors);

  // bone indices (must match the `bones` array below)
  const HIPS=0,SPINE=1,HEADB=2,UAL=3,LAL=4,UAR=5,LAR=6,ULL=7,LLL=8,ULR=9,LLR=10;

  const parts: THREE.BufferGeometry[]=[];
  // Garment recolour map: vertex ranges of clothing boxes, so setClothing() can rewrite
  // just those colours at runtime (clothing store) without rebuilding the mesh.
  const recolorOps: {start:number;count:number;role:string}[]=[];
  let voff=0;
  const add=(geo: THREE.BufferGeometry,bone: number,role?: string)=>{
    const nn=geo.attributes.position.count;
    const si=new Uint16Array(nn*4),sw=new Float32Array(nn*4);
    for(let i=0;i<nn;i++){si[i*4]=bone;sw[i*4]=1;}      // rigid: 100% on one bone
    geo.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(si,4));
    geo.setAttribute('skinWeight',new THREE.Float32BufferAttribute(sw,4));
    if(role)recolorOps.push({start:voff,count:nn,role});
    voff+=nn;
    parts.push(geo);
  };

  // body
  add(box(.32,.2,.2, 0,.93,0, pants),HIPS,'pants');                       // pelvis
  add(box(.38,.52,.22, 0,1.25,0, color),SPINE,'shirt');                   // torso
  add(box(.1,.08,.1, 0,1.53,0, skin),HEADB);                              // neck
  // head
  add(box(HEAD,HEAD+.02,HEAD, 0,HEAD_Y,0, skin),HEADB);
  add(box(HEAD+.02,.07,HEAD+.02, 0,HEAD_Y+.14,-.005, hairColor),HEADB);    // hair top
  add(box(HEAD+.02,.2,.05, 0,HEAD_Y+.03,-.125, hairColor),HEADB);          // hair back
  for(const sx of[-1,1])
    add(box(.045,.045,.02, sx*.06,HEAD_Y+.02,HEAD/2+.005, EYE_COLOR),HEADB); // eyes
  // limbs
  for(const sx of[-1,1]){
    const UA=sx<0?UAL:UAR,LA=sx<0?LAL:LAR,UL=sx<0?ULL:ULR,LL=sx<0?LLL:LLR;
    const ax=sx*(SX+.03);
    add(box(.11,.34,.11, ax,1.29,0, color),UA,'shirt');                    // upper arm (sleeve)
    add(box(.09,.3,.09, ax,.98,0, skin),LA);                               // forearm
    add(box(.09,.09,.09, ax,.79,0, skin),LA);                              // hand
    add(box(.14,.44,.15, sx*LX,.73,0, pants),UL,'pants');                  // thigh
    add(box(.12,.44,.13, sx*LX,.3,0, pants),LL,'pants');                   // calf
    add(box(.13,.08,.25, sx*LX,.04,.04, shoe),LL,'shoe');                  // shoe
  }

  const geo=mergeGeometries(parts,false);

  // ---- skeleton (rest = identity rotation, children offset down -Y) ----
  const mk=(x: number,y: number,z: number)=>{const bo=new THREE.Bone();bo.position.set(x,y,z);return bo;};
  const root=mk(0,.97,0);
  const spine=mk(0,.27,0);root.add(spine);                              // world 1.24
  const head=mk(0,.26,0);spine.add(head);                               // world 1.50
  const uaL=mk(-SX,.21,0);spine.add(uaL);const laL=mk(0,-.32,0);uaL.add(laL); // 1.45 / 1.13
  const uaR=mk(SX,.21,0);spine.add(uaR);const laR=mk(0,-.32,0);uaR.add(laR);
  const ulL=mk(-LX,-.02,0);root.add(ulL);const llL=mk(0,-.43,0);ulL.add(llL);  // .95 / .52
  const ulR=mk(LX,-.02,0);root.add(ulR);const llR=mk(0,-.43,0);ulR.add(llR);
  const bones=[root,spine,head,uaL,laL,uaR,laR,ulL,llL,ulR,llR];

  const mat=new THREE.MeshStandardMaterial({roughness:.92,vertexColors:true,flatShading:true});
  const mesh=new THREE.SkinnedMesh(geo,mat);
  mesh.castShadow=true;
  mesh.add(root);
  mesh.updateMatrixWorld(true);
  mesh.bind(new THREE.Skeleton(bones));
  mesh.onBeforeRender=()=>mesh.skeleton.update();

  const g=new THREE.Group();
  g.add(mesh);

  // mouth: its own little box (story.ts scales it while an NPC talks)
  const mouthMat=new THREE.MeshBasicMaterial({color:0x3a2622});
  const mouth=new THREE.Mesh(mouthG,mouthMat);
  mouth.position.set(0,HEAD_Y-.07,HEAD/2+.006);
  g.add(mouth);
  g.userData.mouth=mouth;

  // rig API: limbs are BONES under the same names (the gore layer collapses `head`).
  g.userData.limbs={
    head,
    leftArm:uaL,rightArm:uaR,leftForearm:laL,rightForearm:laR,
    leftLeg:ulL,rightLeg:ulR,leftCalf:llL,rightCalf:llR,
  };
  g.userData.fadeMats=[mat,mouthMat];

  // Runtime re-clothing (clothing store): rewrite the colour of the tagged garment boxes.
  const colAttr=geo.getAttribute('color') as THREE.BufferAttribute;
  const _rc=new THREE.Color();
  g.userData.clothing={shirt:color,pants,shoe,skin};
  g.userData.hairColor=hairColor;
  g.userData.setClothing=(cols: {shirt?: number;pants?: number;shoe?: number})=>{
    const c=Object.assign(g.userData.clothing,cols) as Record<string,number>;
    for(const op of recolorOps){
      _rc.set(c[op.role]);
      for(let i=op.start;i<op.start+op.count;i++)colAttr.setXYZ(i,_rc.r,_rc.g,_rc.b);
    }
    colAttr.needsUpdate=true;
  };
  return g;
}

// Padrão de modelo: build() puro; descriptor pro model-viewer (descoberta automática).
export default {category:'Characters',label:'Pedestrian',build:buildToonPlayer};

// Gameplay uses makePed(color,pantsColor) and expects the ped already in the scene.
export function makePed(color: number,pantsColor?: number): THREE.Group{
  const g=buildToonPlayer({color,pantsColor});scene.add(g);return g;
}

// The player's doll (hidden in first person; seen in story cut-scenes).
export function makePlayerPed(color: number): THREE.Group{
  const g=buildToonPlayer({color});scene.add(g);return g;
}

// Female look — MANDATORY for every female NPC: long box hair down the back, side
// locks, red lipstick. One extra (non-skinned) mesh on the doll; idempotent.
const LIPSTICK=0xe23a64;
export function addFemaleLook(g: THREE.Object3D): void{
  g.userData.npcFemale=true;
  if(g.userData.femaleLook)return;
  g.userData.femaleLook=true;
  const hairColor=(g.userData.hairColor as number)??0x2a1911;
  const parts: THREE.BufferGeometry[]=[
    box(HEAD+.05,.34,.08, 0,HEAD_Y-.1,-.14, hairColor),        // long hair down the back
  ];
  for(const sx of[-1,1])parts.push(box(.05,.3,.12, sx*(HEAD/2+.02),HEAD_Y-.06,-.01, hairColor)); // side locks
  const mat=new THREE.MeshStandardMaterial({roughness:.9,vertexColors:true,flatShading:true});
  const mesh=new THREE.Mesh(mergeGeometries(parts,false),mat);
  mesh.castShadow=true;
  g.add(mesh);
  // a separate mesh, so a decapitation hides it by hand (js/combat/gore.ts severHead)
  g.userData.femaleHairMesh=mesh;
  (g.userData.fadeMats as THREE.Material[]|undefined)?.push(mat);
  const mouth=g.userData.mouth as THREE.Mesh|undefined;
  if(mouth){
    (mouth.material as THREE.MeshBasicMaterial).color.set(LIPSTICK);
    mouth.scale.set(1.2,1.5,1);
  }
}
