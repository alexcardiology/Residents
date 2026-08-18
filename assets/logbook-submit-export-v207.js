import { sb } from './supabase.js';

const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (m) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const originalRpc = sb.rpc.bind(sb);
let successPending = false;

function injectStyles(){
  if(document.querySelector('#logbookSubmitExport207Style')) return;
  const style=document.createElement('style');
  style.id='logbookSubmitExport207Style';
  style.textContent=`
  .logbook207-overlay{position:fixed;inset:0;z-index:12000;background:rgba(6,22,40,.46);display:grid;place-items:center;padding:18px;backdrop-filter:blur(2px)}
  .logbook207-success{width:min(570px,94vw);background:#fff;border-radius:24px;padding:26px;box-shadow:0 28px 90px rgba(0,0,0,.28);color:#0b223e;text-align:center}
  .logbook207-check{width:58px;height:58px;border-radius:50%;margin:0 auto 14px;display:grid;place-items:center;background:#dff5e9;color:#087548;font-size:30px;font-weight:900}
  .logbook207-success h2{margin:0 0 10px;font-size:25px}.logbook207-success p{margin:0;color:#5b6f85;font-size:15px;line-height:1.6}
  .logbook207-note{margin-top:15px!important;padding:13px 14px;border-radius:14px;background:#f4f8fc;color:#183b5d!important;text-align:left}
  .logbook207-success button{margin-top:18px;min-width:130px}
  `;
  document.head.appendChild(style);
}

function closeSuccess(){document.querySelector('#logbook207Overlay')?.remove()}

function showSuccess(){
  injectStyles();
  closeSuccess();
  const el=document.createElement('div');
  el.id='logbook207Overlay';el.className='logbook207-overlay';
  el.innerHTML=`<section class="logbook207-success" role="dialog" aria-modal="true" aria-labelledby="logbook207Title">
    <div class="logbook207-check">✓</div>
    <h2 id="logbook207Title">Request sent successfully</h2>
    <p>Your activity has been submitted for approval. It will appear in your exported E-logbook PDF after the required senior resident and assessor approvals.</p>
    <p class="logbook207-note"><b>48-hour protection:</b> If the senior resident response is delayed for more than 48 hours, Admin will take immediate action to preserve your rights as a candidate.</p>
    <button type="button" class="btn" data-logbook207-close>OK</button>
  </section>`;
  document.body.appendChild(el);
}

function focusHistoryThenConfirm(){
  let tries=0;
  const tick=()=>{
    tries++;
    const table=document.querySelector('.logbook-history-table-card, .printable-logbook, .logbook-history-table');
    if(table){
      table.scrollIntoView({behavior:'smooth',block:'start'});
      setTimeout(showSuccess,260);
      return;
    }
    if(tries<18) setTimeout(tick,120); else showSuccess();
  };
  setTimeout(tick,100);
}

sb.rpc = async function(name,args,...rest){
  const result=await originalRpc(name,args,...rest);
  if(name==='submit_logbook_entry_v1073' && !result?.error && !successPending){
    successPending=true;
    setTimeout(()=>{successPending=false;focusHistoryThenConfirm()},80);
  }
  return result;
};

document.addEventListener('click',(e)=>{
  if(e.target.closest?.('[data-logbook207-close]')){e.preventDefault();closeSuccess();}
  else if(e.target.id==='logbook207Overlay'){closeSuccess();}
},true);

const fmtDate=(v)=>{
  if(!v)return '—';
  const x=/^\d{4}-\d{2}-\d{2}$/.test(String(v))?new Date(`${v}T12:00:00`):new Date(v);
  return new Intl.DateTimeFormat('en-GB',{day:'2-digit',month:'2-digit',year:'numeric'}).format(x);
};
const participation=(v)=>({attended:'Attended',failed_trial:'Failed trial',assisted:'Performed with assistance',solo_guided:'Performed solo under guidance',solo_unguided:'Performed solo without guidance',solo:'Performed solo without guidance',supervised:'Supervised'})[v]||String(v||'—');
const count=(e)=>Math.max(1,Number(e?.case_count)||1);
const details=(e)=>{
  let arr=e?.case_details;
  if(typeof arr==='string'){try{arr=JSON.parse(arr)}catch(_){arr=[]}}
  if(!Array.isArray(arr))arr=[];
  return arr.map((x,i)=>String(x||'').trim()?`Case ${i+1}: ${String(x).trim()}`:'').filter(Boolean).join(' | ');
};

function currentApprovedEntries(){
  const ids=[...document.querySelectorAll('[data-logbook-detail]')].map(b=>String(b.dataset.logbookDetail||'')).filter(Boolean);
  const map=window.logbookEntryRows instanceof Map?window.logbookEntryRows:new Map();
  const unique=[...new Set(ids)];
  return unique.map(id=>map.get(id)).filter(Boolean).filter(e=>String(e.status||'').toLowerCase()==='approved');
}

function exportCss(){return `@page{size:A4 landscape;margin:10mm}*{box-sizing:border-box}body{margin:0;color:#142033;font-family:Arial,Helvetica,sans-serif;font-size:9px}.sheet{width:100%}.logo-wrap{text-align:center;margin:0 0 5px}.logo-wrap img{width:72px;height:72px;object-fit:contain}.report-head{text-align:center;border-bottom:2px solid #0d4963;padding-bottom:7px;margin-bottom:10px}.report-head h1{margin:0;font-size:18px;color:#081c35}.report-head p{margin:3px 0 0;color:#526174;font-size:10px}.section{margin-top:12px}.section h2{margin:0 0 6px;font-size:13px;color:#0d2d50}table{width:100%;border-collapse:collapse;table-layout:fixed}th,td{border:1px solid #aebbc8;padding:4px 5px;vertical-align:middle;overflow-wrap:anywhere;font-family:Arial,Helvetica,sans-serif;font-style:normal}th{background:#0d4963;color:#fff;font-size:8px;text-transform:uppercase;letter-spacing:.15px}tbody tr:nth-child(even){background:#f5f8fb}.signature-cell{height:28px;background:#fff}.department-signature{margin-top:18px;display:flex;justify-content:flex-end}.department-signature div{width:290px;text-align:center;font-size:10px;font-weight:700}.department-signature .line{display:block;border-top:1px solid #142033;margin-top:30px;padding-top:5px}.empty{padding:15px;border:1px dashed #aebbc8;text-align:center;color:#526174}.footer{margin-top:9px;text-align:right;color:#6c7886;font-size:8px}`}

function buildExport(entries){
  const residentNames=[...new Set(entries.map(x=>x.resident_name).filter(Boolean))];
  const includeResident=residentNames.length>1;
  const reportFor=residentNames.length===1?residentNames[0]:'Approved resident activities';
  const interventions=entries.filter(x=>x.activity_category==='manual_intervention').sort((a,b)=>new Date(a.activity_date)-new Date(b.activity_date));
  const conferences=entries.filter(x=>x.activity_category==='conference').sort((a,b)=>new Date(a.activity_date)-new Date(b.activity_date));
  const irows=interventions.map((x,i)=>`<tr><td>${i+1}</td>${includeResident?`<td>${esc(x.resident_name||'—')}</td>`:''}<td><b>${esc(x.procedure_name||x.title||'Intervention')}</b></td><td>${count(x)}</td><td>${fmtDate(x.activity_date)}</td><td>${esc(participation(x.participation_mode))}</td><td>${esc(x.hospital||'—')}</td><td>${esc(x.senior_resident_id?(x.senior_resident_name||'Senior resident'):'Not required')}</td><td>${esc(x.assessor_name||'—')}</td><td class="signature-cell"></td><td>${esc([x.description,details(x)].filter(Boolean).join(' · ')||'—')}</td></tr>`).join('');
  const crows=conferences.map((x,i)=>`<tr><td>${i+1}</td>${includeResident?`<td>${esc(x.resident_name||'—')}</td>`:''}<td><b>${esc(x.title||'Conference')}</b></td><td>${x.conference_participation==='gave_speech'?'Presenter':'Attended'}</td><td>${fmtDate(x.activity_date)}</td><td>${esc(x.assessor_name||'—')}</td><td class="signature-cell"></td><td>${esc(x.description||'—')}</td></tr>`).join('');
  const logo=new URL('assets/alexandria-faculty-logo.jpg',location.href).href;
  return `<!doctype html><html><head><meta charset="utf-8"><title>Approved E-logbook</title><style>${exportCss()}</style></head><body><main class="sheet"><div class="logo-wrap"><img src="${logo}" alt="Alexandria Faculty of Medicine"></div><div class="report-head"><h1>Approved Resident E-logbook</h1><p>${esc(reportFor)} · ${entries.length} approved record${entries.length===1?'':'s'}</p></div><section class="section"><h2>Interventions</h2>${interventions.length?`<table><thead><tr><th>No.</th>${includeResident?'<th>Resident</th>':''}<th>Intervention</th><th>Cases</th><th>Date</th><th>Participation</th><th>Hospital</th><th>Senior resident</th><th>Assessor</th><th>Signature</th><th>Notes / case details</th></tr></thead><tbody>${irows}</tbody></table>`:'<div class="empty">No approved interventions.</div>'}</section><section class="section"><h2>Conferences</h2>${conferences.length?`<table><thead><tr><th>No.</th>${includeResident?'<th>Resident</th>':''}<th>Conference</th><th>Participation</th><th>Date</th><th>Assessor</th><th>Signature</th><th>Notes</th></tr></thead><tbody>${crows}</tbody></table>`:'<div class="empty">No approved conferences.</div>'}</section><div class="department-signature"><div><span class="line">Head of Cardiology Department signature</span></div></div><div class="footer">Generated ${fmtDate(new Date().toISOString())}</div></main><script>window.addEventListener('load',()=>setTimeout(()=>window.print(),250));<\/script></body></html>`;
}

function customExport(){
  const entries=currentApprovedEntries();
  if(!entries.length){alert('There are no approved logbook entries to export.');return;}
  const popup=window.open('','_blank');
  if(!popup){alert('Please allow pop-ups to export the PDF.');return;}
  popup.document.open();popup.document.write(buildExport(entries));popup.document.close();
}

document.addEventListener('click',(e)=>{
  const btn=e.target.closest?.('[data-logbook-print]');
  if(!btn)return;
  e.preventDefault();e.stopImmediatePropagation();customExport();
},true);
