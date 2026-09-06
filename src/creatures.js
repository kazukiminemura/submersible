import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { floorHeight } from './ocean.js';

const species={squid:'大イカ',octopus:'大ダコ',crab:'巨大ガニ',angler:'大型深海魚'};
const habitat=[
  {kind:'squid',x:-5,z:-6,y:-2,scale:1.05},
  {kind:'octopus',x:5,z:-7,ground:true,scale:1.1},
  {kind:'crab',x:-8,z:0,ground:true,scale:1.1},
  {kind:'angler',x:5,z:0,y:-3,scale:1.15},
  {kind:'squid',x:-18,z:-26,y:-1,scale:1.3},
  {kind:'octopus',x:19,z:-28,ground:true,scale:1.4},
  {kind:'crab',x:2,z:-21,ground:true,scale:1.35},
  {kind:'angler',x:13,z:-19,y:-3,scale:1.3},
];

// Each clone shares immutable GPU resources but owns its morph weights.
function animateModel(root) {
  const tissue=[],legs=[];
  root.traverse(object=>{
    if(object.isMesh) {
      object.receiveShadow=true;
      if(object.morphTargetDictionary?.Flow0!==undefined) {
        // glTF splits skin and suckers into material primitives; their phase
        // belongs to the common Blender object so both deform together.
        const phase=object.userData.flowPhase??object.parent?.userData.flowPhase??0;
        tissue.push({object,phase});
      }
    }
    if(object.name.startsWith('WalkLeg_')) {
      legs.push({object,rest:object.rotation.clone(),phase:legs.length*Math.PI/2});
    }
  });
  return time=>{
    for(const {object,phase} of tissue) {
      const wave=Math.sin(time*1.45+phase);
      object.morphTargetInfluences[object.morphTargetDictionary.Flow0]=Math.max(0,wave);
      object.morphTargetInfluences[object.morphTargetDictionary.Flow1]=Math.max(0,-wave);
    }
    for(const {object,rest,phase} of legs) {
      object.rotation.y=rest.y+Math.sin(time*1.8+phase)*.085;
      object.rotation.z=rest.z+Math.sin(time*1.8+phase)*.035;
    }
  };
}

export async function createCreatures(scene) {
  const loader=new GLTFLoader();
  const entries=await Promise.all(Object.keys(species).map(async kind=>{
    const gltf=await loader.loadAsync(`/models/creatures/${kind}.glb`);
    return [kind,gltf.scene];
  }));
  const models=Object.fromEntries(entries);
  const residents=habitat.map((spec,index)=>{
    const root=models[spec.kind].clone(true);
    root.name=species[spec.kind];root.userData.species=spec.kind;
    root.scale.setScalar(spec.scale);
    scene.add(root);
    return {root,spec,phase:index*1.3,animate:animateModel(root)};
  });
  let time=0;
  function update(dt) {
    time+=dt;
    for(const {root,spec,phase,animate} of residents) {
      const t=time+phase;
      const x=spec.x+Math.sin(t*.2)*(spec.ground?.65:1.4);
      const z=spec.z+Math.sin(t*.14)*.65;
      // Octopus arms rest on the floor; crab feet are at local Y=0.
      const clearance=spec.kind==='octopus'?.78:.04;
      const y=spec.ground?floorHeight(x,z)+clearance*spec.scale:spec.y+Math.sin(t*.5)*.35;
      root.position.set(x,y,z);root.rotation.y=Math.sin(t*.23)*.4;
      animate(t);
    }
  }
  update(0);
  return {update};
}
