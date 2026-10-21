import {describe,expect,it} from 'vitest';
import {planRoadPoles,type PolePlan,type PoleRoad} from '../../src/js/world/divinolandia/postes-rua.ts';
import {makePoleWires,makePostes} from '../../src/assets/models/divinolandia/poste.ts';
import * as THREE from 'three';

const ROAD:PoleRoad={name:'Rua A',pts:[[0,0],[200,0]],halfWidth:4,paved:true,enabled:true,sidewalk:true};
const plan=(overrides:Partial<PolePlan>={})=>planRoadPoles({roads:[ROAD],houses:[],protectedAreas:[],surveyedStreets:['Rua X'],...overrides});

describe('street utility pole placement',()=>{
  it('lines poles along one curb, facing their lamps into the street',()=>{
    const route=plan()[0];
    expect(route.map(site=>site.x)).toEqual([16,50,84,118,152,186]);
    expect(route.every(site=>Math.abs(site.z)>ROAD.halfWidth&&Math.cos(site.r)*site.z<0)).toBe(true);
  });

  it('does not populate unsurveyed dirt roads or duplicate a surveyed street',()=>{
    expect(plan({roads:[{...ROAD,paved:false}]})).toEqual([]);
    expect(plan({surveyedStreets:[ROAD.name]})).toEqual([]);
    expect(plan({roads:[{...ROAD,pts:[[0,0],[20,0]]}]})).toEqual([]);
  });

  it('keeps poles clear of buildings, public parcels and street junctions',()=>{
    const house={x:50,z:4.55,width:23,depth:12,rotation:0};
    const parcel:[number,number][]=[[73,-10],[95,-10],[95,10],[73,10]];
    const crossing:PoleRoad={...ROAD,name:'Rua B',pts:[[118,-30],[118,30]],enabled:false};
    const sites=plan({roads:[ROAD,crossing],houses:[house],protectedAreas:[parcel]}).flat();
    expect(sites.every(site=>Math.abs(site.x-50)>10&&Math.abs(site.x-84)>10&&Math.abs(site.x-118)>=7)).toBe(true);
  });
});

describe('instanced utility pole geometry',()=>{
  const sites=[{x:0,y:20,z:0,r:0},{x:34,y:20,z:0,r:0}];
  it('instances pole parts instead of creating an object per site',()=>{
    const group=makePostes(sites);
    expect(group.children.length).toBeGreaterThan(5);
    expect(group.children.every(child=>(child as THREE.InstancedMesh).count===sites.length)).toBe(true);
  });

  it('spans cables only between poles in the same route',()=>{
    const wires=makePoleWires([sites,[{x:200,y:20,z:0,r:0}]]);
    expect(wires.geometry.getAttribute('position').count).toBe(5*8*2);
  });

  it('does not draw a cable across a long placement gap',()=>{
    const wires=makePoleWires([[sites[0],{x:80,y:20,z:0,r:0}]]);
    expect(wires.geometry.getAttribute('position').count).toBe(0);
  });
});
