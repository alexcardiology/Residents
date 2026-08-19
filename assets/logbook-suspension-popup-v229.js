import { sb } from './supabase.js';

const nativeAlert = window.alert.bind(window);
let checking = false;

function esc(v){return String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));}
function fmt(v){if(!v)return '—';try{return new Intl.DateTimeFormat('en-GB',{day:'2-digit',month:'2-digit',year:'numeric',hour:'numeric',minute:'2-digit',hour12:true,timeZone:'Africa/Cairo'}).format(new Date(v))}catch(_){return String(v)}}
function durationLabel(v){return ({'3_days':'3 days','1_week':'1 week','2_weeks':'2 weeks','1_month':'1 month','3_months':'3 months'})[v]||'';}

function installStyle(){
  if(document.querySelector('#logbookSuspensionPopup229Style'))return;
  const s=document.createElement('style');
  s.id='logbookSuspensionPopup229Style';
  s.textContent=`
    .logbook-suspension-popup229{position:fixed;inset:0;z-index:12000;background:rgba(5,20,38,.58);display:grid;place-items:center;padding:18px}
    .logbook-suspension-popup229-card{width:min(560px,94vw);background:#fff;border-radius:22px;box-shadow:0 28px 80px rgba(0,0,0,.3);padding:24px;color:#0a223c}
    .logbook-suspension-popup229-head{display:flex;gap:14px;align-items:flex-start}.logbook-suspension-popup229-icon{width:50px;height:50px;border-radius:15px;display:grid;place-items:center;background:#fff0f1;color:#a71f32;font-size:24px;flex:0 0 auto}
    .logbook-suspension-popup229-head small{display:block;color:#a71f32;font-weight:900;letter-spacing:.08em;margin-bottom:3px}.logbook-suspension-popup229-head h2{margin:0;font-size:1.35rem}.logbook-suspension-popup229-copy{margin:16px 0 0;padding:14px 16px;background:#f7f9fc;border:1px solid #dce6ef;border-radius:14px;line-height:1.55}.logbook-suspension-popup229-copy b{display:block;margin-bottom:5px}.logbook-suspension-popup229-copy span{display:block;color:#53677c}.logbook-suspension-popup229-reason{margin-top:10px;color:#243b53!important}.logbook-suspension-popup229-actions{display:flex;justify-content:flex-end;margin-top:18px}.logbook-suspension-popup229-ok{border:0;border-radius:12px;background:#0b4e72;color:#fff;padding:11px 24px;font:inherit;font-weight:850;cursor:pointer}
  `;
  document.head.appendChild(s);
}

function closePopup(){document.querySelector('#logbookSuspensionPopup229')?.remove();}

function showPopup(info={}, fallback=''){
  installStyle();closePopup();
  const reason=String(info?.reason||'').trim() || String(fallback||'').replace(/^.*?Reason:\s*/is,'').trim() || 'E-logbook recording is temporarily suspended.';
  const until=info?.ends_at?fmt(info.ends_at):(String(fallback||'').match(/suspended until\s+([^\.]+(?:AM|PM)?)/i)?.[1]||'');
  const duration=durationLabel(info?.duration_code);
  const el=document.createElement('div');el.id='logbookSuspensionPopup229';el.className='logbook-suspension-popup229';
  el.innerHTML=`<section class="logbook-suspension-popup229-card" role="dialog" aria-modal="true" aria-labelledby="logbookSuspensionPopup229Title"><div class="logbook-suspension-popup229-head"><div class="logbook-suspension-popup229-icon" aria-hidden="true">⏳</div><div><small>E-LOGBOOK ACCESS</small><h2 id="logbookSuspensionPopup229Title">E-logbook recording suspended</h2></div></div><div class="logbook-suspension-popup229-copy"><b>${duration?`Suspension period: ${esc(duration)}`:'Your recording access is temporarily suspended.'}</b>${until?`<span>Suspended until ${esc(until)}</span>`:''}<span class="logbook-suspension-popup229-reason"><b>Reason</b>${esc(reason)}</span></div><div class="logbook-suspension-popup229-actions"><button type="button" class="logbook-suspension-popup229-ok" data-logbook-suspension-popup-ok>OK</button></div></section>`;
  document.body.appendChild(el);
  el.querySelector('[data-logbook-suspension-popup-ok]')?.focus();
}

async function currentSuspension(){
  const {data,error}=await sb.rpc('get_my_logbook_suspension_v206');
  if(error)throw error;
  return data && typeof data==='object' ? data : null;
}

window.alert=function(message){
  const text=String(message??'');
  if(/E-logbook recording is suspended/i.test(text)){
    void currentSuspension().then(info=>showPopup(info,text)).catch(()=>showPopup({},text));
    return;
  }
  return nativeAlert(message);
};

document.addEventListener('click',e=>{
  if(e.target.closest?.('[data-logbook-suspension-popup-ok]')||e.target.id==='logbookSuspensionPopup229')closePopup();
},true);

document.addEventListener('keydown',e=>{if(e.key==='Escape'&&document.querySelector('#logbookSuspensionPopup229'))closePopup();});

document.addEventListener('submit',async e=>{
  const form=e.target;
  if(!(form instanceof HTMLFormElement)||form.id!=='logbookForm')return;
  if(form.dataset.logbookSuspensionBypass229==='1'){
    delete form.dataset.logbookSuspensionBypass229;
    return;
  }
  if(checking){e.preventDefault();e.stopImmediatePropagation();return;}
  e.preventDefault();e.stopImmediatePropagation();
  checking=true;
  try{
    const info=await currentSuspension();
    if(info?.id && info?.ends_at && new Date(info.ends_at).getTime()>Date.now()){
      showPopup(info);
      return;
    }
    form.dataset.logbookSuspensionBypass229='1';
    if(typeof form.requestSubmit==='function')form.requestSubmit(e.submitter instanceof HTMLElement?e.submitter:undefined);
    else form.submit();
  }catch(_){
    form.dataset.logbookSuspensionBypass229='1';
    if(typeof form.requestSubmit==='function')form.requestSubmit(e.submitter instanceof HTMLElement?e.submitter:undefined);
    else form.submit();
  }finally{checking=false;}
},true);
