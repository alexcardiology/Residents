import { sb } from './supabase.js';

const $=(s,r=document)=>r.querySelector(s);
const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
let owner=false,timer=null,loadingWindow=false;

const fmt=v=>v?new Intl.DateTimeFormat('en-GB',{day:'2-digit',month:'2-digit',year:'numeric',hour:'numeric',minute:'2-digit',hour12:true}).format(new Date(v)):'—';
const fmtDay=v=>v?new Intl.DateTimeFormat('en-GB',{day:'2-digit',month:'2-digit',year:'numeric'}).format(new Date(v)):'—';
const durationLabel=v=>({'3_days':'3 days','1_week':'1 week','2_weeks':'2 weeks','1_month':'1 month','3_months':'3 months'})[v]||v;
const onPage=()=>owner && /resident logbooks/i.test($('#title')?.textContent||'') && !!$('.logbook-history-table');

function style(){
 if($('#adminLogbook206Style'))return;
 const s=document.createElement('style');s.id='adminLogbook206Style';s.textContent=`
 .admin-logbook206-actions{display:flex;gap:6px;align-items:center;flex-wrap:wrap}.admin-logbook206-approve{background:#dff5e9!important;color:#111!important;border:1px solid #a9dfc2!important}
 .logbook-suspension-window{margin:14px 0;border:1px solid #e2c68b!important;background:linear-gradient(180deg,#fffdf7,#fffaf0)!important;box-shadow:0 8px 26px rgba(96,62,5,.08)!important}.logbook-suspension-head{display:flex;justify-content:space-between;gap:18px;align-items:center;padding:16px 18px}.logbook-suspension-head h3{margin:2px 0 4px;color:#4b2d08}.logbook-suspension-head p{margin:0;color:#6b5a43}.logbook-suspension-head small{font-weight:800;letter-spacing:.08em;color:#9a6500}.logbook-suspension-badge{display:inline-grid;place-items:center;min-width:28px;height:28px;padding:0 8px;margin-left:7px;border-radius:999px;background:#8b5a00;color:#fff;font-size:12px}.logbook-suspension-body{border-top:1px solid #ead9b1;padding:0 14px 14px;overflow:auto}.logbook-suspension-table{width:100%;border-collapse:collapse;min-width:900px}.logbook-suspension-table th{padding:8px 7px;font-size:10px;text-transform:uppercase;letter-spacing:.035em;text-align:left;color:#6f552e;border-bottom:1px solid #e6d5ad;background:transparent}.logbook-suspension-table td{padding:9px 7px;border-bottom:1px solid #eee2c6;vertical-align:middle;color:#172b40}.logbook-suspension-table tbody tr:last-child td{border-bottom:0}.logbook-suspension-name b{display:block}.logbook-suspension-name small,.logbook-suspension-muted{display:block;margin-top:2px;color:#68788b}.logbook-suspension-status{display:inline-flex;align-items:center;padding:5px 8px;border-radius:999px;font-weight:800;font-size:11px}.logbook-suspension-status.active{background:#fde7e8;color:#8a1f2c}.logbook-suspension-status.overdue{background:#fff0cc;color:#815500}.logbook-suspension-action{white-space:nowrap}.logbook-suspension-action .btn{margin:2px}.logbook-suspension-empty{padding:18px;text-align:center;color:#68788b}.logbook-suspension-refresh{white-space:nowrap}
 .admin-logbook206-overlay{position:fixed;inset:0;z-index:10050;background:rgba(5,20,38,.52);display:grid;place-items:center;padding:18px}.admin-logbook206-panel{width:min(720px,96vw);max-height:90vh;overflow:auto;background:#fff;border-radius:22px;box-shadow:0 24px 70px rgba(0,0,0,.25);padding:22px;color:#09233f}.admin-logbook206-head{display:flex;justify-content:space-between;gap:16px;align-items:flex-start}.admin-logbook206-head h2{margin:3px 0 4px}.admin-logbook206-close{border:0;background:#eef3f7;border-radius:10px;width:40px;height:40px;font-size:22px;cursor:pointer}.admin-logbook206-current{margin:16px 0;padding:14px;border-radius:14px;background:#fff5df;border:1px solid #efcf8b}.admin-logbook206-current span{display:block;margin-top:4px}.admin-logbook206-current.active{background:#fff0f1;border-color:#efb6bd}.admin-logbook206-form{display:grid;gap:12px;margin-top:16px}.admin-logbook206-form select,.admin-logbook206-form textarea{width:100%;border:1px solid #cbd9e6;border-radius:12px;padding:12px;font:inherit}.admin-logbook206-form textarea{min-height:90px;resize:vertical}.admin-logbook206-form .actions{display:flex;gap:10px;flex-wrap:wrap}.admin-logbook206-history{margin-top:22px}.admin-logbook206-history-list{display:grid;gap:9px}.admin-logbook206-history-row{border:1px solid #dce6ef;border-radius:12px;padding:12px;background:#fafcfe}.admin-logbook206-history-row b{display:block}.admin-logbook206-history-row small{display:block;margin-top:4px;color:#65768a}.admin-logbook206-history-row.active{border-color:#efb6bd;background:#fff6f7}
 @media(max-width:800px){.logbook-suspension-head{align-items:flex-start;flex-direction:column}.logbook-suspension-body{padding-left:8px;padding-right:8px}}
 `;document.head.appendChild(s)
}

function enhanceRows(){
 if(!onPage())return;
 document.querySelectorAll('.logbook-history-row').forEach(row=>{
  const details=row.querySelector('[data-logbook-detail]');if(!details)return;
  const id=String(details.dataset.logbookDetail||'');const entry=window.logbookEntryRows?.get?.(id);if(!entry)return;
  row.querySelectorAll('.admin-logbook206-actions').forEach(x=>x.remove());
  if(entry.activity_category!=='manual_intervention'||!entry.senior_resident_id||String(entry.senior_status||'pending')!=='pending')return;
  const created=new Date(entry.created_at||entry.activity_date);if(!created||!Number.isFinite(created.getTime())||Date.now()-created.getTime()<=48*60*60*1000)return;
  const seniorCell=[...row.querySelectorAll('td')].find(td=>td.dataset.label==='Senior')||row.children[6];if(!seniorCell)return;
  const wrap=document.createElement('div');wrap.className='admin-logbook206-actions';
  const approve=document.createElement('button');approve.type='button';approve.className='btn small admin-logbook206-approve';approve.dataset.adminLogbook206Approve=id;approve.textContent='Admin approve';approve.style.color='#111';
  wrap.append(approve);seniorCell.append(wrap);
 });
}

async function candidates(){
 const {data,error}=await sb.rpc('owner_list_logbook_suspension_candidates_v218');
 if(error)throw error;
 return data||[];
}
async function history(residentId){const {data,error}=await sb.rpc('owner_get_logbook_suspension_history_v206',{p_resident_id:residentId});if(error)throw error;return data||[]}

function suspensionAnchor(){
 const table=$('.logbook-history-table');
 if(!table)return null;
 return table.closest('.card')||table;
}

async function renderSuspensionWindow(force=false){
 if(!onPage()||loadingWindow)return;
 let card=$('#logbookSuspensionWindow218');
 if(card&&!force)return;
 loadingWindow=true;
 try{
  const rows=await candidates();
  if(!onPage())return;
  card=$('#logbookSuspensionWindow218');
  if(!card){
   card=document.createElement('section');card.id='logbookSuspensionWindow218';card.className='card logbook-suspension-window';
   const anchor=suspensionAnchor();if(!anchor?.parentNode)return;anchor.parentNode.insertBefore(card,anchor);
  }
  const overdueCount=rows.filter(r=>Number(r.overdue_count)>0).length,activeCount=rows.filter(r=>r.active).length;
  card.innerHTML=`<div class="logbook-suspension-head"><div><small>OVERDUE SENIOR RESPONSES</small><h3>Suspension window <span class="logbook-suspension-badge">${rows.length}</span></h3><p>Suspend only the senior resident who delayed a junior logbook reply for more than 48 hours. Active suspensions stay here until they expire or you remove them.</p></div><button class="btn secondary small logbook-suspension-refresh" type="button" data-logbook-suspension-refresh>Refresh · ${overdueCount} overdue · ${activeCount} active</button></div><div class="logbook-suspension-body">${rows.length?`<table class="logbook-suspension-table"><thead><tr><th>Senior resident</th><th>Year</th><th>Waiting junior</th><th>Intervention</th><th>Request date</th><th>Delay</th><th>Status</th><th>Action</th></tr></thead><tbody>${rows.map(r=>`<tr><td class="logbook-suspension-name"><b>${esc(r.senior_name||'Resident')}</b><small>${Number(r.overdue_count)||0} overdue request${Number(r.overdue_count)===1?'':'s'}</small></td><td>${r.senior_year?`Year ${esc(r.senior_year)}`:'—'}</td><td>${r.junior_id?`<b>${esc(r.junior_name||'Resident')}</b><span class="logbook-suspension-muted">${r.junior_year?`Year ${esc(r.junior_year)}`:''}</span>`:'—'}</td><td>${esc(r.intervention||'—')}</td><td>${r.request_created_at?esc(fmtDay(r.request_created_at)):'—'}</td><td>${r.delay_hours!=null?`<b>${esc(r.delay_hours)} h</b>`:'—'}</td><td>${r.active?`<span class="logbook-suspension-status active">Suspended</span><span class="logbook-suspension-muted">until ${esc(fmt(r.suspension_ends_at))}</span>`:`<span class="logbook-suspension-status overdue">Overdue</span>`}</td><td class="logbook-suspension-action">${r.active?`<button class="btn secondary small" type="button" data-logbook-suspension-lift="${esc(r.senior_id)}" data-name="${esc(r.senior_name||'Resident')}">Remove suspension</button>`:`<button class="btn danger small" type="button" data-logbook-suspension-open="${esc(r.senior_id)}" data-name="${esc(r.senior_name||'Resident')}">Suspend</button>`}</td></tr>`).join('')}</tbody></table>`:'<div class="logbook-suspension-empty">No senior response is overdue by more than 48 hours and there are no active suspensions.</div>'}</div>`;
 }catch(err){
  console.warn('Suspension window could not load',err);
 }finally{loadingWindow=false}
}

async function openSuspension(residentId,residentName){
 document.querySelector('#adminLogbook206Overlay')?.remove();
 const rows=await history(residentId);const active=rows.find(r=>r.active);
 const el=document.createElement('div');el.id='adminLogbook206Overlay';el.className='admin-logbook206-overlay';
 el.innerHTML=`<section class="admin-logbook206-panel"><div class="admin-logbook206-head"><div><small>ADMIN · E-LOGBOOK SUSPENSION</small><h2>${esc(residentName||'Senior resident')}</h2><p>This action blocks this senior resident from recording new E-logbook activity. It does not suspend the junior resident who submitted the request.</p></div><button class="admin-logbook206-close" data-admin-logbook206-close>×</button></div><div class="admin-logbook206-current ${active?'active':''}">${active?`<b>Currently suspended until ${esc(fmt(active.ends_at))}</b><span>${esc(active.reason||'No reason recorded')}</span>`:'<b>Not currently suspended</b><span>Choose a duration below.</span>'}</div><form class="admin-logbook206-form" data-admin-logbook206-form data-resident-id="${esc(residentId)}"><label><b>Suspension period</b><select name="duration" required><option value="3_days">3 days</option><option value="1_week">1 week</option><option value="2_weeks">2 weeks</option><option value="1_month">1 month</option><option value="3_months">3 months</option></select></label><label><b>Reason / note</b><textarea name="reason">Delayed response to a junior resident logbook request for more than 48 hours.</textarea></label><div class="actions"><button class="btn danger" type="submit">Suspend senior E-logbook recording</button>${active?'<button class="btn secondary" type="button" data-admin-logbook206-lift>Remove current suspension</button>':''}</div></form><section class="admin-logbook206-history"><h3>Suspension history</h3><div class="admin-logbook206-history-list">${rows.length?rows.map(r=>`<div class="admin-logbook206-history-row ${r.active?'active':''}"><b>${esc(durationLabel(r.duration_code))} · ${esc(fmt(r.started_at))} → ${esc(fmt(r.ends_at))}</b><small>${r.active?'ACTIVE':r.lifted_at?`Ended early ${fmt(r.lifted_at)}`:'Completed'} · ${esc(r.reason||'No reason recorded')} · by ${esc(r.imposed_by_name||'Admin')}</small></div>`).join(''):'<div class="admin-logbook206-history-row"><b>No previous suspensions</b></div>'}</div></section></section>`;
 document.body.appendChild(el);
}

async function doApprove(id,button){
 const entry=window.logbookEntryRows?.get?.(String(id));if(!entry)return;
 if(!confirm(`Approve this overdue senior-resident stage as Dr. Mohamed Alaa in place of ${entry.senior_resident_name||'the assigned senior resident'}?`))return;
 button.disabled=true;
 try{const {data,error}=await sb.rpc('owner_approve_logbook_on_behalf_v206',{p_entry_id:id});if(error)throw error;alert(`${data?.display||'Dr. Mohamed Alaa'} approved the overdue senior stage.`);location.reload()}catch(e){alert(e?.message||String(e));button.disabled=false}
}

async function liftSuspension(residentId,residentName,button){
 if(!confirm(`Remove the current E-logbook suspension for ${residentName||'this resident'}?`))return;
 if(button)button.disabled=true;
 try{const {data,error}=await sb.rpc('owner_lift_logbook_suspension_v206',{p_resident_id:residentId});if(error)throw error;if(!data)alert('No active suspension was found.');document.querySelector('#adminLogbook206Overlay')?.remove();await renderSuspensionWindow(true)}catch(err){alert(err?.message||String(err));if(button)button.disabled=false}
}

document.addEventListener('click',async e=>{
 const ap=e.target.closest?.('[data-admin-logbook206-approve]');if(ap){e.preventDefault();e.stopPropagation();return void doApprove(ap.dataset.adminLogbook206Approve,ap)}
 const open=e.target.closest?.('[data-logbook-suspension-open]');if(open){e.preventDefault();e.stopPropagation();try{await openSuspension(open.dataset.logbookSuspensionOpen,open.dataset.name)}catch(err){alert(err?.message||String(err))}return}
 const lift=e.target.closest?.('[data-logbook-suspension-lift]');if(lift){e.preventDefault();e.stopPropagation();return void liftSuspension(lift.dataset.logbookSuspensionLift,lift.dataset.name,lift)}
 const refresh=e.target.closest?.('[data-logbook-suspension-refresh]');if(refresh){e.preventDefault();return void renderSuspensionWindow(true)}
 if(e.target.closest?.('[data-admin-logbook206-close]')||e.target.id==='adminLogbook206Overlay'){document.querySelector('#adminLogbook206Overlay')?.remove();return}
 const modalLift=e.target.closest?.('[data-admin-logbook206-lift]');if(modalLift){const form=modalLift.closest('[data-admin-logbook206-form]');return void liftSuspension(form.dataset.residentId,'this resident',modalLift)}
},true);

document.addEventListener('submit',async e=>{
 const form=e.target.closest?.('[data-admin-logbook206-form]');if(!form)return;
 e.preventDefault();const fd=new FormData(form),btn=form.querySelector('button[type="submit"]');btn.disabled=true;
 try{const {error}=await sb.rpc('owner_suspend_logbook_recording_v206',{p_resident_id:form.dataset.residentId,p_duration_code:String(fd.get('duration')),p_reason:String(fd.get('reason')||'')||null});if(error)throw error;document.querySelector('#adminLogbook206Overlay')?.remove();alert('Senior resident E-logbook recording suspended.');await renderSuspensionWindow(true)}catch(err){alert(err?.message||String(err));btn.disabled=false}
},true);

async function init(){
 try{const {data:s}=await sb.auth.getSession(),uid=s?.session?.user?.id;if(!uid)return;const {data:p}=await sb.from('profiles').select('role').eq('id',uid).maybeSingle();owner=p?.role==='owner';if(!owner)return;style();arm()}catch(_){}
}
function arm(){
 if(timer)clearInterval(timer);let n=0;
 const tick=()=>{n++;enhanceRows();void renderSuspensionWindow();if(n>=35&&timer){clearInterval(timer);timer=null}};
 tick();timer=setInterval(tick,300);
}
window.addEventListener('hashchange',()=>setTimeout(arm,120));
document.addEventListener('click',e=>{if(e.target.closest?.('[data-go="logbook"]'))setTimeout(arm,120)},true);
init();
