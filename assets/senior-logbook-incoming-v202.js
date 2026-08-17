import { sb } from './supabase.js';

const $=(s,r=document)=>r.querySelector(s);
const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
let timer=null,loading=false;

const onRequestsPage=()=>location.hash.replace(/^#/,'').split('?')[0]==='logbook-requests' || /logbook requests/i.test($('#title')?.textContent||'');
const timeText=v=>{
  if(!v)return '—';
  try{return new Intl.DateTimeFormat('en-GB',{weekday:'short',day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}).format(new Date(v));}
  catch(_){return String(v)}
};

async function loadReceived(){
  const {data,error}=await sb.rpc('get_logbook_messages',{p_view:'received'});
  if(error)throw error;
  return (data||[]).filter(m=>!m.logbook_action_taken && m.logbook_entry_id);
}

function nativeRow(m){
  const sender=m.sender_name||m.resident_name||'Resident';
  const title=m.logbook_title||m.activity_kind||m.subject||'Logbook activity';
  const status=m.request_status||'pending';
  const search=`${sender} ${m.receiver_name||''} ${m.subject||''} ${m.body||''} ${title} ${status}`.toLowerCase();
  return `<article class="message-row ${m.is_read?'read':'unread'}" data-senior-native-request="1" data-request-resident="${esc(m.resident_id||m.sender_id||'')}" data-request-status="${esc(status)}" data-request-type="${esc(`${m.activity_category||''}:${m.activity_kind||''}`)}" data-message-search="${esc(search)}">
    <input class="message-select logbook-message-select" type="checkbox" value="${esc(m.id)}" aria-label="Select logbook message">
    <button class="message-open" data-message-id="${esc(m.id)}" data-message-box="logbook">
      <span class="message-person">From: ${esc(sender)}</span>
      <strong>${esc(m.subject||`Logbook approval request · ${title}`)}</strong>
      <small>${esc(timeText(m.created_at))}</small>
    </button>
    <div class="message-actions approval-actions">
      <button class="btn small success-button" data-quick-logbook-approve="${esc(m.logbook_entry_id)}" data-approval-message-id="${esc(m.id)}">Approve</button>
      <button class="btn small danger-button" data-inbox-logbook-reject="${esc(m.logbook_entry_id)}" data-approval-message-id="${esc(m.id)}" data-logbook-title="${esc(title)}">Reject</button>
    </div>
  </article>`;
}

function removeOldCustomPanel(){
  $('#seniorReq202')?.remove();
  $('#seniorReq202Style')?.remove();
  $('#seniorNativeRequests204')?.remove();
}

function placeBelowApprovedContent(section,content){
  const mailSections=[...content.querySelectorAll('section')].filter(el=>el.querySelector('.mail-panel,.message-list,.logbook-mail-tools'));
  const anchor=mailSections.at(-1);
  if(anchor?.parentNode){anchor.insertAdjacentElement('afterend',section);return;}
  content.appendChild(section);
}

async function render(){
  if(!onRequestsPage()||loading)return;
  const content=$('#content');if(!content)return;
  loading=true;
  try{
    removeOldCustomPanel();
    const {data:sess}=await sb.auth.getSession();
    if(!sess?.session?.user?.id)return;
    const {data:profile}=await sb.from('profiles').select('role').eq('id',sess.session.user.id).maybeSingle();
    if(profile?.role!=='resident')return;

    const rows=await loadReceived();
    if(!rows.length)return;

    if(window.logbookMessages instanceof Map){rows.forEach(m=>window.logbookMessages.set(String(m.id),m));}

    const section=document.createElement('section');
    section.id='seniorNativeRequests204';
    section.className='card mail-card senior-native-requests';
    section.innerHTML=`<div class="section-head"><div><h3>Requests requiring my response</h3><p>Incoming junior logbook requests assigned to you.</p></div><span class="tag warning">${rows.length} pending</span></div><div class="mail-panel"><div class="message-list">${rows.map(nativeRow).join('')}</div></div>`;
    placeBelowApprovedContent(section,content);
  }catch(e){console.error('Could not load incoming senior logbook requests',e);}
  finally{loading=false;}
}

function arm(){
  if(timer)clearInterval(timer);
  let n=0;
  void render();
  timer=setInterval(()=>{n++;void render();if(n>=16){clearInterval(timer);timer=null;}},300);
}
window.addEventListener('hashchange',arm);
document.addEventListener('click',e=>{if(e.target.closest?.('[data-go="logbook-requests"]'))setTimeout(arm,80)},true);
arm();
