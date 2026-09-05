import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { createOcean, floorHeight } from './ocean.js';
import { createPropellers } from './propellers.js';
import './style.css';

const renderer=new THREE.WebGLRenderer({canvas:document.querySelector('#scene'),antialias:true});
renderer.setPixelRatio(Math.min(devicePixelRatio,1.75));
renderer.setSize(innerWidth,innerHeight);
renderer.toneMapping=THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure=1.5;
renderer.shadowMap.enabled=true;
renderer.shadowMap.type=THREE.PCFShadowMap;
const scene=new THREE.Scene();
scene.background=new THREE.Color('#07303b');
scene.fog=new THREE.FogExp2('#07303b',.027);
const pmrem=new THREE.PMREMGenerator(renderer);
const room=new RoomEnvironment();
scene.environment=pmrem.fromScene(room,.04).texture;
scene.environmentIntensity=.6;
room.dispose();pmrem.dispose();
scene.add(new THREE.HemisphereLight(0x92d6db,0x35493b,2));
const sun=new THREE.DirectionalLight(0x94dae7,3);
sun.position.set(-15,30,8);scene.add(sun);
const camera=new THREE.PerspectiveCamera(55,innerWidth/innerHeight,.1,180);
const ocean=createOcean(scene);
const sub=new THREE.Group();scene.add(sub);
sub.position.set(0,-4,7);
camera.position.set(5,0,14);
for(const x of [-.7,.7]) {
  const light=new THREE.SpotLight(0xc5f3ff,100,32,.58,.65,1.2);
  light.position.set(x,-.35,-1.4);light.target.position.set(x,-5,-14);
  light.castShadow=true;light.shadow.mapSize.set(1024,1024);light.shadow.bias=-.001;
  sub.add(light,light.target);
}
const fill=new THREE.PointLight(0xb2dce3,5,7);fill.position.set(0,2,1);sub.add(fill);
const launch=document.querySelector('#launch');
const message=document.querySelector('#message');
launch.disabled=true;launch.textContent='潜水艇を準備中…';
let model,propellers;
new GLTFLoader().load('/models/submersible.glb',gltf=>{
  model=gltf.scene;model.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});
  sub.add(model);launch.disabled=false;launch.textContent='探査を開始';
  propellers=createPropellers(model);
},undefined,()=>{launch.textContent='モデル読込失敗・再読み込みしてください';});

const samples=[];
for(const [x,z,label] of [[7,0,'発光生物の組織'],[-10,-8,'熱水鉱床の菌類'],[4,-21,'深海サンゴの標本'],[-18,-26,'未知の甲殻類'],[19,-31,'古代の貝殻']]) {
  const group=new THREE.Group();group.position.set(x,floorHeight(x,z)+1,z);
  const orb=new THREE.Mesh(new THREE.IcosahedronGeometry(.3,2),new THREE.MeshStandardMaterial({color:0x74e4de,emissive:0x148c8c,emissiveIntensity:2,roughness:.3}));
  const ring=new THREE.Mesh(new THREE.TorusGeometry(.65,.018,8,48),new THREE.MeshBasicMaterial({color:0x73ebeb}));ring.rotation.x=-Math.PI/2;ring.position.y=-.45;
  const glow=new THREE.PointLight(0x3aebdd,5,6);group.add(orb,ring,glow);
  group.userData={found:false,label};samples.push(group);scene.add(group);
}
const keys=new Set();let started=false,collected=0,energy=100,speed=0,time=0,last=performance.now();
const forward=new THREE.Vector3(),offset=new THREE.Vector3(),look=new THREE.Vector3();
const complete=document.querySelector('#complete');
function notify(text){message.textContent=text;}
function hud(){
  document.querySelector('#depth').textContent=`${Math.round(180-sub.position.y*10)} m`;
  document.querySelector('#energy').textContent=`${Math.ceil(energy)}%`;
  document.querySelector('#samples').textContent=`${collected} / 5`;
}
function collect(){
  if(!started)return;
  const near=samples.find(s=>!s.userData.found&&s.position.distanceTo(sub.position)<3);
  if(!near){notify('サンプルの3 m以内で E を押してください。');return;}
  near.visible=false;near.userData.found=true;collected++;notify(`回収：${near.userData.label}`);
  if(collected===5)finish(true);hud();
}
function finish(success){
  started=false;keys.clear();complete.classList.remove('hidden');
  complete.querySelector('p').textContent=success?'MISSION COMPLETE':'MISSION ENDED';
  complete.querySelector('h1').textContent=success?'全サンプルを回収':'エネルギー切れ';
  complete.querySelector('span').textContent=success?'海洋研究基地へデータを送信しました。':'再出発して探索ルートを見直しましょう。';
}
function start(){started=true;keys.clear();document.querySelector('#start').classList.add('hidden');}
launch.onclick=start;
document.querySelector('#restart').onclick=()=>{
  sub.position.set(0,-4,7);sub.rotation.set(0,0,0);collected=0;energy=100;speed=0;
  samples.forEach(s=>{s.visible=true;s.userData.found=false;});complete.classList.add('hidden');start();
};
addEventListener('keydown',e=>{
  if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code))e.preventDefault();
  keys.add(e.code);if(e.code==='KeyE'&&!e.repeat)collect();
});
addEventListener('keyup',e=>keys.delete(e.code));addEventListener('blur',()=>keys.clear());
const pressed=(a,b)=>keys.has(a)||keys.has(b);
renderer.setAnimationLoop(now=>{
  const dt=Math.min((now-last)/1000,.05);last=now;time+=dt;ocean.update(dt);
  const turn=Number(pressed('KeyA','ArrowLeft'))-Number(pressed('KeyD','ArrowRight'));
  const throttle=Number(pressed('KeyW','ArrowUp'))-Number(pressed('KeyS','ArrowDown'));
  propellers?.update(dt,started,throttle,turn);
  if(started){
    sub.rotation.y+=turn*dt*1.05;
    speed=THREE.MathUtils.damp(speed,throttle*5,2,dt);
    forward.set(0,0,-1).applyQuaternion(sub.quaternion);sub.position.addScaledVector(forward,speed*dt);
    sub.position.y+=(Number(keys.has('Space'))-Number(pressed('ShiftLeft','ShiftRight')))*dt*2.5;
    sub.position.x=THREE.MathUtils.clamp(sub.position.x,-65,65);sub.position.z=THREE.MathUtils.clamp(sub.position.z,-65,65);
    sub.position.y=THREE.MathUtils.clamp(sub.position.y,floorHeight(sub.position.x,sub.position.z)+1.35,1);
    energy=Math.max(0,energy-dt*(.08+Math.abs(speed)*.015));if(!energy)finish(false);
    const nearest=samples.filter(s=>!s.userData.found).sort((a,b)=>a.position.distanceToSquared(sub.position)-b.position.distanceToSquared(sub.position))[0];
    if(nearest){const d=nearest.position.distanceTo(sub.position);notify(d<3?`E：${nearest.userData.label}を回収`:`最寄りのサンプル ${d.toFixed(0)} m ・ 青い光を探してください`);}
  }
  if(model){model.position.y=Math.sin(time*.9)*.04;model.rotation.z=Math.sin(time*.7)*.01;}
  offset.set(4.6,2.7,7.2).applyQuaternion(sub.quaternion).add(sub.position);
  camera.position.lerp(offset,1-Math.exp(-dt*3));
  look.set(0,-.3,-3).applyQuaternion(sub.quaternion).add(sub.position);camera.lookAt(look);
  hud();renderer.render(scene,camera);
});
addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);});
