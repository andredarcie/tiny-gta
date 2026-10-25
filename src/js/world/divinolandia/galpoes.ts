// The town's sheds and large buildings that the footprints of the Microsoft building data
// show and the town did not model yet (warehouses, coffee and agro stores, workshops, bus and
// truck depots, the gym, the covered court, a shade-net nursery…). One entry per real
// building: its footprint (the oriented rectangle of the footprint, +z = the side facing the
// nearest street, pulled in ≥ 1.5 m off the road edges) and its look, read off its Street View
// photo (captures gp-NNN in docs/divinolandia/referencias-streetview, local) or, where no
// panorama reaches it, the gridded satellite. Generated from those references by a one-off
// survey script, then kept by hand. build.ts places each one with the galpao.ts model on the
// real slope of its lot and keeps the generated houses off it. Pure data (no THREE).
import type {GalpaoOpts} from '../../../assets/models/divinolandia/galpao.ts';

export interface GalpaoSpec{id:string;nome:string;c:[number,number];w:number;d:number;rot:number;o:Omit<GalpaoOpts,'w'|'d'|'groundAt'>}
// town-local metres; rot = angle of the local +x axis (THREE rotation.y = -rot)
export const GALPOES:GalpaoSpec[]=[
  {id:'g0',nome:'Galpão industrial (norte do rio)',c:[559.4,-726.5],w:51.8,d:107.7,rot:0.4662,o:{h:9,ridge:'z',spans:2,wall:'reboco',wallColor:'#e2dfd6',upper:{kind:'chapa',c:'#c9cdcf',from:4},roofColor:'galv',band:{c:'#9a9a94',h:1},doors:[{x:-12,w:7,h:6,kind:'roll'},{x:12,w:7,h:6,kind:'roll'}]}},
  {id:'g1a',nome:'Galpão de bloco com placas solares',c:[497.0,-599.0],w:75.0,d:22.0,rot:2.3633,o:{h:6,ridge:'x',wall:'bloco',roofColor:'galv',solar:0.55,doors:[{x:0,w:6,h:4.5,kind:'roll'}]}},
  {id:'g1b',nome:'Galpão de bloco (anexo)',c:[540.0,-604.0],w:22.0,d:50.0,rot:2.5564,o:{h:6,ridge:'z',wall:'bloco',roofColor:'galv',doors:[{x:0,w:6,h:4.5,kind:'roll'}]}},
  {id:'g2',nome:'Barracão comprido na encosta (placas solares)',c:[-2.2,-668.3],w:80.9,d:43.6,rot:0.1278,o:{h:4.5,ridge:'x',spans:3,open:'all',roofColor:'ferrugem',solar:0.8}},
  {id:'g3',nome:'Galpão de chapa (oeste)',c:[-1024.6,-832.3],w:76.7,d:31.8,rot:-2.2647,o:{h:8,ridge:'x',wall:'chapa',wallColor:'#c3c7c9',roofColor:'galv',solar:0.25,doors:[{x:-10,w:7,h:6,kind:'roll'}]}},
  {id:'g4',nome:'Prédio comprido branco à beira do rio',c:[478.3,-474.4],w:98.1,d:20.7,rot:0.1385,o:{h:4.2,ridge:'x',wall:'reboco',wallColor:'#efede6',roofColor:'fibro',band:{c:'#b8b4ab',h:0.8},windows:{y:1.6,h:1.3,w:2.2,every:4,front:true}}},
  {id:'g5',nome:'Galpões em arco de tijolo',c:[1074.6,324.8],w:44.5,d:36.3,rot:1.4378,o:{h:6,roof:'arch',ridge:'z',spans:2,wall:'bloco',roofColor:'azul',doors:[{x:-8,w:4,h:4.2,kind:'gate',c:'#2f5fa8'},{x:8,w:4,h:4.2,kind:'gate',c:'#2f5fa8'}]}},
  {id:'g6',nome:'Galpão de chapa galvanizada (transportadora)',c:[1060.4,284.6],w:36.0,d:50.7,rot:1.4669,o:{h:7,ridge:'z',wall:'chapa',wallColor:'#b9bec1',roofColor:'galv',open:'front'}},
  {id:'g7',nome:'Galpão (oeste)',c:[-679.6,-314.8],w:62.6,d:29.7,rot:-2.9005,o:{h:7,ridge:'x',wall:'reboco',wallColor:'#e6e2d8',upper:{kind:'chapa',c:'#c9cdcf',from:3.5},roofColor:'galv',doors:[{x:0,w:6,h:5,kind:'roll'}]}},
  {id:'g8',nome:'Ginásio de esportes',c:[980.2,131.5],w:28.2,d:41.2,rot:1.5498,o:{h:8,roof:'arch',ridge:'z',pitch:0.16,wall:'reboco',wallColor:'#ece6d4',roofColor:'branco',frontFace:{c:'#5c7290',trim:'#b2342e'},porch:{w:9,d:3.5,h:3.2,c:'#b2342e'},doors:[{x:0,w:4,h:2.8,kind:'open'}],windows:{y:5.2,h:1.6,w:3.4,every:4.8,front:true}}},
  {id:'g9',nome:'Oficina com a bandeira quadriculada',c:[842.1,-260.7],w:49.8,d:26.9,rot:-2.8173,o:{h:7,ridge:'z',wall:'reboco',wallColor:'#e9e6dd',band:{c:'#c8322c',h:1.2},roofColor:'galv',mural:'checker',doors:[{x:-2,w:7,h:4.6,kind:'open'}]}},
  {id:'g10',nome:'Galpão velho de tijolo',c:[267.6,121.4],w:27.9,d:47.2,rot:-2.9869,o:{h:5.5,ridge:'z',wall:'bloco',roofColor:'fibro',doors:[{x:-3,w:1.8,h:2.6,kind:'gate',c:'#e8e8e4'},{x:-1,w:1.8,h:2.6,kind:'gate',c:'#9a3a2c'},{x:5,w:2.2,h:2.6,kind:'gate',c:'#e8e8e4'}]}},
  {id:'g11',nome:'Armazém agrícola',c:[-393.3,828.7],w:50.6,d:28.1,rot:-3.0148,o:{h:5,ridge:'x',wall:'concreto',wallColor:'#2f5fa8',roofColor:'fibro',open:'front'}},
  {id:'g12',nome:'Galpão branco (oeste)',c:[-598.5,-259.5],w:47.4,d:25.5,rot:3.1297,o:{h:6.5,ridge:'x',wall:'reboco',wallColor:'#ebe8e1',roofColor:'branco',doors:[{x:-6,w:5,h:4.5,kind:'roll'}]}},
  {id:'g15',nome:'Galpão',c:[199.1,-433.3],w:35.4,d:36.1,rot:-1.4048,o:{h:6,ridge:'z',wall:'reboco',wallColor:'#e3dfd4',roofColor:'fibro',doors:[{x:0,w:5,h:4.5,kind:'roll'}]}},
  {id:'g18',nome:'Garagem dos ônibus',c:[-4.4,-448.3],w:20.8,d:51.8,rot:-1.4527,o:{h:5.5,ridge:'z',wall:'reboco',wallColor:'#d97a6a',band:{c:'#b9554a',h:1},roofColor:'fibro',doors:[{x:-4,w:4.5,h:3.6,kind:'gate',c:'#c58a5a'},{x:4,w:4.5,h:3.6,kind:'gate',c:'#c58a5a'}]}},
  {id:'g19',nome:'Bilica Pneus e Rodas',c:[93.0,-483.5],w:22.2,d:49.6,rot:-1.3492,o:{h:7,ridge:'z',wall:'reboco',wallColor:'#e4dfd2',roofColor:'galv',doors:[{x:-2.5,w:4.8,h:4.6,kind:'gate',c:'#d8d2c2'},{x:3,w:4.8,h:4.6,kind:'roll'}],sign:{lines:['BILICA · PNEUS E RODAS','AUTO PEÇAS - CENTRO AUTOMOTIVO'],bg:'#1a1a1a',fg:'#ffffff',x:2,y:5.4,w:11,h:2.2}}},
  {id:'g20',nome:'Escola (prédio azul)',c:[-18.9,-399.9],w:20.4,d:48.3,rot:-1.4921,o:{h:5,ridge:'x',wall:'reboco',wallColor:'#4f9ad6',band:{c:'#3c7dbb',h:0.9},roofColor:'fibro',doors:[{x:0,w:2.4,h:2.6,kind:'gate',c:'#2f5fa8'}],windows:{y:1.5,h:1.5,w:2.4,every:4,front:true}}},
  {id:'g21',nome:'Quadra coberta',c:[68.5,263.6],w:37.3,d:24.3,rot:0.1533,o:{h:7,roof:'arch',ridge:'x',pitch:0.18,open:'all',wallColor:'#2f5fa8',roofColor:'galv'}},
  {id:'g24',nome:'Galpão de telhado azul (leste)',c:[1295.8,-317.1],w:33.4,d:27.9,rot:0.0469,o:{h:7,ridge:'x',wall:'chapa',wallColor:'#cfd3d4',roofColor:'azul',doors:[{x:0,w:6,h:5,kind:'roll'}]}},
  {id:'g27',nome:'Salão de Eventos',c:[1030.8,-187.0],w:16.3,d:47.4,rot:-1.6341,o:{h:6,ridge:'z',wall:'chapa',wallColor:'#e8e8e4',roofColor:'galv',band:{c:'#bfbdb6',h:1},doors:[{x:0,w:3,h:2.8,kind:'gate',c:'#6d7276'}],sign:{lines:['SALÃO DE EVENTOS'],bg:'#f2f2ee',fg:'#3a3a3a',x:0,y:4.4,w:8,h:0.9}}},
  {id:'g28',nome:'Martinelli Comunicação Visual',c:[88.1,-410.0],w:19.5,d:38.4,rot:-1.3795,o:{h:6.5,ridge:'z',wall:'chapa',wallColor:'#55595c',roofColor:'galv',doors:[{x:2,w:4,h:3.6,kind:'gate',c:'#2b2d2e'}],sign:{lines:['martinelli','COMUNICAÇÃO VISUAL · GRÁFICA · PUBLICIDADE'],bg:'#151515',fg:'#4cc24a',x:-3,y:3.4,w:6.4,h:2.4}}},
  {id:'g31',nome:'Prédio branco do muro azul',c:[-5.3,-356.0],w:24.6,d:27.1,rot:-1.4634,o:{h:4.5,ridge:'x',wall:'reboco',wallColor:'#f0eee8',band:{c:'#3e66b0',h:1.6},roofColor:'fibro',windows:{y:1.6,h:1.2,w:1.8,every:3.6,front:true}}},
  {id:'g36',nome:'Centro automotivo (lubrificantes)',c:[803.7,33.9],w:25.8,d:27.0,rot:0.0000,o:{h:6.5,ridge:'z',wall:'reboco',wallColor:'#f3f2ee',band:{c:'#1d1d1d',h:1.1},roofColor:'galv',doors:[{x:-3,w:6,h:4.6,kind:'open'},{x:4.2,w:2.4,h:2.4,kind:'open'}],sign:{lines:['LUBRIFICANTES'],bg:'#2a5db0',fg:'#ffffff',x:0,y:5.4,w:9,h:1.3}}},
  {id:'g39',nome:'Casa dos Vidros',c:[-99.2,-241.0],w:23.9,d:27.0,rot:1.6876,o:{h:6,ridge:'z',wall:'reboco',wallColor:'#a7a9aa',roofColor:'fibro',doors:[{x:-4.5,w:3.6,h:3.6,kind:'gate',c:'#8e2a26'},{x:3.5,w:4.2,h:4,kind:'open'}],sign:{lines:['CASA DOS VIDROS'],bg:'#111111',fg:'#ffffff',x:-0.6,y:3.6,w:3.4,h:1.2}}},
  {id:'g42',nome:'Barracão dos caminhões (sudeste)',c:[1209.3,852.5],w:31.9,d:19.5,rot:-2.2470,o:{h:6,ridge:'x',open:'all',roofColor:'azul'}},
  {id:'g44',nome:'Viveiro de mudas',c:[-848.1,-404.1],w:31.5,d:19.5,rot:-2.7605,o:{h:3,net:true}},
  {id:'g49',nome:'Galpão (junto ao ginásio)',c:[1013.0,125.3],w:21.9,d:25.4,rot:-0.0354,o:{h:5.5,ridge:'z',wall:'reboco',wallColor:'#e8e3d6',roofColor:'fibro',doors:[{x:0,w:4,h:3.6,kind:'roll'}]}},
  {id:'g51',nome:'Centro Pastoral João Paulo II',c:[66.2,76.2],w:22.7,d:27.1,rot:-3.0446,o:{h:4.6,roof:'flat',ridge:'x',wall:'reboco',wallColor:'#b9bcbd',band:{c:'#7d8a6e',h:1.2},doors:[{x:1,w:1.6,h:2.4,kind:'gate',c:'#d8d8d4'}],windows:{y:1.6,h:1.6,w:2.6,every:4.2,front:true},sign:{lines:['Centro Pastoral','João Paulo II'],bg:'#b9bcbd',fg:'#eeeeea',x:-4,y:3,w:5,h:1.4}}},
  {id:'g52',nome:'Galpão (sul)',c:[-450.9,937.6],w:17.7,d:30.8,rot:-1.3772,o:{h:5.5,ridge:'z',wall:'reboco',wallColor:'#e6e1d6',roofColor:'fibro'}},
  {id:'g54',nome:'Oficina azul e branca',c:[-328.2,-38.1],w:16.6,d:34.3,rot:2.7329,o:{h:5.5,roof:'flat',ridge:'x',wall:'reboco',wallColor:'#f2f2ee',band:{c:'#2d57b8',h:1.6},doors:[{x:0,w:4.4,h:3.6,kind:'open'}]}},
  {id:'g65',nome:'Galpão de bloco e oficina coberta',c:[1417.1,-134.1],w:12.8,d:37.7,rot:-1.9939,o:{h:6.5,ridge:'z',wall:'concreto',roofColor:'fibro',open:'front'}},
  {id:'g66',nome:'Galpão comercial',c:[624.5,-13.0],w:25.6,d:18.7,rot:-0.3404,o:{h:6,roof:'flat',ridge:'x',wall:'reboco',wallColor:'#ebe8e1',band:{c:'#b9b6ae',h:1.1},doors:[{x:-4,w:5.5,h:4.2,kind:'open'}],windows:{y:1.4,h:0.9,w:2,every:5,front:false}}},
  {id:'g74',nome:'Galpão de telhado azul (beira-rio)',c:[1106.5,-196.4],w:18.7,d:24.3,rot:1.3881,o:{h:6,ridge:'z',wall:'chapa',wallColor:'#c6cacb',roofColor:'azul'}},
  {id:'g85',nome:'Galpão (sudoeste)',c:[-773.0,672.1],w:19.7,d:22.6,rot:1.9967,o:{h:5.5,ridge:'z',wall:'reboco',wallColor:'#e3ddd0',roofColor:'fibro'}},
  {id:'g86',nome:'Galpão comprido (leste)',c:[1097.2,-247.7],w:8.2,d:59.5,rot:1.6465,o:{h:5,ridge:'z',wall:'chapa',wallColor:'#c6cacb',roofColor:'azul'}},
  {id:'g88',nome:'Galpão (norte)',c:[-58.2,-899.5],w:24.2,d:14.8,rot:-2.2900,o:{h:5.5,ridge:'z',wall:'reboco',wallColor:'#e6e1d6',roofColor:'galv'}},
  {id:'g97',nome:'Galpão comercial (portão marrom)',c:[138.6,-459.3],w:19.9,d:19.9,rot:1.7219,o:{h:6,roof:'flat',ridge:'x',wall:'reboco',wallColor:'#e9e6df',band:{c:'#bcb8b0',h:1.6},doors:[{x:-4,w:4.4,h:4.6,kind:'gate',c:'#8d7a45'}],windows:{y:3.8,h:0.6,w:2.6,every:6,sides:false}}},
  {id:'g102',nome:'Galpão (leste do centro)',c:[915.0,-75.2],w:13.6,d:29.8,rot:3.0068,o:{h:5.5,ridge:'z',wall:'reboco',wallColor:'#e8e3d8',roofColor:'fibro',doors:[{x:0,w:4,h:3.8,kind:'roll'}]}},
  {id:'g105',nome:'Oficina de bloco com barracão',c:[1439.6,-160.5],w:34.5,d:8.5,rot:-2.0799,o:{h:5.5,ridge:'x',wall:'bloco',roofColor:'ferrugem',open:'front'}},
  {id:'g107',nome:'Galpão de telhado azul (sudeste)',c:[1365.0,-374.1],w:21.9,d:21.9,rot:-0.0310,o:{h:6,ridge:'z',wall:'chapa',wallColor:'#cdd1d2',roofColor:'azul',doors:[{x:0,w:5,h:4.5,kind:'roll'}]}},
  {id:'g108',nome:'Galpão (sudoeste distante)',c:[-1169.1,1016.2],w:13.2,d:24.6,rot:3.1340,o:{h:5,ridge:'z',wall:'reboco',wallColor:'#e3ddd0',roofColor:'fibro'}},
  {id:'g109',nome:'Prédio comprido creme',c:[801.5,-284.5],w:21.9,d:16.2,rot:-1.2470,o:{h:4.6,ridge:'x',wall:'reboco',wallColor:'#e7dcc4',band:{c:'#9a8a70',h:0.5},roofColor:'fibro',windows:{y:1.7,h:1.2,w:2.2,every:4.2,front:true}}},
  {id:'g117',nome:'Galpão',c:[205.3,61.6],w:13.8,d:33.7,rot:-1.4154,o:{h:5,ridge:'z',wall:'reboco',wallColor:'#e6e1d6',roofColor:'fibro',doors:[{x:0,w:4,h:3.6,kind:'roll'}]}},
];
