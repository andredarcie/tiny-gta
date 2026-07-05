import * as THREE from 'three';

export function makeSkyDome(skyTex: THREE.Texture): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(900,24,16),
    // Backdrop puro: NÃO escreve nem testa profundidade e renderiza PRIMEIRO
    // (renderOrder -1). Assim, mesmo encolhido e seguindo a câmera (ver daynight.ts,
    // pra caber dentro do camera.far apertado que corta tudo além da névoa), o dome
    // nunca oclui o terreno/prédios — tudo é desenhado por cima dele.
    new THREE.MeshBasicMaterial({map:skyTex,side:THREE.BackSide,fog:false,
      depthWrite:false,depthTest:false}));
  mesh.renderOrder=-1;
  mesh.frustumCulled=false;
  return mesh;
}
