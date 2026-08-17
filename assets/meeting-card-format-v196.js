import { sb } from './supabase.js';

const $=(s,r=document)=>r.querySelector(s);
const $$=(s,r=document)=>[...r.querySelectorAll(s)];
const CAIRO='Africa/Cairo';
let timer=null;

function datePart(v){
  if(!v)return '—';
  return new Intl.DateTimeFormat('en-GB',{timeZone:CAIRO,day:'2-digit',month:'2-digit',year:'numeric'}).format(new Date(v));
}
function timePart(v){
  if(!v)return '—';
  return new Intl.DateTimeFormat('en-US',{timeZone:CAIRO,hour:'numeric',minute:'2-digit',hour12:true}).format(new Date(v));
}
function meetingText(m){
  const start=`${datePart(m.starts_at)}, ${timePart(m.starts_at)}`;
  if(!m.ends_at)return start;
  const sameDay=datePart(m.starts_at)===datePart(m.ends_at);
  return sameDay?`${start} → ${timePart(m.ends_at)}`:`${start} → ${datePart(m.ends_at)}, ${timePart(m.ends_at)}`;
}
function checkinText(m){
  return `${timePart(m.checkin_opens_at)} → ${timePart(m.checkin_closes_at)}`;
}
function styles(){
  if($('#meet196Styles'))return;
  const s=document.createElement('style');
  s.id='meet196Styles';
  s.textContent=`
    .meet195-delete,.meet194-delete{
      color:#111827!important;
      -webkit-text-fill-color:#111827!important;
      font-weight:900!important;
    }
  `;
  document.head.appendChild(s);
}

async function applyAdmin(){
  const list=$('#meet187AdminList');
  if(!list)return false;
  let rows;
  try{
    const {data,error}=await sb.rpc('owner_list_attendance_meetings_v194');
    if(error)throw error;
    rows=data||[];
  }catch(e){console.warn('Meeting card formatting could not load',e);return false}
  const byId=new Map(rows.map(m=>[String(m.id),m]));
  $$('.meet187-card',list).forEach(card=>{
    const ref=card.querySelector('[data-meet187-report]');
    const id=String(ref?.dataset.meet187Report||'');
    const m=byId.get(id);
    const meta=card.querySelector('.meet187-meta');
    if(!m||!meta)return;
    const spans=[...meta.children].filter(n=>n.tagName==='SPAN');
    if(spans[0])spans[0].innerHTML=`<b>Meeting:</b> ${meetingText(m)}`;
    if(spans[1])spans[1].innerHTML=`<b>Check-in:</b> ${checkinText(m)}`;
  });
  return true;
}

function arm(){
  styles();
  if(timer)clearInterval(timer);
  let tries=0;
  void applyAdmin();
  timer=setInterval(async()=>{
    tries++;
    const done=await applyAdmin();
    if(done||tries>=16){clearInterval(timer);timer=null}
  },400);
}

document.addEventListener('click',e=>{
  if(e.target.closest?.('[data-sm191-open-meetings],[data-meet187-schedule]'))setTimeout(arm,100);
},true);

styles();
arm();
