// The shape of one REAL business of Divinolândia (supermarket, bank, shop…), surveyed from
// Google Street View: where it is (its Google Maps place, snapped onto the OSM street it
// faces) and what its front looks like. The building itself is a Fachada (the surveyed
// street kit: storeys, roof, openings with real holes, balcony), dressed by the shopfront
// layer of loja-comercio.ts: signboards with their lettering and logo, the fascia band,
// awnings and canopies, claddings (wall tiles, mosaic, stone, brick, polished granite,
// ACM), and the clutter of the pavement (trolleys, crates, totems, flower pots).
// Pure data, no THREE (unit-tested in Node).
import type {FachadaOpts} from '../../../../assets/models/divinolandia/fachada.ts';

export type Kind='supermercado'|'banco'|'loja'|'farmacia'|'construcao'|'servico';
// a signboard on the façade (façade frame: x across the front, centre 0, left = negative
// AS SEEN FROM THE STREET; y up from the shop floor; out = metres in front of the wall)
export type Logo='cart'|'cross'|'bradesco'|'bb'|'sicoob'|'sicredi'|'caixa'|'ant'|'crown'|'house'|'credisan'|'star'|'pedrilho'|'drop'|'tooth'|'pin'|'circle';
export type Sign={
  lines:string[];bg:string;fg:string;
  x?:number;y:number;w:number;h:number;out?:number;
  font?:'sans'|'serif'|'script'|'stencil'|'italic';
  logo?:Logo;logoAt?:'left'|'right'|'centre';logoC?:string;
  frame?:string;          // a thin border colour
  depth?:number;          // box depth (default .08; a light box .25)
  side?:boolean;          // a blade sign standing out from the wall (perpendicular)
  lit?:boolean;           // glows a little at night
};
export type Awning={kind:'curved'|'lona'|'tile'|'slab'|'flat'|'glass';c:string;x?:number;w:number;y:number;depth?:number;label?:string;fg?:string};
export type Clad={kind:'azulejo'|'pastilha'|'pedra'|'tijolinho'|'granito'|'mosaico'|'acm'|'ripado'|'grafiato';c?:string;c2?:string;x0:number;x1:number;y0:number;y1:number};
export type Extra=
  |{t:'carts';x:number;n:number;c?:string}
  |{t:'crates';x:number;n:number;c?:string}
  |{t:'bench';x:number;c?:string}
  |{t:'vase';x:number;palm?:boolean}
  |{t:'mannequins';x:number;n:number;c?:string[]}
  |{t:'totem';x:number;h:number;w:number;sign:Sign;out?:number}
  |{t:'spots';xs:number[];y:number}
  |{t:'pergola';d:number;h:number;c:string}
  |{t:'crenel';c:string;c2:string}
  |{t:'gable';h:number;c:string}
  |{t:'tarp';x:number;w:number;h:number;c:string}
  |{t:'corrugated';y0:number;y1:number;c:string}
  |{t:'tower';x:number;w:number;h:number;c:string}
  |{t:'cooler';x:number;c:string;label?:string}
  |{t:'bollards';x0:number;x1:number;c?:string}
  |{t:'rail';x0:number;x1:number;c:string;y?:number}
  |{t:'motos';x:number;n:number}                         // motorcycles parked at the kerb
  |{t:'balls';x:number;n:number}                         // footballs hung by the door
  |{t:'racks';x:number;c?:string[]}                      // a clothes rail out on the pavement
  |{t:'sacks';x:number;n:number;c?:string}               // sacks of feed / cement
  |{t:'aframe';x:number;lines:string[];bg?:string;fg?:string}   // a sandwich board
  |{t:'plants';x0:number;x1:number}                      // potted plants along the front
  |{t:'drums';x:number;n:number;c?:string}
  |{t:'bin';x:number;c?:string};
export interface ShopOpts{signs?:Sign[];awnings?:Awning[];clad?:Clad[];extras?:Extra[]}

export interface LojaSpec{
  id:string;nome:string;kind:Kind;
  at:[number,number];          // the place (lat, lng) — Google Maps, or where Street View shows it
  rua:string;                  // a piece of the OSM street name it faces
  w:number;                    // frontage (m)
  ds?:number;                  // nudge along the street (m, + = toward the street's end)
  next?:{to:string;side:-1|1}; // stands right beside another business (−1 = on its left as seen from the street)
  f:Omit<FachadaOpts,'w'>;
  shop:ShopOpts;
  ref:string;                  // the Street View capture it was modelled from (referencias-streetview/)
}
