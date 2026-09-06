import assert from 'node:assert/strict';
import * as THREE from 'three';
import {setSampleCollected} from '../src/sample-state.js';
import {createExplorationEffects} from '../src/exploration-effects.js';

const scene=new THREE.Scene();
const samples=Array.from({length:5},()=>{
  const sample=new THREE.Group();
  sample.add(new THREE.Mesh(new THREE.SphereGeometry(.3)),new THREE.PointLight(0xffffff,5));
  scene.add(sample);return sample;
});
function visibleLights(){let count=0;scene.traverseVisible(o=>{if(o.isLight)count++;});return count;}
for(const sample of samples){
  setSampleCollected(sample,true);
  assert.equal(visibleLights(),5,'Collection must not change shader light count');
  assert.equal(sample.children[0].visible,false);
  assert.equal(sample.children[1].intensity,0);
}
for(const sample of samples){setSampleCollected(sample,false);assert.equal(sample.children[1].intensity,5);assert(sample.children[0].visible);}
const effects=createExplorationEffects(scene),count=scene.children.length;
const resources=scene.children.filter(o=>o.isMesh).map(o=>[o.geometry,o.material]);
for(let i=0;i<20;i++){effects.emit(new THREE.Vector3(),i%2===0);effects.update(.1);}
effects.update(4);
assert.equal(scene.children.length,count,'Effects must reuse their pool');
scene.children.filter(o=>o.isMesh).forEach((o,i)=>{
  assert.equal(o.geometry,resources[i][0]);assert.equal(o.material,resources[i][1]);assert.equal(o.material.opacity,0);
});
console.log('PASS: stable light count across all pickups and restart; effect resources reused');
