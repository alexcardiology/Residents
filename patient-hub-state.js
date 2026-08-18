(()=>{
const KEY='psh_nav_state_v3';
function read(){try{return JSON.parse(localStorage.getItem(KEY)||'{}')}catch{return{}}}
function write(p){localStorage.setItem(KEY,JSON.stringify({...read(),...p}))}
function currentServiceCode(){try{return currentService||null}catch{return null}}

// Only save explicit user navigation. Do NOT wrap show()/openService(), because enter()
// always calls show('dashboard') during startup and would overwrite the saved location.
document.addEventListener('click',e=>{
  const p=e.target.closest('[data-page]');
  if(p) write({page:p.dataset.page,service:null});
  const s=e.target.closest('[data-service]');
  if(s) write({page:'service',service:s.dataset.service});
  const t=e.target.closest('[data-toggle]');
  if(t){
    const id=t.dataset.toggle;
    setTimeout(()=>{
      const el=document.getElementById(id);
      if(el) write({[id+'Collapsed']:el.classList.contains('hidden')});
    },0);
  }
},true);

document.addEventListener('change',e=>{
  if(e.target?.id==='serviceDate') write({date:e.target.value});
  if(e.target?.id==='serviceStatus') write({status:e.target.value});
  if(e.target?.id==='rangeFrom') write({rangeFrom:e.target.value});
  if(e.target?.id==='rangeTo') write({rangeTo:e.target.value});
});

function restoreDrawer(st){
  ['cath','echo'].forEach(id=>{
    const el=document.getElementById(id);
    const key=id+'Collapsed';
    if(el && typeof st[key]==='boolean') el.classList.toggle('hidden',st[key]);
  });
}

async function restore(){
  const st=read();
  if(!profile || document.getElementById('appView')?.classList.contains('hidden')) return false;
  restoreDrawer(st);

  // Restore requested section AFTER startup's forced Dashboard has completed.
  if(st.page==='service' && st.service){
    await openService(st.service);
    // Cath toolbar may be rebuilt by openService/loadService, so restore its filters afterwards.
    setTimeout(()=>{
      const d=document.getElementById('serviceDate'), status=document.getElementById('serviceStatus');
      if(d && st.date!==undefined) d.value=st.date||'';
      if(status && st.status!==undefined) status.value=st.status||'';
      const rf=document.getElementById('rangeFrom'), rt=document.getElementById('rangeTo');
      if(rf && st.rangeFrom!==undefined) rf.value=st.rangeFrom||'';
      if(rt && st.rangeTo!==undefined) rt.value=st.rangeTo||'';
      if(typeof loadService==='function') loadService();
    },80);
    return true;
  }
  if(st.page && st.page!=='dashboard'){
    // Admin UI is mounted asynchronously; retry briefly if its section isn't ready yet.
    if(document.getElementById(st.page)){show(st.page);return true;}
    if(st.page==='adminCath'){
      let tries=0;const a=setInterval(()=>{tries++;if(document.getElementById('adminCath')){clearInterval(a);show('adminCath')}else if(tries>20)clearInterval(a)},100);
      return true;
    }
  }
  return true;
}

let n=0;const t=setInterval(()=>{
  n++;
  if(typeof profile!=='undefined' && profile && !document.getElementById('appView')?.classList.contains('hidden')){
    clearInterval(t);
    setTimeout(restore,350);
  } else if(n>100) clearInterval(t);
},100);

window.addEventListener('beforeunload',()=>{
  const active=document.querySelector('.page.on')?.id||'dashboard';
  const st={
    page:active,
    service:active==='service'?currentServiceCode():null,
    date:document.getElementById('serviceDate')?.value||'',
    status:document.getElementById('serviceStatus')?.value||'',
    rangeFrom:document.getElementById('rangeFrom')?.value||'',
    rangeTo:document.getElementById('rangeTo')?.value||''
  };
  ['cath','echo'].forEach(id=>{const el=document.getElementById(id);if(el)st[id+'Collapsed']=el.classList.contains('hidden')});
  write(st);
});
})();