// v187 — safe Schedule + Meetings integration.
// This module NEVER touches Dashboard content and NEVER boots the Meetings page.
// It only renames the Schedule drawer item, decorates the Schedule page after a Schedule click,
// and lazy-loads Meetings only when the Meetings header is pressed.

const $=(s,r=document)=>r.querySelector(s);

function closeDrawer(){
  document.body.classList.remove('drawer-open','nav-open','menu-open');
  document.documentElement.classList.remove('drawer-open','nav-open','menu-open');
  $('#shell')?.classList.remove('drawer-open','nav-open','menu-open','open');
  $('.shell > aside')?.classList.remove('open','active','show');
  $('#backdrop')?.classList.remove('show','active','open');
}

function scheduleNav(){return $('#nav [data-resident-schedule-link],#nav [data-admin-schedule-link]')}

function renameScheduleNav(){
  const n=scheduleNav();if(!n)return;
  const badge=n.querySelector('.nav-badge');
  const label=n.querySelector('span:not(.nav-badge)');
  if(label)label.textContent='Schedule and Meetings';
  else if(badge)n.insertAdjacentHTML('afterbegin','<span>Schedule and Meetings</span>');
  else n.textContent='Schedule and Meetings';
  n.setAttribute('aria-label','Schedule and Meetings');
}

function addStyles(){
  if($('#sm187ShellStyles'))return;
  const s=document.createElement('style');s.id='sm187ShellStyles';
  s.textContent=`.sm187-shell-tabs{display:flex;gap:8px;margin:0 0 16px;padding:5px;border:1px solid #d6e2ed;border-radius:14px;background:#edf4f9;width:max-content;max-width:100%}.sm187-shell-tabs button{border:0;border-radius:10px;background:transparent;padding:10px 20px;color:#284a65;font-weight:900;cursor:pointer}.sm187-shell-tabs button.active{background:#0b3764;color:#fff!important;-webkit-text-fill-color:#fff!important}@media(max-width:720px){.sm187-shell-tabs{width:100%;box-sizing:border-box}.sm187-shell-tabs button{flex:1}}`;
  document.head.appendChild(s);
}

function decorateSchedule(){
  const root=$('#content');if(!root)return;
  const page=root.querySelector('.schedule-page,.admin-schedule-page');
  if(!page)return;
  renameScheduleNav();addStyles();
  if($('#title'))$('#title').textContent='Schedule and Meetings';
  if(root.querySelector('[data-sm187-shell-tabs]'))return;
  const tabs=document.createElement('div');tabs.className='sm187-shell-tabs';tabs.dataset.sm187ShellTabs='1';
  tabs.innerHTML='<button type="button" class="active">Schedule</button><button type="button" data-sm187-open-meetings>Meetings</button>';
  root.prepend(tabs);
}

function afterScheduleRender(){
  setTimeout(decorateSchedule,0);
  setTimeout(decorateSchedule,80);
  setTimeout(decorateSchedule,240);
}

async function openMeetings(){
  closeDrawer();
  try{
    const mod=await import('./meetings-page-v187.js?v=187');
    await mod.openMeetingsPage();
  }catch(e){console.error(e);alert(e?.message||String(e))}
}

// The nav is the only DOM area observed. No #content observer is used.
const nav=$('#nav');
if(nav){
  renameScheduleNav();
  new MutationObserver(renameScheduleNav).observe(nav,{childList:true,subtree:true});
}

// Capture-phase close guarantees every mobile drawer item closes before feature-specific handlers.
document.addEventListener('click',e=>{
  const drawerItem=e.target.closest?.('#nav button,#nav a');
  if(drawerItem){closeDrawer();requestAnimationFrame(closeDrawer);setTimeout(closeDrawer,80)}
  const sNav=e.target.closest?.('[data-resident-schedule-link],[data-admin-schedule-link]');
  if(sNav)afterScheduleRender();
  const meetings=e.target.closest?.('[data-sm187-open-meetings]');
  if(meetings){e.preventDefault();e.stopPropagation();void openMeetings()}
},true);

window.addEventListener('hashchange',()=>{
  closeDrawer();
  if(location.hash==='#resident-schedule'||location.hash==='#admin-schedule')afterScheduleRender();
});

renameScheduleNav();
