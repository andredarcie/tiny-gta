// The story's mission chain as plain data — no THREE, no DOM — so the save format can
// be validated in unit tests (test/unit/story-chain.test.ts). See js/story/story.ts.

/** In order: answer the first call → wipe out the camp → answer the second call →
 *  bury the dead → report back on the third call → done. */
export const STAGES=['call1','camp','call2','burial','call3','done'] as const;
export type Stage=typeof STAGES[number];

/** A finished grave in the woods (world x/z + yaw). */
export interface GraveRec{x: number;z: number;ry: number;}

/** What the save keeps: the stage, where each camp body lies (null = already buried),
 *  the finished graves and where the shovel was left (burial only). */
export interface StorySave{
  stage: Stage;
  bodies: ({x: number;z: number}|null)[];
  graves: GraveRec[];
  shovel: {x: number;z: number}|null;
}

const num=(v: unknown): v is number=>typeof v==='number'&&Number.isFinite(v);

/** Validate a stored story blob. Returns null when there is nothing usable (a fresh
 *  game starts at call1). Bodies/graves/shovel are trimmed to what the stage can use:
 *  bodies only matter while they still lie at the camp (call2, burial), graves from the
 *  burial on, the shovel only during the burial; at most `campSize` bodies/graves. */
export function sanitizeStorySave(raw: unknown,campSize: number): StorySave|null{
  if(!raw||typeof raw!=='object')return null;
  const r=raw as Record<string,unknown>;
  if(!STAGES.includes(r.stage as Stage))return null;
  const stage=r.stage as Stage;
  const bodies: ({x: number;z: number}|null)[]=[];
  if((stage==='call2'||stage==='burial')&&Array.isArray(r.bodies)){
    for(const b of r.bodies.slice(0,campSize)){
      if(b===null&&stage==='burial')bodies.push(null);
      else if(b&&typeof b==='object'&&num((b as {x: unknown}).x)&&num((b as {z: unknown}).z))
        bodies.push({x:(b as {x: number}).x,z:(b as {z: number}).z});
      else bodies.push({x:NaN,z:NaN});                    // unknown: the body goes back to its post
    }
  }
  const graves: GraveRec[]=[];
  if((stage==='burial'||stage==='call3'||stage==='done')&&Array.isArray(r.graves)){
    for(const g of r.graves.slice(0,campSize)){
      const o=g as Record<string,unknown>|null;
      if(o&&num(o.x)&&num(o.z))graves.push({x:o.x,z:o.z,ry:num(o.ry)?o.ry:0});
    }
  }
  const sv=r.shovel as Record<string,unknown>|null|undefined;
  const shovel=stage==='burial'&&sv&&num(sv.x)&&num(sv.z)?{x:sv.x,z:sv.z}:null;
  return{stage,bodies,graves,shovel};
}
