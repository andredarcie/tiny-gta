import NPCS from '../../npcs.json';

// Typed reader for the PURE NPC definitions in /npcs.json — the single source of
// truth for the game's fixed population. Identity (name, neighborhood, sex, likes)
// lives in the file so every player meets the same people; the runtime only tracks
// each NPC's live behaviour state. See npcs.json for the schema.
export interface NpcDef{
  id:number;
  name:string;
  sex:'M'|'F';
  kind:string;            // civilian | rural | police | military
  neighborhood:string;    // the district/area the NPC belongs to (interior name if indoor)
  indoor?:boolean;        // true = lives inside an interior (club, jail, hospital, …)
  personality?:string;    // archetype shaping behaviour (brave|nervous|friendly|greedy|hostile|chill)
  likes:string[];         // tastes, e.g. ["smoke_weed"]
  dialogues?:string[];    // the lines this NPC says in its speech bubble (may be absent → silent)
  state:string;           // initial behaviour state (see NPC_STATES)
}
interface NpcsFile{maxNpcs:number;states:string[];neighborhoods:string[];npcs:NpcDef[];}

const DATA=NPCS as unknown as NpcsFile;

export const MAX_NPCS:number=DATA.maxNpcs;
export const NPC_STATES:string[]=DATA.states;
export const NPC_DEFS:NpcDef[]=DATA.npcs;

export const npcDefsByKind=(kind:string):NpcDef[]=>NPC_DEFS.filter(d=>d.kind===kind);
export const npcDefsByNeighborhood=(name:string):NpcDef[]=>NPC_DEFS.filter(d=>d.neighborhood===name);
