export const N=8, CELL=44, ROAD=14, BLOCK=30, SIDE=4, HALF=N*CELL/2;
export const GROUND=N*CELL+ROAD;
export const BEACH=38;                  // largura da faixa de areia ao redor da cidade
export const BOUND=HALF+ROAD/2+BEACH-5; // limite de NPCs: andam na areia, não entram no mar
export const WATER=HALF+ROAD/2+BEACH-3; // linha d'água: além disso é mar (nado/afundamento)
export const SWIM_BOUND=WATER+70;       // parede invisível de verdade, bem mar adentro
// Zona rural: península a leste da cidade que termina na montanha-mirante
export const RURAL_X0=HALF+ROAD/2;      // 183: onde a cidade acaba
// Afasta o conteúdo rural (fazendas/montanha) da cidade por um corredor de
// pasto: a península fica mais comprida e o fog dinâmico (daynight.js) esconde a
// zona distante. RURAL_X0 segue na borda da cidade pra manter a estrada ligada.
export const RURAL_GAP=130;
export const RURAL_X1=RURAL_X0+260+RURAL_GAP; // ponta da península (depois é mar)
export const RURAL_HALF=120;            // meia-largura da península em z
export const MOUNT_X=RURAL_X0+196+RURAL_GAP;   // centro da montanha, empurrada pra leste
export const MOUNT_R=62, MOUNT_H=46;    // raio da base e altura do pico
// Montanha low poly: grade grossa de alturas compartilhada por física e visual.
// Nós seguem um cone suavizado com variação aleatória (facetas irregulares);
// o pico e as bordas ficam exatos.
export const MOUNT_SEG=10, MOUNT_S=MOUNT_R*2+2;
const MN=MOUNT_SEG+1, MCELL=MOUNT_S/MOUNT_SEG;
export const mountH=new Float32Array(MN*MN);
for(let j=0;j<MN;j++)for(let i=0;i<MN;i++){
  const x=(i/MOUNT_SEG-.5)*MOUNT_S,z=(j/MOUNT_SEG-.5)*MOUNT_S;
  const d=Math.hypot(x,z);
  if(d>=MOUNT_R)continue;
  const t=1-d/MOUNT_R;
  let h=MOUNT_H*t*t*(3-2*t);
  if(h>1&&h<MOUNT_H*.92)h=Math.min(h*(.8+Math.random()*.34),MOUNT_H-2); // pico continua sendo o ponto mais alto
  mountH[j*MN+i]=h;
}
// Colinas BEM suaves no corredor entre a cidade e o conteúdo rural: dão a
// sensação de separação entre as zonas sem atrapalhar a direção. Amplitude
// baixa e ondulação larga; somem nas bordas (cidade a oeste, fazendas a leste,
// mar nas laterais z) e na faixa da estrada, então o resto da península segue
// plano. Entram no groundHeight → física (carro/jogador) e visual batem 1:1.
export const HILL_X0=RURAL_X0+15, HILL_X1=RURAL_X0+150, HILL_AMP=2.4;
export function ruralHillH(x,z){
  if(x<=HILL_X0||x>=HILL_X1||Math.abs(z)>=RURAL_HALF)return 0;
  const ex=Math.sin(Math.PI*(x-HILL_X0)/(HILL_X1-HILL_X0)); // 0→1→0 ao longo do corredor
  const ez=Math.cos(Math.PI/2*z/RURAL_HALF);                // some nas pontas (mar)
  const road=Math.min(1,Math.abs(z)/16);                    // achata a faixa da estrada (z≈0)
  const env=ex*ez*road;
  if(env<=0)return 0;
  const h=.5+.5*Math.sin(x*.085+z*.05)*Math.cos(z*.07-x*.035+.6); // hummocks irregulares
  return env*h*HILL_AMP;
}
// Altura do terreno: interpola os MESMOS triângulos da malha (split do
// PlaneGeometry: diagonal B–D), então a colisão bate 1:1 com o que se vê.
// Soma as colinas do corredor (0 fora dele) ao relevo da montanha.
export function groundHeight(x,z){
  const hill=ruralHillH(x,z);
  const u=(x-MOUNT_X)/MCELL+MOUNT_SEG/2, v=z/MCELL+MOUNT_SEG/2;
  if(u<=0||v<=0||u>=MOUNT_SEG||v>=MOUNT_SEG)return hill;
  const i=Math.floor(u),j=Math.floor(v),fu=u-i,fv=v-j;
  const hA=mountH[j*MN+i],hD=mountH[j*MN+i+1],
        hB=mountH[(j+1)*MN+i],hC=mountH[(j+1)*MN+i+1];
  return hill+(fu+fv<=1?hA+(hD-hA)*fu+(hB-hA)*fv:hC+(hB-hC)*(1-fu)+(hD-hC)*(1-fv));
}
export const nodeX=i=>i*CELL-HALF;
export const rand=(a,b)=>a+Math.random()*(b-a);
export const irand=(a,b)=>Math.floor(rand(a,b+1));
export const pick=a=>a[Math.floor(Math.random()*a.length)];
export const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export const wrapA=a=>{while(a>Math.PI)a-=2*Math.PI;while(a<-Math.PI)a+=2*Math.PI;return a};
