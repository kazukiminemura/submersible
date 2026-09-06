import * as THREE from 'three';

// Test the sample sphere against the vessel's local bounding box, including
// its heading and depth. Reuse scratch values for the per-frame checks.
export function createSampleContact(bounds) {
  const local=new THREE.Vector3(),inverse=new THREE.Quaternion();
  return (vessel,position,radius=.3)=>{
    if(bounds.isEmpty())return false;
    local.copy(position).sub(vessel.position).applyQuaternion(inverse.copy(vessel.quaternion).invert());
    return bounds.distanceToPoint(local)<=radius;
  };
}
