(()=>{
function replaceLabels(){
  const host=document.getElementById('cathResidentPortal');
  if(!host)return;
  const walker=document.createTreeWalker(host,NodeFilter.SHOW_TEXT);
  const nodes=[];while(walker.nextNode())nodes.push(walker.currentNode);
  nodes.forEach(n=>{
    n.nodeValue=n.nodeValue
      .replace(/اسم طبيب القسطرة/g,'اسم نائب القسطرة')
      .replace(/طبيب القسطرة:/g,'نائب القسطرة:')
      .replace(/بوابة طبيب القسطرة/g,'بوابة نائب القسطرة')
      .replace(/حساب طبيب القسطرة/g,'حساب نائب القسطرة')
      .replace(/طبيب واحد فقط/g,'نائب واحد فقط/g')
      .replace(/اكتب اسم الطبيب أولاً/g,'اكتب اسم النائب أولاً');
  });
}
new MutationObserver(()=>setTimeout(replaceLabels,0)).observe(document.documentElement,{subtree:true,childList:true});
setInterval(replaceLabels,800);
})();