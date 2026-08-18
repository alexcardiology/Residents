(()=>{
const KEY='psh_nav_state_v2';
function read(){try{return JSON.parse(localStorage.getItem(KEY)||'{}')}catch{return{}}}
function write(p){localStorage.setItem(KEY,JSON.stringify({...read(),...p}))}
function currentServiceCode(){try{return currentService||null}catch{return null}}
function rememberPage(id){write({page:id,service:id==='service'?currentServiceCode():null})}
const originalShow=show;show=function(id){const r=originalShow(id);rememberPage(id);return r};window.show=show;
const originalOpenService=openService;openService=async function(code){write({page:'service',service:code});const r=await originalOpenService(code);return r};window.openService=openService;
document.addEventListener('change',e=>{if(e.target?.id==='serviceDate')write({date:e.target.value});if(e.target?.id==='serviceStatus')write({status:e.target.value})});
document.addEventListener('click',e=>{const p=e.target.closest('[data-page]');if(p)write({page:p.dataset.page,service:null});const s=e.target.closest('[data-service]');if(s)write({page:'service',service:s.dataset.service})},true);
async function restore(){const st=read();if(!profile||document.getElementById('appView')?.classList.contains('hidden'))return false;if(document.getElementById('serviceDate')&&st.date!==undefined)document.getElementById('serviceDate').value=st.date||'';if(document.getElementById('serviceStatus')&&st.status!==undefined)document.getElementById('serviceStatus').value=st.status||'';if(st.page==='service'&&st.service){await openService(st.service);return true}if(st.page&&st.page!=='dashboard'&&document.getElementById(st.page)){show(st.page);return true}return true}
let n=0;const t=setInterval(async()=>{n++;if(typeof profile!=='undefined'&&profile&&!document.getElementById('appView')?.classList.contains('hidden')){clearInterval(t);setTimeout(restore,120)}else if(n>80)clearInterval(t)},100);
window.addEventListener('beforeunload',()=>{const active=document.querySelector('.page.on')?.id||'dashboard';write({page:active,service:active==='service'?currentServiceCode():null,date:document.getElementById('serviceDate')?.value||'',status:document.getElementById('serviceStatus')?.value||''})});
})();