import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {scene} from '@/core/engine.ts';
import {rand,irand,pick,clamp} from '@/core/constants.ts';
import {addDoorArrow} from './door-arrow.ts';

// Portas funcionais: encostar nelas leva o jogador ao telhado do prédio
// (js/world/doors.ts cuida do gatilho e do teleporte; js/actors/player.ts da queda)
export const buildingDoors:any[]=[];

// Paleta Miami, porém puxada pro realista: estuque desbotado pelo sol em vez de
// pastéis saturados de desenho. Areia, off-white quente, coral/salmão suave,
// verde-água esmaecido, aqua-cinza e terracota poeirento.
const facadePalette=['#e7d8c2','#d8c5a6','#e3b6a6','#bcd4cd','#ccd6d0','#e0cbb1','#c7b69e','#d8bdac'];
// Altura do térreo (faixa sólida sem janela): janelas só do 1º andar pra cima.
const BASE_H=3.2;

function windowTexPair(base:string):{map:THREE.CanvasTexture,emis:THREE.CanvasTexture}{
  const c=document.createElement('canvas');c.width=256;c.height=512;
  const e=document.createElement('canvas');e.width=256;e.height=512;
  const cx=c.getContext('2d')!,ex=e.getContext('2d')!;
  cx.fillStyle=base;cx.fillRect(0,0,256,512);
  ex.fillStyle='#000';ex.fillRect(0,0,256,512);
  for(let q=0;q<8;q+=2){cx.fillStyle='rgba(0,0,0,.05)';cx.fillRect(q*32,0,32,512);}
  for(let r=0;r<16;r++){
    cx.fillStyle='rgba(0,0,0,.16)';cx.fillRect(0,r*32,256,3);
    cx.fillStyle='rgba(255,255,255,.08)';cx.fillRect(0,r*32+3,256,2);
  }
  // Vidro de fachada realista: tons frios DESSATURADOS (azul-cinza-aço, leve
  // verde) — reflexo de céu/entorno, não o cyan de desenho de antes.
  const glassCols=['#79868c','#6c7c84','#84908f','#717f81','#67767c','#8b9390'];
  for(let r=0;r<16;r++)for(let q=0;q<8;q++){
    const wx=q*32+7,wy=r*32+9,ww=18,wh=17;
    cx.fillStyle='rgba(18,20,28,.55)';cx.fillRect(wx-2,wy-2,ww+4,wh+4);
    cx.fillStyle='rgba(220,228,232,.16)';cx.fillRect(wx-3,wy+wh+2,ww+6,2);
    if(Math.random()<.12){
      // Janela acesa: mistura de luz quente (residencial) e branca-fria
      // (escritório/fluorescente), em vez de só o creme saturado de antes.
      const col=pick(['#ffe8c2','#ffeed0','#f3e2bd','#e9eeec','#dfe8ea']);
      const g=cx.createLinearGradient(0,wy,0,wy+wh);
      g.addColorStop(0,col);g.addColorStop(1,'#c89a5e');
      cx.fillStyle=g;cx.fillRect(wx,wy,ww,wh);
      ex.fillStyle=col;ex.fillRect(wx,wy,ww,wh);
      if(Math.random()<.3){
        const px=wx+irand(2,11);
        cx.fillStyle='rgba(40,30,45,.6)';cx.fillRect(px,wy+6,5,11);
        ex.fillStyle='rgba(0,0,0,.6)';ex.fillRect(px,wy+6,5,11);
      }
    }else{
      // Vidro apagado: reflexo de céu dessaturado no topo, corpo do vidro
      // tingido no meio, e o interior escuro embaixo (dá profundidade).
      const g=cx.createLinearGradient(0,wy,0,wy+wh);
      g.addColorStop(0,'#aeb9bd');g.addColorStop(.45,pick(glassCols));g.addColorStop(1,'#2c373d');
      cx.fillStyle=g;cx.fillRect(wx,wy,ww,wh);
      if(Math.random()<.3){cx.fillStyle='rgba(206,216,220,.5)';cx.fillRect(wx,wy,ww,irand(4,10));}
      cx.fillStyle='rgba(18,20,28,.45)';cx.fillRect(wx+ww/2-1,wy,2,wh);
    }
  }
  for(let k=0;k<10;k++){
    cx.fillStyle='rgba(18,18,26,.05)';
    cx.fillRect(Math.random()*256,Math.random()*60,irand(2,5),512);
  }
  const mk=(cv:HTMLCanvasElement):THREE.CanvasTexture=>{const t=new THREE.CanvasTexture(cv);t.colorSpace=THREE.SRGBColorSpace;
    t.wrapS=t.wrapT=THREE.RepeatWrapping;return t};
  return{map:mk(c),emis:mk(e)};
}

const texVariants=facadePalette.map(windowTexPair);

// Materiais COMPARTILHADOS (um por variante de fachada). A variação por prédio
// (escala e deslocamento das janelas) é cozida nas UVs de cada geometria, o
// que permite fundir a cidade inteira em pouquíssimos meshes (draw calls).
export const buildingMats:THREE.MeshLambertMaterial[]=[];
const sideMats=texVariants.map(v=>{
  // Emissive BRANCO: o brilho de cada janela acesa vem da cor já pintada no
  // mapa de emissão (quente p/ residência, frio p/ escritório). Antes um âmbar
  // (0xffe9b0) tingia tudo de laranja, matando as luzes brancas-frias.
  const m=new THREE.MeshLambertMaterial({map:v.map,emissiveMap:v.emis,
    emissive:0xffffff,emissiveIntensity:.3});
  buildingMats.push(m);
  return m;
});
const roofMat=new THREE.MeshLambertMaterial({color:0x8a857c});
const parapetMat=new THREE.MeshLambertMaterial({color:0xf0eadc});
const roofEquipMat=new THREE.MeshLambertMaterial({color:0x9aa0a8});
const tankMat=new THREE.MeshLambertMaterial({color:0x8a705a});
const doorMat=new THREE.MeshLambertMaterial({color:0x2a2230});
const antennaTipMat=new THREE.MeshBasicMaterial({color:0xff3030});
const awningMats=[0xc85d77,0x3f9a96,0xd7af4f,0xc7783c,0x90699e]
  .map(c=>new THREE.MeshLambertMaterial({color:c}));
// Paredes lisas (faces sem janela): cor sólida da fachada, SEM textura — bem
// mais barato de desenhar que a face com mapa de janelas (map+emissiveMap).
const plainMats=facadePalette.map(c=>new THREE.MeshLambertMaterial({color:c}));
// Plinto do térreo: a cor da fachada puxada pra um concreto quente e levemente
// escurecida — lê como base de loja/estuque, sem janela, e ancora o prédio.
const baseMats=facadePalette.map(c=>{
  const col=new THREE.Color(c).lerp(new THREE.Color('#968c82'),.45).multiplyScalar(.9);
  return new THREE.MeshLambertMaterial({color:col});
});

// Geometria agrupada por CHUNK espacial (super-bloco) E por material. Cada chunk
// vira um Group de meshes fundidos: o Three faz frustum culling por chunk e
// updateCityCulling() esconde os chunks distantes (atrás da névoa), em vez de
// desenhar a cidade inteira todo frame (um mesh fundido global nunca era culled).
const CHUNK=100; // lado do super-bloco de culling (m)
type Buckets={
  sides:THREE.BufferGeometry[][],
  plain:THREE.BufferGeometry[][],
  base:THREE.BufferGeometry[][],
  roof:THREE.BufferGeometry[],
  parapet:THREE.BufferGeometry[],
  equip:THREE.BufferGeometry[],
  tank:THREE.BufferGeometry[],
  tip:THREE.BufferGeometry[],
  door:THREE.BufferGeometry[],
  awning:THREE.BufferGeometry[][],
};
const newBuckets=():Buckets=>({
  sides:texVariants.map(()=>[]),  // faces COM janela (viradas pra rua)
  plain:texVariants.map(()=>[]),  // faces lisas (sem textura) viradas pro miolo
  base:texVariants.map(()=>[]),   // térreo: plinto sólido sem janela
  roof:[],parapet:[],equip:[],tank:[],tip:[],door:[],
  awning:awningMats.map(()=>[]),
});
const chunks=new Map<string,Buckets>();
function chunkFor(cx:number,cz:number):Buckets{
  const k=Math.round(cx/CHUNK)+'_'+Math.round(cz/CHUNK);
  let b=chunks.get(k);
  if(!b){b=newBuckets();chunks.set(k,b);}
  return b;
}
// Grupos de chunk prontos (cada um com seus meshes e o centro em userData).
export const cityChunks:THREE.Group[]=[];

// Tiling que antes era texture.repeat/offset, agora por face nas UVs.
// O atlas de janelas é uma grade de 8 colunas × 16 linhas (uma janela por
// célula). Para a borda da fachada cair SEMPRE no vão entre janelas — e nunca
// fatiar um vidro no topo, na base ou nos cantos — as UVs cobrem um número
// INTEIRO de células e o offset desloca só por células inteiras. Antes a escala
// era contínua (h/48) com offset fracionário aleatório, o que cortava a última
// fileira/coluna de janelas. A densidade-alvo é a mesma: ~2,2 m por janela na
// horizontal (17.6/8) e ~3 m por andar na vertical (48/16).
const COL=1/8,ROW=1/16; // uma janela em U / V no atlas
function bakeBoxUVs(geo:THREE.BufferGeometry,w:number,h:number,d:number):void{
  const uv=geo.attributes.uv as THREE.BufferAttribute;
  const rows=Math.max(1,Math.round(h/3)); // andares inteiros (~3 m cada)
  const sv=rows*ROW;
  const offU=irand(0,7)*COL,offV=irand(0,15)*ROW; // desloca por células inteiras
  const widths=[d,d,w,w,w,w]; // dimensão horizontal de cada face do box
  for(let f=0;f<6;f++){
    const cols=Math.max(1,Math.round(widths[f]/2.2)); // colunas inteiras (~2,2 m)
    const su=cols*COL;
    for(let i=f*6;i<f*6+6;i++)uv.setXY(i,uv.getX(i)*su+offU,uv.getY(i)*sv+offV);
  }
}

// Extrai faces de um BoxGeometry não-indexado (cada face = 6 vértices,
// ordem +x,-x,+y,-y,+z,-z)
function sliceFaces(geo:THREE.BufferGeometry,faces:number[]):THREE.BufferGeometry{
  const out=new THREE.BufferGeometry();
  for(const name of['position','normal','uv']){
    const src=geo.attributes[name] as THREE.BufferAttribute;
    const dst=new Float32Array(faces.length*6*src.itemSize);
    faces.forEach((f,k)=>dst.set(
      (src.array as Float32Array).subarray(f*6*src.itemSize,(f+1)*6*src.itemSize),k*6*src.itemSize));
    out.setAttribute(name,new THREE.BufferAttribute(dst,src.itemSize));
  }
  return out;
}

// Caixa envidraçada: laterais no balde da variante, topo no balde de telhado;
// a face de baixo nunca aparece e é descartada
function windowedBox(b:Buckets,vi:number,cx:number,cy:number,cz:number,w:number,h:number,d:number,win:{e?:number,w?:number,s?:number,n?:number}):void{
  const nb=new THREE.BoxGeometry(w,h,d).toNonIndexed();
  bakeBoxUVs(nb,w,h,d);
  nb.translate(cx,cy,cz);
  // janela só nas faces viradas pra rua (win); o resto vira parede lisa.
  // Faces do box: 0=+x(L), 1=-x(O), 4=+z(S), 5=-z(N).
  const winF:number[]=[],plainF:number[]=[];
  for(const[f,on]of[[0,win.e],[1,win.w],[4,win.s],[5,win.n]] as [number,number|undefined][])(on?winF:plainF).push(f);
  if(winF.length)b.sides[vi].push(sliceFaces(nb,winF));
  if(plainF.length)b.plain[vi].push(sliceFaces(nb,plainF));
  b.roof.push(sliceFaces(nb,[2]));
}

// Plinto do térreo: parede sólida sem janela. Só as 4 laterais — topo fica sob
// a torre e a base fica no chão.
function baseBand(b:Buckets,vi:number,cx:number,cy:number,cz:number,w:number,h:number,d:number):void{
  const nb=new THREE.BoxGeometry(w,h,d).toNonIndexed();
  nb.translate(cx,cy,cz);
  b.base[vi].push(sliceFaces(nb,[0,1,4,5]));
}

// Fachada. No nível da rua (ground), separa um térreo sólido sem janela do
// resto envidraçado — janelas começam só no 1º andar. Blocos elevados
// (penthouse) entram inteiros.
function addFacadeBox(b:Buckets,vi:number,cx:number,cy:number,cz:number,w:number,h:number,d:number,win:{e?:number,w?:number,s?:number,n?:number},ground=false):void{
  if(ground&&h>BASE_H+2){
    const y0=cy-h/2; // base do prédio (chão)
    baseBand(b,vi,cx,y0+BASE_H/2,cz,w,BASE_H,d);
    windowedBox(b,vi,cx,y0+BASE_H+(h-BASE_H)/2,cz,w,h-BASE_H,d,win);
  }else{
    windowedBox(b,vi,cx,cy,cz,w,h,d,win);
  }
}

function pushBox(arr:THREE.BufferGeometry[],sx:number,sy:number,sz:number,x:number,y:number,z:number,rx=0,rz=0):void{
  const g=new THREE.BoxGeometry(sx,sy,sz);
  if(rz)g.rotateZ(rz);
  if(rx)g.rotateX(rx);
  g.translate(x,y,z);
  arr.push(g);
}

export function addBuilding(cx:number,cz:number,w:number,d:number,solids:{x0:number,x1:number,z0:number,z1:number,h:number}[],win:{e?:number,w?:number,s?:number,n?:number}={e:1,w:1,s:1,n:1}):void{
  const buckets=chunkFor(cx,cz); // tudo deste prédio vai pro balde do seu chunk
  const dist=Math.hypot(cx,cz);
  const h=clamp(rand(7,17)+Math.max(0,1-dist/200)*rand(8,30),7,46);
  const vi=irand(0,texVariants.length-1);
  addFacadeBox(buckets,vi,cx,h/2,cz,w,h,d,win,true);
  solids.push({x0:cx-w/2,x1:cx+w/2,z0:cz-d/2,z1:cz+d/2,h});

  pushBox(buckets.parapet,w+.35,.55,d+.35,cx,h+.12,cz);

  let topH=h;
  if(h>26&&Math.random()<.6){
    const w2=w*.62,d2=d*.62,h2=rand(3.5,6.5);
    addFacadeBox(buckets,vi,cx,h+h2/2,cz,w2,h2,d2,win);
    topH=h+h2;
  }

  if(Math.random()<.75){
    const eh=rand(.5,1.3);
    pushBox(buckets.equip,rand(.9,2.2),eh,rand(.9,2),
      cx+rand(-w/2+1.6,w/2-1.6),h+eh/2+.1,cz+rand(-d/2+1.6,d/2-1.6));
  }
  if(h>13&&Math.random()<.22){
    const tx=cx+rand(-w/4,w/4),tz=cz+rand(-d/4,d/4);
    const tk=new THREE.CylinderGeometry(.8,.8,1.3,8);
    tk.translate(tx,h+.75,tz);buckets.tank.push(tk);
    const lid=new THREE.ConeGeometry(.92,.5,8);
    lid.translate(tx,h+1.65,tz);buckets.parapet.push(lid);
  }
  if(h>24&&Math.random()<.55){
    const ah=rand(2.4,4),ax=cx+rand(-w/4,w/4),az=cz+rand(-d/4,d/4);
    const an=new THREE.CylinderGeometry(.04,.07,ah,5);
    an.translate(ax,topH+ah/2,az);buckets.equip.push(an);
    const tip=new THREE.SphereGeometry(.12,6,5);
    tip.translate(ax,topH+ah+.05,az);buckets.tip.push(tip);
  }
  if(Math.random()<.65){
    const sgn=Math.random()<.5?1:-1,onX=Math.random()<.5;
    const dx=onX?sgn*(w/2+.07):rand(-w/4+1,w/4-1);
    const dz=onX?rand(-d/4+1,d/4-1):sgn*(d/2+.07);
    pushBox(buckets.door,onX?.14:1.3,2.3,onX?1.3:.14,cx+dx,1.15,cz+dz);
    pushBox(buckets.awning[irand(0,awningMats.length-1)],
      onX?.85:rand(2.6,4),.13,onX?rand(2.6,4):.85,
      cx+dx+(onX?sgn*.42:0),2.55,cz+dz+(onX?0:sgn*.42),
      onX?0:sgn*.14,onX?-sgn*.14:0);
    // registro da porta: gatilho na calçada, spawn/saída no telhado e os
    // limites da laje (parapeito) — passar deles é queda livre
    const nx=onX?sgn:0,nz=onX?0:sgn; // normal da fachada (aponta pra rua)
    const door={
      x:cx+dx,z:cz+dz,                      // gatilho de entrada (na porta)
      outX:cx+dx+nx*1.3,outZ:cz+dz+nz*1.3,  // desembarque na calçada
      topX:cx+dx-nx*1.9,topZ:cz+dz-nz*1.9,  // spawn e saída no telhado
      y:h+.395,                             // topo da laje (parapeito)
      x0:cx-(w+.35)/2,x1:cx+(w+.35)/2,
      z0:cz-(d+.35)/2,z1:cz+(d+.35)/2,
      // bloco superior (quando existe) é sólido pra quem anda no telhado
      top:topH>h?{x0:cx-w*.31,x1:cx+w*.31,z0:cz-d*.31,z1:cz+d*.31}:null,
      // espólio do telhado: uns têm dinheiro, outros arma, outros nada
      // (visual e coleta em js/world/doors.ts, só pra quem está neste telhado)
      loot:Math.random()<.35?'money':Math.random()<.4?'gun':null,
      lootX:cx+(nx?-nx:1)*(w/2-1.6),lootZ:cz+(nz?-nz:1)*(d/2-1.6),
    };
    buildingDoors.push(door);
    addDoorArrow(cx+dx+nx*.85,1.55,cz+dz+nz*.85); // seta rente ao chão, na porta
    // alçapão de metal no telhado marcando o ponto de descida (a seta de lá
    // é dinâmica: js/world/doors.ts só a mostra quando o jogador está neste telhado)
    pushBox(buckets.door,1.8,.05,1.8,door.topX,h+.41,door.topZ);  // moldura escura
    pushBox(buckets.equip,1.4,.07,1.4,door.topX,h+.45,door.topZ); // folha de metal
    pushBox(buckets.door,.5,.07,.13,door.topX,h+.5,door.topZ+.4); // alça
  }
}

// Funde os baldes de CADA chunk em meshes, agrupados num Group por chunk — UMA
// vez, depois da cidade montada. Cada Group guarda seu centro pra distância.
export function finalizeBuildings():void{
  for(const[key,b]of chunks){
    const group=new THREE.Group();
    const add=(geos:THREE.BufferGeometry[],mat:THREE.Material,cast=true,receive=false):void=>{
      if(!geos.length)return;
      const m=new THREE.Mesh(mergeGeometries(geos),mat);
      m.castShadow=cast;m.receiveShadow=receive;
      // mesh fundido nunca se move: congela a matriz local (sem recompose/frame)
      m.matrixAutoUpdate=false;m.updateMatrix();
      group.add(m);
    };
    b.sides.forEach((g,i)=>add(g,sideMats[i],true,true));
    b.plain.forEach((g,i)=>add(g,plainMats[i],true,true));
    b.base.forEach((g,i)=>add(g,baseMats[i],true,true));
    add(b.roof,roofMat,true,true);
    add(b.parapet,parapetMat);
    add(b.equip,roofEquipMat);
    add(b.tank,tankMat);
    add(b.tip,antennaTipMat,false);
    add(b.door,doorMat,false);
    b.awning.forEach((g,i)=>add(g,awningMats[i]));
    if(!group.children.length)continue;
    const[ki,kj]=key.split('_').map(Number);
    group.userData.cx=ki*CHUNK;group.userData.cz=kj*CHUNK;
    // chunk fica na identidade (geometria já em world space): congela a matriz
    group.matrixAutoUpdate=false;group.updateMatrix();
    scene.add(group);
    cityChunks.push(group);
  }
  chunks.clear();
}

// Esconde os chunks da cidade longe do jogador (além da névoa + margem de ~1
// chunk, pra não dar pop). O que a névoa já apagou não precisa ser desenhado;
// o frustum culling do Three já corta o que está fora da câmera.
export function updateCityCulling(px:number,pz:number):void{
  // Distância de corte: acompanha a névoa, mas CAPADA. No mirante da montanha a
  // névoa abre com a altitude (daynight.js) — sem o cap, o corte ia a ~970m e a
  // cidade inteira era desenhada de lá. Margem de ~meio chunk (não +CHUNK
  // inteiro, que deixava a borda leste da cidade renderizar da zona rural).
  const ff=Math.min(scene.fog?(scene.fog as THREE.Fog).far:430,330);
  const far=ff+70,f2=far*far;
  for(const g of cityChunks){
    const dx=g.userData.cx-px,dz=g.userData.cz-pz;
    g.visible=dx*dx+dz*dz<f2;
  }
}
