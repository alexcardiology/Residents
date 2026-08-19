import { sb } from './supabase.js';

const $=(s,r=document)=>r.querySelector(s);
const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
let timer=null,loading=false,activated=false;

const onPage=()=>location.hash.replace(/^#/,'').split('?')[0]==='logbook-requests'||/logbook requests/i.test($('#title')?.textContent||'');
const ready=()=>onPage()&&!!$('#content .mailbox.wide-mailbox .mailbox-tabs')&&!!$('#content .logbook-mail-tools');
const timeText=v=>{if(!v)return'—';try{return new Intl.DateTimeFormat('en-GB',{weekday:'short',day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}).format(new Date(v))}catch(_){return String(v)}};

async function history(){
  const {data,error}=await sb.rpc('get_my_senior_logbook_request_history_v224');
  if(error)throw error;
  return data||[];
}

function statusMarkup(m){
  const status=String(m.request_status||'pending').toLowerCase();
  if(status==='pending')return `<div class="message-actions approval-actions"><button class="btn small success-button" data-quick-logbook-approve="${esc(m.logbook_entry_id)}" data-approval-message-id="${esc(m.id)}">Approve</button><button class="btn small danger-button" data-inbox-logbook-reject="${esc(m.logbook_entry_id)}" data-approval-message-id="${esc(m.id)}" data-logbook-title="${esc(m.logbook_title||m.activity_kind||'Logbook activity')}">Reject</button></div>`;
  if(status==='approved'&&m.admin_override){
    const by=m.override_by_name||'Admin';
    const original=m.override_original_name||'you';
    return `<div class="message-actions"><span class="tag success">Approved by ${esc(by)} in place of ${esc(original)}</span></div>`;
  }
  return `<div class="message-actions"><span class="tag ${status==='approved'?'success':'danger'}">${status==='approved'?'Approved':'Rejected'}</span></div>`;
}

function row(m){
  const sender=m.sender_name||m.resident_name||'Resident';
  const title=m.logbook_title||m.activity_kind||'Logbook activity';
  const status=String(m.request_status||'pending').toLowerCase();
  const overrideText=m.admin_override?`${m.override_by_name||'Admin'} approved in place of ${m.override_original_name||'assigned senior resident'} ${m.senior_note||''}`:'';
  const search=`${sender} ${m.receiver_name||''} ${m.subject||''} ${m.body||''} ${title} ${status} ${overrideText}`.toLowerCase();
  const heading=status==='approved'&&m.admin_override?`Approved on your behalf · ${title}`:`Approval request · ${title}`;
  return `<article class="message-row ${m.is_read?'read':'unread'}" data-senior-history-v224="1" data-request-resident="${esc(m.resident_id||m.sender_id||'')}" data-request-status="${esc(status)}" data-request-type="${esc(`${m.activity_category||''}:${m.activity_kind||''}`)}" data-message-search="${esc(search)}">
    <input class="message-select logbook-message-select" type="checkbox" value="${esc(m.id)}" aria-label="Select logbook message">
    <button class="message-open" data-message-id="${esc(m.id)}" data-message-box="logbook">
      <span class="message-person">From: ${esc(sender)}</span>
      <strong>${esc(heading)}</strong>
      <small>${esc(timeText(m.created_at))}</small>
    </button>
    ${statusMarkup(m)}
  </article>`;
}

function activate(panel,tab){
  document.querySelectorAll('[data-logbook-tab]').forEach(x=>x.classList.toggle('active',x===tab));
  document.querySelectorAll('[data-mail-panel]').forEach(x=>x.hidden=x!==panel);
  const search=$('#messageSearch');if(search){search.value='';search.dispatchEvent(new Event('input',{bubbles:true}))}
}

async function render(){
  if(!ready()||loading)return;
  const mailbox=$('#content .mailbox.wide-mailbox');
  if(!mailbox)return;
  const nativeReceived=mailbox.querySelector('[data-logbook-tab="received"]');
  if(nativeReceived){$('#seniorHistoryPanel224')?.remove();$('#seniorHistoryTab224')?.remove();return;}
  loading=true;
  try{
    const {data:sess}=await sb.auth.getSession();const uid=sess?.session?.user?.id;if(!uid)return;
    const {data:profile}=await sb.from('profiles').select('role').eq('id',uid).maybeSingle();if(profile?.role!=='resident')return;
    const rows=await history();
    if(!rows.length){$('#seniorHistoryPanel224')?.remove();$('#seniorHistoryTab224')?.remove();return;}
    if(!(window.logbookMessages instanceof Map))window.logbookMessages=new Map();
    rows.forEach(m=>{
      const detail={...m};
      if(m.admin_override){
        const by=m.override_by_name||'Admin';
        const original=m.override_original_name||'the assigned senior resident';
        detail.body=`${m.body||''}\n\nAdmin override: ${by} approved this senior-review stage in place of ${original}.`;
      }
      window.logbookMessages.set(`logbook-${m.id}`,detail);
    });
    $('#seniorNativeRequests204')?.remove();$('#seniorReq202')?.remove();
    const tabs=mailbox.querySelector('.mailbox-tabs');
    let tab=$('#seniorHistoryTab224');
    if(!tab){tab=document.createElement('button');tab.id='seniorHistoryTab224';tab.type='button';tab.className='mailbox-tab';tab.dataset.logbookTab='received';tabs.prepend(tab)}
    const pending=rows.filter(m=>String(m.request_status||'pending').toLowerCase()==='pending').length;
    tab.innerHTML=`Requests <span class="nav-badge inline-badge" ${pending?'':'hidden'}>${pending}</span>`;
    let panel=$('#seniorHistoryPanel224');
    if(!panel){panel=document.createElement('div');panel.id='seniorHistoryPanel224';panel.className='mail-panel';panel.dataset.mailPanel='received';const first=mailbox.querySelector('[data-mail-panel]');if(first)mailbox.insertBefore(panel,first);else mailbox.appendChild(panel)}
    panel.innerHTML=`<div class="message-list">${rows.map(row).join('')}</div>`;
    if(!activated){activated=true;activate(panel,tab)}
  }catch(err){console.error('Could not load senior request history',err)}finally{loading=false}
}

function arm(){activated=false;if(timer)clearInterval(timer);let n=0;timer=setInterval(()=>{n++;void render();if(n>=28){clearInterval(timer);timer=null}},250)}
window.addEventListener('hashchange',arm);
document.addEventListener('click',e=>{if(e.target.closest?.('[data-go="logbook-requests"]'))setTimeout(arm,80)},true);
arm();
