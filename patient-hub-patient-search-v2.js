(()=>{
const $id=id=>document.getElementById(id);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const norm=v=>String(v??'').trim().toLowerCase().replace(/أ|إ|آ/g,'ا').replace(/ى/g,'ي').replace(/ة/g,'ه');
let liveSearchTimer=null,searchSeq=0;
const AR_DAYS=['الأحد','الاثنين','الثلاثاء','الأربعاء','الخميس','الجمعة','السبت'];
const AR_MONTHS=['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];
function fullArabicDate(v){if(!v)return'—';const d=new Date(v+'T12:00:00');return `${AR_DAYS[d.getDay()]} ${d.getDate()} ${AR_MONTHS[d.getMonth()]} ${d.getFullYear()}`}
function serviceText(s){if(!s)return'';return [s.name_ar,s.name_en,s.code].filter(Boolean).join(' ')}
function aliases(r){const s=r.service||{};let a=serviceText(s)+' '+(r.intervention_type||'')+' '+(r.consultant_name||'');const code=s.code||'';if(code==='cath_miri')a+=' قسطرة الميري الميري ميري cath miri';if(code==='cath_smouha')a+=' قسطرة سموحة smouha cath';if(code==='dse')a+=' ايكو بالمجهود الدوائي إيكو بالمجهود الدوائي DSE';if(code==='exercise_ecg')a+=' رسم قلب بالمجهود exercise ecg';if(code==='tee')a+=' ايكو بالمنظار TEE';if(code==='holter')a+=' رسم قلب ممتد هولتر holter';return a}
function locationLabel(r){const code=r.service?.code||'';if(code==='cath_miri')return'الميري';if(code==='cath_smouha')return'سموحة';return r.service?.name_ar||r.service?.name_en||code||'—'}
function line(v,bold=false){return `<div style="margin:3px 0;min-height:22px;white-space:nowrap;${bold?'font-weight:700;':''}">${esc(v||'—')}</div>`}
async function enhancedSearchPatients(){
 const box=$id('patientSearch');if(!box)return;
 const mySeq=++searchSeq,term=box.value.trim(),nterm=norm(term),body=$id('patientRows');if(body)body.style.opacity='.58';
 const [pq,rq]=await Promise.all([
  sb.from('psh_patients').select('*').order('created_at',{ascending:false}).limit(500),
  sb.from('psh_reservations').select('id,patient_id,scheduled_date,status,intervention_type,consultant_name,service:psh_services(code,name_ar,name_en)').order('scheduled_date',{ascending:false}).limit(2000)
 ]);
 if(mySeq!==searchSeq)return;if(body)body.style.opacity='1';if(pq.error)return toast(pq.error.message);if(rq.error)return toast(rq.error.message);
 const byPatient=new Map();(rq.data||[]).forEach(r=>{if(!byPatient.has(r.patient_id))byPatient.set(r.patient_id,[]);byPatient.get(r.patient_id).push(r)});
 let patients=pq.data||[];if(term)patients=patients.filter(p=>{const own=norm([p.arabic_name,p.mobile,p.national_id].join(' ')),hist=norm((byPatient.get(p.id)||[]).map(aliases).join(' '));return own.includes(nterm)||hist.includes(nterm)});
 if(!body)return;
 body.innerHTML=patients.map(p=>{const h=(byPatient.get(p.id)||[]).slice(0,8);const doctors=h.length?h.map(r=>line(r.consultant_name)).join(''):line('—');const locations=h.length?h.map(r=>line(locationLabel(r),true)).join(''):line('—');const interventions=h.length?h.map(r=>line(r.intervention_type||'—',true)).join(''):line('—');const dates=h.length?h.map(r=>line(fullArabicDate(r.scheduled_date))).join(''):line('—');return `<tr><td>${esc(p.arabic_name)}</td><td>${esc(p.mobile)}</td><td>${esc(p.national_id)}</td><td>${esc(p.year_of_birth)}</td><td style="min-width:180px">${doctors}</td><td style="min-width:150px">${locations}</td><td style="min-width:130px">${interventions}</td><td style="min-width:220px">${dates}</td><td><button class="link" onclick="patientModal('${p.id}')">${typeof lang!=='undefined'&&lang==='ar'?'فتح':'Open'}</button></td></tr>`}).join('')||`<tr><td colspan="9">${typeof lang!=='undefined'&&lang==='ar'?'لا يوجد مرضى مطابقون للبحث':'No patients found'}</td></tr>`;
}
function queueLiveSearch(){clearTimeout(liveSearchTimer);liveSearchTimer=setTimeout(enhancedSearchPatients,220)}
function setup(){const box=$id('patientSearch'),btn=$id('searchBtn'),head=$id('patientRows')?.closest('table')?.querySelector('thead tr');if(!box||!btn)return;
 box.type='search';box.autocomplete='off';box.autocapitalize='off';box.spellcheck=false;box.name='patient_lookup_'+Date.now();box.value='';box.placeholder=(typeof lang!=='undefined'&&lang==='ar')?'الاسم / الهاتف / الرقم القومي / اسم الطبيب / المكان / نوع التدخل':'Name / mobile / National ID / doctor / location / intervention';
 if(head)head.innerHTML=`<th>الاسم</th><th>الهاتف</th><th>الرقم القومي</th><th>سنة الميلاد</th><th>اسم الطبيب</th><th>المكان</th><th>نوع التدخل</th><th>التاريخ</th><th></th>`;
 btn.onclick=enhancedSearchPatients;box.oninput=queueLiveSearch;box.onsearch=queueLiveSearch;box.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();clearTimeout(liveSearchTimer);enhancedSearchPatients()}};
 document.querySelectorAll('[data-page="patients"]').forEach(b=>b.addEventListener('click',()=>setTimeout(()=>{box.value='';enhancedSearchPatients()},0)));
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',setup);else setup();window.enhancedSearchPatients=enhancedSearchPatients;
})();