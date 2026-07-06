import {describe,it,expect} from 'vitest';
import {PARTIES,PARTY_FEE,partyRelation,membershipCounts} from '@/places/party-data.ts';

// The political-party rules are pure logic (js/places/party-data.ts): the
// relation matrix drives the gang AI in js/actors/gangs.ts and the counts feed
// the plaza banner. Guard them here so a refactor can't silently flip a side.

describe('partyRelation',()=>{
  it('is neutral for the unaffiliated (gangs leave you alone)',()=>{
    expect(partyRelation(null,'red')).toBe('neutral');
    expect(partyRelation(null,'blue')).toBe('neutral');
    expect(partyRelation(undefined,'red')).toBe('neutral');
  });
  it('allies you with your own party wing',()=>{
    expect(partyRelation('red','red')).toBe('ally');
    expect(partyRelation('blue','blue')).toBe('ally');
  });
  it('makes the rival wing an enemy (and it is symmetric)',()=>{
    expect(partyRelation('red','blue')).toBe('enemy');
    expect(partyRelation('blue','red')).toBe('enemy');
  });
  it('treats garbage input as unaffiliated',()=>{
    expect(partyRelation('green' as never,'red')).toBe('neutral');
  });
});

describe('PARTIES data',()=>{
  it('defines exactly a red and a blue party with distinct colours',()=>{
    expect(Object.keys(PARTIES).sort()).toEqual(['blue','red']);
    expect(PARTIES.red.color).not.toBe(PARTIES.blue.color);
    expect(PARTIES.red.title).toBe('RED PARTY');
    expect(PARTIES.blue.title).toBe('BLUE PARTY');
  });
  it('gives both parties a pitch, a platform and street lines',()=>{
    for(const p of[PARTIES.red,PARTIES.blue]){
      expect(p.pitch.length).toBeGreaterThan(0);
      expect(p.platform.length).toBeGreaterThan(0);
      expect(p.lines.length).toBeGreaterThan(0);
    }
  });
  it('charges the agreed $100 fee',()=>{
    expect(PARTY_FEE).toBe(100);
  });
});

describe('membershipCounts',()=>{
  const base={redAlive:3,redReserve:4,blueAlive:2,blueReserve:5};
  it('sums living members + roster reserve per party',()=>{
    expect(membershipCounts({...base,player:null})).toEqual({red:7,blue:7});
  });
  it('adds the player to their own party only',()=>{
    expect(membershipCounts({...base,player:'red'})).toEqual({red:8,blue:7});
    expect(membershipCounts({...base,player:'blue'})).toEqual({red:7,blue:8});
  });
  it('never goes negative on a wiped-out wing',()=>{
    expect(membershipCounts({redAlive:0,redReserve:-1,blueAlive:0,blueReserve:0,player:null}))
      .toEqual({red:0,blue:0});
  });
});
