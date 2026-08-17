// v190 — isolated Schedule + Meetings shell.
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
    if(!n.querySelector('[data-sm190-label]'))n.insertAdjacentHTML('afterbegin','<span data-sm190-label>Schedule and Meetings</span>');
  }else if(n.textContent.trim()!==wanted){
    n.textContent=wanted;
  }
  if(n.getAttribute('aria-label')!==wanted)n.setAttribute('aria-label',wanted);
  return true;
}

function addStyles(){
  if($('#sm190ShellStyles'))return;
  const s=document.createElement('style');
  s.id='sm190ShellStyles';
  s.textContent=`.sm190-shell-tabs{display:flex;gap:8px;margin:0 0 18px;padding:5px;border:1px solid #d6e2ed;border-radius:14px;background:#edf4f9;width:max-content;max-width:100%}.sm190-shell-tabs button{border:0;border-radius:10px;background:transparent;padding:10px 22px;color:#284a65;font-weight:900;font-size:15px;cursor:pointer}.sm190-shell-tabs button.active{background:#0b3764;color:#fff!important;-webkit-text-fill-color:#fff!important}@media(max-width:720px){.sm190-shell-tabs{width:100%;box-sizing:border-box}.sm190-shell-tabs button{flex:1}}`;
  document.head.appendChild(s);
}

function decorateSchedule(){
  const root=$('#content');
  if(!root)return false;
  const page=root.querySelector('.schedule-page,.admin-schedule-page');
  if(!page)return false;
  renameScheduleNav();
  addStyles();
  if($('#title'))$('#title').textContent='Schedule and Meetings';
  if(root.querySelector('[data-sm190-shell-tabs]'))return true;
  const tabs=document.createElement('div');
  tabs.className='sm190-shell-tabs';
  tabs.dataset.sm190ShellTabs='1';
  tabs.innerHTML='<button type="button" class="active" aria-current="page">Schedule</button><button type="button" data-sm190-open-meetings>Meetings</button>';
  page.before(tabs);
  return true;
}

function waitForScheduleRender(){
  closeDrawer();
  renameScheduleNav();
  const started=Date.now();
  const tick=()=>{
    if(decorateSchedule())return;
    if(Date.now()-started<15000)setTimeout(tick,120);
  };
  tick();
}

async function openMeetings(){
  closeDrawer();
  try{
    const mod=await import('./meetings-page-v187.js?v=190');
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
    waitForScheduleRender();
    return;
  }
  const meetings=e.target.closest?.('[data-sm190-open-meetings]');
  if(meetings){
    e.preventDefault();
    e.stopPropagation();
    void openMeetings();
  }
},true);

window.addEventListener('hashchange',()=>{
  if(location.hash==='#resident-schedule'||location.hash==='#admin-schedule'){
    waitForScheduleRender();
  }
});
