// v181: enforce one drawer entry for Schedule + Meetings and neutralize the legacy attendance nav.
const $=(s,r=document)=>r.querySelector(s);
const $$=(s,r=document)=>[...r.querySelectorAll(s)];

function closeDrawer(){
  document.body.classList.remove('drawer-open','nav-open','menu-open');
  document.documentElement.classList.remove('drawer-open','nav-open','menu-open');
  $('aside')?.classList.remove('open','active','show');
  $('#backdrop')?.classList.remove('show','active','open');
}

function isScheduleNode(n){
  const t=(n?.textContent||'').trim();
  return /^(schedule|schedule\s*&\s*meetings)$/i.test(t)
    || n?.hasAttribute?.('data-resident-schedule-link')
    || n?.hasAttribute?.('data-admin-schedule-link');
}

function scheduleNode(){
  return $$('#nav button,#nav a').find(isScheduleNode);
}

function cleanNav(){
  const nav=$('#nav');
  if(!nav)return;
  // Permanently remove legacy separate meeting-attendance entries.
  $$('#nav [data-attendance-nav],#nav button,#nav a').forEach(n=>{
    if(n.matches?.('[data-attendance-nav]') || /meeting attendance/i.test((n.textContent||'').trim())) n.remove();
  });
  const s=scheduleNode();
  if(s){
    s.textContent='Schedule & meetings';
    s.setAttribute('aria-label','Schedule & meetings');
  }
}

function clickUnifiedMeetings(){
  cleanNav();
  closeDrawer();
  const internal=$('[data-sm180="meetings"]');
  if(internal){ internal.click(); return; }
  const s=scheduleNode();
  if(s) s.click();
  let tries=0;
  const timer=setInterval(()=>{
    cleanNav(); closeDrawer();
    const m=$('[data-sm180="meetings"]');
    if(m){ clearInterval(timer); m.click(); return; }
    if(++tries>30) clearInterval(timer);
  },50);
}

// Capture any stale legacy meeting click before the old module can render its page/dashboard.
document.addEventListener('click',e=>{
  const legacy=e.target.closest?.('[data-attendance-nav]');
  if(legacy || /meeting attendance/i.test((e.target.closest?.('#nav button,#nav a')?.textContent||'').trim())){
    e.preventDefault();
    e.stopImmediatePropagation();
    clickUnifiedMeetings();
    return;
  }
  const navItem=e.target.closest?.('#nav button,#nav a');
  if(navItem) setTimeout(closeDrawer,0);
},true);

function boot(){
  cleanNav();
  const nav=$('#nav');
  if(nav)new MutationObserver(()=>queueMicrotask(cleanNav)).observe(nav,{childList:true,subtree:true,characterData:true});
  setInterval(cleanNav,300);
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
