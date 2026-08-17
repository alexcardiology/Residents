// v196 — finite cleanup for duplicate admin meeting action blocks.
// This intentionally uses no global MutationObserver.
function cleanMeetingAdminCards(){
  document.querySelectorAll('#meet187AdminList .meet187-card').forEach(card=>{
    const blocks=[...card.querySelectorAll('[data-meet194-tools],[data-meet195-tools]')]
      .filter(node=>node.querySelector('[data-meet194-cancel],[data-meet195-cancel],[data-meet194-delete],[data-meet195-delete]'));
    if(blocks.length>1) blocks.slice(1).forEach(node=>node.remove());

    // Fallback for legacy cached enhancement versions without tool data attributes.
    const actionGroups=[...card.querySelectorAll('.meet187-actions')]
      .filter(node=>node.querySelector('[data-meet194-cancel],[data-meet195-cancel],[data-meet194-delete],[data-meet195-delete]'));
    if(actionGroups.length>1) actionGroups.slice(1).forEach(node=>node.remove());
  });
}

function armCleanup(){
  [0,80,180,350,700,1200,2200,4000].forEach(ms=>setTimeout(cleanMeetingAdminCards,ms));
}

document.addEventListener('click',e=>{
  if(e.target.closest?.('[data-sm191-open-meetings],[data-meet187-report],[data-meet194-cancel],[data-meet195-cancel],[data-meet194-delete],[data-meet195-delete]')) armCleanup();
},true);

armCleanup();
