import * as THREE from 'three';
import './style.css';

const canvas = document.querySelector('#scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.setAnimationLoop(animate);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.background = new THREE.Color('#04131d');
scene.fog = new THREE.FogExp2('#04202d', .018);
const camera = new THREE.PerspectiveCamera(58, innerWidth / innerHeight, .1, 160);
const clock = new THREE.Clock();
const keys = new Set();
const sub = new THREE.Group();
const samples = [];
let started = false, collected = 0, energy = 100, elapsed = 0;
const message = document.querySelector('#message');

scene.add(new THREE.HemisphereLight('#69d8ff', '#062a25', 1.4));
const keyLight = new THREE.DirectionalLight('#90e9ff', 2.2); keyLight.position.set(-8, 14, 5); keyLight.castShadow = true; scene.add(keyLight);
const seabed = new THREE.Mesh(new THREE.PlaneGeometry(150, 150, 45, 45), new THREE.MeshStandardMaterial({ color:'#0a3434', roughness: .95, metalness: .1 }));
seabed.rotation.x = -Math.PI / 2; seabed.receiveShadow = true;
const p = seabed.geometry.attributes.position; for(let i=0;i<p.count;i++) p.setY(i, Math.sin(p.getX(i)*.23)*.45 + Math.cos(p.getZ(i)*.17)*.35 - 8); p.needsUpdate=true; seabed.geometry.computeVertexNormals(); scene.add(seabed);

function makeSubmersible() {
  const hullMat = new THREE.MeshStandardMaterial({ color:'#e7c756', metalness:.72, roughness:.23 });
  const darkMat = new THREE.MeshStandardMaterial({ color:'#13242d', metalness:.7, roughness:.3 });
  const glass = new THREE.MeshPhysicalMaterial({ color:'#88dfff', transparent:true, opacity:.67, roughness:.05, metalness:.1 });
  const body = new THREE.Mesh(new THREE.SphereGeometry(1.05, 28, 16), hullMat); body.scale.set(.74,.72,1.45); body.castShadow=true; sub.add(body);
  const window = new THREE.Mesh(new THREE.SphereGeometry(.61, 24, 12), glass); window.position.set(0,.12,-.62); window.scale.set(.72,.5,.25); sub.add(window);
  const finGeo = new THREE.BoxGeometry(.48,.1,.95); [[-.85,0,0],[.85,0,0]].forEach(([x,y,z]) => { const f=new THREE.Mesh(finGeo,darkMat); f.position.set(x,y,z); f.rotation.z=.18; sub.add(f); });
  const tail = new THREE.Mesh(new THREE.ConeGeometry(.34,.6,16), darkMat); tail.rotation.x=Math.PI/2; tail.position.z=1.65; sub.add(tail);
  const lamp = new THREE.SpotLight('#a5f3ff', 8, 23, .42, .8, 1); lamp.position.set(0,0,-1.35); lamp.target.position.set(0,0,-14); sub.add(lamp, lamp.target);
  const glow = new THREE.Mesh(new THREE.SphereGeometry(.12,10,8), new THREE.MeshBasicMaterial({color:'#d8ffff'})); glow.position.set(0,0,-1.37); sub.add(glow);
}
makeSubmersible(); sub.position.set(0,-2,7); scene.add(sub);

function addCoral(x,z, color) { const g=new THREE.Group(); for(let i=0;i<4;i++){ const stalk=new THREE.Mesh(new THREE.CylinderGeometry(.08,.16,1+Math.random()*1.5,7),new THREE.MeshStandardMaterial({color,roughness:.8})); stalk.position.set((Math.random()-.5)*1.2,-7,(Math.random()-.5)*1.2); stalk.rotation.z=(Math.random()-.5)*.45; g.add(stalk); } g.position.set(x,0,z); scene.add(g); }
for(let i=0;i<42;i++) addCoral((Math.random()-.5)*75,(Math.random()-.5)*75, ['#157a7f','#0f5b62','#cb7b58'][i%3]);

function addSample(x,z,label) { const g=new THREE.Group(); const orb=new THREE.Mesh(new THREE.IcosahedronGeometry(.43,2),new THREE.MeshStandardMaterial({color:'#35e2ff',emissive:'#098aab',emissiveIntensity:2,roughness:.2})); orb.position.y=-6.2; g.add(orb); const ring=new THREE.Mesh(new THREE.TorusGeometry(.65,.025,8,32),new THREE.MeshBasicMaterial({color:'#6af6ff'})); ring.rotation.x=Math.PI/2; ring.position.y=-6.5; g.add(ring); const beam=new THREE.PointLight('#33dcff',2.7,7); beam.position.y=-5.6; g.add(beam); g.position.set(x,0,z); g.userData={label,orb,ring,found:false}; samples.push(g); scene.add(g); }
[[10,0,'発光クラゲの組織'],[-10,-8,'熱水鉱床の菌類'],[4,-21,'深海サンゴの標本'],[-18,-26,'未知の甲殻類'],[19,-31,'古代の貝殻']].forEach(v=>addSample(...v));

function updateHUD() { document.querySelector('#depth').textContent=`${Math.max(0,Math.round((-sub.position.y-1)*42))} m`; document.querySelector('#energy').textContent=`${Math.max(0,Math.round(energy))}%`; document.querySelector('#samples').textContent=`${collected} / 5`; }
function notify(text){message.textContent=text; message.classList.add('flash'); setTimeout(()=>message.classList.remove('flash'),300);}
addEventListener('keydown', e=>{ keys.add(e.code); if(e.code==='KeyE') collectNearest(); }); addEventListener('keyup', e=>keys.delete(e.code));
function collectNearest(){ if(!started) return; const target=samples.find(s=>!s.userData.found && s.position.distanceTo(sub.position)<3); if(!target){ notify('近くに回収可能なサンプルはありません。'); return; } target.userData.found=true; target.visible=false; collected++; notify(`回収成功：${target.userData.label}`); if(collected===5){ document.querySelector('#complete').classList.remove('hidden'); started=false; } updateHUD(); }
function reset(){ collected=0; energy=100; elapsed=0; sub.position.set(0,-2,7); sub.rotation.set(0,0,0); samples.forEach(s=>{s.userData.found=false;s.visible=true}); updateHUD(); notify('新しい探査を開始。青いビーコンを探してください。'); }
document.querySelector('#launch').onclick=()=>{document.querySelector('#start').classList.add('hidden'); started=true; clock.getDelta();}; document.querySelector('#restart').onclick=()=>{document.querySelector('#complete').classList.add('hidden');reset();started=true;};

const forward=new THREE.Vector3(), desiredCam=new THREE.Vector3(), lookAt=new THREE.Vector3();
function animate(){ const dt=Math.min(clock.getDelta(),.05); elapsed+=dt; if(started){ const turn=(keys.has('KeyA')||keys.has('ArrowLeft')?1:0)-(keys.has('KeyD')||keys.has('ArrowRight')?1:0); sub.rotation.y+=turn*dt*1.6; const move=(keys.has('KeyW')||keys.has('ArrowUp')?1:0)-(keys.has('KeyS')||keys.has('ArrowDown')?1:0); sub.getWorldDirection(forward); sub.position.addScaledVector(forward, move*dt*7); const vertical=(keys.has('Space')?1:0)-(keys.has('ShiftLeft')||keys.has('ShiftRight')?1:0); sub.position.y+=vertical*dt*4; sub.position.y=THREE.MathUtils.clamp(sub.position.y,-6.0,4); energy-=dt*(.35+Math.abs(move)*.2); if(energy<=0){energy=0;started=false;notify('エネルギー切れ。探査をやり直してください。');} samples.filter(s=>!s.userData.found).forEach(s=>{s.userData.orb.rotation.y+=dt; s.userData.ring.rotation.z+=dt;}); updateHUD(); }
  desiredCam.copy(sub.position).add(new THREE.Vector3(0,3.3,5).applyAxisAngle(new THREE.Vector3(0,1,0),sub.rotation.y)); camera.position.lerp(desiredCam,.055); lookAt.copy(sub.position).add(new THREE.Vector3(0,0,-3).applyAxisAngle(new THREE.Vector3(0,1,0),sub.rotation.y)); camera.lookAt(lookAt); renderer.render(scene,camera); }
addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);});
