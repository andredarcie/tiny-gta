import type * as THREE from 'three';

// Rider seating for the free vehicles whose pilot rides fully exposed (bike,
// boat, plane), used by js/actors/player.ts completeEnter. Pulled out of player.js so the
// offsets + limb pose for each vehicle live together in one place, retunable when
// the player body changes.
//
// SEAT_OFFSET is the ped-group origin (its FEET) within the vehicle group's local
// space; poseRider then rotates the limb BONES to plant the rider on the seat and
// grip the controls. Tuned to the current player body (buildToonPlayer, ~1.80
// tall): origin at the feet, hips ≈.95, shoulders ≈1.45, crown ≈1.80.
//
// The CAR pose stays in player.js (setDrivePose): spinWheels keeps overriding the
// driver's upper arms onto the wheel every frame, so the car can't be posed once
// and left alone the way these three can.

export const SEAT_OFFSET: Record<string, [number, number, number]>={
  // Cruiser seat top ≈.85, foot pegs ≈.34, raised grips ≈1.15 (see motorcycle.js).
  bike:[0,-.10,-.18],
  // Captain's seat cushion top ≈.565, cockpit sole ≈.145, helm ≈1.14 (see boat.js).
  boat:[0,-.34,-.12],
  // Open cockpit rim ≈1.48; the pilot sits in the fuselage with head/shoulders out.
  plane:[0,.05,.18],
  // Tractor: open elevated seat cushion ≈1.11, footplates ≈.52, wheel ≈(0,1.34,.4).
  tractor:[0,.14,-.5],
};

// The buildToonPlayer userData.limbs bones poseRider rotates. Optional bones are
// the calves/forearms (older bodies may not have them — original used `?.`).
interface RiderLimbs {
  leftLeg: THREE.Object3D;
  rightLeg: THREE.Object3D;
  leftArm: THREE.Object3D;
  rightArm: THREE.Object3D;
  leftCalf?: THREE.Object3D;
  rightCalf?: THREE.Object3D;
  leftForearm?: THREE.Object3D;
  rightForearm?: THREE.Object3D;
}

// Apply the seated limb pose for `kind` ∈ {bike,boat,plane} to a rig's `limbs`
// (the buildToonPlayer userData.limbs bones). Legs are forced visible
// because the cockpits are open. setDrivePose(false) in player.js zeroes every
// bone again on exit, so no per-kind reset is needed here.
export function poseRider(l: RiderLimbs | null | undefined, kind: string): void{
  if(!l)return;
  l.leftLeg.visible=l.rightLeg.visible=true;
  if(kind==='bike'){
    // Straddling the tank: thighs splayed and angled down to the pegs, shins back,
    // arms reaching forward/down to the raised handlebar grips.
    l.leftLeg.rotation.set(-1.0,0,-.3);
    l.rightLeg.rotation.set(-1.0,0,.3);
    l.leftCalf?.rotation.set(1.62,0,0);
    l.rightCalf?.rotation.set(1.62,0,0);
    l.leftArm.rotation.set(-1.15,0,-.12);
    l.rightArm.rotation.set(-1.15,0,.12);
    l.leftForearm?.rotation.set(-.25,0,0);
    l.rightForearm?.rotation.set(-.25,0,0);
  }else if(kind==='boat'){
    // Seated at the console: thighs forward near-horizontal, shins down to the
    // cockpit sole, arms forward/down onto the wheel rim.
    l.leftLeg.rotation.set(-1.3,0,.12);
    l.rightLeg.rotation.set(-1.3,0,-.12);
    l.leftCalf?.rotation.set(1.4,0,0);
    l.rightCalf?.rotation.set(1.4,0,0);
    l.leftArm.rotation.set(-1.15,0,.30);
    l.rightArm.rotation.set(-1.15,0,-.30);
    l.leftForearm?.rotation.set(-.55,0,0);
    l.rightForearm?.rotation.set(-.55,0,0);
  }else if(kind==='plane'){
    // Sunk into the open cockpit: thighs folded forward under the dash, shins
    // tucked, hands forward on the stick/controls.
    l.leftLeg.rotation.set(-2.0,0,0);
    l.rightLeg.rotation.set(-2.0,0,0);
    l.leftCalf?.rotation.set(.5,0,0);
    l.rightCalf?.rotation.set(.5,0,0);
    l.leftArm.rotation.set(-1.3,0,.42);
    l.rightArm.rotation.set(-1.3,0,-.42);
    l.leftForearm?.rotation.set(-.78,0,0);
    l.rightForearm?.rotation.set(-.78,0,0);
  }else if(kind==='tractor'){
    // Sitting up on the open seat: thighs angled forward-down to the footplates,
    // shins down, arms reaching forward/up to the raked steering wheel.
    l.leftLeg.rotation.set(-1.25,0,.2);
    l.rightLeg.rotation.set(-1.25,0,-.2);
    l.leftCalf?.rotation.set(1.25,0,0);
    l.rightCalf?.rotation.set(1.25,0,0);
    l.leftArm.rotation.set(-1.05,0,.32);
    l.rightArm.rotation.set(-1.05,0,-.32);
    l.leftForearm?.rotation.set(-.5,0,0);
    l.rightForearm?.rotation.set(-.5,0,0);
  }
}
