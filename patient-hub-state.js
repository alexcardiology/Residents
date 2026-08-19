(()=>{
const KEY='psh_nav_state_v6';
function read(){try{return JSON.parse(localStorage.getItem(KEY)||localStorage.getItem('psh_nav_state_v5')||localStorage.getItem('psh_nav_state_v4')||localStorage.getItem('psh_nav_state_v3')||'{}')}catch{return{}}}
function write(p){try{localStorage.setItem(KEY,JSON.stringify({...read(),...p}))}catch{}}
function installDrawerLabels(){
 const labels={cath_miri:['Miri','الميري'],cath_smouha:['Smouha','سموحة'],echo_miri:['Miri','الميري'],echo_smouha:['Smouha','سموحة'],tee:['TEE','إيكو بالمنظار'],dse:['DSE','إيكو بالمجهود الدوائي'],holter:['Holter','رسم قلب ممتد هولتر'],exercise_ecg:['Exercise ECG','رسم قلب بالمجهود']};
 Object.entries(labels).forEach(([code,[en,ar]])=>{const b=document.querySelector(`.nav [data-service="${code}"]`);if(!b)return;const icon=code==='holter'?'◌ ':code==='exercise_ecg'?'⌁ ':'';b.innerHTML=`${icon}<span data-en="${en}" data-ar="${ar}">${en}</span>`});
 const cath=document.querySelector('.nav [data-toggle="cath"] span:first-child');if(cath){cath.dataset.en='♥ Cath Lab';cath.dataset.ar='♥ معمل القسطرة'}
 const echo=document.querySelector('.nav [data-toggle="echo"] span:first-child');if(echo){echo.dataset.en='◉ Echo Lab';echo.dataset.ar='◉ معمل الإيكو'}
 const quickLabels={cath_miri:'قسطرة الميري',cath_smouha:'قسطرة سموحة',echo_miri:'إيكو الميري'};
 Object.entries(quickLabels).forEach(([code,ar])=>{const b=document.querySelector(`#dashboard [data-service="${code}"]`);if(!b)return;if(!b.dataset.en)b.dataset.en=b.textContent.trim();b.dataset.ar=ar});
 if(typeof applyLang==='function')applyLang();
}
function restoreDrawer(st){['cath','echo'].forEach(id=>{const el=document.getElementById(id),k=id+'Collapsed';if(el&&typeof st[k]==='boolean')el.classList.toggle('hidden',st[k])})}
async function restoreState(){const st=read();restoreDrawer(st);try{if(st.page==='service'&&st.service&&typeof openService==='function'){await openService(st.service);const d=document.getElementById('serviceDate'),s=document.getElementById('serviceStatus'),rf=document.getElementById('rangeFrom'),rt=document.getElementById('rangeTo');if(d&&st.date!==undefined)d.value=st.date||'';if(s&&st.status!==undefined)s.value=st.status||'';if(rf&&st.rangeFrom!==undefined)rf.value=st.rangeFrom||'';if(rt&&st.rangeTo!==undefined)rt.value=st.rangeTo||'';if(typeof loadService==='function')await loadService();if(typeof enforcePSHDateFilter==='function')enforcePSHDateFilter();restoreDrawer(st);return}if(st.page&&st.page!=='dashboard'&&document.getElementById(st.page)&&typeof show==='function'){show(st.page);restoreDrawer(st)}}catch(e){console.error('PSH state restore failed',e)}}
window.restorePSHState=restoreState;
installDrawerLabels();
let restored=false;const app=document.getElementById('appView');const tryRestore=()=>{if(restored||!app||app.classList.contains('hidden'))return;restored=true;setTimeout(()=>restoreState(),0)};if(app){new MutationObserver(tryRestore).observe(app,{attributes:true,attributeFilter:['class']});tryRestore()}
document.addEventListener('click',e=>{const p=e.target.closest('[data-page]');if(p)write({page:p.dataset.page,service:null});const s=e.target.closest('[data-service]');if(s)write({page:'service',service:s.dataset.service});const t=e.target.closest('[data-toggle]');if(t){const id=t.dataset.toggle;setTimeout(()=>{const el=document.getElementById(id);if(el)write({[id+'Collapsed']:el.classList.contains('hidden')})},0)}},true);
document.addEventListener('change',e=>{if(e.target?.id==='serviceDate')write({date:e.target.value,rangeFrom:'',rangeTo:''});if(e.target?.id==='serviceStatus')write({status:e.target.value});if(e.target?.id==='rangeFrom')write({rangeFrom:e.target.value,date:''});if(e.target?.id==='rangeTo')write({rangeTo:e.target.value,date:''})});
document.getElementById('appLang')?.addEventListener('click',()=>setTimeout(installDrawerLabels,0));
window.addEventListener('beforeunload',()=>{const active=document.querySelector('.page.on')?.id||'dashboard';const st={page:active,service:active==='service'?(typeof currentService!=='undefined'?currentService:null):null,date:document.getElementById('serviceDate')?.value||'',status:document.getElementById('serviceStatus')?.value||'',rangeFrom:document.getElementById('rangeFrom')?.value||'',rangeTo:document.getElementById('rangeTo')?.value||''};['cath','echo'].forEach(id=>{const el=document.getElementById(id);if(el)st[id+'Collapsed']=el.classList.contains('hidden')});write(st)});
const filterFix=document.createElement('script');filterFix.src='./patient-hub-filter-fix.js?v=20260819-1';document.body.appendChild(filterFix);
})();