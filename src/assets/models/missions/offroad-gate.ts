import * as THREE from 'three';

// Pórtico de largada/chegada do OFF-ROAD (rali rural): dois postes de madeira
// inclinados e uma faixa no alto com o texto "OFF-ROAD" desenhado num <canvas>
// (sem assets binários — padrão do projeto). Pilhas de pneus na base dão o ar de
// circuito de terra. O carro passa direto por baixo (não entra em solids[]); é
// só referência visual da linha (vale como largada E chegada, pois o percurso é
// um loop que volta pra cá).
function bannerTexture(): THREE.CanvasTexture{
  const c=document.createElement('canvas');c.width=256;c.height=64;
  const x=c.getContext('2d')!;
  // fundo escuro com borda quadriculada (faixa de prova)
  x.fillStyle='#16100a';x.fillRect(0,0,256,64);
  const s=16;
  for(let i=0;i<16;i++){
    x.fillStyle=i%2?'#0a0a0a':'#f4f4f4';
    x.fillRect(i*s,0,s,s);x.fillRect(i*s,48,s,s);
  }
  x.fillStyle='#ff8a1e';
  x.font='700 28px "IBM Plex Mono", monospace';
  x.textAlign='center';x.textBaseline='middle';
  x.fillText('OFF-ROAD',128,33);
  const t=new THREE.CanvasTexture(c);
  t.magFilter=THREE.NearestFilter;
  return t;
}

export function makeOffroadGate(color=0xff8a1e): THREE.Group{
  const g=new THREE.Group();
  const woodMat=new THREE.MeshStandardMaterial({color:0x6b4423,roughness:.9,metalness:0});
  const W=10; // vão do pórtico (largo: a chegada off-road é mais frouxa que a rua)
  for(const sx of[-1,1]){
    // postes levemente abertos pra fora (cara de rali)
    const post=new THREE.Mesh(new THREE.CylinderGeometry(.32,.4,5.6,8),woodMat);
    post.position.set(sx*W/2,2.8,0);post.rotation.z=sx*.05;
    post.castShadow=true;g.add(post);
    // pilha de 3 pneus em cada base
    const tireMat=new THREE.MeshStandardMaterial({color:0x111417,roughness:1});
    for(let k=0;k<3;k++){
      const tire=new THREE.Mesh(new THREE.TorusGeometry(.55,.22,6,12),tireMat);
      tire.rotation.x=Math.PI/2;
      tire.position.set(sx*(W/2+.4),.25+k*.46,1.2);
      g.add(tire);
    }
  }
  // faixa "OFF-ROAD" no alto, atravessando o vão
  const banner=new THREE.Mesh(new THREE.BoxGeometry(W,1.4,.2),
    new THREE.MeshBasicMaterial({map:bannerTexture()}));
  banner.position.set(0,5.2,0);g.add(banner);
  // detalhe colorido na borda da faixa (combina com o tema da corrida)
  const trimMat=new THREE.MeshStandardMaterial({color,roughness:.5,metalness:.1});
  for(const dy of[.78,-.78]){
    const trim=new THREE.Mesh(new THREE.BoxGeometry(W+.1,.16,.24),trimMat);
    trim.position.set(0,5.2+dy,0);g.add(trim);
  }
  return g;
}

// Padrão de modelo: descriptor para o model-viewer (descoberta automática).
export default {category:'Missions',label:'Off-road gate',build:(o:{color?:number})=>makeOffroadGate(o.color??0xff8a1e)};
