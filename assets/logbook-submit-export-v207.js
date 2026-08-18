import { sb } from './supabase.js';

const originalRpc = sb.rpc.bind(sb);
let successPending = false;

function injectStyles(){
  if(document.querySelector('#logbookSubmitConfirm214Style')) return;
  const style=document.createElement('style');
  style.id='logbookSubmitConfirm214Style';
  style.textContent=`
    .logbook214-overlay{position:fixed;inset:0;z-index:12000;background:rgba(6,22,40,.46);display:grid;place-items:center;padding:18px;backdrop-filter:blur(2px)}
    .logbook214-success{width:min(570px,94vw);background:#fff;border-radius:24px;padding:26px;box-shadow:0 28px 90px rgba(0,0,0,.28);color:#0b223e;text-align:center}
    .logbook214-check{width:58px;height:58px;border-radius:50%;margin:0 auto 14px;display:grid;place-items:center;background:#dff5e9;color:#087548;font-size:30px;font-weight:900}
    .logbook214-success h2{margin:0 0 10px;font-size:25px}.logbook214-success p{margin:0;color:#5b6f85;font-size:15px;line-height:1.6}
    .logbook214-note{margin-top:15px!important;padding:13px 14px;border-radius:14px;background:#f4f8fc;color:#183b5d!important;text-align:left}
    .logbook214-success button{margin-top:18px;min-width:130px}
  `;
  document.head.appendChild(style);
}

function closeSuccess(){document.querySelector('#logbook214Overlay')?.remove()}
function showSuccess(){
  injectStyles();closeSuccess();
  const el=document.createElement('div');
  el.id='logbook214Overlay';el.className='logbook214-overlay';
  el.innerHTML=`<section class="logbook214-success" role="dialog" aria-modal="true" aria-labelledby="logbook214Title">
    <div class="logbook214-check">✓</div>
    <h2 id="logbook214Title">Request sent successfully</h2>
    <p>Your activity has been submitted for approval. It will appear in your exported E-logbook PDF after the required senior resident and assessor approvals.</p>
    <p class="logbook214-note"><b>48-hour protection:</b> If the senior resident response is delayed for more than 48 hours, Admin will take immediate action to preserve your rights as a candidate.</p>
    <button type="button" class="btn" data-logbook214-close>OK</button>
  </section>`;
  document.body.appendChild(el);
}

function focusHistoryThenConfirm(){
  let tries=0;
  const tick=()=>{
    tries++;
    const table=document.querySelector('.logbook-history-table-card, .printable-logbook, .logbook-history-table');
    if(table){table.scrollIntoView({behavior:'smooth',block:'start'});setTimeout(showSuccess,260);return;}
    if(tries<18)setTimeout(tick,120);else showSuccess();
  };
  setTimeout(tick,100);
}

sb.rpc=async function(name,args,...rest){
  const result=await originalRpc(name,args,...rest);
  if(name==='submit_logbook_entry_v1073'&&!result?.error&&!successPending){
    successPending=true;
    setTimeout(()=>{successPending=false;focusHistoryThenConfirm()},80);
  }
  return result;
};

document.addEventListener('click',e=>{
  if(e.target.closest?.('[data-logbook214-close]')){e.preventDefault();closeSuccess();}
  else if(e.target.id==='logbook214Overlay'){closeSuccess();}
},true);
