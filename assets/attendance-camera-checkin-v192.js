import { sb } from './supabase-v175.js';

const $=(s,r=document)=>r.querySelector(s);
const UUID_RE=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function tokenFromLocation(){
  const hash=String(location.hash||'');
  const m=hash.match(/^#attendance-checkin=([^&]+)$/i);
  if(m)return decodeURIComponent(m[1]);
  const q=new URLSearchParams(location.search).get('attendance-checkin');
  return q||'';
}

function closeDrawer(){
  document.body.classList.remove('drawer-open','nav-open','menu-open');
  document.documentElement.classList.remove('drawer-open','nav-open','menu-open');
  $('#shell')?.classList.remove('drawer-open','nav-open','menu-open','open');
  $('.shell > aside')?.classList.remove('open','active','show');
  $('#backdrop')?.classList.remove('show','active','open');
}

function paint(title,message,ok=true,detail=''){
  closeDrawer();
  const root=$('#content');
  if(!root)return false;
  $('#crumb') && ($('#crumb').textContent='RESIDENT');
  $('#title') && ($('#title').textContent='Meeting check-in');
  const accent=ok?'#0b7a4b':'#ad243d';
  const bg=ok?'#e9f8f0':'#fff0f2';
  root.innerHTML=`
    <section style="max-width:720px;margin:32px auto;padding:24px;border:1px solid #dce7ef;border-radius:20px;background:#fff;box-shadow:0 12px 30px rgba(8,38,66,.07)">
      <div style="display:grid;place-items:center;width:58px;height:58px;border-radius:50%;margin:0 0 16px;background:${bg};color:${accent};font-size:30px;font-weight:900">${ok?'✓':'!'}</div>
      <h2 style="margin:0;color:#0a2745;font-size:clamp(1.55rem,4vw,2.2rem)">${title}</h2>
      <p style="margin:10px 0 0;color:#536b80;font-size:1rem;line-height:1.55">${message}</p>
      ${detail?`<p style="margin:14px 0 0;padding:11px 13px;border-radius:12px;background:#f4f7fa;color:#5a7084;font-weight:700">${detail}</p>`:''}
      <div style="margin-top:20px"><button type="button" id="attendanceCheckinContinue" style="border:0;border-radius:12px;padding:11px 16px;background:#0b3764;color:#fff;font-weight:900;cursor:pointer">Continue to portal</button></div>
    </section>`;
  $('#attendanceCheckinContinue')?.addEventListener('click',()=>{
    history.replaceState(null,'',location.pathname+location.search.replace(/([?&])attendance-checkin=[^&]*&?/,'$1').replace(/[?&]$/,''));
    location.hash='#dashboard';
    location.reload();
  });
  return true;
}

async function run(){
  const token=tokenFromLocation();
  if(!token)return;
  if(!UUID_RE.test(token)){
    const show=()=>paint('Check-in failed','This QR code is not valid.',false);
    show() || setTimeout(show,300);
    return;
  }

  const {data:{session}}=await sb.auth.getSession();
  if(!session){
    try{sessionStorage.setItem('pendingAttendanceQrToken',token)}catch(_){}
    location.href='index.html?attendance-checkin='+encodeURIComponent(token);
    return;
  }

  const wait=()=>new Promise(resolve=>{
    if($('#content'))return resolve();
    const t=setInterval(()=>{if($('#content')){clearInterval(t);resolve()}},80);
    setTimeout(()=>{clearInterval(t);resolve()},5000);
  });
  await wait();
  paint('Checking you in…','Please wait while your attendance is being verified.',true);

  try{
    const {data,error}=await sb.rpc('resident_attendance_checkin_v167',{p_qr_token:token,p_meeting_id:null});
    if(error)throw error;
    const checked=data?.checked_in_at?new Date(data.checked_in_at).toLocaleString('en-GB',{dateStyle:'medium',timeStyle:'short'}):'';
    paint('You checked in successfully.','Your attendance has been recorded.',true,checked?`Check-in time: ${checked}`:'');
    history.replaceState(null,'',location.pathname+'#attendance-checkin-complete');
  }catch(err){
    paint('Check-in failed',err?.message||'We could not record your attendance from this QR code.',false);
  }
}

run().catch(err=>console.error('Attendance camera check-in failed',err));
