import "./schedule-meetings-v176.js?v=179";

const $=(s,r=document)=>r.querySelector(s);

function addTabStyle(){
  if($("#sm179Style")) return;
  const s=document.createElement("style");
  s.id="sm179Style";
  s.textContent=`
    .sm176-tabs{display:flex!important;gap:8px;padding:6px;background:#edf4f9;border:1px solid #d9e4ee;border-radius:16px;width:max-content;max-width:100%;margin:0 0 18px}
    .sm176-tabs button{border:0;background:transparent;color:#24445f;padding:10px 16px;border-radius:11px;font-weight:900;cursor:pointer}
    .sm176-tabs button.active{background:#0b3764;color:#fff!important;-webkit-text-fill-color:#fff!important}
  `;
  document.head.appendChild(s);
}

function isSchedulePage(){
  const title=$("#title")?.textContent?.trim()||"";
  return /^Schedule(?:\s*&\s*meetings)?$/i.test(title) || !!$("#content [data-resident-schedule-root],#content .resident-schedule-page,#content .schedule-substitution-page");
}

function ensureTabs(){
  addTabStyle();
  const root=$("#content");
  if(!root || !isSchedulePage() || root.querySelector("[data-sm176-page='meetings']")) return;
  if(root.querySelector(".sm176-tabs")) return;
  const tabs=document.createElement("div");
  tabs.className="sm176-tabs";
  tabs.setAttribute("aria-label","Schedule and meetings");
  tabs.innerHTML='<button type="button" data-sm176="schedule" class="active">Schedule</button><button type="button" data-sm176="meetings">Meetings</button>';
  root.prepend(tabs);
}

let timer=0;
const content=$("#content");
if(content){
  new MutationObserver(()=>{
    clearTimeout(timer);
    timer=setTimeout(ensureTabs,40);
  }).observe(content,{childList:true,subtree:true});
}

[0,100,250,500,1000,1800].forEach(ms=>setTimeout(ensureTabs,ms));
setInterval(ensureTabs,1200);
