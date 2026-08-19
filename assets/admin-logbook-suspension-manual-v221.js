import { sb } from './supabase.js';

const $=(s,r=document)=>r.querySelector(s);
const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#39;'}[m]));
const fmt=v=>v?new Intl.DateTimeFormat('en-GB',{day:'2-digit',month:'2-digit',year:'numeric',hour:'numeric',minute:'2-digit',hour12:true}).format(new Date(v)):'—';
let owner=false,observer=null,pendingAction=null,managerOverlay=null,managerLocked=false;

function ensureStyle(){
 if($('#manualSuspension222Style'))return;
 const s=document.createElement('style');s.id='manualSuspension222Style';s.textContent=`
 #logbookSuspensionWindow218 .logbook-suspension-table thead tr th,
 #logbookSuspensionWindow218 .logbook-suspension-table thead th,
 .admin-red-theme #logbookSuspensionWindow218 .logbook-suspension-table thead th,
 body.admin-red-theme #logbookSuspensionWindow218 .logbook-suspension-table thead th{
   color:#fff!important;
   -webkit-text-fill-color:#fff!important;
   text-shadow:none!important;
 }
 #logbookSuspensionWindow218 .logbook-suspension-table thead th *{color:#fff!important;-webkit-text-fill-color:#fff!important}
 .manual-suspension221-tools{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
 .manual-suspension221-btn{background:#9a1e2f!important;color:#fff!important;border-color:#9a1e2f!important;font-weight:800!important}
 .manual-suspension221-overlay{position:fixed;inset:0;z-index:10080;background:rgba(5,20,38,.55);display:grid;place-items:center;padding:18px}
 .manual-suspension221-panel{width:min(650px,96vw);max-height:92vh;overflow:auto;background:#fff;border-radius:22px;box-shadow:0 24px 70px rgba(0,0,0,.28);padding:22px;color:#09233f}
 .manual-suspension221-head{display:flex;justify-content:space-between;gap:16px;align-items:flex-start}.manual-suspension221-head h2{margin:3px 0 4px}.manual-suspension221-head p{margin:5px 0 0;color:#64748b}
 .manual-suspension221-close{border:0;background:#eef3f7;border-radius:10px;width:40px;height:40px;font-size:22px;cursor:pointer}
 .manual-suspension221-form{display:grid;gap:13px;margin-top:18px}.manual-suspension221-form label{display:grid;gap:6px}
 .manual-suspension221-form select,.manual-suspension221-form textarea{width:100%;border:1px solid #cbd9e6;border-radius:12px;padding:12px;font:inherit;background:#fff;color:#09233f}
 .manual-suspension221-form textarea{min-height:82px;resize:vertical}
 .manual-suspension221-status{padding:12px 14px;border:1px solid #dce6ef;border-radius:13px;background:#f8fbfd}.manual-suspension221-status.active{background:#fff1f2;border-color:#efb7bd;color:#7f1d2d}.manual-suspension221-status span{display:block;margin-top:3px}
 .manual-suspension221-actions{display:flex;gap:10px;flex-wrap:wrap}.manual-suspension221-remove{background:#fff!important;color:#8a1f2c!important;border:1px solid #d99aa3!important;font-weight:800!important}
 .manual-suspension221-confirm{display:none;margin-top:2px;padding:14px;border-radius:14px;border:1px solid #e5c3c8;background:#fff6f7}.manual-suspension221-confirm.show{display:block}.manual-suspension221-confirm b{display:block;color:#7f1d2d;font-size:1rem}.manual-suspension221-confirm p{margin:6px 0 12px;color:#4b5563}.manual-suspension221-confirm-actions{display:flex;gap:9px;flex-wrap:wrap}.manual-suspension221-confirm-ok{background:#9a1e2f!important;color:#fff!important;border-color:#9a1e2f!important;font-weight:800!important}
 .manual-suspension221-feedback{display:none;padding:11px 13px;border-radius:12px;font-weight:750}.manual-suspension221-feedback.show{display:block}.manual-suspension221-feedback.success{background:#eaf8ef;border:1px solid #b8e2c8;color:#166534}.manual-suspension221-feedback.error{background:#fff1f2;border:1px solid #fecdd3;color:#9f1239}
 `;document.head.appendChild(s)
}

const onPage=()=>owner&&/resident logbooks/i.test($('#title')?.textContent||'')&&!!$('#logbookSuspensionWindow218');

async function residents(){
 const {data,error}=await sb.from('profiles').select('id,display_name,username,residency_year').eq('role','resident').eq('is_active',true).order('residency_year',{ascending:true}).order('display_name',{ascending:true});
 if(error)throw error;
 return data||[];
}
async function history(id){const {data,error}=await sb.rpc('owner_get_logbook_suspension_history_v206',{p_resident_id:id});if(error)throw error;return data||[]}

function injectButton(){
 ensureStyle();
 if(!onPage())return;
 const head=$('#logbookSuspensionWindow218 .logbook-suspension-head');if(!head)return;
 let tools=head.querySelector('.manual-suspension221-tools');
 if(!tools){
  const refresh=head.querySelector('[data-logbook-suspension-refresh]');
  tools=document.createElement('div');tools.className='manual-suspension221-tools';
  const btn=document.createElement('button');btn.type='button';btn.className='btn small manual-suspension221-btn';btn.dataset.manualSuspension221Open='1';btn.textContent='Suspend resident';
  tools.appendChild(btn);if(refresh)tools.appendChild(refresh);head.appendChild(tools);
 }else if(!tools.querySelector('[data-manual-suspension221-open]')){
  const btn=document.createElement('button');btn.type='button';btn.className='btn small manual-suspension221-btn';btn.dataset.manualSuspension221Open='1';btn.textContent='Suspend resident';tools.prepend(btn);
 }
}

function showFeedback(form,message,type='success'){
 const box=form.querySelector('[data-manual-suspension221-feedback]');
 if(!box)return;
 box.className=`manual-suspension221-feedback show ${type}`;
 box.textContent=message;
}
function clearFeedback(form){const box=form.querySelector('[data-manual-suspension221-feedback]');if(box){box.className='manual-suspension221-feedback';box.textContent=''}}
function hideConfirm(form){pendingAction=null;const box=form.querySelector('[data-manual-suspension221-confirm]');if(box){box.classList.remove('show');box.querySelector('[data-manual-suspension221-confirm-text]').textContent=''}}
function showConfirm(form,action,message){
 pendingAction=action;clearFeedback(form);
 const box=form.querySelector('[data-manual-suspension221-confirm]');if(!box)return;
 box.querySelector('[data-manual-suspension221-confirm-text]').textContent=message;
 box.classList.add('show');box.scrollIntoView({block:'nearest',behavior:'smooth'});
}

function closeManager(){
 managerLocked=false;
 pendingAction=null;
 const overlay=managerOverlay||document.querySelector('#manualSuspension221Overlay');
 managerOverlay=null;
 overlay?.remove();
}

async function openManager(){
 ensureStyle();pendingAction=null;
 managerLocked=false;
 document.querySelector('#manualSuspension221Overlay')?.remove();
 const list=await residents();
 const el=document.createElement('div');el.id='manualSuspension221Overlay';el.className='manual-suspension221-overlay';
 const options=list.map(r=>`<option value="${esc(r.id)}">${esc(r.display_name||r.username||'Resident')}${r.residency_year?` · Year ${esc(r.residency_year)}`:''}</option>`).join('');
 el.innerHTML=`<section class="manual-suspension221-panel"><div class="manual-suspension221-head"><div><small>ADMIN · E-LOGBOOK SUSPENSION</small><h2>Suspend / remove suspension</h2><p>Choose the resident and duration. Confirmation stays inside this window and the suspension list updates immediately.</p></div><button class="manual-suspension221-close" type="button" data-manual-suspension221-close>×</button></div><form class="manual-suspension221-form" data-manual-suspension221-form><label><b>Resident</b><select name="resident" required><option value="">Choose resident…</option>${options}</select></label><div class="manual-suspension221-status" data-manual-suspension221-status><b>Select a resident</b><span>The current suspension status will appear here.</span></div><label><b>Suspension duration</b><select name="duration" required><option value="3_days">3 days</option><option value="1_week">1 week</option><option value="2_weeks">2 weeks</option><option value="1_month">1 month</option><option value="3_months">3 months</option></select></label><label><b>Reason / note</b><textarea name="reason">Delayed response to a junior resident logbook request for more than 48 hours.</textarea></label><div class="manual-suspension221-feedback" data-manual-suspension221-feedback></div><div class="manual-suspension221-confirm" data-manual-suspension221-confirm><b>Confirm action</b><p data-manual-suspension221-confirm-text></p><div class="manual-suspension221-confirm-actions"><button class="btn manual-suspension221-confirm-ok" type="button" data-manual-suspension221-confirm-ok>Confirm</button><button class="btn secondary" type="button" data-manual-suspension221-confirm-cancel>Cancel</button></div></div><div class="manual-suspension221-actions"><button class="btn danger" type="submit">Suspend</button><button class="btn manual-suspension221-remove" type="button" data-manual-suspension221-remove hidden>Remove suspension</button></div></form></section>`;
 managerOverlay=el;
 managerLocked=true;
 document.body.appendChild(el);
}

async function refreshSelected(form){
 const id=String(form.elements.resident.value||'');const status=form.querySelector('[data-manual-suspension221-status]');const remove=form.querySelector('[data-manual-suspension221-remove]');
 remove.hidden=true;remove.dataset.residentId='';hideConfirm(form);
 if(!id){status.className='manual-suspension221-status';status.innerHTML='<b>Select a resident</b><span>The current suspension status will appear here.</span>';return}
 status.className='manual-suspension221-status';status.innerHTML='<b>Checking…</b>';
 try{const rows=await history(id);const active=rows.find(r=>r.active);if(active){status.className='manual-suspension221-status active';status.innerHTML=`<b>Currently suspended</b><span>Until ${esc(fmt(active.ends_at))}${active.reason?` · ${esc(active.reason)}`:''}</span>`;remove.hidden=false;remove.dataset.residentId=id}else{status.className='manual-suspension221-status';status.innerHTML='<b>Not currently suspended</b><span>You can choose a duration and suspend this resident.</span>'}}catch(err){status.innerHTML=`<b>Could not load status</b><span>${esc(err?.message||String(err))}</span>`}
}

function refreshMain(){
 const refresh=document.querySelector('[data-logbook-suspension-refresh]');
 if(refresh){
  refresh.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true}));
  setTimeout(()=>refresh.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true})),350);
 }
 setTimeout(injectButton,500);
}

async function executePending(form,button){
 const action=pendingAction;if(!action)return;
 button.disabled=true;
 try{
  if(action.type==='suspend'){
   const {error}=await sb.rpc('owner_suspend_logbook_recording_v206',{p_resident_id:action.id,p_duration_code:action.duration,p_reason:action.reason||null});
   if(error)throw error;
   await refreshSelected(form);showFeedback(form,`${action.name} is now suspended. The suspension list has been updated.`,'success');refreshMain();
  }else if(action.type==='remove'){
   const {data,error}=await sb.rpc('owner_lift_logbook_suspension_v206',{p_resident_id:action.id});
   if(error)throw error;
   await refreshSelected(form);showFeedback(form,data?`Suspension removed for ${action.name}. The suspension list has been updated.`:'No active suspension was found.','success');refreshMain();
  }
  pendingAction=null;
 }catch(err){showFeedback(form,err?.message||String(err),'error')}
 finally{button.disabled=false;hideConfirm(form)}
}

document.addEventListener('click',async e=>{
 const open=e.target.closest?.('[data-manual-suspension221-open]');if(open){e.preventDefault();e.stopPropagation();try{await openManager()}catch(err){console.error(err)}return}
 if(e.target.closest?.('[data-manual-suspension221-close]')){e.preventDefault();e.stopPropagation();closeManager();return}
 if(e.target.id==='manualSuspension221Overlay'){e.preventDefault();e.stopPropagation();return}
 const cancel=e.target.closest?.('[data-manual-suspension221-confirm-cancel]');if(cancel){const form=cancel.closest('[data-manual-suspension221-form]');hideConfirm(form);return}
 const ok=e.target.closest?.('[data-manual-suspension221-confirm-ok]');if(ok){const form=ok.closest('[data-manual-suspension221-form]');await executePending(form,ok);return}
 const remove=e.target.closest?.('[data-manual-suspension221-remove]');if(remove){const form=remove.closest('[data-manual-suspension221-form]');const id=remove.dataset.residentId||form?.elements.resident.value;if(!id)return;const name=form.elements.resident.selectedOptions[0]?.textContent||'this resident';showConfirm(form,{type:'remove',id,name},`Remove the current E-logbook suspension for ${name}?`);return}
},true);

document.addEventListener('change',e=>{const sel=e.target.closest?.('[data-manual-suspension221-form] select[name="resident"]');if(sel){clearFeedback(sel.form);void refreshSelected(sel.form)}},true);

document.addEventListener('submit',e=>{
 const form=e.target.closest?.('[data-manual-suspension221-form]');if(!form)return;e.preventDefault();
 const id=String(form.elements.resident.value||'');if(!id){showFeedback(form,'Choose a resident first.','error');return}
 const name=form.elements.resident.selectedOptions[0]?.textContent||'this resident';
 const duration=String(form.elements.duration.value||'');const reason=String(form.elements.reason.value||'');
 showConfirm(form,{type:'suspend',id,name,duration,reason},`Suspend E-logbook recording for ${name} for ${form.elements.duration.selectedOptions[0]?.textContent||duration}?`);
},true);

function arm(){
 ensureStyle();injectButton();if(observer)return;
 observer=new MutationObserver(()=>{
  ensureStyle();
  if(managerLocked&&managerOverlay&&!managerOverlay.isConnected)document.body.appendChild(managerOverlay);
  injectButton();
 });
 observer.observe(document.body,{childList:true,subtree:true});
}
async function init(){try{const {data:s}=await sb.auth.getSession();const uid=s?.session?.user?.id;if(!uid)return;const {data:p}=await sb.from('profiles').select('role').eq('id',uid).maybeSingle();owner=p?.role==='owner';if(owner)arm()}catch(_){}}
window.addEventListener('hashchange',()=>{closeManager();setTimeout(injectButton,200)});init();
