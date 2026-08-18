import { sb } from './supabase.js';

const $=(s,r=document)=>r.querySelector(s);
const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
let owner=false,busy=false,timer=null;

const fmt=v=>v?new Intl.DateTimeFormat('en-GB',{day:'2-digit',month:'2-digit',year:'numeric',hour:'numeric',minute:'2-digit',hour12:true}).format(new Date(v)):'—';
const durationLabel=v=>({'3_days':'3 days','1_week':'1 week','2_weeks':'2 weeks','1_month':'1 month','3_months':'3 months'})[v]||v;
const onPage=()=>owner && /resident logbooks/i.test($('#title')?.textContent||'') && !!$('.logbook-history-table');

function style(){if($('#adminLogbook206Style'))return;const s=document.createElement('style');s.id='adminLogbook206Style';s.textContent=`
.admin-logbook206-actions{display:flex;gap:6px;align-items:center;flex-wrap:wrap}.admin-logbook206-approve{background:#dff5e9!important;color:#066b42!important;border:1px solid #a9dfc2!important}.admin-logbook206-suspend{background:#fff3d8!important;color:#7b4c00!important;border:1px solid #efd18e!important}.admin-logbook206-overlay{position:fixed;inset:0;z-index:10050;background:rgba(5,20,38,.5);display:grid;place-items:center;padding:18px}.admin-logbook206-panel{width:min(720px,96vw);max-height:90vh;overflow:auto;background:#fff;border-radius:22px;box-shadow:0 24px 70px rgba(0,0,0,.25);padding:22px;color:#09233f}.admin-logbook206-head{display:flex;justify-content:space-between;gap:16px;align-items:flex-start}.admin-logbook206-head h2{margin:3px 0 4px}.admin-logbook206-close{border:0;background:#eef3f7;border-radius:10px;width:40px;height:40px;font-size:22px;cursor:pointer}.admin-logbook206-current{margin:16px 0;padding:14px;border-radius:14px;background:#fff5df;border:1px solid #efcf8b}.admin-logbook206-current.active{background:#fff0f1;border-color:#efb6bd}.admin-logbook206-form{display:grid;gap:12px;margin-top:16px}.admin-logbook206-form select,.admin-logbook206-form textarea{width:100%;border:1px solid #cbd9e6;border-radius:12px;padding:12px;font:inherit}.admin-logbook206-form textarea{min-height:90px;resize:vertical}.admin-logbook206-form .actions{display:flex;gap:10px;flex-wrap:wrap}.admin-logbook206-history{margin-top:22px}.admin-logbook206-history-list{display:grid;gap:9px}.admin-logbook206-history-row{border:1px solid #dce6ef;border-radius:12px;padding:12px;background:#fafcfe}.admin-logbook206-history-row b{display:block}.admin-logbook206-history-row small{display:block;margin-top:4px;color:#65768a}.admin-logbook206-history-row.active{border-color:#efb6bd;background:#fff6f7}
`;document.head.appendChild(s)}

function pendingStage(entry){
 if(!entry||String(entry.status)!=='pending')return null;
 if(entry.activity_category==='conference'&&String(entry.assessor_status||'pending')==='pending')return {stage:'assessor',name:entry.assessor_assigned_name||entry.assessor_name||'assigned assessor'};
 if(entry.activity_category==='manual_intervention'){
  if(entry.senior_resident_id&&String(entry.senior_status||'pending')==='pending')return {stage:'senior',name:entry.senior_assigned_name||entry.senior_resident_name||'assigned senior resident'};
  if(String(entry.senior_status||'approved')==='approved'&&String(entry.assessor_status||'pending')==='pending')return {stage:'assessor',name:entry.assessor_assigned_name||entry.assessor_name||'assigned assessor'};
 }
 return null;
}

function enhanceRows(){
 if(!onPage())return;
 document.querySelectorAll('.logbook-history-row').forEach(row=>{
  const details=row.querySelector('[data-logbook-detail]');if(!details)return;
  const id=String(details.dataset.logbookDetail||'');const entry=window.logbookEntryRows?.get?.(id);if(!entry)return;
  const cell=details.closest('td')||details.parentElement;let wrap=cell.querySelector('.admin-logbook206-actions');
  if(!wrap){wrap=document.createElement('div');wrap.className='admin-logbook206-actions';details.replaceWith(wrap);wrap.append(details)}
  const stage=pendingStage(entry);
  let approve=wrap.querySelector('[data-admin-logbook206-approve]');
  if(stage&&!approve){approve=document.createElement('button');approve.type='button';approve.className='btn small admin-logbook206-approve';approve.dataset.adminLogbook206Approve=id;approve.textContent='Admin approve';approve.title=`Approve ${stage.stage} stage in place of ${stage.name}`;wrap.prepend(approve)}
  if(!stage&&approve)approve.remove();
  if(!wrap.querySelector('[data-admin-logbook206-suspend]')){const b=document.createElement('button');b.type='button';b.className='btn small admin-logbook206-suspend';b.dataset.adminLogbook206Suspend=id;b.textContent='Suspend';wrap.insertBefore(b,details)}
 });
}

async function history(residentId){const {data,error}=await sb.rpc('owner_get_logbook_suspension_history_v206',{p_resident_id:residentId});if(error)throw error;return data||[]}

async function openSuspension(entry){
 document.querySelector('#adminLogbook206Overlay')?.remove();
 const rows=await history(entry.resident_id);const active=rows.find(r=>r.active);
 const el=document.createElement('div');el.id='adminLogbook206Overlay';el.className='admin-logbook206-overlay';
 el.innerHTML=`<section class="admin-logbook206-panel"><div class="admin-logbook206-head"><div><small>ADMIN · E-LOGBOOK CONTROL</small><h2>${esc(entry.resident_name||'Resident')}</h2><p>Suspend new E-logbook recording while keeping all existing entries and approval history unchanged.</p></div><button class="admin-logbook206-close" data-admin-logbook206-close>×</button></div>
 <div class="admin-logbook206-current ${active?'active':''}">${active?`<b>Currently suspended until ${esc(fmt(active.ends_at))}</b><span>${esc(active.reason||'No reason recorded')}</span>`:'<b>Not currently suspended</b><span>The resident can record new activities.</span>'}</div>
 <form class="admin-logbook206-form" data-admin-logbook206-form data-resident-id="${esc(entry.resident_id)}"><label><b>Suspension period</b><select name="duration" required><option value="3_days">3 days</option><option value="1_week">1 week</option><option value="2_weeks">2 weeks</option><option value="1_month">1 month</option><option value="3_months">3 months</option></select></label><label><b>Reason / note</b><textarea name="reason" placeholder="Optional reason shown to the resident"></textarea></label><div class="actions"><button class="btn danger" type="submit">Suspend E-logbook recording</button>${active?'<button class="btn secondary" type="button" data-admin-logbook206-lift>End current suspension now</button>':''}</div></form>
 <section class="admin-logbook206-history"><h3>Previous suspension history</h3><div class="admin-logbook206-history-list">${rows.length?rows.map(r=>`<div class="admin-logbook206-history-row ${r.active?'active':''}"><b>${esc(durationLabel(r.duration_code))} · ${esc(fmt(r.started_at))} → ${esc(fmt(r.ends_at))}</b><small>${r.active?'ACTIVE':r.lifted_at?`Ended early ${fmt(r.lifted_at)}`:'Completed'} · ${esc(r.reason||'No reason recorded')} · by ${esc(r.imposed_by_name||'Admin')}</small></div>`).join(''):'<div class="admin-logbook206-history-row"><b>No previous suspensions</b></div>'}</div></section></section>`;
 document.body.appendChild(el);
}

async function doApprove(id,button){const entry=window.logbookEntryRows?.get?.(String(id));const stage=pendingStage(entry);if(!entry||!stage)return;if(!confirm(`Approve this ${stage.stage} stage as Dr. Mohamed Alaa in place of ${stage.name}?`))return;button.disabled=true;try{const {data,error}=await sb.rpc('owner_approve_logbook_on_behalf_v206',{p_entry_id:id});if(error)throw error;alert(`${data?.display||'Dr. Mohamed Alaa'} approved the ${data?.stage||stage.stage} stage.`);location.reload()}catch(e){alert(e?.message||String(e));button.disabled=false}}

document.addEventListener('click',async e=>{
 const ap=e.target.closest?.('[data-admin-logbook206-approve]');if(ap){e.preventDefault();e.stopPropagation();return void doApprove(ap.dataset.adminLogbook206Approve,ap)}
 const sp=e.target.closest?.('[data-admin-logbook206-suspend]');if(sp){e.preventDefault();e.stopPropagation();const entry=window.logbookEntryRows?.get?.(String(sp.dataset.adminLogbook206Suspend));if(entry)try{await openSuspension(entry)}catch(err){alert(err?.message||String(err))}return}
 if(e.target.closest?.('[data-admin-logbook206-close]')||e.target.id==='adminLogbook206Overlay')document.querySelector('#adminLogbook206Overlay')?.remove();
 const lift=e.target.closest?.('[data-admin-logbook206-lift]');if(lift){const form=lift.closest('[data-admin-logbook206-form]');if(!confirm('End this resident’s current E-logbook suspension now?'))return;lift.disabled=true;const {error}=await sb.rpc('owner_lift_logbook_suspension_v206',{p_resident_id:form.dataset.residentId});if(error){alert(error.message);lift.disabled=false;return}const entry=[...window.logbookEntryRows.values()].find(x=>String(x.resident_id)===String(form.dataset.residentId));if(entry)await openSuspension(entry)}
},true);

document.addEventListener('submit',async e=>{const form=e.target.closest?.('[data-admin-logbook206-form]');if(!form)return;e.preventDefault();const fd=new FormData(form);const btn=form.querySelector('button[type="submit"]');btn.disabled=true;try{const {error}=await sb.rpc('owner_suspend_logbook_recording_v206',{p_resident_id:form.dataset.residentId,p_duration_code:String(fd.get('duration')),p_reason:String(fd.get('reason')||'')||null});if(error)throw error;const entry=[...window.logbookEntryRows.values()].find(x=>String(x.resident_id)===String(form.dataset.residentId));if(entry)await openSuspension(entry)}catch(err){alert(err?.message||String(err));btn.disabled=false}},true);

async function init(){try{const {data:s}=await sb.auth.getSession();const uid=s?.session?.user?.id;if(!uid)return;const {data:p}=await sb.from('profiles').select('role').eq('id',uid).maybeSingle();owner=p?.role==='owner';if(!owner)return;style();arm()}catch(_){}}
function arm(){if(timer)clearInterval(timer);let n=0;enhanceRows();timer=setInterval(()=>{n++;enhanceRows();if(n>=30){clearInterval(timer);timer=null}},300)}
window.addEventListener('hashchange',()=>setTimeout(arm,100));document.addEventListener('click',e=>{if(e.target.closest?.('[data-go="logbook"]'))setTimeout(arm,100)},true);init();
