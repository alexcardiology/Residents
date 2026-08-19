(()=>{
const $id=id=>document.getElementById(id);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const norm=v=>String(v??'').trim().toLowerCase().replace(/أ|إ|آ/g,'ا').replace(/ى/g,'ي').replace(/ة/g,'ه');
let liveSearchTimer=null,searchSeq=0;
function serviceText(s){if(!s)return'';return [s.name_ar,s.name_en,s.code].filter(Boolean).join(' ')}
function aliases(r){const s=r.service||{};let a=serviceText(s)+' '+(r.intervention_type||'');const code=s.code||'';if(code==='cath_miri')a+=' قسطرة الميري ميري cath miri';if(code==='cath_smouha')a+=' قسطرة سموحة smouha cath';if(code==='dse')a+=' ايكو بالمجهود الدوائي إيكو بالمجهود الدوائي DSE';if(code==='exercise_ecg')a+=' رسم قلب بالمجهود exercise ecg';if(code==='tee')a+=' ايكو بالمنظار TEE';if(code==='holter')a+=' رسم قلب ممتد هولتر holter';return a}
function historyLabel(r){const s=r.service||{};const svc=(typeof lang!=='undefined'&&lang==='ar'?(s.name_ar||s.name_en):(s.name_en||s.name_ar))||s.code||'—';const it=r.intervention_type?` · ${r.intervention_type}`:'';return `${svc}${it}`}
async function enhancedSearchPatients(){
 const box=$id('patientSearch'); if(!box)return;
 const mySeq=++searchSeq,term=box.value.trim(), nterm=norm(term);
 const body=$id('patientRows');if(body)body.style.opacity='.58';
 const [pq,rq]=await Promise.all([
  sb.from('psh_patients').select('*').order('created_at',{ascending:false}).limit(500),
  sb.from('psh_reservations').select('id,patient_id,scheduled_date,status,intervention_type,service:psh_services(code,name_ar,name_en)').order('scheduled_date',{ascending:false}).limit(2000)
 ]);
 if(mySeq!==searchSeq)return;
 if(body)body.style.opacity='1';
 if(pq.error)return toast(pq.error.message);if(rq.error)return toast(rq.error.message);
 const reservations=rq.data||[], byPatient=new Map();reservations.forEach(r=>{if(!byPatient.has(r.patient_id))byPatient.set(r.patient_id,[]);byPatient.get(r.patient_id).push(r)});
 let patients=pq.data||[];
 if(term){patients=patients.filter(p=>{const own=norm([p.arabic_name,p.mobile,p.national_id].join(' '));const hist=norm((byPatient.get(p.id)||[]).map(aliases).join(' '));return own.includes(nterm)||hist.includes(nterm)})}
 if(!body)return;
 body.innerHTML=patients.map(p=>{const h=byPatient.get(p.id)||[];const hs=h.slice(0,6).map(r=>`<div style="margin:2px 0"><b>${esc(historyLabel(r))}</b>${r.scheduled_date?` <span style="opacity:.7">— ${esc(typeof fmt==='function'?fmt(r.scheduled_date):r.scheduled_date)}</span>`:''}</div>`).join('')||'<span style="opacity:.55">—</span>';return `<tr><td>${esc(p.arabic_name)}</td><td>${esc(p.mobile)}</td><td>${esc(p.national_id)}</td><td>${esc(p.year_of_birth)}</td><td style="min-width:240px">${hs}</td><td><button class="link" onclick="patientModal('${p.id}')">${typeof lang!=='undefined'&&lang==='ar'?'فتح':'Open'}</button></td></tr>`}).join('')||`<tr><td colspan="6">${typeof lang!=='undefined'&&lang==='ar'?'لا يوجد مرضى مطابقون للبحث':'No patients found'}</td></tr>`;
}
function queueLiveSearch(){clearTimeout(liveSearchTimer);liveSearchTimer=setTimeout(enhancedSearchPatients,220)}
function setup(){const box=$id('patientSearch'),btn=$id('searchBtn'),head=$id('patientRows')?.closest('table')?.querySelector('thead tr');if(!box||!btn)return;
 box.type='search';box.autocomplete='off';box.autocapitalize='off';box.spellcheck=false;box.name='patient_lookup_'+Date.now();box.value='';box.placeholder=(typeof lang!=='undefined'&&lang==='ar')?'الاسم / الهاتف / الرقم القومي / الخدمة / نوع التدخل':'Name / mobile / National ID / service / intervention';
 if(head&&!head.querySelector('[data-patient-history-head]')){const th=document.createElement('th');th.dataset.patientHistoryHead='1';th.textContent=(typeof lang!=='undefined'&&lang==='ar')?'الخدمة / نوع التدخل':'Service / intervention';head.insertBefore(th,head.lastElementChild)}
 btn.onclick=enhancedSearchPatients;
 box.oninput=queueLiveSearch;
 box.onsearch=queueLiveSearch;
 box.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();clearTimeout(liveSearchTimer);enhancedSearchPatients()}};
 document.querySelectorAll('[data-page="patients"]').forEach(b=>b.addEventListener('click',()=>setTimeout(()=>{box.value='';enhancedSearchPatients()},0)));
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',setup);else setup();
window.enhancedSearchPatients=enhancedSearchPatients;
})();