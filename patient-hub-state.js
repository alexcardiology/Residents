(()=>{
const KEY='psh_nav_state_v4';
const app=document.getElementById('appView'),login=document.getElementById('loginView');
// Hide BOTH login and app until Supabase session + saved navigation state are resolved.
if(app) app.style.visibility='hidden';
if(login) login.style.visibility='hidden';
const boot=document.createElement('div');boot.id='pshBoot';boot.style.cssText='position:fixed;inset:0;z-index:9999;display:grid;place-items:center;background:linear-gradient(135deg,#fffaf6,#fff2e7);color:#8a2d0c;font:850 18px Inter,system-ui,-apple-system,Segoe UI,Arial,sans-serif';boot.innerHTML='<div style="display:grid;place-items:center;gap:10px"><div style="font-size:38px">♥</div><div>Patient Service Hub</div></div>';document.body.appendChild(boot);
function read(){try{return JSON.parse(localStorage.getItem(KEY)||localStorage.getItem('psh_nav_state_v3')||'{}')}catch{return{}}}
function write(p){localStorage.setItem(KEY,JSON.stringify({...read(),...p}))}
function currentServiceCode(){try{return currentService||null}catch{return null}}
function finishBoot(showLogin=false){if(showLogin&&login)login.style.visibility='visible';if(boot)boot.remove()}

document.addEventListener('click',e=>{
  const p=e.target.closest('[data-page]');if(p)write({page:p.dataset.page,service:null});
  const s=e.target.closest('[data-service]');if(s)write({page:'service',service:s.dataset.service});
  const t=e.target.closest('[data-toggle]');if(t){const id=t.dataset.toggle;setTimeout(()=>{const el=document.getElementById(id);if(el)write({[id+'Collapsed']:el.classList.contains('hidden')})},0)}
},true);
document.addEventListener('change',e=>{if(e.target?.id==='serviceDate')write({date:e.target.value});if(e.target?.id==='serviceStatus')write({status:e.target.value});if(e.target?.id==='rangeFrom')write({rangeFrom:e.target.value});if(e.target?.id==='rangeTo')write({rangeTo:e.target.value})});
function restoreDrawer(st){['cath','echo'].forEach(id=>{const el=document.getElementById(id),key=id+'Collapsed';if(el&&typeof st[key]==='boolean')el.classList.toggle('hidden',st[key])})}
function revealApp(){if(app)app.style.visibility='visible';finishBoot(false)}
async function restore(){const st=read();restoreDrawer(st);if(st.page==='service'&&st.service){await openService(st.service);await new Promise(r=>setTimeout(r,40));const d=document.getElementById('serviceDate'),status=document.getElementById('serviceStatus'),rf=document.getElementById('rangeFrom'),rt=document.getElementById('rangeTo');if(d&&st.date!==undefined)d.value=st.date||'';if(status&&st.status!==undefined)status.value=st.status||'';if(rf&&st.rangeFrom!==undefined)rf.value=st.rangeFrom||'';if(rt&&st.rangeTo!==undefined)rt.value=st.rangeTo||'';if(typeof loadService==='function')await loadService();restoreDrawer(st);revealApp();return}if(st.page&&st.page!=='dashboard'){if(document.getElementById(st.page)){show(st.page);restoreDrawer(st);revealApp();return}if(st.page==='adminCath'){let tries=0;const a=setInterval(()=>{tries++;if(document.getElementById('adminCath')){clearInterval(a);show('adminCath');restoreDrawer(st);revealApp()}else if(tries>30){clearInterval(a);revealApp()}},50);return}}restoreDrawer(st);revealApp()}
(async()=>{const {data:{session}}=await sb.auth.getSession();if(!session){if(app)app.style.visibility='visible';finishBoot(true);return}let n=0;const t=setInterval(()=>{n++;if(typeof profile!=='undefined'&&profile&&app&&!app.classList.contains('hidden')){clearInterval(t);restore()}else if(n>120){clearInterval(t);if(app)app.style.visibility='visible';finishBoot(false)}},50)})();
window.addEventListener('beforeunload',()=>{const active=document.querySelector('.page.on')?.id||'dashboard';const st={page:active,service:active==='service'?currentServiceCode():null,date:document.getElementById('serviceDate')?.value||'',status:document.getElementById('serviceStatus')?.value||'',rangeFrom:document.getElementById('rangeFrom')?.value||'',rangeTo:document.getElementById('rangeTo')?.value||''};['cath','echo'].forEach(id=>{const el=document.getElementById(id);if(el)st[id+'Collapsed']=el.classList.contains('hidden')});write(st)});
})();