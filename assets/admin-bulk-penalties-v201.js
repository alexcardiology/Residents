import { sb } from './supabase.js';

const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const rpc=async(name,args={})=>{const{data,error}=await sb.rpc(name,args);if(error)throw error;return data};
let timer=null, enhancePromise=null;

function styles(){if($('#bulkPen201Style'))return;const s=document.createElement('style');s.id='bulkPen201Style';s.textContent=`
.bulkpen-panel{display:grid;gap:16px}.bulkpen-card{border:1px solid #ead6da;border-radius:18px;padding:18px;background:#fff}.bulkpen-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}.bulkpen-head h2{margin:0}.bulkpen-head p{margin:5px 0 0;color:#725f65}.bulkpen-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin-top:14px}.bulkpen-grid label{display:grid;gap:6px;font-size:.8rem;font-weight:850}.bulkpen-grid label.full{grid-column:1/-1}.bulkpen-grid input,.bulkpen-grid textarea,.bulkpen-search{width:100%;box-sizing:border-box;border:1px solid #d8c9cd;border-radius:11px;padding:10px 11px;font:inherit;background:#fff}.bulkpen-grid textarea{min-height:100px;resize:vertical}.bulkpen-residents{margin-top:14px;border:1px solid #eadde1;border-radius:14px;overflow:hidden}.bulkpen-toolbar{display:flex;gap:8px;align-items:center;padding:10px;background:#fff8fa;flex-wrap:wrap}.bulkpen-list{max-height:310px;overflow:auto}.bulkpen-person{display:grid;grid-template-columns:auto 1fr auto;gap:10px;align-items:center;padding:10px 12px;border-top:1px solid #f2e8eb}.bulkpen-person small{display:block;color:#75666b}.bulkpen-person input{width:18px;height:18px}.bulkpen-count{font-weight:900;color:#8e2135}.bulkpen-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:14px}.bulkpen-primary{border:0;border-radius:11px;padding:11px 15px;background:#b4233c;color:#fff!important;-webkit-text-fill-color:#fff!important;font-weight:900;cursor:pointer}.bulkpen-secondary{border:1px solid #d9c9cd;border-radius:11px;padding:10px 14px;background:#fff;color:#3f2530;font-weight:850;cursor:pointer}.bulkpen-reconsider{border:1px solid #e6b9c2!important;border-radius:10px!important;padding:8px 11px!important;background:#fff3f5!important;color:#8d1730!important;font-weight:900!important}.bulkpen-reconsider-card{border:1px solid #ead6da;border-radius:16px;padding:15px;background:#fff;margin-top:12px}.bulkpen-reconsider-card h3{margin:0 0 4px}.bulkpen-edit{display:grid;grid-template-columns:1fr 1fr;gap:9px;margin-top:12px}.bulkpen-edit input,.bulkpen-edit textarea{width:100%;box-sizing:border-box;border:1px solid #d8c9cd;border-radius:10px;padding:9px}.bulkpen-edit textarea{grid-column:1/-1;min-height:80px}.bulkpen-dialog{width:min(94vw,650px);border:0;border-radius:18px;padding:0;box-shadow:0 24px 80px rgba(0,0,0,.25)}.bulkpen-dialog::backdrop{background:rgba(10,20,32,.55)}.bulkpen-dialog-body{padding:18px}.bulkpen-dialog-head{display:flex;justify-content:space-between;gap:12px}.bulkpen-x{border:0;background:#eef2f5;border-radius:9px;width:36px;height:36px}
@media(max-width:720px){.bulkpen-grid,.bulkpen-edit{grid-template-columns:1fr}.bulkpen-grid label.full,.bulkpen-edit textarea{grid-column:auto}.bulkpen-person{grid-template-columns:auto 1fr}.bulkpen-person .year-chip{grid-column:2}}
`;document.head.appendChild(s)}

function removeDuplicates(tabs,workspace){
  const unique=(selector)=>{const nodes=$$(selector);nodes.slice(1).forEach(n=>n.remove())};
  unique('[data-review-section="owner-bulk-penalties"]');
  unique('[data-review-panel="owner-bulk-penalties"]');
  unique('[data-review-section="owner-admin-reconsiderations"]');
  unique('[data-review-panel="owner-admin-reconsiderations"]');
}

async function ensureOwnerBulkTab(tabs,workspace){
  removeDuplicates(tabs,workspace);
  if(tabs.querySelector('[data-review-section="owner-bulk-penalties"]'))return;
  if(tabs.dataset.bulkPen201Bulk==='loading')return;
  tabs.dataset.bulkPen201Bulk='loading';
  try{
    const targets=await rpc('owner_penalty_targets_v200');
    if(!tabs.isConnected||!workspace.isConnected)return;
    if(tabs.querySelector('[data-review-section="owner-bulk-penalties"]'))return;
    const btn=document.createElement('button');btn.className='review-workspace-tab';btn.dataset.reviewSection='owner-bulk-penalties';btn.innerHTML='Sign penalties <small>Batch</small>';tabs.appendChild(btn);
    const panel=document.createElement('div');panel.className='review-workspace-panel';panel.dataset.reviewPanel='owner-bulk-penalties';panel.hidden=true;
    panel.innerHTML=`<div class="bulkpen-panel"><section class="bulkpen-card"><div class="bulkpen-head"><div><span class="eyebrow rose">ADMIN DIRECT PENALTY</span><h2>Sign one penalty to multiple residents</h2><p>Select any residents, then write the penalty exactly as you want it recorded.</p></div><span class="bulkpen-count" data-bulk-count>0 selected</span></div><form id="bulkPenaltyForm201"><div class="bulkpen-grid"><label>Penalty type<input name="category" required></label><label>Problem<input name="problem" required></label><label>Punishment<input name="punishment" required></label><label class="full">Incident / justification<textarea name="details" required></textarea></label></div><div class="bulkpen-residents"><div class="bulkpen-toolbar"><input class="bulkpen-search" data-bulk-search placeholder="Search resident"><button type="button" class="bulkpen-secondary" data-bulk-all>Select all</button><button type="button" class="bulkpen-secondary" data-bulk-none>Clear</button>${[1,2,3,4,5].map(y=>`<button type="button" class="bulkpen-secondary" data-bulk-year="${y}">Year ${y}</button>`).join('')}</div><div class="bulkpen-list">${(targets||[]).map(p=>`<label class="bulkpen-person" data-name="${esc(String(p.display_name||p.username||'').toLowerCase())}" data-year="${Number(p.residency_year)||0}"><input type="checkbox" data-bulk-person value="${esc(p.id)}"><span><b>${esc(p.display_name||p.username||'Resident')}</b><small>@${esc(p.username||'')}</small></span><span class="year-chip">Year ${esc(p.residency_year)}</span></label>`).join('')}</div></div><div class="bulkpen-actions"><button class="bulkpen-primary" type="submit">Sign penalty to selected residents</button></div></form></section></div>`;
    workspace.appendChild(panel);
    const count=()=>{$('[data-bulk-count]',panel).textContent=`${$$('[data-bulk-person]:checked',panel).length} selected`};
    panel.addEventListener('change',e=>{if(e.target.matches('[data-bulk-person]'))count()});
    $('[data-bulk-search]',panel).addEventListener('input',e=>{const q=e.target.value.trim().toLowerCase();$$('.bulkpen-person',panel).forEach(x=>x.hidden=!!q&&!x.dataset.name.includes(q))});
    $('[data-bulk-all]',panel).onclick=()=>{$$('[data-bulk-person]',panel).forEach(x=>{if(!x.closest('.bulkpen-person').hidden)x.checked=true});count()};
    $('[data-bulk-none]',panel).onclick=()=>{$$('[data-bulk-person]',panel).forEach(x=>x.checked=false);count()};
    $$('[data-bulk-year]',panel).forEach(b=>b.onclick=()=>{$$('[data-bulk-person]',panel).forEach(x=>x.checked=Number(x.closest('.bulkpen-person').dataset.year)===Number(b.dataset.bulkYear));count()});
    $('#bulkPenaltyForm201',panel).addEventListener('submit',async e=>{e.preventDefault();const f=e.currentTarget,ids=$$('[data-bulk-person]:checked',panel).map(x=>x.value);if(!ids.length)return alert('Choose at least one resident.');const submit=f.querySelector('[type="submit"]');submit.disabled=true;try{const r=await rpc('owner_create_bulk_penalties_v200',{p_resident_ids:ids,p_category:f.category.value.trim(),p_problem:f.problem.value.trim(),p_punishment:f.punishment.value.trim(),p_details:f.details.value.trim()});alert(`${Number(r?.count||0)} penalty record${Number(r?.count||0)===1?'':'s'} created.`);location.reload()}catch(err){alert(err.message||err);submit.disabled=false}});
  } finally { delete tabs.dataset.bulkPen201Bulk; }
}

async function ensureOwnerReconsiderTab(tabs,workspace){
  removeDuplicates(tabs,workspace);
  if(tabs.querySelector('[data-review-section="owner-admin-reconsiderations"]'))return;
  if(tabs.dataset.bulkPen201Reconsider==='loading')return;
  tabs.dataset.bulkPen201Reconsider='loading';
  try{
    const rows=await rpc('get_penalty_admin_rows_v1071');
    const pending=(rows||[]).filter(x=>x.admin_direct&&x.status==='appeal_pending');
    if(!tabs.isConnected||!workspace.isConnected)return;
    if(tabs.querySelector('[data-review-section="owner-admin-reconsiderations"]'))return;
    const btn=document.createElement('button');btn.className='review-workspace-tab';btn.dataset.reviewSection='owner-admin-reconsiderations';btn.innerHTML=`Admin reconsiderations <small>${pending.length}</small>`;tabs.appendChild(btn);
    const panel=document.createElement('div');panel.className='review-workspace-panel';panel.dataset.reviewPanel='owner-admin-reconsiderations';panel.hidden=true;
    panel.innerHTML=`<div class="review-section-heading"><div><span class="eyebrow">ADMIN REVIEW</span><h2>Penalty reconsideration requests</h2><p>These requests come directly back to you. Keep, edit or cancel the penalty.</p></div></div>${pending.length?pending.map(r=>`<article class="bulkpen-reconsider-card" data-admin-reconsider-id="${esc(r.id)}"><h3>${esc(r.resident_name)} · ${esc(r.problem)}</h3><p><b>Resident request:</b> ${esc(r.complaint_text||'—')}</p><div class="bulkpen-edit"><input data-r-category value="${esc(r.category)}"><input data-r-problem value="${esc(r.problem)}"><input data-r-punishment value="${esc(r.punishment)}"><input data-r-response placeholder="Optional response"><textarea data-r-details>${esc(r.details)}</textarea></div><div class="bulkpen-actions"><button class="bulkpen-secondary" data-r-action="uphold">Keep penalty</button><button class="bulkpen-primary" data-r-action="modify">Save edited penalty</button><button class="bulkpen-secondary" data-r-action="cancel">Cancel penalty</button></div></article>`).join(''):'<div class="panel-empty">No Admin penalty reconsiderations are waiting.</div>'}`;
    workspace.appendChild(panel);
    panel.addEventListener('click',async e=>{const b=e.target.closest('[data-r-action]');if(!b)return;const card=b.closest('[data-admin-reconsider-id]'),action=b.dataset.rAction;if(!confirm(action==='cancel'?'Cancel this penalty?':action==='modify'?'Save edited penalty?':'Keep this penalty?'))return;b.disabled=true;try{await rpc('owner_resolve_admin_penalty_reconsideration_v200',{p_penalty_id:Number(card.dataset.adminReconsiderId),p_action:action,p_category:$('[data-r-category]',card).value,p_problem:$('[data-r-problem]',card).value,p_punishment:$('[data-r-punishment]',card).value,p_details:$('[data-r-details]',card).value,p_response:$('[data-r-response]',card).value});location.reload()}catch(err){alert(err.message||err);b.disabled=false}});
  } finally { delete tabs.dataset.bulkPen201Reconsider; }
}

function dialog(){let d=$('#bulkPen201Dialog');if(!d){d=document.createElement('dialog');d.id='bulkPen201Dialog';d.className='bulkpen-dialog';document.body.appendChild(d)}return d}
function openResidentRequest(id){const d=dialog();d.innerHTML=`<form class="bulkpen-dialog-body"><div class="bulkpen-dialog-head"><div><span class="eyebrow">Penalty reconsideration</span><h2>Request reconsideration</h2></div><button type="button" class="bulkpen-x" data-close>×</button></div><div class="bulkpen-grid"><label class="full">Reason<textarea name="reason" required minlength="3"></textarea></label></div><div class="bulkpen-actions"><button class="bulkpen-primary">Send to Admin</button></div></form>`;d.showModal();$('[data-close]',d).onclick=()=>d.close();$('form',d).onsubmit=async e=>{e.preventDefault();const b=e.submitter;b.disabled=true;try{await rpc('resident_request_admin_penalty_reconsideration_v200',{p_penalty_id:Number(id),p_reason:e.currentTarget.reason.value.trim()});d.close();alert('Your reconsideration request was sent to Admin.');location.reload()}catch(err){alert(err.message||err);b.disabled=false}}}
async function ensureResidentButtons(){const rows=await rpc('get_penalties_for_me_v1071');(rows||[]).filter(x=>x.admin_direct&&x.status==='approved').forEach(r=>{const old=$(`[data-penalty-complain="${CSS.escape(String(r.id))}"]`);if(old){old.textContent='Request reconsideration';old.dataset.adminReconsiderRequest=String(r.id);old.removeAttribute('data-penalty-complain');old.classList.add('bulkpen-reconsider')}})}

document.addEventListener('click',e=>{const b=e.target.closest?.('[data-admin-reconsider-request]');if(b){e.preventDefault();e.stopImmediatePropagation();openResidentRequest(b.dataset.adminReconsiderRequest)}},true);

async function enhanceOnce(){const hash=String(location.hash||'');if(!['#reviews-penalties','#reviews','#write-review'].includes(hash))return;const tabs=$('.review-workspace-tabs');if(!tabs)return;const workspace=tabs.closest('.review-workspace');if(!workspace)return;const{data:sess}=await sb.auth.getSession(),uid=sess?.session?.user?.id;if(!uid)return;const{data:p}=await sb.from('profiles').select('role').eq('id',uid).maybeSingle();if(p?.role==='owner'){removeDuplicates(tabs,workspace);await ensureOwnerBulkTab(tabs,workspace);await ensureOwnerReconsiderTab(tabs,workspace);removeDuplicates(tabs,workspace)}else if(p?.role==='resident'){await ensureResidentButtons()}}
function enhance(){if(enhancePromise)return enhancePromise;enhancePromise=enhanceOnce().catch(console.error).finally(()=>{enhancePromise=null});return enhancePromise}
function arm(){if(timer)clearInterval(timer);let n=0;void enhance();timer=setInterval(()=>{n++;void enhance();if(n>=12){clearInterval(timer);timer=null}},400)}
document.addEventListener('click',e=>{if(e.target.closest?.('[data-go="reviews-penalties"],[data-go="reviews"],[data-review-section]'))setTimeout(arm,100)},true);window.addEventListener('hashchange',arm);styles();arm();
