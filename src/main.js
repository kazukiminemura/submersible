import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { createOcean, floorHeight } from './ocean.js';
import { createPropellers } from './propellers.js';
import { createHeadlights } from './headlights.js';
import { createCreatures } from './creatures.js';
import { createAudio } from './audio.js';
import { createGameHud } from './game-hud.js';
import { createExplorationEffects } from './exploration-effects.js';
import './style.css';

const renderer=new THREE.WebGLRenderer({canvas:document.querySelector('#scene'),antialias:true});
renderer.setPixelRatio(Math.min(devicePixelRatio,1.75));
renderer.setSize(innerWidth,innerHeight);
renderer.toneMapping=THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure=1.25;
renderer.shadowMap.enabled=true;
renderer.shadowMap.type=THREE.PCFShadowMap;
const scene=new THREE.Scene();
scene.background=new THREE.Color('#06334e');
scene.fog=new THREE.FogExp2('#06334e',.035);
const pmrem=new THREE.PMREMGenerator(renderer);
const room=new RoomEnvironment();
scene.environment=pmrem.fromScene(room,.04).texture;
scene.environmentIntensity=.6;
room.dispose();pmrem.dispose();
scene.add(new THREE.HemisphereLight(0x92d6ef,0x183044,.9));
const sun=new THREE.DirectionalLight(0x94dae7,1.8);
sun.position.set(-15,30,8);scene.add(sun);
const camera=new THREE.PerspectiveCamera(55,innerWidth/innerHeight,.1,180);
const ocean=createOcean(scene);
const effects=createExplorationEffects(scene);
const gameHud=createGameHud();
const mute=document.querySelector('#mute'),volume=document.querySelector('#volume');
const soundtrack=createAudio(state=>{
  mute.setAttribute('aria-pressed',String(state.muted));
  mute.textContent=state.muted?'M · サウンド OFF':'M · サウンド ON';
  volume.value=Math.round(state.volume*100);
  document.querySelector('#audio-status').textContent=!state.available?'このブラウザは音声非対応':state.muted||state.volume===0?'消音中':state.playing?'♫ DEEP BLUE · 探索BGM再生中':'探査開始でBGM再生';
});
mute.onclick=()=>{soundtrack.toggleMute();mute.blur();};
volume.oninput=()=>soundtrack.setVolume(Number(volume.value)/100);
soundtrack.status();
const sub=new THREE.Group();scene.add(sub);
sub.position.set(0,-4,7);
camera.position.set(5,0,14);
createHeadlights(sub);
const fill=new THREE.PointLight(0xb2dce3,5,7);fill.position.set(0,2,1);sub.add(fill);
const launch=document.querySelector('#launch');
const message=document.querySelector('#message');
launch.disabled=true;launch.textContent='潜水艇と海洋生物を準備中…';
let model,propellers,creatures;
Promise.all([new GLTFLoader().loadAsync('/models/submersible.glb'),createCreatures(scene)]).then(([gltf,fauna])=>{
  model=gltf.scene;model.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});
  propellers=createPropellers(model);
  creatures=fauna;
  sub.add(model);launch.disabled=false;launch.textContent='探査を開始';
}).catch(error=>{console.error('Scene asset loading failed',error);launch.textContent='モデル読込失敗・再読み込みしてください';});

const samples=[];
for(const [x,z,label] of [[7,0,'発光生物の組織'],[-10,-8,'熱水鉱床の菌類'],[4,-21,'深海サンゴの標本'],[-18,-26,'未知の甲殻類'],[19,-31,'古代の貝殻']]) {
  const group=new THREE.Group();group.position.set(x,floorHeight(x,z)+1,z);
  const orb=new THREE.Mesh(new THREE.IcosahedronGeometry(.3,2),new THREE.MeshStandardMaterial({color:0x74e4de,emissive:0x148c8c,emissiveIntensity:2,roughness:.3}));
  const ring=new THREE.Mesh(new THREE.TorusGeometry(.65,.018,8,48),new THREE.MeshBasicMaterial({color:0x73ebeb}));ring.rotation.x=-Math.PI/2;ring.position.y=-.45;
  const glow=new THREE.PointLight(0x3aebdd,5,6);group.add(orb,ring,glow);
  group.userData={found:false,label};samples.push(group);scene.add(group);
}
const keys=new Set();let started=false,collected=0,energy=100,speed=0,time=0,last=performance.now();
let elapsed=0,points=0,scanCooldown=0,scanGlow=0,hudClock=0;
const discoveries=new Set();
let frontView=false;
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
  if(!near){gameHud.toast('サンプルに近づいてください','3 m以内で E を押すと回収できます');return;}
  near.visible=false;near.userData.found=true;collected++;points+=200;
  effects.emit(near.position,true);soundtrack.effect('collect');
  gameHud.toast('SAMPLE SECURED · +200',`${near.userData.label}　${collected} / 5`);
  if(collected===5)finish(true);hud();
}
function scan(){
  if(!started||scanCooldown>0)return;
  scanCooldown=8;scanGlow=3;
  effects.emit(sub.position);soundtrack.effect('sonar');
  gameHud.toast('SONAR PULSE','青いビーコンを探知 · レーダーの上が艇の前方です');
}
document.querySelector('#scan').onclick=()=>{scan();document.querySelector('#scan').blur();};
function finish(success){
  started=false;keys.clear();complete.classList.remove('hidden');
  soundtrack.finish(success);
  complete.querySelector('p').textContent=success?'MISSION COMPLETE':'MISSION ENDED';
  complete.querySelector('h1').textContent=success?'全サンプルを回収':'エネルギー切れ';
  complete.querySelector('span').textContent=`調査スコア ${points}　·　${Math.floor(elapsed/60)}分${Math.floor(elapsed%60)}秒　·　生物発見 ${discoveries.size}/4。${success?'海洋研究基地へデータを送信しました。':'再出発して探索ルートを見直しましょう。'}`;
}
function start(){
  started=true;keys.clear();document.querySelector('#start').classList.add('hidden');
  launch.blur();document.querySelector('#restart').blur();
  void soundtrack.start().then(()=>soundtrack.effect('start'));
  gameHud.toast('MISSION START','サンプル回収 +200 · 生物の初発見 +50');
}
launch.onclick=start;
document.querySelector('#restart').onclick=()=>{
  sub.position.set(0,-4,7);sub.rotation.set(0,0,0);collected=0;energy=100;speed=0;
  elapsed=0;points=0;scanCooldown=0;scanGlow=0;discoveries.clear();
  samples.forEach(s=>{s.visible=true;s.userData.found=false;});complete.classList.add('hidden');start();
};
addEventListener('keydown',e=>{
  if(e.target instanceof HTMLInputElement)return;
  if(e.code==='KeyM'&&!e.repeat){soundtrack.toggleMute();return;}
  if(e.target instanceof HTMLButtonElement&&(e.code==='Space'||e.code==='Enter'))return;
  if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code))e.preventDefault();
  keys.add(e.code);if(e.code==='KeyE'&&!e.repeat)collect();
  if(e.code==='KeyV'&&!e.repeat)frontView=!frontView;
  if(e.code==='KeyR'&&!e.repeat)scan();
});
addEventListener('keyup',e=>keys.delete(e.code));addEventListener('blur',()=>keys.clear());
const pressed=(a,b)=>keys.has(a)||keys.has(b);
addEventListener('visibilitychange',()=>{keys.clear();soundtrack.visibility(document.hidden);});
renderer.setAnimationLoop(now=>{
  const dt=Math.min((now-last)/1000,.05);last=now;time+=dt;ocean.update(dt);
  effects.update(dt);
  creatures?.update(dt);
  const turn=Number(pressed('KeyA','ArrowLeft'))-Number(pressed('KeyD','ArrowRight'));
  const throttle=Number(pressed('KeyW','ArrowUp'))-Number(pressed('KeyS','ArrowDown'));
  propellers?.update(dt,started,throttle,turn);
  if(started){
    elapsed+=dt;scanCooldown=Math.max(0,scanCooldown-dt);scanGlow=Math.max(0,scanGlow-dt);
    for(const sample of samples){
      sample.children[0].scale.setScalar(1+Math.sin(time*3)*.12+(scanGlow>0?.4:0));
      sample.children[0].material.emissiveIntensity=scanGlow>0?5:2;
    }
    sub.rotation.y+=turn*dt*1.05;
    speed=THREE.MathUtils.damp(speed,throttle*5,2,dt);
    forward.set(0,0,-1).applyQuaternion(sub.quaternion);sub.position.addScaledVector(forward,speed*dt);
    sub.position.y+=(Number(keys.has('Space'))-Number(pressed('ShiftLeft','ShiftRight')))*dt*2.5;
    sub.position.x=THREE.MathUtils.clamp(sub.position.x,-65,65);sub.position.z=THREE.MathUtils.clamp(sub.position.z,-65,65);
    sub.position.y=THREE.MathUtils.clamp(sub.position.y,floorHeight(sub.position.x,sub.position.z)+1.35,1);
    energy=Math.max(0,energy-dt*(.08+Math.abs(speed)*.015));if(!energy)finish(false);
    for(const creature of scene.children){
      if(!creature.userData.species||discoveries.has(creature.userData.species))continue;
      if(creature.position.distanceTo(sub.position)<8){
        discoveries.add(creature.userData.species);points+=50;
        soundtrack.effect('discover');gameHud.toast('NEW SPECIES · +50',`${creature.name}を発見　${discoveries.size} / 4`);
      }
    }
    const nearest=samples.filter(s=>!s.userData.found).sort((a,b)=>a.position.distanceToSquared(sub.position)-b.position.distanceToSquared(sub.position))[0];
    if(nearest){const d=nearest.position.distanceTo(sub.position);notify(d<3?`E：${nearest.userData.label}を回収`:`最寄りのサンプル ${d.toFixed(0)} m ・ 青い光を探してください`);}
  }
  if(model){model.position.y=Math.sin(time*.9)*.04;model.rotation.z=Math.sin(time*.7)*.01;}
  const inspect=frontView||(!started&&complete.classList.contains('hidden'));
  offset.set(inspect?4.5:4.6,inspect?1.8:2.7,inspect?-6.5:7.2).applyQuaternion(sub.quaternion).add(sub.position);
  camera.position.lerp(offset,1-Math.exp(-dt*3));
  look.set(0,-.3,inspect?0:-3).applyQuaternion(sub.quaternion).add(sub.position);camera.lookAt(look);
  hud();renderer.render(scene,camera);
  hudClock+=dt;
  if(hudClock>=.1){
    hudClock=0;gameHud.update({position:sub.position,yaw:sub.rotation.y,samples,elapsed,points,collected,cooldown:scanCooldown,discoveries:discoveries.size});
    document.querySelector('#scan').disabled=!started||scanCooldown>0;
  }
});
addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);});
