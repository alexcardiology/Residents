(()=>{
const AR_DAYS=['الأحد','الاثنين','الثلاثاء','الأربعاء','الخميس','الجمعة','السبت'];
const AR_MONTHS=['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];
const INTERVENTIONS=['CA','CA +/- PCI','PCI','CTO','IVUS guided PCI'];
const q=id=>document.getElementById(id);
function esc(v=''){return String(v??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')}
function arDate(v){if(!v)return'';const d=new Date(v+'T12:00:00');return `${AR_DAYS[d.getDay()]} ${d.getDate()} ${AR_MONTHS[d.getMonth()]} ${d.getFullYear()}`}
function isCathCode(code){return code==='cath_miri'||code==='cath_smouha'}
function siteLabel(code){return code==='cath_miri'?'الميري':'سموحة'}
function otherCathCode(code){return code==='cath_miri'?'cath_smouha':'cath_miri'}
function currentBookingCode(){
 const v=q('rService')?.value||'';
 if(isCathCode(v))return v;
 const byId=(typeof services!=='undefined'?services:[]).find(x=>String(x.id)===String(v));
 return byId?.code||v;
}
async function consultantConflict(code,date,consultant){
 if(!isCathCode(code)||!date||!consultant)return null;
 const other=(typeof services!=='undefined'?services:[]).find(x=>x.code===otherCathCode(code));if(!other)return null;
 const r=await sb.from('psh_reservations').select('id,status').eq('service_id',other.id).eq('scheduled_date',date).eq('consultant_name',consultant).not('status','in','("cancelled","no_show")').limit(1);
 if(r.error){console.error('Consultant conflict check failed',r.error);throw new Error('تعذر التحقق من تعارض قائمة الاستشاري. حاول مرة أخرى.')}
 return r.data?.length?{site:siteLabel(other.code)}:null;
}
function confirmConflict(conflict,consultant,date){
 if(!conflict)return true;
 return window.confirm(`تنبيه ⚠️\n\nالاستشاري ${consultant} لديه بالفعل حالة أو قائمة قسطرة في ${conflict.site} يوم ${arDate(date)}.\n\nأنت الآن تحاول الحجز له في المكان الآخر في نفس اليوم.\n\nهل أنت متأكد من المتابعة؟`);
}
function reviewCard(data){
 return new Promise(resolve=>{
   window.__pshReviewResolve=resolve;
   modal(`<div dir="rtl" style="max-width:700px"><div class="modalHead"><h2>مراجعة الحجز قبل الإضافة</h2><button class="close" onclick="confirmSingleBooking(false)">×</button></div><p style="margin-top:0;color:var(--mut)">راجع البيانات التالية جيداً قبل تأكيد الحجز.</p><div style="border:1.5px solid #efc6ae;border-radius:18px;background:#fffaf7;padding:18px"><div style="font-size:24px;font-weight:800;margin-bottom:14px">${esc(data.name)}</div><div class="formGrid" style="gap:10px"><div class="item"><small>المكان</small><br><strong>${esc(data.site)}</strong></div><div class="item"><small>التاريخ</small><br><strong>${esc(data.dateLabel)}</strong></div><div class="item"><small>نوع الإجراء</small><br><strong dir="ltr">${esc(data.intervention)}</strong></div><div class="item"><small>الاستشاري</small><br><strong>${esc(data.consultant)}</strong></div><div class="item"><small>الرقم القومي</small><br><strong dir="ltr">${esc(data.nid)}</strong></div><div class="item"><small>رقم الهاتف</small><br><strong dir="ltr">${esc(data.mobile)}</strong></div></div></div><div class="actions" style="margin-top:18px"><button type="button" class="secondary" onclick="confirmSingleBooking(false)">رجوع للتعديل</button><button type="button" class="primary" onclick="confirmSingleBooking(true)">تأكيد وإضافة</button></div></div>`);
 });
}
window.confirmSingleBooking=ok=>{const r=window.__pshReviewResolve;window.__pshReviewResolve=null;closeModal();if(typeof r==='function')r(!!ok)};
function installSingleConflictGuard(){
 const form=q('reservationForm');if(!form||form.dataset.conflictGuard==='2')return;
 form.dataset.conflictGuard='2';
 const original=form.onsubmit;
 form.onsubmit=async function(e){
   e.preventDefault();
   if(form.dataset.confirmedSubmit==='1'){
     form.dataset.confirmedSubmit='0';
     if(typeof original==='function')return original.call(form,e);
     return;
   }
   const code=currentBookingCode();
   if(!isCathCode(code)){
     if(typeof original==='function')return original.call(form,e);
     return;
   }
   const date=q('rDate')?.value||'',consultant=q('rConsultant')?.value?.trim()||'',name=q('rName')?.value?.trim()||'',mobile=q('rMobile')?.value?.trim()||'',nid=q('rNid')?.value?.trim()||'',intervention=q('rIntervention')?.value||'';
   if(!name||!mobile||!nid||!date||!consultant||!intervention){
     if(typeof original==='function')return original.call(form,e);
     return;
   }
   try{
     const conflict=await consultantConflict(code,date,consultant);
     if(conflict&&!confirmConflict(conflict,consultant,date))return;
   }catch(err){toast(err.message||'تعذر التحقق من تعارض الاستشاري');return}
   const ok=await reviewCard({name,site:siteLabel(code),dateLabel:arDate(date),intervention,consultant,nid,mobile});
   if(!ok)return;
   form.dataset.confirmedSubmit='1';
   if(typeof form.requestSubmit==='function')form.requestSubmit();
   else form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));
 };
}
function addBulkButton(){
 const head=document.querySelector('#new .pageHead');if(!head||q('bulkCathBookingBtn'))return;
 const b=document.createElement('button');b.id='bulkCathBookingBtn';b.type='button';b.className='secondary';b.textContent='حجز قائمة';b.onclick=openBulkBooking;head.appendChild(b);
}
async function activeConsultants(){const r=await sb.from('psh_cath_consultants').select('name').eq('active',true).order('sort_order').order('name');return r.data||[]}
function bulkRow(i){return `<div class="bulkCase card" data-bulk-row style="padding:14px;margin:10px 0;background:#fffaf7"><div style="display:flex;justify-content:space-between;align-items:center;gap:10px"><strong>حالة ${i}</strong><button type="button" class="secondary" onclick="this.closest('[data-bulk-row]').remove();renumberBulkCases()">حذف</button></div><div class="formGrid" style="margin-top:10px"><div class="formField"><label>اسم المريض بالعربية</label><input data-b-name dir="rtl" required></div><div class="formField"><label>رقم الهاتف</label><input data-b-mobile inputmode="tel" required></div><div class="formField"><label>الرقم القومي</label><input data-b-nid inputmode="numeric" required></div><div class="formField"><label>العمر</label><input data-b-age type="number" min="0" max="120" required></div><div class="formField"><label>نوع الإجراء</label><select data-b-intervention required><option value="">اختر</option>${INTERVENTIONS.map(x=>`<option value="${x}">${x}</option>`).join('')}</select></div><div class="formField full"><label>ملاحظات / تشخيص</label><textarea data-b-note rows="2"></textarea></div></div></div>`}
window.renumberBulkCases=()=>document.querySelectorAll('[data-bulk-row]').forEach((r,i)=>{const s=r.querySelector('strong');if(s)s.textContent=`حالة ${i+1}`});
window.addBulkCase=()=>{const box=q('bulkCases');if(!box)return;box.insertAdjacentHTML('beforeend',bulkRow(box.querySelectorAll('[data-bulk-row]').length+1))};
async function openBulkBooking(){
 const cs=await activeConsultants();
 modal(`<div dir="rtl" style="max-width:1100px"><div class="modalHead"><h2>حجز قائمة قسطرة</h2><button class="close" onclick="closeModal()">×</button></div><p>اختر المكان والتاريخ والاستشاري مرة واحدة، ثم أضف كل الحالات المطلوبة في نفس الصفحة.</p><div class="formGrid"><div class="formField"><label>المكان</label><select id="bulkSite"><option value="cath_miri">الميري</option><option value="cath_smouha">سموحة</option></select></div><div class="formField"><label>التاريخ</label><input id="bulkDate" type="date" value="${today()}" required></div><div class="formField full"><label>الاستشاري</label><input id="bulkConsultant" list="bulkConsultants" autocomplete="off" placeholder="ابدأ بالكتابة!" required><datalist id="bulkConsultants">${cs.map(x=>`<option value="${esc(x.name)}"></option>`).join('')}</datalist></div></div><div id="bulkCases">${bulkRow(1)}${bulkRow(2)}</div><div class="actions" style="justify-content:space-between;flex-wrap:wrap"><button type="button" class="secondary" onclick="addBulkCase()">+ إضافة حالة</button><div style="display:flex;gap:8px"><button type="button" class="secondary" onclick="closeModal()">إلغاء</button><button type="button" class="primary" id="saveBulkCathBtn" onclick="saveBulkCathList()">حفظ القائمة</button></div></div></div>`)
}
async function upsertPatient(row){
 const name=row.querySelector('[data-b-name]').value.trim(),mobile=row.querySelector('[data-b-mobile]').value.trim(),nid=row.querySelector('[data-b-nid]').value.trim(),age=Number(row.querySelector('[data-b-age]').value);
 if(!name||!mobile||!nid||!Number.isFinite(age))throw new Error('أكمل بيانات كل المرضى');
 if(!/^\d{10,15}$/.test(mobile.replace(/\D/g,'')))throw new Error(`راجع رقم الهاتف للمريض ${name}`);
 const yob=new Date().getFullYear()-age;
 let p=(await sb.from('psh_patients').select('*').eq('national_id',nid).maybeSingle()).data;
 if(!p){const z=await sb.from('psh_patients').insert({arabic_name:name,mobile,national_id:nid,year_of_birth:yob,created_by:me.id}).select().single();if(z.error)throw z.error;p=z.data}
 else{const z=await sb.from('psh_patients').update({arabic_name:name,mobile,year_of_birth:yob}).eq('id',p.id);if(z.error)throw z.error}
 return p;
}
window.saveBulkCathList=async()=>{
 const btn=q('saveBulkCathBtn');if(btn)btn.disabled=true;
 try{
   const code=q('bulkSite').value,date=q('bulkDate').value,consultant=q('bulkConsultant').value.trim();
   const cs=await activeConsultants();if(!cs.some(x=>x.name===consultant))throw new Error('اختر استشارياً من القائمة');
   if(!date)throw new Error('اختر التاريخ');
   const rows=[...document.querySelectorAll('[data-bulk-row]')];if(!rows.length)throw new Error('أضف حالة واحدة على الأقل');
   const conflict=await consultantConflict(code,date,consultant);if(conflict&&!confirmConflict(conflict,consultant,date))return;
   const svc=services.find(x=>x.code===code);if(!svc)throw new Error('خدمة القسطرة غير متاحة');
   let saved=0;
   for(const row of rows){
     const intervention=row.querySelector('[data-b-intervention]').value,note=row.querySelector('[data-b-note]').value.trim();if(!INTERVENTIONS.includes(intervention))throw new Error(`اختر نوع الإجراء في الحالة ${saved+1}`);
     const p=await upsertPatient(row);
     const rr=await sb.from('psh_reservations').insert({patient_id:p.id,service_id:svc.id,scheduled_date:date,consultant_name:consultant,intervention_type:intervention,created_by:me.id,updated_by:me.id}).select().single();if(rr.error)throw rr.error;
     if(note){const n=await sb.from('psh_patient_notes').insert({patient_id:p.id,reservation_id:rr.data.id,note,created_by:me.id});if(n.error)throw n.error}
     saved++;
   }
   closeModal();toast(`تم حفظ ${saved} حالات في قائمة ${siteLabel(code)}`);await loadDashboard();if(typeof openService==='function')await openService(code);
 }catch(e){toast(e.message||'تعذر حفظ القائمة')}finally{if(btn)btn.disabled=false}
};
function install(){installSingleConflictGuard();addBulkButton()}
setTimeout(install,150);const obs=new MutationObserver(()=>install());const host=document.getElementById('new');if(host)obs.observe(host,{childList:true,subtree:true});
})();