(()=>{
function dateKeyFromCell(cell){
  const t=(cell?.textContent||'').trim();
  const m=t.match(/(\d{2}\/\d{2}\/\d{4})/);
  return m?m[1]:t;
}
function addDaySeparators(){
  const body=document.getElementById('serviceRows');
  if(!body)return;
  const rows=[...body.querySelectorAll(':scope > tr')].filter(r=>!r.classList.contains('psh-day-separator'));
  let previous='';
  rows.forEach((row,i)=>{
    const key=dateKeyFromCell(row.cells?.[0]);
    if(!key)return;
    if(i>0&&key!==previous){
      const sep=document.createElement('tr');
      sep.className='psh-day-separator';
      const td=document.createElement('td');
      td.colSpan=Math.max(row.cells.length,1);
      td.style.cssText='height:7px;padding:0!important;background:#f97316;border:0!important;box-shadow:inset 0 1px 0 #e85d04,inset 0 -1px 0 #ff9a4d';
      sep.appendChild(td);
      row.before(sep);
    }
    previous=key;
  });
}
const observer=new MutationObserver(()=>requestAnimationFrame(addDaySeparators));
function start(){const body=document.getElementById('serviceRows');if(!body)return setTimeout(start,250);observer.observe(body,{childList:true});addDaySeparators()}
start();
})();