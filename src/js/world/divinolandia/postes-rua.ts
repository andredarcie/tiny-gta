export type PoleSite={x:number;z:number;r:number};
export type PoleRoad={name:string;pts:[number,number][];halfWidth:number;paved:boolean;enabled:boolean;sidewalk:boolean};
export type HouseFootprint={x:number;z:number;width:number;depth:number;rotation:number};
export type PolePlan={roads:PoleRoad[];houses:HouseFootprint[];protectedAreas:[number,number][][];surveyedStreet:string};

const POLE_SPACING=34;
const FIRST_POLE=16;
const END_CLEARANCE=9;
const JUNCTION_CLEARANCE=8;
const CROSSING_CLEARANCE=7;
const HOUSE_CLEARANCE=.55;
const MIN_POLE_SEPARATION=14;
const SEARCH_SHIFTS=[0,-4,4,-7,7];

type Sample={x:number;z:number;alongX:number;alongZ:number};
type OrientedHouse=HouseFootprint&{cos:number;sin:number};
type RoadSegment={ax:number;az:number;bx:number;bz:number;name:string};

function roadLength(points:[number,number][]):number{
  let length=0;
  for(let i=1;i<points.length;i++)length+=Math.hypot(points[i][0]-points[i-1][0],points[i][1]-points[i-1][1]);
  return length;
}

function sampleRoad(points:[number,number][],distance:number):Sample{
  let travelled=0;
  for(let i=1;i<points.length;i++){
    const [ax,az]=points[i-1],[bx,bz]=points[i],length=Math.hypot(bx-ax,bz-az);
    if(length<.01)continue;
    if(travelled+length>=distance||i===points.length-1){
      const fraction=Math.min(1,Math.max(0,(distance-travelled)/length));
      return{x:ax+(bx-ax)*fraction,z:az+(bz-az)*fraction,alongX:(bx-ax)/length,alongZ:(bz-az)/length};
    }
    travelled+=length;
  }
  const [x,z]=points[0];
  return{x,z,alongX:1,alongZ:0};
}

function streetSide(road:PoleRoad):number{
  let hash=0;
  for(const letter of road.name)hash=(hash*31+letter.charCodeAt(0))|0;
  const first=road.pts[0],last=road.pts[road.pts.length-1];
  const direction=last[0]-first[0]||last[1]-first[1];
  return (hash&1?1:-1)*(direction<0?-1:1);
}

function insidePolygon(x:number,z:number,polygon:[number,number][]):boolean{
  let inside=false;
  for(let i=0,j=polygon.length-1;i<polygon.length;j=i++){
    const [ax,az]=polygon[i],[bx,bz]=polygon[j];
    if((az>z)!==(bz>z)&&x<(bx-ax)*(z-az)/(bz-az)+ax)inside=!inside;
  }
  return inside;
}

function nearHouse(x:number,z:number,houses:OrientedHouse[]):boolean{
  for(const house of houses){
    const dx=x-house.x,dz=z-house.z;
    if(Math.abs(dx)>house.width+house.depth||Math.abs(dz)>house.width+house.depth)continue;
    const along=dx*house.cos+dz*house.sin,depth=-dx*house.sin+dz*house.cos;
    if(Math.abs(along)<house.width/2+HOUSE_CLEARANCE&&Math.abs(depth)<house.depth/2+HOUSE_CLEARANCE)return true;
  }
  return false;
}

function farFromSites(x:number,z:number,sites:{x:number;z:number}[],clearance:number):boolean{
  return sites.every(site=>(x-site.x)**2+(z-site.z)**2>=clearance**2);
}

function nearCrossing(x:number,z:number,roadName:string,segments:RoadSegment[]):boolean{
  for(const segment of segments){
    if(segment.name===roadName)continue;
    if(x<Math.min(segment.ax,segment.bx)-CROSSING_CLEARANCE||x>Math.max(segment.ax,segment.bx)+CROSSING_CLEARANCE
      ||z<Math.min(segment.az,segment.bz)-CROSSING_CLEARANCE||z>Math.max(segment.az,segment.bz)+CROSSING_CLEARANCE)continue;
    const dx=segment.bx-segment.ax,dz=segment.bz-segment.az;
    const fraction=Math.min(1,Math.max(0,((x-segment.ax)*dx+(z-segment.az)*dz)/(dx*dx+dz*dz||1)));
    const nearX=segment.ax+fraction*dx,nearZ=segment.az+fraction*dz;
    if((x-nearX)**2+(z-nearZ)**2<CROSSING_CLEARANCE**2)return true;
  }
  return false;
}

type SiteContext={houses:OrientedHouse[];areas:[number,number][][];junctions:PoleSite[];placed:PoleSite[];segments:RoadSegment[];roadName:string};
function eligibleSite(site:PoleSite,context:SiteContext):boolean{
  const {x,z}=site;
  return farFromSites(x,z,context.junctions,JUNCTION_CLEARANCE)
    &&farFromSites(x,z,context.placed,MIN_POLE_SEPARATION)
    &&!nearCrossing(x,z,context.roadName,context.segments)
    &&!nearHouse(x,z,context.houses)
    &&!context.areas.some(area=>insidePolygon(x,z,area));
}

export function planRoadPoles(plan:PolePlan):PoleSite[][]{
  const houses=plan.houses.map(house=>({...house,cos:Math.cos(house.rotation),sin:Math.sin(house.rotation)}));
  const junctions=plan.roads.flatMap(road=>road.pts.length>1?[road.pts[0],road.pts[road.pts.length-1]]:[])
    .map(([x,z])=>({x,z,r:0}));
  const segments=plan.roads.flatMap(road=>road.pts.slice(1).map((point,index)=>({
    ax:road.pts[index][0],az:road.pts[index][1],bx:point[0],bz:point[1],name:road.name,
  })));
  const placed:PoleSite[]=[],routes:PoleSite[][]=[];
  for(const road of plan.roads){
    if(!road.enabled||!road.paved||road.name===plan.surveyedStreet||road.pts.length<2)continue;
    const context={houses,areas:plan.protectedAreas,junctions,placed,segments,roadName:road.name};
    const length=roadLength(road.pts);
    if(length<FIRST_POLE+END_CLEARANCE)continue;
    const side=streetSide(road),offset=road.halfWidth+(road.sidewalk?.55:1.25);
    const route:PoleSite[]=[];
    for(let distance=FIRST_POLE;distance<length-END_CLEARANCE;distance+=POLE_SPACING){
      for(const shift of SEARCH_SHIFTS){
        const position=distance+shift;
        if(position<FIRST_POLE/2||position>length-END_CLEARANCE)continue;
        const sample=sampleRoad(road.pts,position);
        const normalX=-sample.alongZ*side,normalZ=sample.alongX*side;
        const site={x:sample.x+normalX*offset,z:sample.z+normalZ*offset,r:Math.atan2(-normalX,-normalZ)};
        if(!eligibleSite(site,context))continue;
        route.push(site);placed.push(site);break;
      }
    }
    if(route.length)routes.push(route);
  }
  return routes;
}
