import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createSampleContact} from '../src/sample-contact.js';

const box=new THREE.Box3(new THREE.Vector3(-1,-1,-2),new THREE.Vector3(1,1,2));
const touches=createSampleContact(box),vessel=new THREE.Group();
vessel.position.set(10,-5,8);
assert(touches(vessel,new THREE.Vector3(10,-5,10.25)),'Bow contact should collect');
assert(!touches(vessel,new THREE.Vector3(10,-5,10.4)),'A gap should not collect');
assert(!touches(vessel,new THREE.Vector3(12,-5,8)),'Within 3 m without contact should not collect');
assert(!touches(vessel,new THREE.Vector3(10,-3,8)),'Depth must be checked');
vessel.rotation.y=Math.PI/2;
assert(touches(vessel,new THREE.Vector3(12.25,-5,8)),'Rotated bow contact should collect');
assert(!touches(vessel,new THREE.Vector3(10,-5,10.25)),'Rotation must change the contact volume');
assert(!createSampleContact(new THREE.Box3())(vessel,vessel.position),'Unloaded model must not collect');
console.log('PASS: contact, separation, depth, rotated hull and loading guard');
