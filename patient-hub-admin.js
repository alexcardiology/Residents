(()=>{
const style=document.createElement('style');
style.textContent=`
.adminCathCard{padding:16px}
.adminToolbar{display:grid;grid-template-columns:92px minmax(220px,1fr) auto auto;gap:8px;align-items:center;margin-bottom:16px}
.adminToolbar input,.adminToolbar select{height:44px;border:1px solid var(--line);border-radius:10px;padding:0 12px;background:#fff}
.adminToolbar select{font-weight:800;text-align:center}
.dangerBtn{border:1px solid #efb1ac;background:#fff5f4;color:#b42318;border-radius:10px;padding:10px 13px;font-weight:800;cursor:pointer}
.consultantList{display:grid;gap:7px}
.consultantRow{display:grid;grid-template-columns:76px minmax(220px,1fr) auto auto auto;gap:7px;align-items:center;border:1px solid #edd7ca;border-radius:11px;padding:8px 10px;background:#fff}
.consultantRow input,.consultantRow select{height:40px;border:1px solid var(--line);border-radius:9px;padding:0 10px;background:#fffdfa}
.consultantRow select{font-weight:850;text-align:center}
.consultantRow .listBtn{white-space:nowrap}
.consultantListsWrap{direction:rtl}
.consultantListsSummary{display:flex;gap:8px;flex-wrap:wrap;margin:10px 0 14px}
.consultantListsSummary span{background:#fff3e9;border:1px solid #f3cbb3;border-radius:999px;padding:6px 10px;font-size:13px;font-weight:750}
.consultantListsTable{width:100%;border-collapse:collapse;min-width:760px}
.consultantListsTable th,.consultantListsTable td{padding:9px;border-bottom:1px solid #f1dfd4;text-align:right}
.consultantListsTable th{background:#fff4eb;color:#7b3a1f}
.reportedTag{display:inline-block;background:#e6f6eb;color:#198754;border-radius:999px;padding:3px 8px;font-size:12px;font-weight:800}
.pendingTag{display:inline-block;background:#fff0e5;color:#b34a12;border-radius:999px;padding:3px 8px;font-size:12px;font-weight:800}
@media(max-width:760px){
 .adminToolbar{grid-template-columns:82px 1fr}
 .adminToolbar .primary,.adminToolbar .dangerBtn{width:100%}
 .consultantRow{grid-template-columns:70px 1fr}
 .consultantRow button{width:100%}
}
`;
document.head.appendChild(style);

let mounted=false;

function parseConsultantName(value){
  const raw=String(value||'').trim();
  const prof=/^(ا\.?\s*د\.?|أ\.?\s*د\.?|prof\.?\s*dr\.?)\s*/i;
  if(prof.test(raw))return{title:'prof',name:raw.replace(prof,'').trim()};
  const dr=/^(د\.?|dr\.?)\s*/i;
  if(dr.test(raw))return{title:'dr',name:raw.replace(dr,'').trim()};
  return{title:'dr',name:raw};
}

function composeConsultantName(title,name){
  const clean=String(name||'').trim()
    .replace(/^(ا\.?\s*د\.?|أ\.?\s*د\.?|prof\.?\s*dr\.?|د\.?|dr\.?)\s*/i,'')
    .trim();
  if(!clean)return'';
  return `${title==='prof'?'ا.د.':'د.'} ${clean}`;
}

function safe(v){
  return String(v||'')
    .replace(/&/g,'&amp;')
    .replace(/"/g,'&quot;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;');
}

function fullArabicDate(v){
  if(!v)return'—';
  const d=new Date(String(v).slice(0,10)+'T12:00:00');
  return new Intl.DateTimeFormat('ar-EG',{
    weekday:'long',day:'numeric',month:'long',year:'numeric'
  }).format(d);
}

function placeLabel(code){
  if(code==='cath_miri')return'الميري';
  if(code==='cath_smouha')return'سموحة';
  return code||'—';
}

function titleOption(value,current){
  return `<option value="${value}" ${current===value?'selected':''}>${value==='prof'?'ا.د.':'د.'}</option>`;
}

function ensureAdminUi(){
  if(mounted||typeof profile==='undefined'||!profile||profile.role!=='admin')return;
  mounted=true;

  const nav=document.querySelector('.nav');
  const btn=document.createElement('button');
  btn.dataset.page='adminCath';
  btn.innerHTML='♟ <span data-en="Cath consultant list" data-ar="قائمة استشاريي القسطرة">قائمة استشاريي القسطرة</span>';
  nav.appendChild(btn);

  const content=document.querySelector('.content');
  const section=document.createElement('section');
  section.id='adminCath';
  section.className='page';
  section.innerHTML=`
    <div class="pageHead">
      <div>
        <h2 data-en="Cath consultant list" data-ar="قائمة استشاريي القسطرة">قائمة استشاريي القسطرة</h2>
        <p data-en="Choose the Arabic title, then type the name only" data-ar="اختر الدرجة ثم اكتب الاسم فقط">اختر الدرجة ثم اكتب الاسم فقط</p>
      </div>
    </div>

    <div class="card adminCathCard">
      <div class="adminToolbar">
        <select id="newConsultantTitle">
          <option value="prof">ا.د.</option>
          <option value="dr" selected>د.</option>
        </select>
        <input id="newConsultantName" placeholder="اكتب الاسم فقط" autocomplete="off">
        <button id="addConsultantBtn" class="primary">إضافة استشاري</button>
        <button id="resetConsultantsBtn" class="dangerBtn">مسح كل الأسماء</button>
      </div>
      <div id="consultantAdminList" class="consultantList"></div>
    </div>`;

  content.appendChild(section);

  document.getElementById('addConsultantBtn').onclick=addConsultant;
  document.getElementById('resetConsultantsBtn').onclick=resetAllConsultants;
  document.getElementById('newConsultantName').onkeydown=e=>{
    if(e.key==='Enter'){
      e.preventDefault();
      addConsultant();
    }
  };

  loadAdminConsultants();
  if(typeof applyLang==='function')applyLang();
}

async function loadAdminConsultants(){
  const host=document.getElementById('consultantAdminList');
  if(!host)return;

  const r=await sb.from('psh_cath_consultants')
    .select('*')
    .order('sort_order')
    .order('name');

  if(r.error){
    host.innerHTML=`<div class="placeholder">${safe(r.error.message)}</div>`;
    return;
  }

  const a=r.data||[];
  host.innerHTML=a.length
    ?a.map(x=>{
      const p=parseConsultantName(x.name);
      return `
        <div class="consultantRow">
          <select id="consultantTitle_${x.id}">
            ${titleOption('prof',p.title)}
            ${titleOption('dr',p.title)}
          </select>

          <input id="consultant_${x.id}" value="${safe(p.name)}" placeholder="الاسم فقط">

          <button class="secondary listBtn" onclick="window.viewCathConsultantLists(${x.id})">عرض القوائم</button>
          <button class="secondary" onclick="window.editCathConsultant(${x.id})">حفظ</button>
          <button class="dangerBtn" onclick="window.deleteCathConsultant(${x.id})">حذف</button>
        </div>`;
    }).join('')
    :`<div class="placeholder">لا توجد أسماء حتى الآن</div>`;
}

async function addConsultant(){
  const input=document.getElementById('newConsultantName');
  const title=document.getElementById('newConsultantTitle')?.value||'dr';
  const name=composeConsultantName(title,input.value);
  if(!name)return toast('اكتب الاسم');

  const r=await sb.from('psh_cath_consultants')
    .insert({name,created_by:me.id})
    .select()
    .single();

  if(r.error)return toast(r.error.message);

  input.value='';
  await loadAdminConsultants();
  if(window.refreshCathConsultants)await window.refreshCathConsultants();
  toast('تمت إضافة الاستشاري');
}

async function editConsultant(id){
  const input=document.getElementById('consultant_'+id);
  const title=document.getElementById('consultantTitle_'+id)?.value||'dr';
  const name=composeConsultantName(title,input.value);

  if(!name)return toast('الاسم لا يمكن أن يكون فارغاً');

  const r=await sb.from('psh_cath_consultants')
    .update({name})
    .eq('id',id);

  if(r.error)return toast(r.error.message);

  await loadAdminConsultants();
  if(window.refreshCathConsultants)await window.refreshCathConsultants();
  toast('تم تعديل الاسم');
}

async function deleteConsultant(id){
  if(!confirm('حذف هذا الاستشاري من القائمة؟'))return;

  const r=await sb.from('psh_cath_consultants')
    .delete()
    .eq('id',id);

  if(r.error)return toast(r.error.message);

  await loadAdminConsultants();
  if(window.refreshCathConsultants)await window.refreshCathConsultants();
  toast('تم الحذف');
}

async function resetAllConsultants(){
  const text='سيتم حذف جميع أسماء الاستشاريين من القائمة. الحجوزات القديمة لن تُحذف. هل أنت متأكد؟';
  if(!confirm(text))return;

  const r=await sb.from('psh_cath_consultants')
    .delete()
    .gte('id',0);

  if(r.error)return toast(r.error.message);

  await loadAdminConsultants();
  if(window.refreshCathConsultants)await window.refreshCathConsultants();
  toast('تم مسح كل الأسماء');
}

async function viewConsultantLists(id){
  const nameInput=document.getElementById('consultant_'+id);
  const title=document.getElementById('consultantTitle_'+id)?.value||'dr';
  const fullName=composeConsultantName(title,nameInput?.value||'');

  if(!fullName)return toast('اسم الاستشاري غير متاح');

  const q=await sb.from('psh_reservations')
    .select(`
      id,
      scheduled_date,
      status,
      cath_filing_id,
      intervention_type,
      consultant_name,
      patient:psh_patients(arabic_name,mobile),
      service:psh_services(code,category)
    `)
    .eq('consultant_name',fullName)
    .order('scheduled_date',{ascending:false})
    .limit(500);

  if(q.error)return toast(q.error.message);

  const rows=(q.data||[]).filter(r=>r.service?.category==='cath');
  const miri=rows.filter(r=>r.service?.code==='cath_miri').length;
  const smouha=rows.filter(r=>r.service?.code==='cath_smouha').length;
  const reported=rows.filter(r=>r.cath_filing_id).length;

  const body=rows.length
    ?rows.map(r=>`
      <tr>
        <td>${safe(fullArabicDate(r.scheduled_date))}</td>
        <td>${safe(placeLabel(r.service?.code))}</td>
        <td><strong>${safe(r.patient?.arabic_name||'—')}</strong><br><small>${safe(r.patient?.mobile||'')}</small></td>
        <td>${safe(r.intervention_type||'—')}</td>
        <td>${r.cath_filing_id
          ?`<span class="reportedTag">تم التقرير · ${safe(r.cath_filing_id)}</span>`
          :`<span class="pendingTag">لم يكتب التقرير</span>`}
        </td>
        <td><button class="secondary" onclick="closeModal();reservationModal('${r.id}')">إدارة</button></td>
      </tr>`).join('')
    :`<tr><td colspan="6" style="text-align:center;padding:24px">لا توجد قوائم مسجلة لهذا الاستشاري</td></tr>`;

  modal(`
    <div class="consultantListsWrap">
      <div class="modalHead">
        <div>
          <h2 style="margin:0">${safe(fullName)}</h2>
          <div style="color:var(--mut);margin-top:4px">قوائم القسطرة</div>
        </div>
        <button class="close" onclick="closeModal()">×</button>
      </div>

      <div class="consultantListsSummary">
        <span>إجمالي الحالات: ${rows.length}</span>
        <span>الميري: ${miri}</span>
        <span>سموحة: ${smouha}</span>
        <span>تم كتابة التقرير: ${reported}</span>
      </div>

      <div class="tableWrap">
        <table class="consultantListsTable">
          <thead>
            <tr>
              <th>التاريخ</th>
              <th>المكان</th>
              <th>المريض</th>
              <th>نوع التدخل</th>
              <th>التقرير</th>
              <th></th>
            </tr>
          </thead>
          <tbody>${body}</tbody>
        </table>
      </div>
    </div>`);
}

window.editCathConsultant=editConsultant;
window.deleteCathConsultant=deleteConsultant;
window.viewCathConsultantLists=viewConsultantLists;
window.loadAdminConsultants=loadAdminConsultants;

const timer=setInterval(()=>{
  if(typeof profile!=='undefined'&&profile){
    ensureAdminUi();
    clearInterval(timer);
  }
},250);

if(!document.querySelector('script[data-cath-export]')){
  const s=document.createElement('script');
  s.src='./patient-hub-cath-export.js?v=1';
  s.dataset.cathExport='1';
  document.body.appendChild(s);
}
})();