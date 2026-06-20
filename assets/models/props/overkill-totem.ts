import * as THREE from 'three';
import {matte} from '../matte.js';

// Ícone do modo OVERKILL: apenas uma caveira flutuante. É o objeto do cenário
// com que o jogador interage pra ligar o modo.
export function makeOverkillTotem(): THREE.Group{
  const g=new THREE.Group();
  const bone=matte({
    color:0xd8d0b8,roughness:.72,metalness:.02,emissive:0x2a0a0a,emissiveIntensity:.16
  });
  const dark=new THREE.MeshBasicMaterial({color:0x070409});
  const red=new THREE.MeshBasicMaterial({color:0xff2e2e});

  const skull=new THREE.Group();
  skull.position.y=1.45;
  skull.userData.baseY=1.45;
  const cranium=new THREE.Mesh(new THREE.SphereGeometry(.52,24,16),bone);
  cranium.scale.set(.95,1.1,.82);cranium.position.y=.18;cranium.castShadow=false;skull.add(cranium);
  const jaw=new THREE.Mesh(new THREE.BoxGeometry(.68,.34,.42),bone);
  jaw.position.set(0,-.35,-.02);jaw.castShadow=false;skull.add(jaw);
  for(const side of[-1,1]){
    const socket=new THREE.Mesh(new THREE.SphereGeometry(.145,16,10),dark);
    socket.scale.set(1.35,1,.35);socket.position.set(side*.2,.22,-.41);skull.add(socket);
    const eyeGlow=new THREE.Mesh(new THREE.SphereGeometry(.045,10,8),red);
    eyeGlow.position.set(side*.2,.22,-.47);skull.add(eyeGlow);
    const cheek=new THREE.Mesh(new THREE.SphereGeometry(.16,12,8),bone);
    cheek.scale.set(1,.72,.5);cheek.position.set(side*.27,-.1,-.32);cheek.castShadow=false;skull.add(cheek);
  }
  const nose=new THREE.Mesh(new THREE.ConeGeometry(.105,.2,3),dark);
  nose.position.set(0,.02,-.46);nose.rotation.z=Math.PI;nose.scale.z=.35;skull.add(nose);
  for(let i=0;i<5;i++){
    const tooth=new THREE.Mesh(new THREE.BoxGeometry(.055,.16,.055),bone);
    tooth.position.set((i-2)*.09,-.58,-.26);tooth.castShadow=false;skull.add(tooth);
  }
  const crack=new THREE.Mesh(new THREE.BoxGeometry(.035,.34,.025),dark);
  crack.position.set(.08,.55,-.43);crack.rotation.z=.45;skull.add(crack);
  const brow=new THREE.Mesh(new THREE.BoxGeometry(.56,.07,.06),dark);
  brow.position.set(0,.37,-.42);skull.add(brow);
  g.add(skull);

  g.userData.icon=skull;
  return g;
}

// Padrão de modelo: descriptor para o model-viewer (descoberta automática).
export default {category:'Props',label:'Overkill skull',build:()=>makeOverkillTotem()};
