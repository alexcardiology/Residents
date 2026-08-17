// v189 — isolated Schedule + Meetings shell.
// No DOM observers. No Dashboard/content watcher. Meetings is lazy-loaded only on click.

const $=(s,r=document)=>r.querySelector(s);

function closeDrawer(){
  document.body.classList.remove('drawer-open','nav-open','menu-open');
  document.documentElement.classList.remove('drawer-open','nav-open','menu-open');
  $('#shell')?.classList.remove('drawer-open','nav-open','menu-open','open');
  $('.shell > aside')?.classList.remove('open','active','show');
  $('#backdrop')?.classList.remove('show','active','open');
}

function scheduleNav(){
  return $('#nav [data-resident-schedule-link],#nav [data-admin-schedule-link]');
}

function renameScheduleNav(){
  const n=scheduleNav();
  if(!n)return false;
  const wanted='Schedule and Meetings';
  const badge=n.querySelector('.nav-badge');
  const label=n.querySelector('span:not(.nav-badge)');
  if(label){
    if(label.textContent!==wanted)label.textContent=wanted;
  }else if(badge){
    if(!n.querySelector('[data-sm188-label]'))n.insertAdjacentHTML('afterbegin','<span data-sm188-label>Schedule and Meetings</span>');
  }else if(n.textContent.trim()!==wanted){
    n.textContent=wanted;
  }
  if(n.getAttribute('aria-label')!==wanted)n.setAttribute('aria-label',wanted);
  return true;
}

function addStyles(){
  if($('#sm188ShellStyles'))return;
  const s=document.createElement('style');
  s.id='sm188ShellStyles';
  s.textContent=`.sm188-shell-tabs{display:flex;gap:8px;margin:0 0 16px;padding:5px;border:1px solid #d6e2ed;border-radius:14px;background:#edf4f9;width:max-content;max-width:100%}.sm188-shell-tabs button{border:0;border-radius:10px;background:transparent;padding:10px 20px;color:#284a65;font-weight:900;cursor:pointer}.sm188-shell-tabs button.active{background:#0b3764;color:#fff!important;-webkit-text-fill-color:#fff!important}@media(max-width:720px){.sm188-shell-tabs{width:100%;box-sizing:border-box}.sm188-shell-tabs button{flex:1}}`;
  document.head.appendChild(s);
}

function decorateSchedule(){
  const root=$('#content');
  if(!root)return;
  const page=root.querySelector('.schedule-page,.admin-schedule-page');
  if(!page)return;
  renameScheduleNav();
  addStyles();
  if($('#title'))$('#title').textContent='Schedule and Meetings';
  if(root.querySelector('[data-sm188-shell-tabs]'))return;
  const tabs=document.createElement('div');
  tabs.className='sm188-shell-tabs';
  tabs.dataset.sm188ShellTabs='1';
  tabs.innerHTML='<button type="button" class="active">Schedule</button><button type="button" data-sm188-open-meetings>Meetings</button>';
  root.prepend(tabs);
}

function afterScheduleRender(){
  [0,80,240,600].forEach(ms=>setTimeout(decorateSchedule,ms));
}

async function openMeetings(){
  closeDrawer();
  try{
    const mod=await import('./meetings-page-v187.js?v=189');
    await mod.openMeetingsPage();
  }catch(e){
    console.error(e);
    alert(e?.message||String(e));
  }
}

[0,250,1000,2500].forEach(ms=>setTimeout(renameScheduleNav,ms));

document.addEventListener('click',e=>{
  const sNav=e.target.closest?.('[data-resident-schedule-link],[data-admin-schedule-link]');
  if(sNav){
    closeDrawer();
    afterScheduleRender();
    return;
  }
  const meetings=e.target.closest?.('[data-sm188-open-meetings]');
  if(meetings){
    e.preventDefault();
    e.stopPropagation();
    void openMeetings();
  }
},true);

window.addEventListener('hashchange',()=>{
  if(location.hash==='#resident-schedule'||location.hash==='#admin-schedule'){
    closeDrawer();
    afterScheduleRender();
  }
});
