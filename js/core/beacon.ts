import * as THREE from 'three';
import {scene} from '@/core/engine.ts';
import {groundHeight} from '@/core/constants.ts';
import {makeBeacon,BEACON_HEIGHT,BEACON_RADIUS} from '../../assets/models/missions/beacon.ts';

// ===========================================================================
// Beacon — the single, game-wide objective marker (the glowing rising cylinder).
//
// ONE standard shape for the whole game: you only choose the COLOUR. Size and
// height are fixed (height = 2× the character height; see models/missions/beacon.ts).
// The class owns the mesh lifecycle so call sites never repeat the
// scene.add / position(y) / scene.remove dance:
//
//   const b = new Beacon(0x19e3ff).at(x, z).mount();   // create, place, show
//   b.at(target.x, target.z);                          // move (e.g. follow a target)
//   b.opacity = .18;  b.visible = false;               // tweak look / toggle
//   b.dispose();                                        // remove from scene + free geometry
// ===========================================================================
export class Beacon{
  readonly mesh: THREE.Mesh;
  private mounted=false;

  constructor(color: number){
    this.mesh=makeBeacon(color);
  }

  // Place the base of the beacon at the (x,z) ground point. baseY defaults to the
  // terrain height there (clamped to the water surface at y=0) so the column sits
  // flush on land, hills or water; pass an explicit baseY to override.
  at(x: number,z: number,baseY: number=Math.max(0,groundHeight(x,z))): this{
    this.mesh.position.set(x,baseY,z);
    return this;
  }

  // Add to the scene (or any parent). Idempotent.
  mount(parent: THREE.Object3D=scene): this{
    if(!this.mounted){parent.add(this.mesh);this.mounted=true;}
    return this;
  }

  set visible(v: boolean){this.mesh.visible=v;}
  get visible(): boolean{return this.mesh.visible;}

  set opacity(o: number){(this.mesh.material as THREE.MeshBasicMaterial).opacity=o;}
  get opacity(): number{return (this.mesh.material as THREE.MeshBasicMaterial).opacity;}

  set color(c: number){(this.mesh.material as THREE.MeshBasicMaterial).color.setHex(c);}

  // Remove from the scene and free the per-instance geometry.
  dispose(): void{
    this.mesh.parent?.remove(this.mesh);
    this.mesh.geometry.dispose();
    this.mounted=false;
  }
}

export {BEACON_HEIGHT,BEACON_RADIUS};
