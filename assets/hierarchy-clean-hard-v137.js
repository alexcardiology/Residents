let hierarchyCleanupTimer=0;
function cleanHierarchyHard(){
  const overlay=document.querySelector('#auditHierarchyOverlay');
  if(!overlay)return;
  overlay.querySelectorAll('.audit-rank-chip,.audit-inline-rank-select').forEach(n=>n.remove());
  overlay.querySelectorAll('.audit-person-copy small').forEach(n=>n.remove());
  overlay.querySelectorAll('.audit-slot.rank-invalid').forEach(n=>n.classList.remove('rank-invalid'));
  overlay.querySelectorAll('[class*="rank-warning"]').forEach(n=>n.classList.remove('rank-warning'));
  const help=overlay.querySelector('.audit-assessor-bank-head > span');
  if(help)help.textContent='Drag a name into the correct hierarchy position. On touch devices, tap the name then tap the destination slot.';
}
function scheduleHierarchyCleanup(){clearTimeout(hierarchyCleanupTimer);hierarchyCleanupTimer=setTimeout(cleanHierarchyHard,20)}
new MutationObserver(scheduleHierarchyCleanup).observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['class']});
setInterval(cleanHierarchyHard,500);
cleanHierarchyHard();
