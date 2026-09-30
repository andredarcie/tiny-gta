// The story's mission chain as plain data — no THREE, no DOM — so the save format can
// be validated in unit tests (test/unit/story-chain.test.ts). See js/story/story.ts.

/** In order — mission 1: answer the first call → wipe out the camp → second call;
 *  mission 2: bury the dead → report back on the third call;
 *  mission 3: the fourth call (the dead rose) → kill the zombies → fifth call → see the
 *  priest → burn the cursed bodies with holy water → back to the priest (the blessing). */
export const STAGES=['call1','camp','call2','burial','call3','call4','zombies','call5','priest','holywater','blessing','done'] as const;
export type Stage=typeof STAGES[number];

/** A finished grave in the woods (world x/z + yaw). */
export interface GraveRec{x: number;z: number;ry: number;}

/** What the save keeps: the stage, where each body lies — the camp's dead up to the
 *  burial (null = buried), the zombies' cursed corpses after the fight (null = burned) —
 *  the graves, and where the shovel was left (burial only). */
export interface StorySave{
  stage: Stage;
  bodies: ({x: number;z: number}|null)[];
  graves: GraveRec[];
  shovel: {x: number;z: number}|null;
}

const num=(v: unknown): v is number=>typeof v==='number'&&Number.isFinite(v);

/** Validate a stored story blob. Returns null when there is nothing usable (a fresh
 *  game starts at call1). Bodies/graves/shovel are trimmed to what the stage can use:
 *  bodies only while they lie in the woods (call2/burial, then call5/priest/holywater),
 *  graves from the burial on, the shovel only during the burial; at most `campSize`. */
export function sanitizeStorySave(raw: unknown,campSize: number): StorySave|null{
  if(!raw||typeof raw!=='object')return null;
  const r=raw as Record<string,unknown>;
  if(!STAGES.includes(r.stage as Stage))return null;
  const stage=r.stage as Stage;
  const bodies: ({x: number;z: number}|null)[]=[];
  const withBodies=['call2','burial','call5','priest','holywater'].includes(stage);
  const canBeGone=stage==='burial'||stage==='holywater';
  if(withBodies&&Array.isArray(r.bodies)){
    for(const b of r.bodies.slice(0,campSize)){
      if(b===null&&canBeGone)bodies.push(null);
      else if(b&&typeof b==='object'&&num((b as {x: unknown}).x)&&num((b as {z: unknown}).z))
        bodies.push({x:(b as {x: number}).x,z:(b as {z: number}).z});
      else bodies.push({x:NaN,z:NaN});                    // unknown: the body goes back to its post
    }
  }
  const graves: GraveRec[]=[];
  if(STAGES.indexOf(stage)>=STAGES.indexOf('burial')&&Array.isArray(r.graves)){
    for(const g of r.graves.slice(0,campSize)){
      const o=g as Record<string,unknown>|null;
      if(o&&num(o.x)&&num(o.z))graves.push({x:o.x,z:o.z,ry:num(o.ry)?o.ry:0});
    }
  }
  const sv=r.shovel as Record<string,unknown>|null|undefined;
  const shovel=stage==='burial'&&sv&&num(sv.x)&&num(sv.z)?{x:sv.x,z:sv.z}:null;
  return{stage,bodies,graves,shovel};
}
