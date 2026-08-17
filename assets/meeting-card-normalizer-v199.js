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
function scheduledText(m){
  const start=`${datePart(m.starts_at)}, ${timePart(m.starts_at)}`;
  if(!m.ends_at)return start;
  const sameDay=datePart(m.starts_at)===datePart(m.ends_at);
  return sameDay?`${start} → ${timePart(m.ends_at)}`:`${start} → ${datePart(m.ends_at)}, ${timePart(m.ends_at)}`;
}
function allowedPeriod(m){
  return `${timePart(m.checkin_opens_at)} → ${timePart(m.checkin_closes_at)}`;
}
function scheduledHtml(m){
  return `<span class="meet199-scheduled"><span class="meet199-tick" aria-hidden="true">✓</span><span>Scheduled: ${scheduledText(m)}</span></span>`;
}
function styles(){
  if($('#meet199Styles'))return;
  const s=document.createElement('style');
  s.id='meet199Styles';
  s.textContent=`
    .meet199-scheduled{display:inline-flex;align-items:center;gap:7px;font-weight:950;color:#0b1f37;font-size:1.08rem;line-height:1.25}
    .meet199-tick{display:inline-grid;place-items:center;width:20px;height:20px;flex:0 0 20px;border-radius:50%;background:#16a34a;color:#fff!important;-webkit-text-fill-color:#fff!important;font-size:13px;font-weight:1000;line-height:1}
    .meet195-delete,.meet194-delete,[data-meet195-delete],[data-meet194-delete]{color:#111827!important;-webkit-text-fill-color:#111827!important;font-weight:900!important}
    @media(max-width:720px){.meet199-scheduled{font-size:1rem}}
  `;
  document.head.appendChild(s);
}

function lifecycleGroups(card){
  return $$('.meet187-actions',card).filter(node=>node.querySelector('[data-meet194-cancel],[data-meet195-cancel],[data-meet194-delete],[data-meet195-delete]'));
}
function dedupeAdmin(){
  $$('#meet187AdminList .meet187-card').forEach(card=>{
    const groups=lifecycleGroups(card);
    if(groups.length>1){
      const preferred=groups.find(g=>g.matches('[data-meet195-tools]')||g.querySelector('[data-meet195-cancel],[data-meet195-delete]'))||groups[0];
      groups.forEach(g=>{if(g!==preferred)g.remove()});
    }
    const del=card.querySelector('[data-meet195-delete],[data-meet194-delete]');
    if(del){
      del.style.setProperty('color','#111827','important');
      del.style.setProperty('-webkit-text-fill-color','#111827','important');
    }
  });
}

async function formatAdmin(){
  const list=$('#meet187AdminList');
  if(!list)return;
  let rows=[];
  try{const{data,error}=await sb.rpc('owner_list_attendance_meetings_v194');if(error)throw error;rows=data||[]}catch(_){return}
  const byId=new Map(rows.map(m=>[String(m.id),m]));
  $$('.meet187-card',list).forEach(card=>{
    const ref=card.querySelector('[data-meet187-report]');
    const m=byId.get(String(ref?.dataset.meet187Report||''));
    const meta=card.querySelector('.meet187-meta');
    if(!m||!meta)return;
    const spans=[...meta.children].filter(n=>n.tagName==='SPAN');
    if(spans[0])spans[0].innerHTML=scheduledHtml(m);
    if(spans[1])spans[1].innerHTML=`<b>Check-in allowed period:</b> ${allowedPeriod(m)}`;
  });
}

async function formatResident(){
  const list=$('#meet187ResidentList');
  if(!list)return;
  let rows=[];
  try{const{data,error}=await sb.rpc('get_my_attendance_meetings_v179');if(error)throw error;rows=data||[]}catch(_){return}
  const cards=$$('.meet187-card',list);
  cards.forEach((card,i)=>{
    const m=rows[i],meta=card.querySelector('.meet187-meta');
    if(!m||!meta)return;
    const spans=[...meta.children].filter(n=>n.tagName==='SPAN');
    if(spans[0])spans[0].innerHTML=scheduledHtml(m);
    const checkSpan=spans.find(s=>/Check-in/i.test(s.textContent||''));
    if(checkSpan)checkSpan.innerHTML=`<b>Check-in allowed period:</b> ${allowedPeriod(m)}`;
  });
  const hero=$('.meet187-hero p');
  if(hero&&/in-app QR scanner/i.test(hero.textContent||''))hero.textContent='Online meetings use numbers announced by Admin. Physical meetings use the phone Camera to scan the meeting QR code.';
}

async function normalize(){
  styles();
  dedupeAdmin();
  await Promise.all([formatAdmin(),formatResident()]);
  dedupeAdmin();
}

function arm(){
  if(timer){clearInterval(timer);timer=null}
  let tries=0;
  void normalize();
  timer=setInterval(()=>{
    tries++;
    void normalize();
    if(tries>=30){clearInterval(timer);timer=null}
  },400);
}

document.addEventListener('click',e=>{
  if(e.target.closest?.('[data-sm191-open-meetings],[data-meet187-schedule],[data-meet187-create-code],[data-meet187-new-qr]'))setTimeout(arm,50);
},true);
window.addEventListener('hashchange',()=>{if(location.hash==='#meetings')arm()});
styles();
arm();
