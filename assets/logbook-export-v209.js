function exportBlankPdf(){
  const html='<!doctype html><html><head><meta charset="utf-8"><title></title><style>@page{size:A4 landscape;margin:0}html,body{margin:0!important;padding:0!important;width:100%;height:100%;background:#fff!important}body{overflow:hidden}body>*{display:none!important}</style></head><body><script>window.addEventListener("load",()=>setTimeout(()=>window.print(),120))<\/script></body></html>';
  const blob=new Blob([html],{type:'text/html;charset=utf-8'});
  const url=URL.createObjectURL(blob);
  const w=window.open(url,'_blank');
  if(!w){URL.revokeObjectURL(url);alert('Please allow pop-ups to export the PDF.');return;}
  try{w.opener=null}catch(_){}
  setTimeout(()=>URL.revokeObjectURL(url),60000);
}

window.addEventListener('click',e=>{
  const b=e.target.closest?.('[data-logbook-print]');
  if(!b)return;
  e.preventDefault();
  e.stopPropagation();
  e.stopImmediatePropagation();
  exportBlankPdf();
},true);
