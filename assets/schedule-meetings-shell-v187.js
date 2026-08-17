// v191 — deterministic Schedule + Meetings shell.
// No DOM observers. No Dashboard/content repaint. Meetings is lazy-loaded only on click.

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
    if(!n.querySelector('[data-sm191-label]'))n.insertAdjacentHTML('afterbegin','<span data-sm191-label>Schedule and Meetings</span>');
  }else if(n.textContent.trim()!==wanted){
    n.textContent=wanted;
  }
  if(n.getAttribute('aria-label')!==wanted)n.setAttribute('aria-label',wanted);
  return true;
}

function addStyles(){
  if($('#sm191ShellStyles'))return;
  const s=document.createElement('style');
  s.id='sm191ShellStyles';
  s.textContent=`.sm191-shell-tabs{display:flex;gap:8px;margin:0 0 18px;padding:5px;border:1px solid #d6e2ed;border-radius:14px;background:#edf4f9;width:max-content;max-width:100%}.sm191-shell-tabs button{border:0;border-radius:10px;background:transparent;padding:10px 22px;color:#284a65;font-weight:900;font-size:15px;cursor:pointer}.sm191-shell-tabs button.active{background:#0b3764;color:#fff!important;-webkit-text-fill-color:#fff!important}@media(max-width:720px){.sm191-shell-tabs{width:100%;box-sizing:border-box}.sm191-shell-tabs button{flex:1}}`;
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
  if(root.querySelector('[data-sm191-shell-tabs]'))return true;
  const tabs=document.createElement('div');
  tabs.className='sm191-shell-tabs';
  tabs.dataset.sm191ShellTabs='1';
  tabs.innerHTML='<button type="button" class="active" aria-current="page">Schedule</button><button type="button" data-sm191-open-meetings>Meetings</button>';
  page.before(tabs);
  return true;
}

async function openMeetings(){
  closeDrawer();
  try{
    const mod=await import('./meetings-page-v187.js?v=191');
    await mod.openMeetingsPage();
  }catch(e){
    console.error(e);
    alert(e?.message||String(e));
  }
}

setInterval(()=>{
  renameScheduleNav();
  decorateSchedule();
},500);

[0,250,1000,2500].forEach(ms=>setTimeout(()=>{renameScheduleNav();decorateSchedule();},ms));

document.addEventListener('click',e=>{
  const sNav=e.target.closest?.('[data-resident-schedule-link],[data-admin-schedule-link]');
  if(sNav){
    closeDrawer();
    setTimeout(decorateSchedule,0);
    setTimeout(decorateSchedule,250);
    setTimeout(decorateSchedule,800);
    return;
  }
  const meetings=e.target.closest?.('[data-sm191-open-meetings]');
  if(meetings){
    e.preventDefault();
    e.stopPropagation();
    void openMeetings();
  }
},true);

window.addEventListener('hashchange',()=>{
  if(location.hash==='#resident-schedule'||location.hash==='#admin-schedule'){
    closeDrawer();
    setTimeout(decorateSchedule,0);
    setTimeout(decorateSchedule,300);
  }
});
