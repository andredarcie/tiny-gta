// Axis-aligned collision boxes of the OFF-MAP rooms: every interior (club, gym, shops,
// hospital, prison, house) and the escape tunnel are built far west of the town
// (x ≈ -700…-1000), and their walls, counters and furniture are pushed here by the
// models. Collision out in Divinolândia itself uses oriented boxes instead
// (divinolandia/collide.ts); physics.ts picks the right list by position.
export type Solid={x0:number;x1:number;z0:number;z1:number;h:number};
export const solids:Solid[]=[];
