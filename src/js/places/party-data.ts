import {SHIRT_COLORS,PANTS_COLORS} from '@/core/palette.ts';

// ============================================================================
// POLITICAL PARTIES — pure data + logic (no three.js, no DOM, so the Vitest
// unit suite can import it directly). The two street gangs are the parties'
// street wings: RED (left-wing satire) vs BLUE (right-wing satire).
//
// The player affiliates at a party desk for $100 (js/places/party-hq.ts);
// membership drives the gang friend/enemy AI (js/actors/gangs.ts), the
// members-only weapon perk (js/combat/weapon-pickups.ts) and the plaza
// membership banner (assets/models/city/party-banner.ts).
//
// All the satire is deliberately even-handed: both parties are mocked equally.
// ============================================================================

export type PartyId='red'|'blue';
export type PartyRelation='neutral'|'ally'|'enemy';

export const PARTY_FEE=100; // one-time affiliation fee, charged at the desk

export interface PartyDef{
  id:PartyId;
  title:string;         // player-facing name (gang name, HUD, banner)
  color:number;         // shirt colour — members + the outfit granted on joining
  pants:number;         // trouser colour for members + the granted outfit
  css:string;           // HUD accent colour
  cssA:string;          // translucent territory tint (radar/map)
  repName:string;       // the desk recruiter's name
  voice:{freq:number;type:OscillatorType}; // cutscene voice blips
  pitch:string[];       // recruiter cutscene lines (the sales pitch)
  platform:string[];    // "the party stands for" list on the sign-up sheet
  lines:string[];       // street chatter for members
}

export const PARTIES:Record<PartyId,PartyDef>={
  red:{
    id:'red',
    title:'RED PARTY',
    color:SHIRT_COLORS[0],  // 0xc23b4e — the palette's red (FLEET/WARDROBE family)
    pants:PANTS_COLORS[2],  // dark earthy brown
    css:'#c23b4e',cssA:'rgba(194,59,78,.22)',
    repName:'Comrade Lu',
    voice:{freq:120,type:'sawtooth'},
    pitch:[
      "Welcome, comrade! The RED PARTY fights for the people — and today, the people is YOU.",
      "Our leader rose from the factory floor to the palace. Twice. Some say the palace is comfier.",
      "Join us and everything will be shared: the wealth, the streets... starting with your $100 membership fee.",
      "Ready to make history, comrade? The revolution begins at this little table.",
    ],
    platform:[
      'FREE EVERYTHING FOR EVERYONE (someone else pays)',
      'NATIONALIZE THE TAXI FLEET',
      'PICANHA ON EVERY BARBECUE',
      'A STATUE OF THE LEADER IN EVERY PLAZA',
      'WHAT IS YOURS IS OURS - WHAT IS OURS STAYS WITH THE COMMITTEE',
    ],
    lines:[
      "Comrade! After the revolution, every car belongs to everyone!",
      "Tax the rich! ...Got a spare dollar, though?",
      "The Leader was a factory worker, you know. A REAL man of the people.",
      "Read the manifesto. It's free. Everything should be free.",
      "One day this whole city will be one big cooperative.",
      "The revolution is coming, comrade. It's just stuck in a committee meeting.",
    ],
  },
  blue:{
    id:'blue',
    title:'BLUE PARTY',
    color:SHIRT_COLORS[1],  // 0x3b7ac2 — the palette's blue
    pants:PANTS_COLORS[1],  // navy
    css:'#3b7ac2',cssA:'rgba(59,122,194,.22)',
    repName:'Captain Myth',
    voice:{freq:95,type:'square'},
    pitch:[
      "Citizen! You look like someone who loves freedom. And firearms.",
      "The BLUE PARTY stands for family, order and shooting first. The reds tremble when we march by.",
      "Membership is $100. Taxation is theft, of course — but fees are freedom.",
      "Sign here and become a true patriot. The Myth smiles upon you.",
    ],
    platform:[
      'A GUN IN EVERY GLOVEBOX',
      'TAXATION IS THEFT (fees apply)',
      'THE MYTH NEVER LOSES - RECOUNT UNTIL HE WINS',
      'FAMILY, FAITH AND UNLIMITED AMMO',
      'IT IS ONLY A DICTATORSHIP WHEN THE OTHERS DO IT',
    ],
    lines:[
      "The Myth is back, and stronger than ever!",
      "Good citizens carry a gun. GREAT citizens carry two.",
      "It's not fascism, it's FAMILY VALUES.",
      "Fake news! Don't believe anything you see — except us.",
      "God, family, and my seven rifles.",
      "Communists hate this one simple trick: PROPERTY.",
    ],
  },
};

// The player's relation to a party's street wing: no affiliation = neutral
// (they leave you alone), same party = ally (they fight at your side), the
// other party = enemy (they shoot on sight).
export function partyRelation(player:PartyId|null|undefined,gang:PartyId):PartyRelation{
  if(player!=='red'&&player!=='blue')return 'neutral';
  return player===gang?'ally':'enemy';
}

// Affiliate totals shown on the plaza banner: every living street member plus
// the reserve roster counts for its party, and the player adds 1 to theirs.
export function membershipCounts(o:{redAlive:number;redReserve:number;blueAlive:number;blueReserve:number;player:PartyId|null}):{red:number;blue:number}{
  return{
    red:Math.max(0,o.redAlive)+Math.max(0,o.redReserve)+(o.player==='red'?1:0),
    blue:Math.max(0,o.blueAlive)+Math.max(0,o.blueReserve)+(o.player==='blue'?1:0),
  };
}
