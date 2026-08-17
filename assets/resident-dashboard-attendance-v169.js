import { sb } from "./supabase.js";

const $=(s,r=document)=>r.querySelector(s);
const $$=(s,r=document)=>[...r.querySelectorAll(s)];
const CAIRO="Africa/Cairo";
let role="";
let painting=false;
let lastPath="";

function esc(v){return String(v??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));}
function fmt(v){if(!v)return"—";return new Intl.DateTimeFormat("en-GB",{timeZone:CAIRO,day:"2-digit",month:"2-digit",year:"numeric",hour:"2-digit",minute:"2-digit"}).format(new Date(v));}
function rpc(name,args={}){return sb.rpc(name,args).then(({data,error})=>{if(error)throw error;return data;});}
function isDashboard(){return /^dashboard$/i.test($("#title")?.textContent?.trim()||"");}
function findCardByLabel(label){return $$("#content *").find(n=>n.children.length===0&&n.textContent?.trim().toUpperCase()===label)?.closest("article,.card,.stat-card,.metric-card,section,div");}
function gridForYear(){const leaf=$$("#content *").find(n=>n.children.length===0&&n.textContent?.trim().toUpperCase()==="CURRENT RESIDENCY");if(!leaf)return null;let card=leaf;while(card&&card.parentElement&&card.parentElement!==$("#content")){const p=card.parentElement;if(p.children.length>=2){card=card.parentElement;continue}break}return leaf.closest("article,.card,.stat-card,.metric-card")||leaf.parentElement?.parentElement||leaf.parentElement;}
function upcomingMeeting(rows){const now=Date.now();return (rows||[]).filter(m=>m.is_active!==false).filter(m=>new Date(m.checkin_closes_at||m.ends_at||m.starts_at).getTime()>=now-60*60*1000).sort((a,b)=>new Date(a.starts_at)-new Date(b.starts_at))[0]||null;}
function openMeetings(){location.hash="#attendance";setTimeout(()=>{const b=$$("#nav button").find(x=>/schedule\s*&\s*meetings|schedule/i.test(x.textContent||""));b?.click();setTimeout(()=>$("[data-sm='meetings']")?.click(),150)},30)}
function openSchedule(){const b=$$("#nav button").find(x=>/schedule\s*&\s*meetings|schedule/i.test(x.textContent||""));b?.click()}
function cardStyle(){return "border:1px solid #d7e3ef;border-radius:20px;background:#fff;box-shadow:0 8px 26px rgba(10,42,73,.05);padding:22px;min-height:126px;box-sizing:border-box;cursor:pointer"}

async function paintDashboard(){
 if(painting||role!=="resident"||!isDashboard())return;painting=true;
 try{
  const yearLeaf=$$("#content *").find(n=>n.children.length===0&&n.textContent?.trim().toUpperCase()==="CURRENT RESIDENCY");
  const yearCard=yearLeaf?.closest("article,.card,.stat-card,.metric-card")||yearLeaf?.parentElement?.parentElement;
  if(!yearCard?.parentElement)return;
  const grid=yearCard.parentElement;
  let meetings=[],swaps=[];try{meetings=await rpc("get_my_attendance_meetings_v167")}catch{}try{swaps=await rpc("get_schedule_substitution_requests_v133")}catch{}
  $("#dashboardMeeting169")?.remove();$("#dashboardSwaps169")?.remove();
  const m=upcomingMeeting(meetings);
  let anchor=yearCard;
  if(m){const c=document.createElement("div");c.id="dashboardMeeting169";c.setAttribute("style",cardStyle()+";background:#f4f9ff;border-color:#b9d9fb");c.innerHTML=`<div style="font-size:.78rem;font-weight:900;color:#1570c7;letter-spacing:.04em">NEXT MEETING</div><div style="font-size:1.25rem;font-weight:950;color:#082847;margin-top:9px">${esc(m.title)}</div><div style="margin-top:7px;color:#5c7084;font-weight:700">Meeting starts ${fmt(m.starts_at)}${m.ends_at?` · ends ${fmt(m.ends_at)}`:""}</div><div style="margin-top:5px;color:#5c7084;font-size:.84rem">Check-in ${fmt(m.checkin_opens_at)} → ${fmt(m.checkin_closes_at)}</div>`;c.onclick=openMeetings;anchor.after(c);anchor=c}
  const active=(swaps||[]).filter(x=>!["approved","rejected","cancelled","completed"].includes(String(x.status||"").toLowerCase())).length;
  const s=document.createElement("div");s.id="dashboardSwaps169";s.setAttribute("style",cardStyle());s.innerHTML=`<div style="font-size:.78rem;font-weight:900;color:#607386;letter-spacing:.04em">DUTY / SHIFT SWAPS</div><div style="font-size:2.25rem;line-height:1;font-weight:950;color:#082847;margin-top:13px">${active}</div><div style="margin-top:9px;color:#607386;font-weight:700">Open substitution requests</div>`;s.onclick=openSchedule;anchor.after(s);
 }finally{painting=false}
}

async function polishMeetingCards(){
 if(role!=="resident"||!$("#attendanceResidentList"))return;
 let rows=[];try{rows=await rpc("get_my_attendance_meetings_v167")}catch{return}
 $$("#attendanceResidentList .attendance-card").forEach(card=>{
  const title=card.querySelector("h3")?.textContent?.trim();const m=rows.find(x=>String(x.title||"").trim()===title);if(!m)return;
  const meta=card.querySelector(".attendance-meta");if(meta){meta.innerHTML=`<span><b>Meeting starts:</b> ${fmt(m.starts_at)}${m.ends_at?` &nbsp;·&nbsp; <b>ends:</b> ${fmt(m.ends_at)}`:""}</span>${m.venue?`<span>📍 ${esc(m.venue)}</span>`:""}<span><b>Check-in for this meeting starts:</b> ${fmt(m.checkin_opens_at)} &nbsp;·&nbsp; <b>ends:</b> ${fmt(m.checkin_closes_at)}</span>${m.attended?`<span><b>Check-in time:</b> ${fmt(m.checked_in_at)}</span>`:""}${m.notes?`<span>${esc(m.notes)}</span>`:""}`}
  const badges=$$(".attendance-badge",card);badges.forEach(b=>{if(/attended/i.test(b.textContent||""))b.textContent="✓ Checked-in"});
  const check=card.querySelector(".attendance-attended-check");if(check)check.textContent="✓ You checked-in successfully";
 });
}

function makeAdminEndOptional(){
 if(role!=="owner")return;
 const form=$("#attendanceCreateForm");if(form?.ends){form.ends.required=false;const label=form.ends.closest("label");if(label&&!/optional/i.test(label.firstChild?.textContent||"")){label.firstChild.textContent="Ends (optional)"}}
 $$("dialog input[name='ends']").forEach(inp=>{inp.required=false;const label=inp.closest("label");if(label&&!/optional/i.test(label.firstChild?.textContent||""))label.firstChild.textContent="Ends (optional)"});
}

function forceDrawerClose(){
 setTimeout(()=>{try{$("#backdrop")?.click()}catch{}try{$("#drawerClose")?.click()}catch{};document.body?.classList.remove("drawer-open","nav-open","menu-open");$("#shell")?.classList.remove("drawer-open","nav-open","menu-open","open");},20)
}
function wireDrawer(){
 $$("#nav button").forEach(b=>{if(b.dataset.close169)return;b.dataset.close169="1";b.addEventListener("click",forceDrawerClose)});
 $$(".sm-tabs button").forEach(b=>{if(b.dataset.close169)return;b.dataset.close169="1";b.addEventListener("click",forceDrawerClose)});
}

async function bootRole(){try{const{data:s}=await sb.auth.getSession();const id=s?.session?.user?.id;if(!id)return;const{data:p}=await sb.from("profiles").select("role").eq("id",id).maybeSingle();role=String(p?.role||"")}catch{}}
await bootRole();
const observer=new MutationObserver(()=>{clearTimeout(observer._t);observer._t=setTimeout(()=>{wireDrawer();makeAdminEndOptional();polishMeetingCards();paintDashboard()},80)});
observer.observe(document.body,{childList:true,subtree:true});
wireDrawer();makeAdminEndOptional();setTimeout(()=>{polishMeetingCards();paintDashboard()},250);setInterval(()=>{if(isDashboard())paintDashboard();wireDrawer()},15000);
