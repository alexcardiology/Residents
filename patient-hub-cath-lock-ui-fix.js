(()=>{
const TOKEN_KEY='psh_cath_portal_token_v1';
function norm(v){return String(v||'').trim().toLowerCase()}
function currentResident(){
  const host=document.getElementById('cathResidentPortal');
  if(!host||host.style.display==='none')return'';
  const nodes=[...host.querySelectorAll('div')];
  const line=nodes.find(x=>/^(?:طبيب|نائب) القسطرة\s*:/.test((x.textContent||'').trim()) && x.children.length===0);
  return line?line.textContent.replace(/^(?:طبيب|نائب) القسطرة\s*:\s*/,'').trim():'';
}
function token(){try{return localStorage.getItem(TOKEN_KEY)||''}catch{return''}}
function replaceLabels(host){
  const walker=document.createTreeWalker(host,NodeFilter.SHOW_TEXT);
  const nodes=[];while(walker.nextNode())nodes.push(walker.currentNode);
  nodes.forEach(n=>{n.nodeValue=n.nodeValue
    .replace(/اسم طبيب القسطرة/g,'اسم نائب القسطرة')
    .replace(/طبيب القسطرة:/g,'نائب القسطرة:')
    .replace(/بوابة طبيب القسطرة/g,'بوابة نائب القسطرة')
    .replace(/حساب طبيب القسطرة/g,'حساب نائب القسطرة')
    .replace(/طبيب واحد فقط/g,'نائب واحد فقط')
    .replace(/اكتب اسم الطبيب أولاً/g,'اكتب اسم النائب أولاً');});
}
function enforce(){
  const host=document.getElementById('cathResidentPortal');
  if(!host||host.style.display==='none')return;
  replaceLabels(host);
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
window.releaseCathPortalCase=async(id,type,code)=>{
  const resident=currentResident();
  if(!resident)return;
  const {error}=await sb.rpc('psh_cath_portal_release_case',{p_token:token(),p_item_type:type,p_item_id:id,p_resident_name:resident});
  if(error){alert(error.message);return}
  document.getElementById('refreshCathPortal')?.click();
};
new MutationObserver(()=>setTimeout(enforce,0)).observe(document.documentElement,{subtree:true,childList:true});
setInterval(enforce,800);
})();