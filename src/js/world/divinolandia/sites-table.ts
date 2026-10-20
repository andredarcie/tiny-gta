// Where the game's places stand in the real Divinolândia. PURE data, no imports:
// data.ts flattens the terrain under every site (a level pad blended into the slope, so
// buildings sit flush and gameplay that reads groundHeight works unchanged), and
// build.ts keeps the generated houses, poles and trees off them.
//
// Coordinates are town-LOCAL metres (the bake frame: centred on the Igreja Matriz,
// x = east, z = south; add DIV_OX/DIV_OZ for world). `face` is the heading the front
// door looks at (atan2(dx,dz)) — toward the street. w = width along the facade,
// d = depth. Sites were picked from lots with little slope that face a street
// (tools of the 2026-10-20 migration: nearest street snapped, facade parallel to it,
// set back past the kerb) and keep clear of the surveyed Rua José Augusto Machado and
// the Euclides da Cunha school.
export interface SiteSpec{x:number;z:number;face:number;w:number;d:number;name:string}

export const SITE_TABLE={
  // ---- downtown (shops on the real commercial blocks around the Matriz)
  club:     {x:-325.7,z:-49.5, face:-2.6673,w:20,d:22,name:'Rua São José'},
  gym:      {x:246.8, z:-104.2,face:1.3661, w:18,d:20,name:'Rua Joaquim Garcia'},
  gunShop:  {x:2.6,   z:-139.9,face:-1.7183,w:18,d:20,name:'Rua Barão do Rio Branco'},
  clothes:  {x:-100.2,z:-217.0,face:-0.1886,w:18,d:20,name:'Rua Treze de Maio'},
  workshop: {x:546.3, z:-50.4, face:1.3491, w:22,d:22,name:'Praça Nossa Senhora do Rosário'},
  prison:   {x:1040.0,z:-196.9,face:2.6095, w:22,d:24,name:'Avenida Marginal do Rio do Peixe'},
  genStore: {x:-156.0,z:473.1, face:1.0855, w:12,d:14,name:'Rua Barão do Rio Branco'},
  // ---- garages and yards
  crusher:  {x:-517.3,z:-201.0,face:1.4483, w:18,d:18,name:'ferro-velho da rodovia'},
  exportDock:{x:1350.6,z:-344.7,face:2.6779,w:18,d:18,name:'saída leste'},
  bombShop: {x:-664.0,z:112.4, face:3.0358, w:16,d:16,name:'Rua Constatino da Cunha Sobrinho'},
  // ---- countryside (translated only: the compounds keep their own axes)
  ranch:    {x:-203.5,z:827.4, face:Math.PI,w:38,d:38,name:'sítio da estrada do hospital'},
  weedFarm: {x:-938.5,z:-777.5,face:0,      w:30,d:24,name:'grota além do Rio do Peixe'},
  fort:     {x:-168.0,z:1668.2,face:Math.PI,w:50,d:50,name:'serra ao sul'},
} satisfies Record<string,SiteSpec>;
export type SiteId=keyof typeof SITE_TABLE;

// pad = metres beyond the footprint that are fully levelled; blend = slope back to the
// natural ground over this many more metres (the heightfield cell is 8 m)
export const SITE_PAD=4, SITE_BLEND=18;

// Is the town-LOCAL point (lx,lz) on a site's lot (footprint grown by `margin`)? The
// town build skips generated houses, poles and trees there.
export function onSiteLot(lx:number,lz:number,margin=2):boolean{
  for(const id in SITE_TABLE){
    const s=SITE_TABLE[id as SiteId],dx=lx-s.x,dz=lz-s.z;
    const fx=Math.sin(s.face),fz=Math.cos(s.face);
    if(Math.abs(dx*fz-dz*fx)<s.w/2+margin&&Math.abs(dx*fx+dz*fz)<s.d/2+margin)return true;
  }
  return false;
}
// the lot outline (town-local), for the pole planner's protected areas
export function siteLotPolygon(id:SiteId,margin=2):[number,number][]{
  const s=SITE_TABLE[id],fx=Math.sin(s.face),fz=Math.cos(s.face),ux=fz,uz=-fx;
  const a=s.w/2+margin,b=s.d/2+margin;
  return[[-1,-1],[1,-1],[1,1],[-1,1]].map(([u,v])=>[s.x+ux*u*a+fx*v*b,s.z+uz*u*a+fz*v*b]);
}
