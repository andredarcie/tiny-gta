import * as THREE from 'three';

// Balão de diálogo: um sprite (sempre encara a câmera) com o texto desenhado
// num <canvas>, no estilo "no asset binário" do projeto. Fica legível de perto,
// com fundo claro, borda escura e uma setinha apontando pra cabeça do NPC.
// Uso típico: makeSpeechBubble('...'), posicionar acima da cabeça e add na cena
// (ou no grupo do ambiente). Ver o paciente do hospital em assets/.../hospital.js.

function wrap(ctx: CanvasRenderingContext2D,text: string,maxW: number): string[]{
  const words=text.split(/\s+/);
  const lines: string[]=[];let line='';
  for(const w of words){
    const test=line?line+' '+w:w;
    if(ctx.measureText(test).width>maxW&&line){lines.push(line);line=w;}
    else line=test;
  }
  if(line)lines.push(line);
  return lines;
}

export function makeSpeechBubble(text: string,{worldWidth=3,font=30,pad=26,maxTextW=448}: {worldWidth?: number; font?: number; pad?: number; maxTextW?: number}={}): THREE.Sprite{
  const c=document.createElement('canvas');
  const x=c.getContext('2d')!;
  const fontStr=`600 ${font}px "IBM Plex Mono", ui-monospace, monospace`;
  x.font=fontStr;
  const lines=wrap(x,text,maxTextW);
  const lineH=Math.round(font*1.32);
  const tail=26;
  const innerW=Math.min(maxTextW,Math.max(...lines.map(l=>x.measureText(l).width)));
  c.width=Math.ceil(innerW+pad*2);
  c.height=Math.ceil(lines.length*lineH+pad*2+tail);

  const ctx=c.getContext('2d')!;
  ctx.font=fontStr;ctx.textBaseline='top';ctx.textAlign='center';
  const bw=c.width,bh=c.height-tail,r=18,cx=bw/2;

  // balão arredondado: fundo claro + borda escura
  ctx.beginPath();
  ctx.moveTo(r,2);ctx.arcTo(bw-2,2,bw-2,bh,r);ctx.arcTo(bw-2,bh,2,bh,r);
  ctx.arcTo(2,bh,2,2,r);ctx.arcTo(2,2,bw-2,2,r);ctx.closePath();
  ctx.fillStyle='#f4f7f8';ctx.fill();
  // setinha pra baixo (aponta pra cabeça do NPC)
  ctx.beginPath();
  ctx.moveTo(cx-16,bh-1);ctx.lineTo(cx+16,bh-1);ctx.lineTo(cx,c.height-3);ctx.closePath();
  ctx.fillStyle='#f4f7f8';ctx.fill();
  ctx.lineWidth=5;ctx.strokeStyle='#15222a';
  // contorno = MESMO caminho do fundo + a setinha embutida na borda inferior. O
  // canto inferior-direito é arredondado igual ao fundo (arcTo mira o canto oposto
  // p/ a tangente ficar na horizontal); só DEPOIS a borda segue reta pela base até a
  // setinha. (Antes ia direto do canto pra ponta, cortando na diagonal — a borda
  // direita ficava torta e não acompanhava o balão branco.)
  ctx.beginPath();
  ctx.moveTo(r,2);ctx.arcTo(bw-2,2,bw-2,bh,r);ctx.arcTo(bw-2,bh,2,bh,r);
  ctx.lineTo(cx+16,bh);ctx.lineTo(cx,c.height-3);ctx.lineTo(cx-16,bh);
  ctx.arcTo(2,bh,2,2,r);ctx.arcTo(2,2,bw-2,2,r);ctx.closePath();
  ctx.stroke();

  // texto
  ctx.fillStyle='#15222a';
  lines.forEach((l,i)=>ctx.fillText(l,cx,pad+i*lineH));

  const tex=new THREE.CanvasTexture(c);
  tex.colorSpace=THREE.SRGBColorSpace;
  tex.anisotropy=4;
  // depthTest:true → o balão é TAMPADO pela cena (prédios na frente o escondem,
  // não atravessa mais paredes). depthWrite:false pra não furar a transparência.
  const mat=new THREE.SpriteMaterial({map:tex,transparent:true,
    depthTest:true,depthWrite:false});
  const spr=new THREE.Sprite(mat);
  spr.renderOrder=20;
  spr.scale.set(worldWidth,worldWidth*c.height/c.width,1);
  return spr;
}

// Padrão de modelo: descriptor para o model-viewer (descoberta automática).
export default {category:'Characters',label:'Speech bubble',
  build:()=>makeSpeechBubble('Hey, you! Over here.')};
