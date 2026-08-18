(()=>{
const interventionLabels=['CA','CA +/- PCI','PCI','CTO','IVUS guided PCI'];
const originalLoadService=window.loadService;
function esc(v=''){return String(v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')}
function isCath(){const s=services.find(x=>x.code===currentService);return s?.category==='cath'}
function ensureCathUi(){
  const table=document.querySelector('#service .tbl'); if(!table) return;
  const thead=table.querySelector('thead tr');
  if(isCath()){
    thead.innerHTML=`<th data-en="Date" data-ar="التاريخ">${lang==='ar'?'التاريخ':'Date'}</th><th data-en="Patient" data-ar="المريض">${lang==='ar'?'المريض':'Patient'}</th><th>Type of intervention</th><th data-en="Consultant" data-ar="الاستشاري">${lang==='ar'?'الاستشاري':'Consultant'}</th><th data-en="Mobile" data-ar="الهاتف">${lang==='ar'?'الهاتف':'Mobile'}</th><th data-en="Status" data-ar="الحالة">${lang==='ar'?'الحالة':'Status'}</th><th data-en="Filing ID" data-ar="رقم الحفظ">${lang==='ar'?'رقم الحفظ':'Filing ID'}</th><th></th>`;
    let btn=document.getElementById('cathExportBtn');
    if(!btn){btn=document.createElement('button');btn.id='cathExportBtn';btn.className='secondary';btn.type='button';btn.onclick=openExportModal;document.querySelector('#service .toolbar')?.appendChild(btn)}
    btn.textContent=lang==='ar'?'تصدير':'Export';
  } else {
    thead.innerHTML=`<th data-en="Date" data-ar="التاريخ">${lang==='ar'?'التاريخ':'Date'}</th><th data-en="Patient" data-ar="المريض">${lang==='ar'?'المريض':'Patient'}</th><th data-en="Mobile" data-ar="الهاتف">${lang==='ar'?'الهاتف':'Mobile'}</th><th data-en="Status" data-ar="الحالة">${lang==='ar'?'الحالة':'Status'}</th><th data-en="Filing ID" data-ar="رقم الحفظ">${lang==='ar'?'رقم الحفظ':'Filing ID'}</th><th></th>`;
    document.getElementById('cathExportBtn')?.remove();
  }
}
async function enhancedLoadService(){
  const s=services.find(x=>x.code===currentService); if(!s)return;
  ensureCathUi();
  let q=sb.from('psh_reservations').select('*,patient:psh_patients(arabic_name,mobile,national_id),service:psh_services(*)').eq('service_id',s.id).order('scheduled_date');
  if($('serviceDate').value)q=q.eq('scheduled_date',$('serviceDate').value);
  if($('serviceStatus').value)q=q.eq('status',$('serviceStatus').value);
  const r=await q;if(r.error)return toast(r.error.message);
  const rows=r.data||[];
  if(s.category==='cath'){
    $('serviceRows').innerHTML=rows.map(x=>`<tr><td>${fmt(x.scheduled_date)}</td><td>${esc(x.patient?.arabic_name||'')}</td><td>${esc(x.intervention_type||'—')}</td><td>${esc(x.consultant_name||'—')}</td><td>${esc(x.patient?.mobile||'')}</td><td>${pill(x.status)}</td><td>${esc(x.cath_filing_id||'—')}</td><td><button class="link" onclick="reservationModal('${x.id}')">${lang==='ar'?'إدارة':'Manage'}</button></td></tr>`).join('')||`<tr><td colspan="8">${lang==='ar'?'لا توجد حجوزات':'No reservations'}</td></tr>`;
  } else {
    $('serviceRows').innerHTML=rows.map(x=>`<tr><td>${fmt(x.scheduled_date)}</td><td>${esc(x.patient?.arabic_name||'')}</td><td>${esc(x.patient?.mobile||'')}</td><td>${pill(x.status)}</td><td>${esc(x.cath_filing_id||'—')}</td><td><button class="link" onclick="reservationModal('${x.id}')">${lang==='ar'?'إدارة':'Manage'}</button></td></tr>`).join('')||`<tr><td colspan="6">${lang==='ar'?'لا توجد حجوزات':'No reservations'}</td></tr>`;
  }
}
window.loadService=enhancedLoadService;
loadService=enhancedLoadService;
async function getCathRows(){const s=services.find(x=>x.code===currentService);if(!s||s.category!=='cath')return[];let q=sb.from('psh_reservations').select('*,patient:psh_patients(arabic_name,mobile,national_id),service:psh_services(*)').eq('service_id',s.id).order('scheduled_date');if($('serviceDate').value)q=q.eq('scheduled_date',$('serviceDate').value);if($('serviceStatus').value)q=q.eq('status',$('serviceStatus').value);const r=await q;if(r.error){toast(r.error.message);return[]}const rows=r.data||[];for(const row of rows){const n=await sb.from('psh_patient_notes').select('note').eq('reservation_id',row.id).order('created_at',{ascending:false});row.notes=(n.data||[]).map(x=>x.note).join(' | ')}return rows}
function openExportModal(){const fields=[['patient','Patient name',true],['intervention','Type of intervention',true],['consultant','Consultant name',true],['notes','Notes',true],['date','Date',false],['mobile','Mobile',false],['nid','National ID',false],['status','Status',false],['filing','Filing ID',false]];modal(`<div class="modalHead"><h2>${lang==='ar'?'تصدير قائمة القسطرة':'Export Cath list'}</h2><button class="close" onclick="closeModal()">×</button></div><p>${lang==='ar'?'اختر الأعمدة المراد تصديرها':'Choose columns to export'}</p><div class="rows">${fields.map(f=>`<label class="item"><input type="checkbox" class="exportCol" value="${f[0]}" ${f[2]?'checked':''}> ${f[1]}</label>`).join('')}</div><div class="actions"><button class="secondary" onclick="closeModal()">${lang==='ar'?'إلغاء':'Cancel'}</button><button class="primary" onclick="exportCathCsv()">${lang==='ar'?'تصدير':'Export'}</button></div>`)}
async function exportCathCsv(){const cols=[...document.querySelectorAll('.exportCol:checked')].map(x=>x.value);if(!cols.length)return toast(lang==='ar'?'اختر عموداً واحداً على الأقل':'Choose at least one column');const rows=await getCathRows();const map={patient:['Patient name',r=>r.patient?.arabic_name||''],intervention:['Type of intervention',r=>r.intervention_type||''],consultant:['Consultant name',r=>r.consultant_name||''],notes:['Notes',r=>r.notes||''],date:['Date',r=>fmt(r.scheduled_date)],mobile:['Mobile',r=>r.patient?.mobile||''],nid:['National ID',r=>r.patient?.national_id||''],status:['Status',r=>r.status||''],filing:['Filing ID',r=>r.cath_filing_id||'']};const csv=[cols.map(c=>map[c][0]),...rows.map(r=>cols.map(c=>map[c][1](r)))].map(row=>row.map(v=>'"'+String(v).replace(/"/g,'""')+'"').join(',')).join('\r\n');const blob=new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`${currentService||'cath'}_${$('serviceDate').value||'all-dates'}.csv`;a.click();URL.revokeObjectURL(a.href);closeModal()}
window.exportCathCsv=exportCathCsv;
window.openExportModal=openExportModal;
document.getElementById('appLang')?.addEventListener('click',()=>setTimeout(()=>{ensureCathUi();if(currentService)enhancedLoadService()},0));
})();