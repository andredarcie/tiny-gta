import * as THREE from 'three';

// Caveira vermelha flutuante do minigame RAMPAGE. É o pickup de chão com que o
// jogador encosta (a pé) pra iniciar a chacina. Geometria simples e estilizada:
// crânio + olhos brilhantes + dentes, sobre um anel/halo no chão pra "chamar
// atenção" de longe. Tudo em tom vermelho. Sem texturas: só primitivas Three.js.
export function makeRampageSkull(): THREE.Group{
  const g=new THREE.Group();
  const bone=new THREE.MeshStandardMaterial({
    color:0xff3b3b,roughness:.5,metalness:.06,emissive:0x7a0000,emissiveIntensity:.6
  });
  const dark=new THREE.MeshBasicMaterial({color:0x1a0000});
  const glow=new THREE.MeshBasicMaterial({color:0xffe14a}); // olhos
  // materiais do halo/raios no chão: transparentes e sem escrever profundidade
  // pra não brigarem com o terreno (efeito "decalque" de luz).
  const halo=new THREE.MeshBasicMaterial({
    color:0xff2e2e,transparent:true,opacity:.42,side:THREE.DoubleSide,depthWrite:false
  });

  // ---- halo no chão (anel + disco difuso): marca o ponto de longe -----------
  const ring=new THREE.Mesh(new THREE.RingGeometry(.62,.92,28),halo);
  ring.rotation.x=-Math.PI/2;ring.position.y=.04;g.add(ring);
  const disc=new THREE.Mesh(new THREE.CircleGeometry(.6,24),
    new THREE.MeshBasicMaterial({color:0xff2e2e,transparent:true,opacity:.16,depthWrite:false}));
  disc.rotation.x=-Math.PI/2;disc.position.y=.03;g.add(disc);
  g.userData.halo=ring; // o loop do rampage pulsa o halo (ver js/rampage.js)

  // ---- a caveira em si: flutua e gira (o pivô é o grupo `skull`) ------------
  const skull=new THREE.Group();
  skull.position.y=1.4;
  skull.userData.baseY=1.4;

  // crânio
  const cranium=new THREE.Mesh(new THREE.SphereGeometry(.5,20,14),bone);
  cranium.scale.set(.96,1.08,.84);cranium.position.y=.16;cranium.castShadow=false;
  skull.add(cranium);
  // mandíbula
  const jaw=new THREE.Mesh(new THREE.BoxGeometry(.64,.3,.4),bone);
  jaw.position.set(0,-.34,-.02);jaw.castShadow=false;skull.add(jaw);
  // maçãs do rosto (dão volume e leem melhor de longe)
  for(const side of[-1,1]){
    const cheek=new THREE.Mesh(new THREE.SphereGeometry(.16,10,8),bone);
    cheek.position.set(side*.34,-.08,-.18);cheek.scale.set(1,.8,.7);
    cheek.castShadow=false;skull.add(cheek);
  }

  for(const side of[-1,1]){
    // órbita escura
    const socket=new THREE.Mesh(new THREE.SphereGeometry(.16,14,10),dark);
    socket.scale.set(1.35,1.05,.45);socket.position.set(side*.2,.2,-.39);skull.add(socket);
    // olho brilhante (referenciado pelo loop pra "respirar" via escala)
    const eye=new THREE.Mesh(new THREE.SphereGeometry(.07,10,8),glow);
    eye.position.set(side*.2,.2,-.45);skull.add(eye);
    (skull.userData.eyes||(skull.userData.eyes=[])).push(eye);
  }
  // nariz
  const nose=new THREE.Mesh(new THREE.ConeGeometry(.1,.18,3),dark);
  nose.position.set(0,.0,-.45);nose.rotation.z=Math.PI;nose.scale.z=.35;skull.add(nose);
  // dentes (fileira de cima + de baixo pra "cara" mais nítida)
  for(let i=0;i<5;i++){
    const x=(i-2)*.085;
    const top=new THREE.Mesh(new THREE.BoxGeometry(.06,.1,.05),bone);
    top.position.set(x,-.46,-.26);top.castShadow=false;skull.add(top);
    const bot=new THREE.Mesh(new THREE.BoxGeometry(.06,.12,.05),bone);
    bot.position.set(x,-.56,-.25);bot.castShadow=false;skull.add(bot);
  }

  g.add(skull);
  g.userData.icon=skull;
  return g;
}

// Padrão de modelo: descriptor para o model-viewer (descoberta automática).
export default {category:'Props',label:'Rampage skull',build:()=>makeRampageSkull()};
