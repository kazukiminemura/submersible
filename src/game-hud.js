export function createGameHud() {
  const radar=document.querySelector('#radar'),ctx=radar.getContext('2d');
  const toast=document.querySelector('#toast'),score=document.querySelector('#score');
  let toastTimer;
  return {
    toast(title,detail='') {
      toast.querySelector('strong').textContent=title;toast.querySelector('span').textContent=detail;
      toast.classList.add('visible');clearTimeout(toastTimer);
      toastTimer=setTimeout(()=>toast.classList.remove('visible'),3200);
    },
    update({position,yaw,samples,elapsed,points,collected,cooldown,discoveries}) {
      score.textContent=String(points).padStart(4,'0');
      document.querySelector('#elapsed').textContent=`${Math.floor(elapsed/60).toString().padStart(2,'0')}:${Math.floor(elapsed%60).toString().padStart(2,'0')}`;
      document.querySelector('#mission-progress').value=collected;
      document.querySelector('#mission-count').textContent=`${collected} / 5`;
      document.querySelector('#discoveries').textContent=`生物発見 ${discoveries} / 4`;
      const scan=document.querySelector('#scan');scan.disabled=cooldown>0;
      scan.textContent=cooldown>0?`ソナー充電 ${Math.ceil(cooldown)} s`:'R · ソナー発信';
      document.querySelector('#bearing').textContent=`${((Math.round(-yaw*180/Math.PI)%360+360)%360).toString().padStart(3,'0')}°`;
      const size=radar.width,center=size/2,range=35,scale=(center-12)/range;
      ctx.clearRect(0,0,size,size);ctx.strokeStyle='#5ee5e53d';ctx.lineWidth=1;
      for(const radius of [center*.4,center*.8]){ctx.beginPath();ctx.arc(center,center,radius,0,Math.PI*2);ctx.stroke();}
      ctx.beginPath();ctx.moveTo(center,8);ctx.lineTo(center,size-8);ctx.moveTo(8,center);ctx.lineTo(size-8,center);ctx.stroke();
      const sweep=elapsed*.9;
      ctx.strokeStyle='#67f3e966';ctx.beginPath();ctx.moveTo(center,center);ctx.lineTo(center+Math.sin(sweep)*(center-8),center-Math.cos(sweep)*(center-8));ctx.stroke();
      for(const sample of samples) {
        if(sample.userData.found)continue;
        const dx=sample.position.x-position.x,dz=sample.position.z-position.z;
        if(Math.hypot(dx,dz)>range)continue;
        const x=(dx*Math.cos(yaw)-dz*Math.sin(yaw))*scale+center;
        const y=(dx*Math.sin(yaw)+dz*Math.cos(yaw))*scale+center;
        ctx.fillStyle='#b3ffeb';ctx.shadowBlur=8;ctx.shadowColor='#57e8ce';
        ctx.beginPath();ctx.arc(x,y,3,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;
      }
      ctx.fillStyle='#ffffff';ctx.beginPath();ctx.moveTo(center,center-6);ctx.lineTo(center-4,center+4);ctx.lineTo(center+4,center+4);ctx.closePath();ctx.fill();
    },
  };
}
