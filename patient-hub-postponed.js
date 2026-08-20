(()=>{
const escP=v=>String(v??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const arDateP=v=>{
 if(!v)return'—';
 const d=new Date(v+'T12:00:00');
 return new Intl.DateTimeFormat('ar-EG',{weekday:'long',day:'numeric',month:'long',year:'numeric'}).format(d);
};
const placeP=code=>code==='cath_miri'?'الميري':code==='cath_smouha'?'سموحة':code||'—';

function installPostponedButton(){
 if(typeof profile==='undefined'||!profile||!['admin','secretary','head_nurse'].includes(profile.role))return false;
 if(document.getElementById('postponedCathBtn'))return true;
 const nav=document.querySelector('.nav');
 if(!nav)return false;
 const btn=document.createElement('button');
 btn.id='postponedCathBtn';
 btn.type='button';
 btn.innerHTML='⏸ <span>الحالات المؤجلة</span> <span id="postponedCathCount"></span>';
 const inbox=nav.querySelector('[data-page="inbox"]');
 if(inbox)nav.insertBefore(btn,inbox);else nav.appendChild(btn);
 btn.onclick=openPostponedCases;
 refreshPostponedCount();
 return true;
}

async function postponedData(){
 const {data,error}=await sb.rpc('psh_cath_postponed_cases');
 if(error)throw error;
 return data||[];
}

async function refreshPostponedCount(){
 try{
   const rows=await postponedData();
   const c=document.getElementById('postponedCathCount');
   if(c)c.textContent=rows.length?`(${rows.length})`:'';
 }catch(e){console.warn(e)}
}

async function openPostponedCases(){
 let rows=[];
 try{rows=await postponedData()}catch(e){return toast(e.message)}
 const body=rows.length?rows.map(r=>`<tr>
   <td>${escP(arDateP(r.scheduled_date))}</td>
   <td><strong>${escP(r.patient_name)}</strong><br><small>${escP(r.mobile||'')}</small></td>
   <td>${escP(placeP(r.service_code))}</td>
   <td>${escP(r.consultant_name||'—')}</td>
   <td>${escP(r.cath_filing_id||'—')}</td>
   <td>${r.cath_cd_received?'نعم':'لا'}</td>
   <td style="max-width:330px;white-space:normal"><strong style="color:#b54708">${escP(r.postponed_reason||'—')}</strong></td>
   <td>${escP(r.cath_report_resident_name||'—')}</td>
   <td>${r.item_type==='reservation'?`<button class="secondary" onclick="closeModal();reservationModal('${r.item_id}')">إدارة</button>`:'حالة مضافة من نائب القسطرة'}</td>
 </tr>`).join(''):`<tr><td colspan="9" style="text-align:center;padding:28px">لا توجد حالات مؤجلة</td></tr>`;
 modal(`<div dir="rtl">
   <div class="modalHead">
     <div><h2 style="margin:0">الحالات المؤجلة</h2><div style="color:var(--mut);margin-top:5px">حالات القسطرة التي تم تسجيلها كتأجيل</div></div>
     <button class="close" onclick="closeModal()">×</button>
   </div>
   <div class="tableWrap" style="margin-top:15px">
     <table class="tbl" style="min-width:1200px">
       <thead><tr>
         <th>التاريخ</th><th>المريض</th><th>المكان</th><th>الاستشاري</th><th>رقم التقرير</th><th>استلم CD</th><th>سبب التأجيل</th><th>نائب القسطرة</th><th></th>
       </tr></thead>
       <tbody>${body}</tbody>
     </table>
   </div>
 </div>`);
}

window.openPostponedCases=openPostponedCases;
window.refreshPostponedCount=refreshPostponedCount;

const timer=setInterval(()=>{if(installPostponedButton())clearInterval(timer)},250);
setInterval(refreshPostponedCount,60000);
})();