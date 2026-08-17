// v193 — keep the selected Schedule/Meetings tab across browser refreshes.
const KEY='scheduleMeetingsActiveTab';
const SCHEDULE_HASHES=new Set(['#resident-schedule','#admin-schedule']);

function selected(){
  const h=String(location.hash||'');
  if(h==='#meetings')return 'meetings';
  if(SCHEDULE_HASHES.has(h))return 'schedule';
  try{return sessionStorage.getItem(KEY)||''}catch(_){return ''}
}
function remember(tab){try{sessionStorage.setItem(KEY,tab)}catch(_){} }

// Restore Meetings after the normal app boot/auth has painted the shell.
async function restoreMeetings(){
  if(selected()!=='meetings')return;
  const tryOpen=async()=>{
    const root=document.querySelector('#content');
    const shell=document.querySelector('#shell');
    if(!root||shell?.hidden)return false;
    try{
      const mod=await import('./meetings-page-v187.js?v=193');
      await mod.openMeetingsPage();
      return true;
    }catch(e){console.error('Could not restore Meetings tab',e);return false}
  };
  for(const ms of [0,250,700,1400,2600]){
    await new Promise(r=>setTimeout(r,ms));
    if(await tryOpen())break;
  }
}

document.addEventListener('click',e=>{
  if(e.target.closest?.('[data-sm191-open-meetings]')){
    remember('meetings');
    try{history.replaceState(null,'',location.pathname+location.search+'#meetings')}catch(_){location.hash='meetings'}
    return;
  }
  if(e.target.closest?.('[data-meet187-schedule],[data-resident-schedule-link],[data-admin-schedule-link]')){
    remember('schedule');
  }
},true);

window.addEventListener('hashchange',()=>{
  if(location.hash==='#meetings')remember('meetings');
  else if(SCHEDULE_HASHES.has(location.hash))remember('schedule');
});

restoreMeetings();
