// v194 — keep Schedule/Meetings state across refresh without flashing Dashboard.
const KEY='scheduleMeetingsActiveTab';
const SCHEDULE_HASHES=new Set(['#resident-schedule','#admin-schedule']);

function selected(){
  const h=String(location.hash||'');
  if(h==='#meetings')return 'meetings';
  if(SCHEDULE_HASHES.has(h))return 'schedule';
  try{return sessionStorage.getItem(KEY)||''}catch(_){return ''}
}
function remember(tab){try{sessionStorage.setItem(KEY,tab)}catch(_){} }

function showRestoreCover(){
  if(selected()!=='meetings'||document.getElementById('sm194RestoreCover'))return;
  const style=document.createElement('style');
  style.id='sm194RestoreStyle';
  style.textContent=`#sm194RestoreCover{position:fixed;inset:0;z-index:2147483646;display:grid;place-items:center;background:#f4f7fb;opacity:1;transition:opacity .16s ease}#sm194RestoreCover.sm194-hide{opacity:0;pointer-events:none}#sm194RestoreCover .sm194-box{display:grid;justify-items:center;gap:12px;text-align:center;color:#0a2948;font-family:inherit}#sm194RestoreCover .sm194-heart{width:58px;height:58px;border-radius:18px;display:grid;place-items:center;background:#0b3764;color:#fff;font-size:27px;box-shadow:0 12px 34px rgba(11,55,100,.16)}#sm194RestoreCover strong{font-size:19px;font-weight:900}#sm194RestoreCover span{font-size:13px;font-weight:700;color:#667b90}`;
  document.head.appendChild(style);
  const cover=document.createElement('div');
  cover.id='sm194RestoreCover';
  cover.setAttribute('role','status');
  cover.setAttribute('aria-live','polite');
  cover.innerHTML='<div class="sm194-box"><div class="sm194-heart">♥</div><strong>Opening Meetings…</strong><span>Restoring your last page</span></div>';
  (document.body||document.documentElement).appendChild(cover);
}
function hideRestoreCover(){
  const cover=document.getElementById('sm194RestoreCover');
  if(!cover)return;
  cover.classList.add('sm194-hide');
  setTimeout(()=>cover.remove(),180);
}

showRestoreCover();

async function restoreMeetings(){
  if(selected()!=='meetings')return;
  let restored=false;
  const tryOpen=async()=>{
    const root=document.querySelector('#content');
    const shell=document.querySelector('#shell');
    if(!root||shell?.hidden)return false;
    try{
      const mod=await import('./meetings-page-v187.js?v=194');
      await mod.openMeetingsPage();
      return true;
    }catch(e){console.error('Could not restore Meetings tab',e);return false}
  };
  for(const ms of [0,180,420,800,1400]){
    await new Promise(r=>setTimeout(r,ms));
    if(await tryOpen()){restored=true;break}
  }
  hideRestoreCover();
  if(!restored)console.warn('Meetings restore timed out; showing normal portal instead.');
}

document.addEventListener('click',e=>{
  if(e.target.closest?.('[data-sm191-open-meetings]')){
    remember('meetings');
    try{history.replaceState(null,'',location.pathname+location.search+'#meetings')}catch(_){location.hash='meetings'}
    return;
  }
  if(e.target.closest?.('[data-meet187-schedule],[data-resident-schedule-link],[data-admin-schedule-link]')){
    remember('schedule');
    hideRestoreCover();
  }
},true);

window.addEventListener('hashchange',()=>{
  if(location.hash==='#meetings')remember('meetings');
  else if(SCHEDULE_HASHES.has(location.hash)){remember('schedule');hideRestoreCover()}
});

restoreMeetings();
