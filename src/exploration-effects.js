import * as THREE from 'three';

export function createExplorationEffects(scene) {
  const geometry=new THREE.RingGeometry(.96,1,80);
  // Render transparent pooled rings during loading to warm their shader.
  // Collection then only changes uniforms, without allocation or compilation.
  const pulses=Array.from({length:6},()=>{
    const material=new THREE.MeshBasicMaterial({transparent:true,opacity:0,depthWrite:false,side:THREE.DoubleSide});
    const mesh=new THREE.Mesh(geometry,material);
    mesh.rotation.x=-Math.PI/2;mesh.frustumCulled=false;scene.add(mesh);
    return {mesh,age:0,collect:false,active:false};
  });
  return {
    emit(position,collect=false) {
      const pulse=pulses.find(p=>!p.active)??pulses.reduce((a,b)=>a.age>b.age?a:b);
      pulse.mesh.position.copy(position);pulse.mesh.scale.setScalar(1);
      pulse.mesh.material.color.setHex(collect?0xffdb86:0x67ffe2);
      pulse.mesh.material.opacity=.85;pulse.age=0;pulse.collect=collect;pulse.active=true;
    },
    update(dt) {
      for(let i=pulses.length-1;i>=0;i--) {
        const pulse=pulses[i];if(!pulse.active)continue;pulse.age+=dt;
        const lifetime=pulse.collect?1.2:3;
        pulse.mesh.scale.setScalar(1+pulse.age*(pulse.collect?3:10));
        pulse.mesh.material.opacity=.8*(1-pulse.age/lifetime);
        if(pulse.age>=lifetime) {
          pulse.mesh.material.opacity=0;pulse.active=false;
        }
      }
    },
  };
}
