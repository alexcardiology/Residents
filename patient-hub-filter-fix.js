(()=>{
  const parseIso = v => /^\d{4}-\d{2}-\d{2}$/.test(v||'') ? v : '';
  const isoFromDisplay = text => {
    const m=String(text||'').match(/(\d{2})\/(\d{2})\/(\d{4})/);
    return m?`${m[3]}-${m[2]}-${m[1]}`:'';
  };
  function activeFilters(){
    const single=parseIso(document.getElementById('serviceDate')?.value||'');
    const from=parseIso(document.getElementById('rangeFrom')?.value||'');
    const to=parseIso(document.getElementById('rangeTo')?.value||'');
    return {single,from,to};
  }
  function enforce(){
    const body=document.getElementById('serviceRows');
    if(!body)return;
    const {single,from,to}=activeFilters();
    [...body.querySelectorAll('tr')].forEach(tr=>{
      const iso=isoFromDisplay(tr.cells?.[0]?.textContent||'');
      if(!iso){tr.hidden=false;return;}
      let show=true;
      if(single) show=iso===single;
      else {
        if(from) show=show&&iso>=from;
        if(to) show=show&&iso<=to;
      }
      tr.hidden=!show;
    });
  }
  function syncButton(){
    const d=document.getElementById('serviceDate');
    const b=document.getElementById('singleDateBtn');
    if(!d||!b)return;
    if(d.value && typeof fmtDay==='function') b.textContent=fmtDay(d.value);
  }
  const body=document.getElementById('serviceRows');
  if(body)new MutationObserver(()=>{syncButton();enforce()}).observe(body,{childList:true,subtree:true});
  document.addEventListener('change',e=>{
    if(['serviceDate','rangeFrom','rangeTo'].includes(e.target?.id)){
      if(e.target.id==='serviceDate' && e.target.value){
        const rf=document.getElementById('rangeFrom'),rt=document.getElementById('rangeTo');
        if(rf)rf.value=''; if(rt)rt.value='';
      }
      setTimeout(()=>{syncButton();enforce();},0);
    }
  },true);
  document.addEventListener('click',e=>{
    if(e.target.closest('#serviceFilter,#serviceRefreshBtn,#singleDateBtn,#clearServiceFilter')) setTimeout(()=>{syncButton();enforce();},120);
  },true);
  window.enforcePSHDateFilter=enforce;
  setTimeout(()=>{syncButton();enforce();},300);
})();