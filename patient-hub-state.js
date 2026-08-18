(()=>{
const KEY='psh_nav_state_v1';
function read(){try{return JSON.parse(localStorage.getItem(KEY)||'{}')}catch{return {}}}
function write(patch){const next={...read(),...patch};localStorage.setItem(KEY,JSON.stringify(next));}
function rememberClick(e){const p=e.target.closest('[data-page]');if(p){write({kind:'page',page:p.dataset.page,service:null});return}const s=e.target.closest('[data-service]');if(s){write({kind:'service',service:s.dataset.service,page:'service'});}}
document.addEventListener('click',rememberClick,true);
function bindFilters(){const d=document.getElementById('serviceDate'),s=document.getElementById('serviceStatus');if(d&&!d.dataset.stateBound){d.dataset.stateBound='1';d.addEventListener('change',()=>write({serviceDate:d.value}));}if(s&&!s.dataset.stateBound){s.dataset.stateBound='1';s.addEventListener('change',()=>write({serviceStatus:s.value}));}}
function restore(){const st=read();if(!window.profile||!document.getElementById('appView')||document.getElementById('appView').classList.contains('hidden'))return false;bindFilters();const d=document.getElementById('serviceDate'),s=document.getElementById('serviceStatus');if(d&&st.serviceDate!==undefined)d.value=st.serviceDate||'';if(s&&st.serviceStatus!==undefined)s.value=st.serviceStatus||'';
if(st.kind==='service'&&st.service&&typeof window.openService==='function'){window.openService(st.service);return true;}
if(st.kind==='page'&&st.page&&typeof window.show==='function'){const target=document.getElementById(st.page);if(target){window.show(st.page);return true;}}
return true;}
let tries=0;const timer=setInterval(()=>{tries++;if(restore()||tries>40)clearInterval(timer)},150);
window.addEventListener('beforeunload',()=>{bindFilters();const active=document.querySelector('.page.on');if(active&&active.id==='service'&&window.currentService)write({kind:'service',service:window.currentService,page:'service'});else if(active)write({kind:'page',page:active.id,service:null});});
})();