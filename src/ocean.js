import * as THREE from 'three';

export const floorHeight = (x,z) => -9 + Math.sin(x*.12)*.65 + Math.cos(z*.17)*.6 + Math.sin(x*.4+z*.22)*.18;

export function createOcean(scene) {
  const canvas=document.createElement('canvas');canvas.width=canvas.height=256;
  const context=canvas.getContext('2d');const pixels=context.createImageData(256,256);
  let noiseSeed=17;
  for(let y=0;y<256;y++)for(let x=0;x<256;x++){
    noiseSeed=(noiseSeed*1664525+1013904223)>>>0;
    const shade=125+25*Math.sin(y*.27+Math.sin(x*.04)*2)+(noiseSeed/4294967296-.5)*65;
    const i=(y*256+x)*4;pixels.data[i]=pixels.data[i+1]=pixels.data[i+2]=shade;pixels.data[i+3]=255;
  }
  context.putImageData(pixels,0,0);
  const sand=new THREE.CanvasTexture(canvas);sand.wrapS=sand.wrapT=THREE.RepeatWrapping;sand.repeat.set(65,65);
  const geo = new THREE.PlaneGeometry(180,180,180,180);
  geo.rotateX(-Math.PI/2);
  const positions=geo.attributes.position;
  const colors=[];
  for(let i=0;i<positions.count;i++) {
    const x=positions.getX(i), z=positions.getZ(i);
    positions.setY(i,floorHeight(x,z));
    const shade=.7+.18*Math.sin(x*4+Math.sin(z*3))+.06*Math.cos(z*12);
    colors.push(.22*shade,.32*shade,.29*shade);
  }
  geo.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
  geo.computeVertexNormals();
  const floor=new THREE.Mesh(geo,new THREE.MeshStandardMaterial({vertexColors:true,roughness:.96,bumpMap:sand,bumpScale:.08}));
  floor.receiveShadow=true; scene.add(floor);

  let seed=34;
  const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
  const rockGeo=new THREE.IcosahedronGeometry(1,2);
  const rp=rockGeo.attributes.position;
  for(let i=0;i<rp.count;i++) {
    const v=new THREE.Vector3().fromBufferAttribute(rp,i);
    v.multiplyScalar(1+.12*Math.sin(v.x*9+v.y*5)*Math.cos(v.z*8));
    rp.setXYZ(i,v.x,v.y,v.z);
  }
  rockGeo.computeVertexNormals();
  const rocks=new THREE.InstancedMesh(rockGeo,new THREE.MeshStandardMaterial({color:0x344846,roughness:.92}),220);
  const dummy=new THREE.Object3D();
  for(let i=0;i<220;i++) {
    const x=(random()-.5)*140,z=(random()-.5)*140,s=.25+random()*2.8;
    dummy.position.set(x,floorHeight(x,z)-.3,z);dummy.rotation.set(random(),random()*6,random());dummy.scale.set(s,s*.65,s*.8);dummy.updateMatrix();rocks.setMatrixAt(i,dummy.matrix);
  }
  rocks.castShadow=true;rocks.receiveShadow=true;scene.add(rocks);
  const branches=new THREE.InstancedMesh(new THREE.CylinderGeometry(.03,.08,1,6),new THREE.MeshStandardMaterial({color:0x9d795e,roughness:.95}),600);
  for(let i=0;i<600;i++) {
    const cluster=Math.floor(i/12),x=Math.sin(cluster*93)*42,z=Math.cos(cluster*41)*42;
    const h=.4+random()*1.4;
    dummy.position.set(x+(random()-.5)*1.2,floorHeight(x,z)+h*.45,z+(random()-.5)*1.2);
    dummy.rotation.set((random()-.5)*1.1,random()*6,(random()-.5)*1.1);dummy.scale.set(1,h,1);dummy.updateMatrix();branches.setMatrixAt(i,dummy.matrix);
  }
  scene.add(branches);
  const dustGeo=new THREE.BufferGeometry();const dust=[];
  for(let i=0;i<1800;i++) dust.push((random()-.5)*110,random()*26-8,(random()-.5)*110);
  dustGeo.setAttribute('position',new THREE.Float32BufferAttribute(dust,3));
  const particles=new THREE.Points(dustGeo,new THREE.PointsMaterial({color:0x9bd7d2,size:.035,transparent:true,opacity:.45,depthWrite:false}));scene.add(particles);
  return {update(dt){particles.rotation.y+=dt*.0015;}};
}
