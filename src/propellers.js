import * as THREE from 'three';

// Separate the moving blades from the fixed motor and duct, preserving
// the transforms exported by Blender. glTF's longitudinal axis is Z.
export function createPropellers(model) {
  model.updateMatrixWorld(true);
  const sides=[[],[]];
  const position=new THREE.Vector3();
  model.traverse(object=>{
    if(object.isMesh && object.name.startsWith('Propeller')) {
      object.getWorldPosition(position);
      model.worldToLocal(position);
      sides[position.x<0?0:1].push(object);
    }
  });
  const rotors=sides.map((blades,index)=>{
    if(!blades.length) throw new Error('Blender model is missing propeller blades');
    const pivot=new THREE.Group();
    pivot.name=index===0?'PortRotor':'StarboardRotor';
    blades[0].getWorldPosition(position);
    pivot.position.copy(model.worldToLocal(position));
    model.add(pivot);
    pivot.updateMatrixWorld(true);
    blades.forEach(blade=>pivot.attach(blade));
    return {pivot,velocity:0};
  });
  return {
    update(dt,active,throttle,turn) {
      rotors.forEach((rotor,index)=>{
        const differential=turn*(index===0?-1:1)*10;
        const target=active?(throttle===0?1.8:throttle*22)+differential:0;
        rotor.velocity=THREE.MathUtils.damp(rotor.velocity,target,4,dt);
        rotor.pivot.rotation.z=(rotor.pivot.rotation.z+rotor.velocity*dt)%(Math.PI*2);
      });
    },
  };
}
