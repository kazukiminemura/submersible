import * as THREE from 'three';

// Scattering is visual only; spotlights independently illuminate the seabed.
export function createHeadlights(sub) {
  const length=12;
  const geometry=new THREE.ConeGeometry(2.1,length,48,1,true);
  const material=new THREE.ShaderMaterial({
    transparent:true,depthWrite:false,side:THREE.DoubleSide,
    blending:THREE.AdditiveBlending,
    vertexShader:`varying vec2 vUv;
      void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
    fragmentShader:`varying vec2 vUv;
      void main(){float fade=pow(vUv.y,2.0)*(1.0-smoothstep(.88,1.0,vUv.y));
        gl_FragColor=vec4(.65,.85,1.0,fade*.16);}`,
  });
  for(const x of [-.7,.7]) {
    const mount=new THREE.Group();mount.position.set(x,-.65,-1.53);
    mount.rotation.x=-.13;sub.add(mount);
    const light=new THREE.SpotLight(0xd9f2ff,85,28,.23,.65,1.2);
    light.target.position.set(0,0,-length);
    light.castShadow=true;light.shadow.mapSize.set(1024,1024);light.shadow.bias=-.001;
    const beam=new THREE.Mesh(geometry,material);
    beam.rotation.x=Math.PI/2;beam.position.z=-length/2;
    mount.add(light,light.target,beam);
  }
}
