import * as THREE from 'three';

export function makeStoryUsb(color: number): THREE.Group{
  const mat=new THREE.MeshBasicMaterial({color});
  const g=new THREE.Group();
  const body=new THREE.Mesh(new THREE.BoxGeometry(.5,.18,.24),mat);
  const plug=new THREE.Mesh(new THREE.BoxGeometry(.18,.12,.16),
    new THREE.MeshBasicMaterial({color:0xc8ccd4}));
  plug.position.x=.34;g.add(body,plug);
  return g;
}

// Padrão de modelo: descriptor para o model-viewer (descoberta automática).
export default {category:'Missions',label:'Story USB',build:(o:{color?:number})=>makeStoryUsb(o.color??0xffd24a)};
