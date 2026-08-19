(()=>{
function dateKeyFromCell(cell){
  const t=(cell?.textContent||'').trim();
  const m=t.match(/(\d{2}\/\d{2}\/\d{4})/);
  return m?m[1]:t;
}
function addDaySeparators(){
  const body=document.getElementById('serviceRows');
  if(!body)return;
  body.querySelectorAll(':scope > tr.psh-day-separator').forEach(x=>x.remove());
  const rows=[...body.querySelectorAll(':scope > tr')];
  let previous='';
  rows.forEach((row,i)=>{
    const key=dateKeyFromCell(row.cells?.[0]);
    if(!key)return;
    if(i>0&&key!==previous){
      const sep=document.createElement('tr');
      sep.className='psh-day-separator';
      const td=document.createElement('td');
      td.colSpan=Math.max(row.cells.length,1);
      td.style.cssText='height:2px!important;line-height:0!important;padding:0!important;background:#f97316!important;border:0!important;';
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