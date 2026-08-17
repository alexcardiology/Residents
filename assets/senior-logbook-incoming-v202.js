import { sb } from './supabase.js';

const $=(s,r=document)=>r.querySelector(s);
const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
let timer=null, loading=false;

function style(){
  if($('#seniorReq202Style')) return;
  const s=document.createElement('style'); s.id='seniorReq202Style'; s.textContent=`
  .seniorreq202{margin:0 0 18px;border:1px solid #cfe0f2;border-left:5px solid #177fd3;border-radius:18px;background:#fff;padding:18px}
  .seniorreq202-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;margin-bottom:12px}.seniorreq202-head h2{margin:2px 0 4px}.seniorreq202-head p{margin:0;color:#68788b}.seniorreq202-count{display:inline-flex;min-width:34px;height:34px;align-items:center;justify-content:center;border-radius:999px;background:#e9f4ff;color:#075aa3;font-weight:900}
  .seniorreq202-list{display:grid;gap:10px}.seniorreq202-card{border:1px solid #dbe6f1;border-radius:14px;padding:14px;background:#fbfdff}.seniorreq202-card h3{margin:0 0 6px;font-size:1rem}.seniorreq202-meta{display:flex;gap:10px;flex-wrap:wrap;color:#5f7184;font-size:.82rem;font-weight:700}.seniorreq202-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}.seniorreq202-actions button{border:0;border-radius:10px;padding:9px 13px;font-weight:900;cursor:pointer}.seniorreq202-approve{background:#dff5e9;color:#087347}.seniorreq202-reject{background:#fff0f2;color:#a91f35;border:1px solid #f0bbc4!important}.seniorreq202-empty{padding:12px;border-radius:12px;background:#f7f9fc;color:#68788b}
  `; document.head.appendChild(s);
}

async function loadRows(){
  const {data,error}=await sb.rpc('get_my_senior_logbook_requests_v135');
  if(error) throw error;
  return data||[];
}

function card(row){
  const date=row.activity_date?new Date(`${row.activity_date}T12:00:00`):null;
  const dateText=date?new Intl.DateTimeFormat('en-GB',{day:'2-digit',month:'2-digit',year:'numeric'}).format(date):'—';
  return `<article class="seniorreq202-card" data-seniorreq-id="${esc(row.id)}">
    <h3>${esc(row.resident_name||'Resident')} · ${esc(row.procedure_name||'Logbook activity')}</h3>
    <div class="seniorreq202-meta"><span>Year ${esc(row.residency_year||'')}</span><span>${esc(row.participation_mode||'')}</span><span>${esc(row.case_count||1)} case${Number(row.case_count||1)===1?'':'s'}</span><span>${esc(dateText)}</span>${row.hospital?`<span>${esc(row.hospital)}</span>`:''}${row.assessor_name?`<span>Assessor: ${esc(row.assessor_name)}</span>`:''}</div>
    <div class="seniorreq202-actions"><button type="button" class="seniorreq202-approve" data-seniorreq-decision="approved">Approve</button><button type="button" class="seniorreq202-reject" data-seniorreq-decision="rejected">Reject</button></div>
  </article>`;
}

async function render(){
  if(location.hash!=='#logbook-requests' || loading) return;
  const content=$('#content'); if(!content) return;
  loading=true;
  try{
    const {data:sess}=await sb.auth.getSession(); const uid=sess?.session?.user?.id; if(!uid) return;
    const {data:p}=await sb.from('profiles').select('role,residency_year').eq('id',uid).maybeSingle();
    if(!p || p.role!=='resident' || Number(p.residency_year)<2) return;
    const rows=await loadRows();
    let panel=$('#seniorReq202');
    if(!panel){
      panel=document.createElement('section'); panel.id='seniorReq202'; panel.className='seniorreq202';
      content.prepend(panel);
    }
    panel.innerHTML=`<div class="seniorreq202-head"><div><span class="eyebrow">SENIOR RESIDENT REVIEW</span><h2>Requests awaiting my response</h2><p>Junior residents assigned to you appear here until you approve or reject their logbook entry.</p></div><span class="seniorreq202-count">${rows.length}</span></div><div class="seniorreq202-list">${rows.length?rows.map(card).join(''):'<div class="seniorreq202-empty">No junior logbook requests are waiting for your response.</div>'}</div>`;
  }catch(e){ console.error('Could not load incoming senior logbook requests',e); }
  finally{ loading=false; }
}

document.addEventListener('click',async e=>{
  const btn=e.target.closest?.('[data-seniorreq-decision]'); if(!btn) return;
  const card=btn.closest('[data-seniorreq-id]'); if(!card) return;
  e.preventDefault(); e.stopImmediatePropagation();
  const decision=btn.dataset.seniorreqDecision; let note='';
  if(decision==='rejected'){
    note=prompt('Reason for rejection (required):','')?.trim()||'';
    if(!note) return;
  }
  btn.disabled=true;
  try{
    const {error}=await sb.rpc('review_logbook_entry_v1051',{p_entry_id:card.dataset.seniorreqId,p_decision:decision,p_note:note||null});
    if(error) throw error;
    await render();
  }catch(err){ alert(err.message||err); btn.disabled=false; }
},true);

function arm(){
  if(timer) clearInterval(timer); let n=0;
  void render();
  timer=setInterval(()=>{ n++; void render(); if(n>=12){clearInterval(timer);timer=null;} },350);
}
window.addEventListener('hashchange',arm);
document.addEventListener('click',e=>{if(e.target.closest?.('[data-go="logbook-requests"]')) setTimeout(arm,80)},true);
style(); arm();
