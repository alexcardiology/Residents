(()=>{
let dashDay='today',dashService='all';
const ar=()=>typeof lang!=='undefined'&&lang==='ar';
const escD=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const isoAdd=n=>{const d=new Date();d.setDate(d.getDate()+n);return d.toISOString().slice(0,10)};
function fullLocalDate(){
  const d=new Date();
  const locale=ar()?'ar-EG':'en-GB';
  return new Intl.DateTimeFormat(locale,{weekday:'long',day:'numeric',month:'long',year:'numeric'}).format(d);
}
function applyFullDashboardDate(){
  const dashboard=document.getElementById('dashboard');
  if(!dashboard)return;
  const h2=dashboard.querySelector('.pageHead h2');
  const smallDate=document.getElementById('todayLabel');
  if(h2)h2.textContent=fullLocalDate();
  if(smallDate)smallDate.textContent='';
}
window.applyPSHFullDashboardDate=applyFullDashboardDate;
function serviceCode(r){return r.service?.code||''}
function loc(r){const c=serviceCode(r);if(c==='cath_miri')return'الميري';if(c==='cath_smouha')return'سموحة';return r.service?.name_ar||r.service?.name_en||c||'—'}
function enhanceMarkup(){const d=document.getElementById('dashboard');if(!d)return;if(d.dataset.ops==='1'){applyFullDashboardDate();return}d.dataset.ops='1';
 const head=d.querySelector('.pageHead');if(head){head.classList.add('dashTop');const search=document.createElement('div');search.className='dashSearch';search.innerHTML='<input id="dashSearch" type="search" autocomplete="off" placeholder="بحث سريع: المريض، الهاتف، الرقم القومي، الطبيب، المكان أو التدخل"><button id="dashSearchBtn" class="primary">بحث</button>';head.insertBefore(search,head.lastElementChild)}
 const old=d.querySelector('.panelGrid');if(old)old.remove();
 const ops=document.createElement('div');ops.className='opsGrid';ops.innerHTML=`<div class="opsStack"><section class="dashCard"><div class="sectionHead"><h3>قوائم العمل</h3><button class="secondary" id="dashRefresh">تحديث</button></div><div class="dayTabs"><button data-dday="today" class="active">اليوم</button><button data-dday="tomorrow">غداً</button></div><div class="serviceTabs"><button data-dsvc="all" class="active">الكل</button><button data-dsvc="cath_miri">الميري</button><button data-dsvc="cath_smouha">سموحة</button><button data-dsvc="echo">الإيكو</button><button data-dsvc="other">هولتر / مجهود</button></div><div id="dashCases"></div></section><section class="dashCard"><h3>تنبيهات تحتاج تدخل</h3><div id="dashAlerts"></div></section></div><div class="opsStack"><section class="dashCard"><h3>وصول سريع</h3><div class="quickGrid"><button class="secondary" data-service="cath_miri">قسطرة الميري</button><button class="secondary" data-service="cath_smouha">قسطرة سموحة</button><button class="secondary" data-service="echo_miri">إيكو الميري</button><button class="secondary" data-service="echo_smouha">إيكو سموحة</button><button class="secondary" data-service="tee">إيكو بالمنظار</button><button class="secondary" data-service="dse">إيكو بالمجهود الدوائي</button><button class="secondary" data-service="holter">هولتر</button><button class="secondary" data-service="exercise_ecg">رسم قلب بالمجهود</button><button class="secondary" data-page="patients">بحث المرضى</button><button class="primary" data-page="new">+ حجز جديد</button></div></section><section class="dashCard"><h3>آخر النشاطات</h3><div id="dashActivity"></div></section></div>`;d.appendChild(ops);
 document.getElementById('dashSearchBtn').onclick=goSearch;document.getElementById('dashSearch').onkeydown=e=>{if(e.key==='Enter')goSearch()};document.getElementById('dashRefresh').onclick=loadOps;
 d.querySelectorAll('[data-dday]').forEach(b=>b.onclick=()=>{dashDay=b.dataset.dday;d.querySelectorAll('[data-dday]').forEach(x=>x.classList.toggle('active',x===b));loadOps()});
 d.querySelectorAll('[data-dsvc]').forEach(b=>b.onclick=()=>{dashService=b.dataset.dsvc;d.querySelectorAll('[data-dsvc]').forEach(x=>x.classList.toggle('active',x===b));loadOps()});
 d.querySelectorAll('.kpi').forEach((k,i)=>k.onclick=()=>{if(i===0){dashDay='today';loadOps()}else if(i===1){dashDay='tomorrow';loadOps()}else if(i===2){const b=d.querySelector('[data-dsvc="cath_miri"]');if(b)b.click()}else if(i===3){show('patients')}});
 applyFullDashboardDate();
}
function goSearch(){const v=document.getElementById('dashSearch')?.value.trim();if(!v)return;const p=document.getElementById('patientSearch');if(p)p.value=v;show('patients');if(typeof enhancedSearchPatients==='function')enhancedSearchPatients();else if(typeof searchPatients==='function')searchPatients()}
function matchSvc(r){const c=serviceCode(r),cat=r.service?.category;if(dashService==='all')return true;if(dashService==='echo')return cat==='echo'||['echo_miri','echo_smouha','tee','dse'].includes(c);if(dashService==='other')return ['holter','exercise_ecg'].includes(c);return c===dashService}
async function loadOps(){applyFullDashboardDate();if(typeof sb==='undefined'||!document.getElementById('dashCases'))return;const date=dashDay==='tomorrow'?isoAdd(1):isoAdd(0);const q=await sb.from('psh_reservations').select('id,scheduled_date,status,cath_filing_id,consultant_name,intervention_type,patient:psh_patients(arabic_name,mobile,national_id),service:psh_services(code,name_ar,name_en,category)').eq('scheduled_date',date).order('created_at',{ascending:true});const rows=(q.data||[]).filter(matchSvc);document.getElementById('dashCases').innerHTML=rows.length?rows.map(r=>`<div class="dashCase"><div><strong>${escD(r.patient?.arabic_name||'')}</strong> · ${escD(loc(r))}${r.intervention_type?' · '+escD(r.intervention_type):''}<div class="dashCaseMeta">${escD(r.consultant_name||'بدون استشاري')} · ${escD(r.patient?.mobile||'')}</div></div><div class="dashActions">${r.patient?.mobile?`<a class="miniAction" href="tel:${escD(r.patient.mobile)}">☎</a><a class="miniAction" href="https://wa.me/2${escD(r.patient.mobile.replace(/^0/,''))}" target="_blank">واتساب</a>`:''}<button class="miniAction" onclick="reservationModal('${r.id}')">إدارة</button></div></div>`).join(''):'<div class="emptyDash">لا توجد حالات في هذه القائمة</div>';
 const allQ=await sb.from('psh_reservations').select('id,scheduled_date,status,cath_filing_id,consultant_name,patient:psh_patients(arabic_name),service:psh_services(code,category,name_ar)').gte('scheduled_date',isoAdd(0)).order('scheduled_date').limit(120);const all=allQ.data||[];const pending=all.filter(r=>r.service?.category==='cath'&&!r.cath_filing_id&&!['cancelled','no_show'].includes(r.status));const noDoc=all.filter(r=>!r.consultant_name&&!['cancelled','no_show'].includes(r.status));const alerts=[];if(pending.length)alerts.push(`${pending.length} حالة قسطرة بدون رقم تقرير`);if(noDoc.length)alerts.push(`${noDoc.length} حجز بدون اسم استشاري`);document.getElementById('dashAlerts').innerHTML=alerts.length?alerts.map(x=>`<div class="alertItem">${x}</div>`).join(''):'<div class="emptyDash">لا توجد تنبيهات حالياً</div>';
 const recent=all.slice().sort((a,b)=>String(b.scheduled_date).localeCompare(String(a.scheduled_date))).slice(0,5);document.getElementById('dashActivity').innerHTML=recent.length?recent.map(r=>`<div class="dashCase"><div><strong>${escD(r.patient?.arabic_name||'')}</strong><div class="dashCaseMeta">${escD(loc(r))} · ${escD(r.scheduled_date)}</div></div></div>`).join(''):'<div class="emptyDash">لا يوجد نشاط</div>';
}
function boot(){
  enhanceMarkup();
  applyFullDashboardDate();
  const app=document.getElementById('appView');
  if(app){
    new MutationObserver(()=>{
      if(!app.classList.contains('hidden')){
        enhanceMarkup();
        applyFullDashboardDate();
        loadOps();
      }
    }).observe(app,{attributes:true,attributeFilter:['class']});
  }
  new MutationObserver(()=>applyFullDashboardDate()).observe(document.documentElement,{attributes:true,attributeFilter:['dir','lang']});
  setTimeout(()=>{enhanceMarkup();applyFullDashboardDate();loadOps()},700);
}
document.readyState==='loading'?document.addEventListener('DOMContentLoaded',boot):boot();window.loadOperationalDashboard=loadOps;
})();
