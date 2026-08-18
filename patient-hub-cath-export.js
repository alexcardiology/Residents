(()=>{
const servicePage=document.getElementById('service'); if(!servicePage) return;
const head=servicePage.querySelector('.pageHead');
const actions=head?.querySelector(':scope > button')?.parentElement===head?head:null;
const exportBtn=document.createElement('button');
exportBtn.type='button';exportBtn.id='cathExportBtn';exportBtn.className='secondary hidden';exportBtn.textContent='Export';
if(head) head.appendChild(exportBtn);

const cols=[
 {key:'patient',en:'Patient name',ar:'اسم المريض',checked:true},
 {key:'intervention',en:'Type of intervention',ar:'نوع التدخل',checked:true},
 {key:'consultant',en:'Consultant name',ar:'اسم الاستشاري',checked:true},
 {key:'notes',en:'Notes',ar:'ملاحظات',checked:true},
 {key:'date',en:'Date',ar:'التاريخ',checked:false},
 {key:'mobile',en:'Mobile',ar:'الهاتف',checked:false},
 {key:'national_id',en:'National ID',ar:'الرقم القومي',checked:false},
 {key:'status',en:'Status',ar:'الحالة',checked:false},
 {key:'filing',en:'Filing ID',ar:'رقم الحفظ',checked:false}
];
function isCath(){return typeof currentService==='string'&&currentService.startsWith('cath_')}
function syncButton(){exportBtn.classList.toggle('hidden',!isCath());exportBtn.textContent=lang==='ar'?'تصدير':'Export'}
document.addEventListener('click',e=>{if(e.target.closest('[data-service]'))setTimeout(syncButton,80)});document.getElementById('appLang')?.addEventListener('click',()=>setTimeout(syncButton,0));
function esc(v){v=String(v??'');return /[",\n]/.test(v)?'"'+v.replace(/"/g,'""')+'"':v}
function modalHtml(){return `<div class="modalHead"><h2>${lang==='ar'?'تصدير قائمة القسطرة':'Export Cath Lab list'}</h2><button class="close" onclick="closeModal()">×</button></div><p>${lang==='ar'?'اختر الأعمدة المراد تصديرها. الاختيارات الافتراضية محددة مسبقاً.':'Choose which columns to export. Default columns are pre-selected.'}</p><div class="rows" style="margin:14px 0">${cols.map(c=>`<label class="item" style="display:flex;gap:10px;align-items:center"><input type="checkbox" data-export-col="${c.key}" ${c.checked?'checked':''}> <span>${lang==='ar'?c.ar:c.en}</span></label>`).join('')}</div><div class="actions"><button class="secondary" onclick="closeModal()">${lang==='ar'?'إلغاء':'Cancel'}</button><button class="primary" id="doCathExport">${lang==='ar'?'تصدير CSV':'Export CSV'}</button></div>`}
exportBtn.onclick=()=>{if(!isCath())return;modal(modalHtml());document.getElementById('doCathExport').onclick=doExport};
async function doExport(){
 const selected=[...document.querySelectorAll('[data-export-col]:checked')].map(x=>x.dataset.exportCol);if(!selected.length)return toast(lang==='ar'?'اختر عموداً واحداً على الأقل':'Choose at least one column');
 const svc=services.find(x=>x.code===currentService);if(!svc)return toast('Service unavailable');
 let q=sb.from('psh_reservations').select('id,scheduled_date,status,cath_filing_id,consultant_name,intervention_type,patient:psh_patients(arabic_name,mobile,national_id)').eq('service_id',svc.id).order('scheduled_date');
 const d=document.getElementById('serviceDate')?.value||'';const st=document.getElementById('serviceStatus')?.value||'';if(d)q=q.eq('scheduled_date',d);if(st)q=q.eq('status',st);
 const r=await q;if(r.error)return toast(r.error.message);const rows=r.data||[];
 const ids=rows.map(x=>x.id);let noteMap={};if(ids.length){const n=await sb.from('psh_patient_notes').select('reservation_id,note,created_at').in('reservation_id',ids).order('created_at');if(!n.error){for(const x of n.data||[]){if(!noteMap[x.reservation_id])noteMap[x.reservation_id]=[];noteMap[x.reservation_id].push(x.note)}}}
 const labels={patient:'Patient name',intervention:'Type of intervention',consultant:'Consultant name',notes:'Notes',date:'Date',mobile:'Mobile',national_id:'National ID',status:'Status',filing:'Filing ID'};
 const get=(x,k)=>({patient:x.patient?.arabic_name||'',intervention:x.intervention_type||'',consultant:x.consultant_name||'',notes:(noteMap[x.id]||[]).join(' | '),date:fmt(x.scheduled_date),mobile:x.patient?.mobile||'',national_id:x.patient?.national_id||'',status:x.status||'',filing:x.cath_filing_id||''}[k]??'');
 const csv=[selected.map(k=>esc(labels[k])).join(','),...rows.map(x=>selected.map(k=>esc(get(x,k))).join(','))].join('\r\n');
 const blob=new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`Cath_${currentService.replace('cath_','')}_${d||today()}.csv`;document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url);closeModal();toast(lang==='ar'?'تم تصدير القائمة':'List exported');
}
window.syncCathExportButton=syncButton;
setTimeout(syncButton,200);
})();