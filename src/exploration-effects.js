import * as THREE from 'three';

export function createExplorationEffects(scene) {
  const pulses=[];
  return {
    emit(position,collect=false) {
      const material=new THREE.MeshBasicMaterial({color:collect?0xffdb86:0x67ffe2,transparent:true,opacity:.85,depthWrite:false,side:THREE.DoubleSide});
      const mesh=new THREE.Mesh(new THREE.RingGeometry(.96,1,80),material);
      mesh.rotation.x=-Math.PI/2;mesh.position.copy(position);scene.add(mesh);
      pulses.push({mesh,age:0,collect});
    },
    update(dt) {
      for(let i=pulses.length-1;i>=0;i--) {
        const pulse=pulses[i];pulse.age+=dt;
        const lifetime=pulse.collect?1.2:3;
        pulse.mesh.scale.setScalar(1+pulse.age*(pulse.collect?3:10));
        pulse.mesh.material.opacity=.8*(1-pulse.age/lifetime);
        if(pulse.age>=lifetime) {
          scene.remove(pulse.mesh);pulse.mesh.geometry.dispose();pulse.mesh.material.dispose();pulses.splice(i,1);
        }
      }
    },
  };
}
