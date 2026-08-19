import { sb } from './supabase.js';

const $=(s,r=document)=>r.querySelector(s);
const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
let timer=null,loading=false,activated=false,historyPromise=null;

const route=()=>location.hash.replace(/^#/,'').split('?')[0];
const onPage=()=>route()==='logbook-requests';
const ready=()=>onPage()&&!!$('#content .mailbox.wide-mailbox .mailbox-tabs')&&!!$('#content .logbook-mail-tools');
const timeText=v=>{if(!v)return'—';try{return new Intl.DateTimeFormat('en-GB',{weekday:'short',day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}).format(new Date(v))}catch(_){return String(v)}};
const overrideName=m=>{
  const note=String(m?.senior_note||'');
  const match=note.match(/^(.+?)\s*\(in place of/i);
  const raw=match?.[1]?.trim()||m?.override_by_name||'Admin';
  return /^drmohamedalaa90$/i.test(raw)?'Dr. Mohamed Alaa':raw;
};

function removePriorSoon(){
  if(!onPage())return;
  document.querySelectorAll('#content section,#content .card,#content [data-feature-gate-ui="1"]').forEach(node=>{
    if(node.closest?.('.mailbox'))return;
    const text=String(node.textContent||'').replace(/\s+/g,' ').trim();
    if(/prior experience logbook/i.test(text)&&/coming soon|available soon|section will be available soon/i.test(text))node.remove();
  });
}

async function history(){
  const {data,error}=await sb.rpc('get_my_senior_logbook_request_history_v224');
  if(error)throw error;
  return data||[];
}

function prefetch(){
  if(!onPage())return null;
  if(!historyPromise)historyPromise=history().catch(error=>{console.error('Could not preload senior request history',error);return[]});
  return historyPromise;
}

function statusMarkup(m){
  const status=String(m.request_status||'pending').toLowerCase();
  if(status==='pending')return `<div class="message-actions approval-actions"><button class="btn small success-button" data-quick-logbook-approve="${esc(m.logbook_entry_id)}" data-approval-message-id="${esc(m.id)}">Approve</button><button class="btn small danger-button" data-inbox-logbook-reject="${esc(m.logbook_entry_id)}" data-approval-message-id="${esc(m.id)}" data-logbook-title="${esc(m.logbook_title||m.activity_kind||'Logbook activity')}">Reject</button></div>`;
  if(status==='approved'&&m.admin_override){
    const by=overrideName(m);
    const original=m.override_original_name||'you';
    return `<div class="message-actions"><span class="tag success">Approved by ${esc(by)} in place of ${esc(original)}</span></div>`;
  }
  return `<div class="message-actions"><span class="tag ${status==='approved'?'success':'danger'}">${status==='approved'?'Approved':'Rejected'}</span></div>`;
}

function row(m){
  const sender=m.sender_name||m.resident_name||'Resident';
  const title=m.logbook_title||m.activity_kind||'Logbook activity';
  const status=String(m.request_status||'pending').toLowerCase();
  const overrideText=m.admin_override?`${overrideName(m)} approved in place of ${m.override_original_name||'assigned senior resident'} ${m.senior_note||''}`:'';
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
  if(!onPage())return;
  removePriorSoon();
  if(!ready()||loading)return;
  const mailbox=$('#content .mailbox.wide-mailbox');
  if(!mailbox)return;
  const nativeReceived=[...mailbox.querySelectorAll('[data-logbook-tab="received"]')].find(x=>x.id!=='seniorHistoryTab224');
  if(nativeReceived){$('#seniorHistoryPanel224')?.remove();$('#seniorHistoryTab224')?.remove();return}
  loading=true;
  try{
    const rows=await(prefetch()||history());
    historyPromise=null;
    if(!onPage())return;
    removePriorSoon();
    if(!rows.length){$('#seniorHistoryPanel224')?.remove();$('#seniorHistoryTab224')?.remove();return}
    if(!(window.logbookMessages instanceof Map))window.logbookMessages=new Map();
    rows.forEach(m=>{
      const detail={...m};
      if(m.admin_override){
        const by=overrideName(m);
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

function arm(){
  activated=false;
  if(timer)clearInterval(timer);
  if(!onPage()){historyPromise=null;return}
  prefetch();
  removePriorSoon();
  void render();
  let n=0;
  timer=setInterval(()=>{n++;void render();if(n>=40){clearInterval(timer);timer=null}},100);
}

if(onPage())prefetch();
window.addEventListener('hashchange',arm);
document.addEventListener('click',e=>{
  if(e.target.closest?.('[data-go="logbook-requests"]'))setTimeout(()=>{prefetch();arm()},0);
},true);

const content=$('#content');
if(content)new MutationObserver(()=>{if(onPage()){removePriorSoon();void render()}}).observe(content,{childList:true,subtree:true});
arm();
