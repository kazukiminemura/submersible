// Original 72 BPM score: warm chords, a bell melody, bass and a soft pulse.
// Web Audio scheduling keeps musical timing independent of the render FPS.
const BEAT=60/72;
export const MUSIC_GAIN=3;
const CHORDS=[[50,57,60,65],[46,53,57,62],[53,60,64,69],[48,55,58,64]];
const MELODY=[[74,77,81,77,72,69],[74,77,79,77,69,65],[77,81,84,81,76,72],[76,79,82,79,74,69]];
const frequency=midi=>440*2**((midi-69)/12);
const voices=new WeakMap();

function note(context,bus,midi,start,duration,volume,type='sine',attack=.03) {
  const oscillator=context.createOscillator(),gain=context.createGain();
  oscillator.type=type;oscillator.frequency.value=frequency(midi);
  gain.gain.setValueAtTime(0,start);
  gain.gain.linearRampToValueAtTime(volume,start+attack);
  gain.gain.exponentialRampToValueAtTime(.0001,start+duration);
  oscillator.connect(gain);gain.connect(bus);
  if(!voices.has(bus))voices.set(bus,new Set());
  voices.get(bus).add(oscillator);
  oscillator.start(start);oscillator.stop(start+duration+.05);
  oscillator.onended=()=>{voices.get(bus).delete(oscillator);oscillator.disconnect();gain.disconnect();};
}

// Exported so the same composition can be verified with OfflineAudioContext.
export function scheduleMusicBar(context,bus,start,index) {
  const chord=CHORDS[Math.floor(index/2)%4],melody=MELODY[Math.floor(index/2)%4];
  for(const pitch of chord)note(context,bus,pitch,start,BEAT*4.8,.028,'triangle',.65);
  note(context,bus,chord[0]-12,start,BEAT*3.5,.08,'sine',.1);
  for(let step=0;step<6;step++) {
    const pitch=melody[(step+(index%2)*2)%6];
    note(context,bus,pitch,start+step*BEAT*.5,BEAT*1.4,.037,'sine',.012);
    note(context,bus,pitch+12,start+step*BEAT*.5,BEAT*.7,.008,'sine',.01);
  }
  for(let step=0;step<4;step++)note(context,bus,38,start+step*BEAT,.22,.04,'sine',.008);
}

export function createAudio(onStatus=()=>{}) {
  let context,master,musicBus,effectsBus,timer,nextBar=0,bar=0,active=false,muted=false,hidden=false;
  let volume=.45;
  try {const saved=JSON.parse(localStorage.getItem('abyssal-audio'));if(saved){volume=Math.max(0,Math.min(1,Number(saved.volume)||0));muted=!!saved.muted;}} catch {}
  function status() {onStatus({volume,muted,playing:active&&!hidden&&!muted&&volume>0&&context?.state==='running',available:!!(window.AudioContext||window.webkitAudioContext)});}
  function persist() {try {localStorage.setItem('abyssal-audio',JSON.stringify({volume,muted}));} catch {}}
  function initialize() {
    if(context)return;
    const AudioContext=window.AudioContext||window.webkitAudioContext;
    if(!AudioContext){status();return;}
    context=new AudioContext();
    const compressor=context.createDynamicsCompressor();
    compressor.threshold.value=-18;compressor.ratio.value=5;
    master=context.createGain();master.gain.value=muted?0:volume;
    master.connect(compressor);compressor.connect(context.destination);
    musicBus=context.createGain();musicBus.gain.value=MUSIC_GAIN;
    const filter=context.createBiquadFilter();filter.type='lowpass';filter.frequency.value=2100;
    musicBus.connect(filter);filter.connect(master);
    const delay=context.createDelay(2),wet=context.createGain(),feedback=context.createGain();
    delay.delayTime.value=BEAT*.75;wet.gain.value=.22;feedback.gain.value=.3;
    filter.connect(delay);delay.connect(wet);wet.connect(master);delay.connect(feedback);feedback.connect(delay);
    effectsBus=context.createGain();effectsBus.gain.value=.7;effectsBus.connect(master);
    context.onstatechange=status;
  }
  function schedule() {
    if(!active||hidden||context?.state!=='running')return;
    if(nextBar<context.currentTime-.1)nextBar=context.currentTime+.08;
    while(nextBar<context.currentTime+.18) {
      scheduleMusicBar(context,musicBus,nextBar,bar++);nextBar+=BEAT*4;
    }
  }
  async function resume() {
    try {initialize();if(!context)return;await context.resume();schedule();} catch { /* Silent play remains available when audio is blocked. */ }
    status();
  }
  function setVolume(value) {
    volume=Math.max(0,Math.min(1,value));
    if(master)master.gain.setTargetAtTime(muted?0:volume,context.currentTime,.04);
    persist();status();
  }
  function toggleMute() {muted=!muted;setVolume(volume);if(!muted&&active&&!hidden)void resume();}
  return {
    async start() {
      active=true;hidden=document.hidden;
      if(context){
        for(const voice of voices.get(musicBus)??[])voice.stop();
        nextBar=context.currentTime+.08;bar=0;
      }
      await resume();
      if(musicBus)musicBus.gain.setTargetAtTime(MUSIC_GAIN,context.currentTime,.3);
      clearInterval(timer);timer=setInterval(schedule,80);status();
    },
    finish(success) {
      active=false;clearInterval(timer);
      if(musicBus)musicBus.gain.setTargetAtTime(.1,context.currentTime,.4);
      this.effect(success?'complete':'end');status();
    },
    effect(kind) {
      if(!context||context.state!=='running'||muted)return;
      const now=context.currentTime+.01;
      const pitches={sonar:[86],collect:[74,77,81],discover:[69,76],complete:[62,69,74,77,81,86],end:[57,53,50],start:[62,69,74]};
      (pitches[kind]??[]).forEach((pitch,i)=>note(context,effectsBus,pitch,now+i*.12,kind==='sonar'?1.6:.65,.16,'sine',.01));
    },
    visibility(isHidden) {
      hidden=isHidden;
      if(!context)return;
      if(hidden)void context.suspend().catch(()=>{});
      else if(active)void resume();
      status();
    },
    setVolume,toggleMute,status,
  };
}
