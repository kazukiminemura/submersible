import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// Validate the delivered binaries, including connectivity of the deforming
// arms. Long cross-arm edges catch accidental indexing into sucker vertices.
for (const kind of ['squid','octopus','crab','angler']) {
  const file=readFileSync(new URL(`../public/models/creatures/${kind}.glb`,import.meta.url));
  assert.equal(file.readUInt32LE(0),0x46546c67);
  assert.equal(file.readUInt32LE(4),2);
  assert.equal(file.readUInt32LE(8),file.length);
  const jsonSize=file.readUInt32LE(12);
  const gltf=JSON.parse(file.subarray(20,20+jsonSize).toString());
  const binary=file.subarray(28+jsonSize);
  function accessor(index) {
    const a=gltf.accessors[index],view=gltf.bufferViews[a.bufferView];
    const dimensions={SCALAR:1,VEC2:2,VEC3:3,VEC4:4}[a.type];
    const bytes={5126:4,5125:4,5123:2,5121:1}[a.componentType];
    const reader={5126:'readFloatLE',5125:'readUInt32LE',5123:'readUInt16LE',5121:'readUInt8'}[a.componentType];
    assert(dimensions&&bytes,`Unsupported accessor ${kind}`);
    const start=(view.byteOffset??0)+(a.byteOffset??0),stride=view.byteStride??dimensions*bytes;
    return Array.from({length:a.count},(_,i)=>Array.from({length:dimensions},(_,j)=>{
      const value=binary[reader](start+i*stride+j*bytes);
      assert(Number.isFinite(value),`${kind}: nonfinite geometry`);return value;
    }));
  }
  assert(gltf.materials.some(m=>m.normalTexture),`${kind}: missing pore normal map`);
  assert(gltf.materials.some(m=>m.pbrMetallicRoughness?.baseColorTexture),`${kind}: missing pigment map`);
  assert(gltf.images.every(image=>image.bufferView!==undefined),`${kind}: texture is not embedded`);
  let triangles=0,morphs=0,longestArmEdge=0;
  for(const mesh of gltf.meshes)for(const primitive of mesh.primitives) {
    const positions=accessor(primitive.attributes.POSITION);
    const indices=accessor(primitive.indices).flat();triangles+=indices.length/3;
    assert(indices.every(i=>i<positions.length),`${kind}: invalid triangle index`);
    for(const target of primitive.targets??[]) {
      assert.equal(accessor(target.POSITION).length,positions.length);
      morphs++;
    }
    if(/Squid arm|Octopus arm|Feeding tentacle/.test(mesh.name)) {
      for(let i=0;i<indices.length;i+=3)for(let j=0;j<3;j++) {
        const a=positions[indices[i+j]],b=positions[indices[i+(j+1)%3]];
        const distance=Math.hypot(...a.map((v,k)=>v-b[k]));
        longestArmEdge=Math.max(longestArmEdge,distance);
        assert(distance<.8,`${kind}: discontinuous arm edge ${distance}`);
      }
    }
  }
  if(kind==='crab')assert.equal(gltf.nodes.filter(n=>n.name?.startsWith('WalkLeg_')).length,8);
  else {
    assert(morphs>0,`${kind}: missing deformation targets`);
    assert(gltf.nodes.some(n=>n.extras?.flowPhase!==undefined),`${kind}: missing synchronized morph phase`);
  }
  console.log(`${kind}: ${Math.round(file.length/1024)} KiB, ${triangles} triangles, ${morphs} morph targets, arm edge max ${longestArmEdge.toFixed(3)} m — OK`);
}
