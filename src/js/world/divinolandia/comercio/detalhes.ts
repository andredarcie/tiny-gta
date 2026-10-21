// Second pass over the Street View captures (com-*, com2-*): the smaller things each
// business front shows that the first survey (lojas.ts) left out — posters and price
// tags, banners, the footballs hung at Casa Haddad's door, the motorcycles at Ronaldinho
// Motos, the sacks of feed of the agropecuárias, sandwich boards, flower pots, bins,
// bollards. Merged into each record's shopfront by mergeDetalhes (arrays appended).
// Pure data.
import type {LojaSpec,ShopOpts,Sign} from './spec.ts';

// a row of small paper posters / price tags taped on a front (x0..x1, at height y)
const tags=(x0:number,x1:number,y:number,bg:string,fg:string,text:string[],w=.55,h=.42):Sign[]=>{
  const n=Math.max(1,Math.floor((x1-x0)/(w+.08))),out:Sign[]=[];
  for(let i=0;i<n;i++)out.push({lines:[text[i%text.length]],bg,fg,x:x0+w/2+i*(x1-x0)/n,y,w,h,out:.02,depth:.01});
  return out;
};

export const DETALHES:{[id:string]:ShopOpts}={
  'sm-ideal':{signs:tags(-4,4,2.25,'#23a35a','#ffffff',['8,99','4,99','15,90','2,79','11,49','5,29'],.6,.35)},
  'sm-formiga':{signs:[...tags(-6.6,-4.6,.9,'#f6d32a','#2a2a2a',['OFERTA','3,99','PROMO'],.5,.55),...tags(4.6,6.8,.9,'#f6d32a','#2a2a2a',['OFERTA','9,90','5,49'],.5,.55)],
    extras:[{t:'plants',x0:4.2,x1:4.2},{t:'bin',x:6.4}]},
  'sm-pegpag':{extras:[{t:'bin',x:-2.9,c:'#3a9a4a'}]},
  'sm-divinolandense':{extras:[{t:'drums',x:-.6,n:3,c:'#2a6ad0'}]},
  'sm-pedrilho':{extras:[{t:'bench',x:-.2,c:'#b9a88a'}],signs:[{lines:['@supermercadopedrilho','(19) 98386-7930'],bg:'#ffffff',fg:'#e88d1d',x:3.2,y:2.3,w:2.4,h:.5}]},
  'sm-beliscao':{extras:[{t:'plants',x0:-4,x1:-3.2},{t:'bench',x:-.6,c:'#7a5634'}]},
  'sm-martins':{extras:[{t:'plants',x0:-2,x1:1.2}],signs:[{lines:['Drª Camila C. Almeida','Dr. Eloísio Jorge'],bg:'#f4f4f2',fg:'#2a6a6a',x:6.5,y:1.1,w:1.3,h:.9}]},
  'sm-saojose2':{signs:[{lines:['Uma Empresa do Grupo','SAN MICHEL'],bg:'#ffffff',fg:'#d1262b',x:-6.3,y:3.05,w:2.4,h:1.45,font:'script'}],extras:[{t:'bin',x:3,c:'#3a9a4a'}]},
  'bc-bradesco':{signs:[{lines:['Agência 2154'],bg:'#f4f4f2',fg:'#d4262c',x:1.6,y:1.9,w:1.1,h:.25,out:.02,depth:.01}]},
  'bc-credisan':{extras:[{t:'plants',x0:-4.6,x1:-4.6}],signs:[{lines:['Credisan'],bg:'#1f4a3a',fg:'#ffffff',x:-4.8,y:.3,w:.35,h:2.2,out:.03}]},
  'bc-sicoob':{signs:[{lines:['813'],bg:'#f3f3f0',fg:'#3a3a3a',x:.9,y:1.5,w:.35,h:.25,out:.02,depth:.01},{lines:['Dr. Jefferson','salão'],bg:'#f2d6a6',fg:'#6a3a2a',font:'script',x:4.8,y:2.3,w:.9,h:.5}]},
  'bc-sicredi':{extras:[{t:'plants',x0:-7,x1:-6}]},
  'lj-haddad':{extras:[{t:'balls',x:-4.7,n:10},{t:'balls',x:-3.5,n:10},{t:'plants',x0:-.2,x1:-.2}]},
  'lj-originalclass':{signs:[{lines:['calcci'],bg:'#f2f2ee',fg:'#1d1d1d',x:3.6,y:1.4,w:.7,h:1.2,out:.14}]},
  'lj-santa25':{signs:[{lines:['IMOBILIÁRIA OLIVEIRA','VENDE','(19) 3663-1604'],bg:'#ffffff',fg:'#c42b2b',x:-4.4,y:3.75,w:3.4,h:1.1,depth:.02},
    {lines:['SOB NOVA','DIREÇÃO'],bg:'#ffffff',fg:'#2bb06e',x:-8.4,y:2.48,w:1.5,h:.7,out:.16}]},
  'lj-todachic':{signs:[{lines:['Odontologia','Dr. Leonardo'],bg:'#eef2f2',fg:'#3a7a8a',x:-6,y:1.3,w:.8,h:.9}]},
  'lj-alebru':{extras:[{t:'plants',x0:-3.4,x1:-3.4}]},
  'lj-juliana':{extras:[{t:'sacks',x:-3.6,n:2,c:'#e8e6df'}]},
  'lj-dassi':{extras:[{t:'bin',x:3.6}]},
  'lj-mundy':{extras:[{t:'totem',x:-3.2,h:1.9,w:.55,out:1.3,sign:{lines:['MUNDY'],bg:'#c42b3c',fg:'#ffffff',y:0,w:.55,h:1.9}}]},
  'lj-reluz':{extras:[{t:'aframe',x:-4.3,lines:['Reluz','moda infantil'],bg:'#ffffff',fg:'#c8344a'},{t:'motos',x:4.4,n:1}]},
  'lj-primos':{extras:[{t:'balls',x:2.9,n:8},{t:'racks',x:.2,c:['#e83a8a','#3ab0e8','#f2c418']}]},
  'lj-zeza':{extras:[{t:'bollards',x0:-4,x1:4,c:'#e3c23a'}]},
  'lj-optica':{signs:[{lines:['FAÇA','SEUS ÓCULOS','EM 10X','NO CARTÃO'],bg:'#1e3a9a',fg:'#ffffff',x:-6.3,y:.3,w:1.1,h:2.2,out:.02}]},
  'lj-dogmia':{signs:[{lines:['Dog & Mia','banho · tosa · acessórios'],bg:'#ffffff',fg:'#c48a3a',x:-.5,y:.4,w:.5,h:1.9,out:.03},{lines:['pet boutique'],bg:'#ffffff',fg:'#c48a3a',x:1.3,y:.4,w:.5,h:1.9,out:.03}]},
  'lj-automais':{extras:[{t:'motos',x:-3.6,n:1}]},
  'lj-ronaldinho':{extras:[{t:'motos',x:-7,n:4},{t:'motos',x:3,n:3}]},
  'lj-dgauto':{extras:[{t:'drums',x:-4.4,n:2,c:'#3a3a3a'}]},
  'lj-agrolandia':{extras:[{t:'sacks',x:1.6,n:8},{t:'racks',x:-1.2,c:['#e8e6df','#3a7a3a','#c49a4a']}]},
  'lj-agrovale':{extras:[{t:'sacks',x:4.6,n:8,c:'#d8c9a6'}]},
  'lj-agrolima':{extras:[{t:'drums',x:-10,n:4,c:'#2a6ad0'},{t:'sacks',x:-3,n:8}]},
  'lj-bellachica':{extras:[{t:'plants',x0:-.8,x1:-.8}]},
  'lj-marcinho':{extras:[{t:'aframe',x:2.8,lines:['Prato do dia','R$ 25,00'],bg:'#2a2a2a'}]},
  'lj-bifinho':{extras:[{t:'aframe',x:-2.2,lines:['Picanha','Fraldinha','Linguiça'],bg:'#1d1d1d',fg:'#e2b24a'}]},
  'mc-lealdutra':{extras:[{t:'plants',x0:-5.8,x1:-3.6}]},
  'mc-santoantonio':{extras:[{t:'plants',x0:-3.4,x1:-2.2},{t:'aframe',x:1.4,lines:['PORCELANATO','a partir de 49,90'],bg:'#f2f2ee',fg:'#2a2a2a'}]},
  'mc-chiquinho':{extras:[{t:'sacks',x:3,n:4,c:'#9a9c9e'}]},
  'mc-delninno':{extras:[{t:'drums',x:-4,n:2,c:'#ee6a2a'}]},
  'fa-total':{signs:[{lines:['incomparável','95%','de desconto'],bg:'#d82a2a',fg:'#ffffff',x:-5.2,y:.4,w:1.3,h:1.6,out:.02}]},
  'fa-farmapopular':{signs:[{lines:['MENORES','PREÇOS','VOCÊ ENCONTRA AQUI!'],bg:'#f2d84a',fg:'#2a2a2a',x:-2,y:.6,w:1.2,h:1.6,out:.02}]},
  'lj-cancian':{extras:[{t:'crates',x:8.6,n:6,c:'#e8b421'}]},
  'lj-kenny':{extras:[{t:'racks',x:3.6,c:['#cfe03a','#1d1d1d','#2a4fa0']}]},
  'lj-crystal':{extras:[{t:'racks',x:6,c:['#d0403a','#f2f2ee','#e85d8a']}]},
  'lj-paratodos':{extras:[{t:'racks',x:-3.6,c:['#3b6fb0','#f2f2ee','#c43c5a']}]},
  'lj-neusa':{extras:[{t:'racks',x:-1.4,c:['#d9d0e8','#f2f2ee','#7a5ab0']}]},
};

// each record with its second-pass details appended
export function mergeDetalhes(list:LojaSpec[]):LojaSpec[]{
  return list.map(l=>{
    const d=DETALHES[l.id];if(!d)return l;
    const s=l.shop;
    return{...l,shop:{signs:[...s.signs??[],...d.signs??[]],awnings:[...s.awnings??[],...d.awnings??[]],clad:[...s.clad??[],...d.clad??[]],extras:[...s.extras??[],...d.extras??[]]}};
  });
}
