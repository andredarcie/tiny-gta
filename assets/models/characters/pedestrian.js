import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {scene} from '../../../js/engine.js';

// Pedestre otimizado: cada segmento que se move junto vira UM mesh fundido com
// vertex colors (tronco+cabeça+rosto = 1, braço = 1, antebraço+mão = 1, coxa = 1,
// panturrilha+pé = 1) — ~10 meshes/ped em vez de ~38, e UM material por ped em
// vez de dezenas de clones. A hierarquia de grupos e o userData.limbs continuam
// idênticos: animatePed, poses de motorista/arma e attachGun não mudam.
// A boca fica num mesh próprio porque story.js anima scale.y dela na fala.

const pedHeadG=new THREE.SphereGeometry(.24,10,8);
const pedNeckG=new THREE.CylinderGeometry(.08,.09,.16,7);
const pedThoraxG=new THREE.BoxGeometry(.52,.40,.30);
const pedAbdomenG=new THREE.BoxGeometry(.46,.26,.26);
const pedHipG=new THREE.BoxGeometry(.46,.20,.28);
const pedShoulderG=new THREE.SphereGeometry(.105,8,6);
const pedBicepsG=new THREE.BoxGeometry(.12,.30,.12);
const pedElbowG=new THREE.SphereGeometry(.075,7,5);
const pedForearmG=new THREE.BoxGeometry(.10,.26,.10);
const pedPalmG=new THREE.BoxGeometry(.09,.12,.11);
const pedFingersG=new THREE.BoxGeometry(.08,.10,.10);
const pedThumbG=new THREE.BoxGeometry(.035,.075,.04);
const pedThighG=new THREE.BoxGeometry(.17,.30,.18);
const pedKneeG=new THREE.SphereGeometry(.08,7,5);
const pedCalfG=new THREE.BoxGeometry(.13,.18,.14);
const pedFootG=new THREE.BoxGeometry(.18,.09,.28);
const eyeG=new THREE.SphereGeometry(.035,6,4);
const noseG=new THREE.ConeGeometry(.04,.12,6);
const mouthG=new THREE.BoxGeometry(.15,.025,.018);
const browG=new THREE.BoxGeometry(.12,.025,.02);
const beardG=new THREE.SphereGeometry(.18,8,5);
const hairG=new THREE.SphereGeometry(.255,8,5);
// Toon (Schedule I-style) eyes — used only by the player ped (buildPed{toon:true}):
// a big pale eyeball with a small dark pupil, instead of the tiny dark eye dot.
const toonScleraG=new THREE.SphereGeometry(.07,16,12);
const toonPupilG=new THREE.SphereGeometry(.03,12,10);
const toonEarG=new THREE.SphereGeometry(.05,10,8);
const toonEyelidG=new THREE.SphereGeometry(.07,16,12);
// Toon smooth body (player only): capsules/spheres instead of boxes, so the
// figure reads as a soft modeled character rather than assembled blocks.
const toonHeadG=new THREE.SphereGeometry(.24,28,20);
const toonChestG=new THREE.CapsuleGeometry(.18,.34,10,18);
const toonHipG=new THREE.CapsuleGeometry(.16,.06,8,16);
const toonShoulderG=new THREE.SphereGeometry(.05,10,8);
const toonBicepsG=new THREE.CapsuleGeometry(.055,.2,8,14);
const toonElbowG=new THREE.SphereGeometry(.052,10,8);
const toonForearmG=new THREE.CapsuleGeometry(.05,.2,8,14);
const toonHandG=new THREE.SphereGeometry(.062,12,10);
const toonThighG=new THREE.CapsuleGeometry(.078,.2,8,14);
const toonKneeG=new THREE.SphereGeometry(.068,10,8);
const toonCalfG=new THREE.CapsuleGeometry(.06,.16,8,14);
const toonFootG=new THREE.SphereGeometry(.1,12,10);
// Smooth skinned PLAYER body. Each limb is ONE continuous surface (no thigh-stuck-
// to-shin seam): the torso is a single capsule (rigid, so rounded caps suffice),
// and the arms/legs are cylinders with many HEIGHT segments so skinning bends the
// single tube smoothly at the elbow/knee — like a real human limb.
const skTorsoG=new THREE.CapsuleGeometry(.15,.4,12,22);
const skArmG=new THREE.CylinderGeometry(.06,.033,.58,16,16);    // wide shoulder -> thin wrist (tapered)
const skLegG=new THREE.CylinderGeometry(.072,.05,.9,18,16);     // hip -> ankle
const skShoulderG=new THREE.SphereGeometry(.058,14,12);        // small rounded shoulder (sleeve cap)
const skYokeG=new THREE.CapsuleGeometry(.062,.32,8,16);        // horizontal shoulder yoke (broad shoulders)

const skinColors=[0xf0c08b,0xd9a06b,0xb8754c,0x8f5637,0x6f3e2a];
const pantsColors=[0x202435,0x263454,0x2e2a24,0x3d3f46,0x18191f];
const shoeColors=[0x111117,0x33251e,0xe8e3d2,0x1f2733];
const facialHairColors=[0x17100c,0x2a1911,0x4a2b18,0x6b5137,0x0d0d12];
export const shirtColors=[0xc23b4e,0x3b7ac2,0xcf9a3a,0x3aa06b,0xd96fae,0xe8e3d2,0x7a4f9e,0x40c8c0];

const EYE_COLOR=0x101018,MOUTH_COLOR=0x6b1220;
const SCLERA_COLOR=0xece6da,PUPIL_COLOR=0x15101e;

const _p=new THREE.Vector3(),_q=new THREE.Quaternion(),_s=new THREE.Vector3(),
  _e=new THREE.Euler(),_c=new THREE.Color();

function partM(p,r,s){
  return new THREE.Matrix4().compose(
    _p.set(p[0],p[1],p[2]),
    _q.setFromEuler(_e.set(r?r[0]:0,r?r[1]:0,r?r[2]:0)),
    _s.set(s?s[0]:1,s?s[1]:1,s?s[2]:1));
}

// Clona a geometria base já transformada e com a cor cozida por vértice
function tinted(geo,m,c){
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
function tintedY(geo,m,colBot,colTop,yMid,band){
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

function pickOf(arr){return arr[Math.floor(Math.random()*arr.length)];}

export function buildPed({color=shirtColors[0],pantsColor,toon=false}={}){
  const g=new THREE.Group();
  const skin=pickOf(skinColors);
  const pants=pantsColor??pickOf(pantsColors);
  const shoe=pickOf(shoeColors);
  const hairColor=pickOf(facialHairColors);
  const bodyScale=.92+Math.random()*.18;
  // Toon (Schedule I) tuning — only the player passes toon:true. Every multiplier
  // is 1 for normal peds, so their geometry stays byte-for-byte unchanged.
  const headK=toon?1.03:1;     // slightly oversized rounded head
  const shoulderK=toon?.6:1;   // barely-there sloped shoulders (arms hang close)
  const armThin=toon?.76:1;    // thin smooth arms
  const legThin=toon?.8:1;     // thin smooth legs
  // toon: narrower + taller head (egg shape with a tapered chin), not a round ball
  const eggX=toon?.95:1,eggY=toon?1.06:1;
  const hsx=(1+Math.random()*.14)*headK*eggX,hsy=(.92+Math.random()*.18)*headK*eggY,hsz=(1+Math.random()*.08)*headK;

  const mat=new THREE.MeshStandardMaterial({roughness:.9,vertexColors:true});

  // ----- corpo + cabeça + rosto: um mesh só -----
  const headM=partM([0,1.62,0],null,[hsx,hsy,hsz]);
  const onHead=(p,r,s)=>headM.clone().multiply(partM(p,r,s));
  const noseS=toon?.42:.85+Math.random()*.45;   // toon: barely-there nose
  const bodyParts=toon?[
    // smooth tapered torso (shirt) + rounded hips (pants), not stacked boxes
    tinted(toonHipG,partM([0,.55,0],null,[1.18*bodyScale,1,.82]),pants),
    tinted(toonChestG,partM([0,1.0,0],null,[1.12*bodyScale,1,.72]),color),
    tinted(pedNeckG,partM([0,1.37,0]),skin),
    tinted(toonHeadG,headM,skin),
    tinted(noseG,onHead([0,-.03,.246],[Math.PI/2,0,0],[noseS,noseS,noseS]),skin),
  ]:[
    tinted(pedHipG,partM([0,.55,0],null,[bodyScale,1,1]),pants),
    tinted(pedAbdomenG,partM([0,.78,0],null,[.94*bodyScale,1,1]),color),
    tinted(pedThoraxG,partM([0,1.11,0],null,
      [bodyScale,.95+Math.random()*.12,.92+Math.random()*.16]),color),
    tinted(pedNeckG,partM([0,1.37,0]),skin),
    tinted(pedHeadG,headM,skin),
    tinted(noseG,onHead([0,-.015,.255],[Math.PI/2,0,0],[noseS,noseS,noseS]),skin),
  ];
  for(const sx of[-1,1]){
    if(toon){
      // Big almond eye tucked under a heavy skin-colored upper eyelid (the Schedule I
      // half-lidded look); clear dark iris glancing slightly aside; angled brow above.
      bodyParts.push(tinted(toonScleraG,onHead([sx*.089,.026,.196],null,[.95,.74,.42]),SCLERA_COLOR));
      bodyParts.push(tinted(toonPupilG,onHead([sx*.089-.006,.014,.224],null,[.9,.95,.5]),PUPIL_COLOR));
      // upper eyelid: a thin skin fold resting on the top of the eye (half-lidded)
      bodyParts.push(tinted(toonEyelidG,onHead([sx*.089,.07,.2],[-.28,0,0],[.98,.5,.42]),skin));
      bodyParts.push(tinted(browG,onHead([sx*.089,.136,.197],[0,0,-sx*.08],[.92,.8,1]),hairColor));
      // small ear on the side of the head
      bodyParts.push(tinted(toonEarG,onHead([sx*.226,-.015,-.02],null,[.5,1,.95]),skin));
    }else{
      bodyParts.push(tinted(eyeG,onHead([sx*.085,.045,.225]),EYE_COLOR));
      if(Math.random()<.65)bodyParts.push(tinted(browG,
        onHead([sx*.085,.105,.22],[0,0,-sx*Math.random()*.25]),hairColor));
    }
  }
  // toon player gets a clean protagonist look (hair, no beard); normal peds keep
  // the random beard/hair mix
  if(!toon&&Math.random()<.58)bodyParts.push(tinted(beardG,
    onHead([0,-.115,.165],null,[.82+Math.random()*.35,.42+Math.random()*.3,.26]),hairColor));
  if(toon){
    // hair on the crown + back of the head with a HIGH hairline, so the big
    // forehead stays visible (present, not bald, not covering the face)
    bodyParts.push(tinted(hairG,onHead([0,.16,-.055],null,[1.0,.6,1.05]),hairColor));
    bodyParts.push(tinted(hairG,onHead([0,.03,-.14],null,[.9,.66,.62]),hairColor));
  }else if(Math.random()<.74){
    bodyParts.push(tinted(hairG,
      onHead([0,.13,-.005],null,[1.02,.42+Math.random()*.22,1]),hairColor));
  }

  const body=new THREE.Mesh(mergeGeometries(bodyParts,false),mat);
  body.castShadow=true;g.add(body);

  // boca separada: story.js anima scale.y enquanto o NPC fala
  const mouthMat=new THREE.MeshBasicMaterial({color:toon?0x3a2622:MOUTH_COLOR});
  const mouth=new THREE.Mesh(mouthG,mouthMat);
  mouth.position.set(0,1.62-(toon?.1:.12)*hsy,.228*hsz);
  mouth.scale.x=(toon?.58:.75+Math.random()*.55)*hsx;
  if(toon)mouth.scale.y=.65;   // a faint, neutral line (not an open mouth)
  g.add(mouth);
  g.userData.mouth=mouth;

  // ----- membros: geometria local ao grupo articulado -----
  const armGeo=toon?mergeGeometries([
    tinted(toonShoulderG,partM([0,.02,0]),color),
    tinted(toonBicepsG,partM([0,-.16,0]),color),
  ],false):mergeGeometries([
    tinted(pedShoulderG,partM([0,0,0]),color),
    tinted(pedBicepsG,partM([0,-.16,0]),color),
  ],false);
  const thighGeo=toon
    ?tinted(toonThighG,partM([0,-.16,0]),pants)
    :tinted(pedThighG,partM([0,-.16,0]),pants);
  const calfGeo=toon?mergeGeometries([
    tinted(toonKneeG,partM([0,0,0]),pants),
    tinted(toonCalfG,partM([0,-.1,0]),pants),
    tinted(toonFootG,partM([0,-.2,.05],null,[.85,.5,1.5]),shoe),
  ],false):mergeGeometries([
    tinted(pedKneeG,partM([0,0,0]),pants),
    tinted(pedCalfG,partM([0,-.10,0]),pants),
    tinted(pedFootG,partM([0,-.185,.05]),shoe),
  ],false);

  const limbs={};
  for(const side of[-1,1]){
    const arm=new THREE.Group();
    arm.position.set(side*.34*bodyScale*shoulderK,1.26,0);
    const armMesh=new THREE.Mesh(armGeo,mat);
    armMesh.scale.set(toon?1:armThin,1,toon?1:armThin);
    arm.add(armMesh);
    const forearm=new THREE.Group();
    forearm.position.y=-.30;
    // mão (palma+dedos+polegar) fundida no antebraço; polegar muda de lado
    const foreGeo=toon?mergeGeometries([
      tinted(toonElbowG,partM([0,0,0]),skin),
      tinted(toonForearmG,partM([0,-.14,0]),skin),
      tinted(toonHandG,partM([0,-.3,0],null,[1,.95,1.1]),skin),
    ],false):mergeGeometries([
      tinted(pedElbowG,partM([0,0,0]),skin),
      tinted(pedForearmG,partM([0,-.14,0]),skin),
      tinted(pedPalmG,partM([0,-.32,0]),skin),
      tinted(pedFingersG,partM([0,-.42,0]),skin),
      tinted(pedThumbG,partM([-side*.06,-.33,.04]),skin),
    ],false);
    const foreMesh=new THREE.Mesh(foreGeo,mat);
    foreMesh.scale.set(toon?1:armThin,1,toon?1:armThin);
    forearm.add(foreMesh);
    arm.add(forearm);
    g.add(arm);
    limbs[side<0?'leftArm':'rightArm']=arm;
    limbs[side<0?'leftForearm':'rightForearm']=forearm;

    const leg=new THREE.Group();
    leg.position.set(side*.15,.52,0);
    const thighMesh=new THREE.Mesh(thighGeo,mat);
    thighMesh.scale.set(toon?1:legThin,1,toon?1:legThin);
    leg.add(thighMesh);
    const calf=new THREE.Group();
    calf.position.y=-.30;
    const calfMesh=new THREE.Mesh(calfGeo,mat);
    calfMesh.scale.set(toon?1:legThin,1,toon?1:legThin);
    calf.add(calfMesh);
    leg.add(calf);
    g.add(leg);
    limbs[side<0?'leftLeg':'rightLeg']=leg;
    limbs[side<0?'leftCalf':'rightCalf']=calf;
  }
  g.userData.limbs=limbs;
  // fade de morte (setOpacity) mexe só nos materiais DESTE ped — a arma da
  // gangue usa material compartilhado e não pode ser afetada
  g.userData.fadeMats=[mat,mouthMat];
  return g;
}

// Padrão de modelo: build() puro; descriptor pro model-viewer.
export default {category:'Characters',label:'Pedestrian',build:buildPed};

// Compat: gameplay usa makePed(color,pantsColor) e espera o ped já na cena.
// Os NPCs da rua agora usam a MESMA base skinada do jogador (buildToonPlayer),
// variando só cor de roupa/pele — migração rápida para o visual novo.
export function makePed(color,pantsColor){
  const g=buildToonPlayer({color,pantsColor});scene.add(g);return g;
}

// ===========================================================================
// PLAYER (Schedule I look) as a single SMOOTH SkinnedMesh.
// One continuous surface deformed by a bone skeleton — no joint balls, no part
// seams like the box ped: the limbs are seamless tubes that bend smoothly, like
// the real game. It exposes the SAME rig API as buildPed (userData.limbs are
// bones with .rotation, userData.mouth, userData.fadeMats), so animatePed, the
// driving/aiming poses and attachHandGun keep working with zero changes.
// ===========================================================================
export function buildToonPlayer({color=0x19e3ff,pantsColor,skin}={}){
  skin=skin??pickOf(skinColors);
  const pants=pantsColor??pickOf(pantsColors);
  const shoe=pickOf(shoeColors);
  const hairColor=pickOf(facialHairColors);
  // human proportions (~6.5 heads tall, H≈1.80): smaller head, longer limbs,
  // legs ≈ half the height, arms reaching mid-thigh
  const hsx=.5,hsy=.58,hsz=.52;                       // small egg head (correct head:body ratio)
  const headM=partM([0,1.66,0],null,[hsx,hsy,hsz]);  // center → crown ~1.80, chin ~1.52
  const onHead=(p,r,s)=>headM.clone().multiply(partM(p,r,s));
  const SX=.22,LX=.09;                                // shoulder (broad) / leg x offsets

  // bone indices (must match the `bones` array below)
  const HIPS=0,SPINE=1,HEAD=2,UAL=3,LAL=4,UAR=5,LAR=6,ULL=7,LLL=8,ULR=9,LLR=10;

  // PER-PART skinning: every part is bound to a FIXED bone (or, for a limb tube,
  // blends along Y between the two bones of THAT SAME limb at the elbow/knee).
  // Because a torso vertex is never assigned to an arm bone, the shoulder/hip is a
  // clean cut — swinging a limb can't stretch a web of skin ("bat wing").
  const parts=[];
  const add=(geo,top,bot,yJ,band)=>{
    const p=geo.attributes.position,nn=p.count;
    const si=new Uint16Array(nn*4),sw=new Float32Array(nn*4);
    for(let i=0;i<nn;i++){
      const w=(top===bot)?1:Math.max(0,Math.min(1,(p.getY(i)-(yJ-band))/(2*band)));
      si[i*4]=top;sw[i*4]=w;si[i*4+1]=bot;sw[i*4+1]=1-w;
    }
    geo.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(si,4));
    geo.setAttribute('skinWeight',new THREE.Float32BufferAttribute(sw,4));
    parts.push(geo);
  };

  // torso (→spine) + broad shoulder yoke + neck/head/nose (→head bone); all static
  // during walking. Yoke makes the shoulders wider than the chest so the arms hang
  // OUTSIDE the torso (a real armpit gap, not arms glued to the sides).
  add(tintedY(skTorsoG,partM([0,1.13,0],null,[.98,1,.7]),pants,color,1.0,.05),SPINE,SPINE);
  add(tinted(skYokeG,partM([0,1.43,0],[0,0,Math.PI/2],[1,1,.82]),color),SPINE,SPINE);
  add(tinted(pedNeckG,partM([0,1.49,0],null,[.6,.7,.6]),skin),HEAD,HEAD);
  add(tinted(toonHeadG,headM,skin),HEAD,HEAD);
  add(tinted(noseG,onHead([0,-.03,.246],[Math.PI/2,0,0],[.42,.42,.42]),skin),HEAD,HEAD);
  for(const sx of[-1,1]){
    const UA=sx<0?UAL:UAR,LA=sx<0?LAL:LAR,UL=sx<0?ULL:ULR,LL=sx<0?LLL:LLR;
    add(tinted(skShoulderG,partM([sx*SX,1.44,0]),color),UA,UA);                     // small shoulder = shirt sleeve
    add(tintedY(skArmG,partM([sx*SX,1.17,0]),skin,color,1.3,.05),UA,LA,1.13,.07);   // sleeve top, bare arm below; bends at elbow
    add(tinted(toonHandG,partM([sx*SX,.85,.005],null,[.82,1.3,.46]),skin),LA,LA);   // flat paddle palm
    add(tinted(toonHandG,partM([sx*(SX-.045),.88,.03],null,[.42,.62,.42]),skin),LA,LA); // thumb
    add(tinted(skLegG,partM([sx*LX,.5,0]),pants),UL,LL,.52,.06);                    // leg, bends at knee
    add(tinted(toonFootG,partM([sx*LX,.05,.06],null,[.78,.5,1.7]),shoe),LL,LL);
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
  const mk=(x,y,z)=>{const bo=new THREE.Bone();bo.position.set(x,y,z);return bo;};
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

  // rig API: limbs are BONES (Object3D with .rotation) under the same names
  g.userData.limbs={
    leftArm:uaL,rightArm:uaR,leftForearm:laL,rightForearm:laR,
    leftLeg:ulL,rightLeg:ulR,leftCalf:llL,rightCalf:llR,
  };
  g.userData.fadeMats=[mat,mouthMat];
  return g;
}

// Player-only: the smooth Schedule I skinned figure (see buildToonPlayer).
export function makePlayerPed(color){
  const g=buildToonPlayer({color});scene.add(g);return g;
}
