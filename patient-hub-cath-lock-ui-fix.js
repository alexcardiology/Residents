(()=>{
function norm(v){return String(v||'').trim().toLowerCase()}
function currentResident(){
  const host=document.getElementById('cathResidentPortal');
  if(!host||host.style.display==='none')return'';
  const nodes=[...host.querySelectorAll('div')];
  const line=nodes.find(x=>/^طبيب القسطرة\s*:/.test((x.textContent||'').trim()) && x.children.length===0);
  return line?line.textContent.replace(/^طبيب القسطرة\s*:\s*/,'').trim():'';
}
function enforce(){
  const host=document.getElementById('cathResidentPortal');
  if(!host||host.style.display==='none')return;
  const me=currentResident(); if(!me)return;
  host.querySelectorAll('tbody tr').forEach(tr=>{
    const cells=tr.querySelectorAll('td'); if(cells.length<8)return;
    const reportCell=cells[5], nameCell=cells[6], controlCell=cells[7];
    const owner=(nameCell.textContent||'').trim();
    const saved=(controlCell.textContent||'').includes('تم كتابة التقرير');
    if(saved||!owner)return;
    if(norm(owner)!==norm(me)){
      const input=reportCell.querySelector('input');
      if(input){input.disabled=true;input.value='';input.placeholder='الحالة مستلمة';input.style.background='#f3f3f3';input.style.color='#666'}
      controlCell.innerHTML=`<div style="background:#f1f1f1;border-radius:10px;padding:8px 10px;color:#555;min-width:175px">🔒 قيد الإدخال بواسطة<br><strong>${owner.replace(/</g,'&lt;').replace(/>/g,'&gt;')}</strong></div>`;
      tr.style.background='#f7f7f7';
    }
  });
}
new MutationObserver(()=>setTimeout(enforce,0)).observe(document.documentElement,{subtree:true,childList:true});
setInterval(enforce,1000);
})();