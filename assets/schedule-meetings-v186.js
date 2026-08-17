import { sb } from "./supabase.js";

const $=(s,r=document)=>r.querySelector(s);
const $$=(s,r=document)=>[...r.querySelectorAll(s)];
const CAIRO="Africa/Cairo";
let role="";
let scanState=null;

const esc=(v)=>String(v??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));
const dt=(v)=>v?new Intl.DateTimeFormat("en-GB",{timeZone:CAIRO,day:"2-digit",month:"2-digit",year:"numeric",hour:"2-digit",minute:"2-digit"}).format(new Date(v)):"—";
const localDate=()=>new Intl.DateTimeFormat("en-CA",{timeZone:CAIRO}).format(new Date());
const toIso=(v)=>v?new Date(`${v}:00+03:00`).toISOString():null;
const rpc=async(name,args={})=>{const{data,error}=await sb.rpc(name,args);if(error)throw error;return data};

function closeDrawer(){
  document.body.classList.remove("drawer-open","nav-open","menu-open");
  document.documentElement.classList.remove("drawer-open","nav-open","menu-open");
  $("#shell")?.classList.remove("drawer-open","nav-open","menu-open","open");
  $(".shell > aside")?.classList.remove("open","active","show");
  $("#backdrop")?.classList.remove("show","active","open");
}

function scheduleNav(){
  return $("#nav [data-resident-schedule-link]")||$("#nav [data-admin-schedule-link]");
}

function normalizeScheduleNav(){
  const n=scheduleNav();
  if(!n)return;
  const badge=n.querySelector(".nav-badge");
  const label=n.querySelector("span:not(.nav-badge)");
  if(label)label.textContent="Schedule and Meetings";
  else if(badge)n.insertAdjacentHTML("afterbegin","<span>Schedule and Meetings</span>");
  else n.textContent="Schedule and Meetings";
  n.setAttribute("aria-label","Schedule and Meetings");
}

function tabs(active){
  return `<div class="sm186-tabs" data-sm186-tabs>
    <button type="button" data-sm186-tab="schedule" class="${active==='schedule'?'active':''}">Schedule</button>
    <button type="button" data-sm186-tab="meetings" class="${active==='meetings'?'active':''}">Meetings</button>
  </div>`;
}

function setHeader(){
  if($("#title"))$("#title").textContent="Schedule and Meetings";
  if($("#crumb"))$("#crumb").textContent=role==='owner'?"ADMIN":"RESIDENT";
}

function decorateSchedule(){
  const root=$("#content");
  if(!root)return;
  const page=root.querySelector(".schedule-page,.admin-schedule-page");
  if(!page)return;
  normalizeScheduleNav();
  setHeader();
  if(!root.querySelector("[data-sm186-tabs]")){
    const holder=document.createElement("div");
    holder.innerHTML=tabs("schedule");
    root.prepend(holder.firstElementChild);
  }
}

function addStyles(){
  if($("#sm186Styles"))return;
  const style=document.createElement("style");
  style.id="sm186Styles";
  style.textContent=`
  .sm186-tabs{display:flex;gap:7px;width:max-content;max-width:100%;margin:0 0 16px;padding:5px;border:1px solid #d9e4ef;border-radius:14px;background:#edf4f9}
  .sm186-tabs button{border:0;border-radius:10px;background:transparent;padding:10px 18px;color:#284a65;font-weight:900;cursor:pointer}
  .sm186-tabs button.active{background:#0b3764;color:#fff!important;-webkit-text-fill-color:#fff!important}
  .sm186-page{display:grid;gap:16px}.sm186-hero{padding:18px;border:1px solid #dbe6f0;border-radius:18px;background:linear-gradient(145deg,#fff,#f6fbff)}
  .sm186-hero h2{margin:0}.sm186-hero p{margin:6px 0 0;color:#64788b}.sm186-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(290px,1fr));gap:14px}
  .sm186-card{padding:16px;border:1px solid #dbe5ee;border-radius:17px;background:#fff;box-shadow:0 8px 22px rgba(8,38,66,.05)}.sm186-card h3{margin:8px 0}
  .sm186-meta{display:grid;gap:6px;color:#607487;font-size:.84rem}.sm186-badge{display:inline-flex;padding:5px 9px;border-radius:999px;font-size:.72rem;font-weight:900}
  .sm186-badge.physical{background:#e8f1ff;color:#1659a3}.sm186-badge.online{background:#f0eaff;color:#6238a3}.sm186-badge.ok{background:#e7f7ee;color:#087443}.sm186-badge.wait{background:#fff3cf;color:#8a5d00}
  .sm186-note{margin-top:11px;padding:11px 12px;border-radius:12px;background:#f4f7fa;color:#607386;font-size:.83rem}.sm186-success{padding:11px 13px;border-radius:12px;background:#e8f7ee;color:#08683e;font-weight:900}
  .sm186-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}.sm186-btn{border:0;border-radius:11px;padding:10px 13px;background:#0b3764;color:#fff!important;-webkit-text-fill-color:#fff!important;font-weight:900;cursor:pointer}.sm186-btn.secondary{background:#edf3f8;color:#123c61!important;-webkit-text-fill-color:#123c61!important}
  .sm186-code-entry{display:flex;gap:8px;margin-top:12px}.sm186-code-entry input{flex:1;min-width:0;border:1px solid #cad8e6;border-radius:11px;padding:11px;font-size:1.05rem;font-weight:900;letter-spacing:.08em}
  .sm186-current-code{margin-top:12px;padding:14px;border-radius:15px;background:#081f3a;color:#fff;text-align:center}.sm186-current-code small{display:block;opacity:.76;font-weight:800}.sm186-current-code strong{display:block;margin:4px 0;font-size:2rem;letter-spacing:.14em}
  .sm186-form{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;padding:16px;border:1px solid #dbe5ee;border-radius:17px;background:#fff}.sm186-form label{display:grid;gap:6px;font-size:.8rem;font-weight:800}.sm186-form label.full{grid-column:1/-1}.sm186-form input,.sm186-form select,.sm186-form textarea{width:100%;box-sizing:border-box;border:1px solid #ccd9e6;border-radius:11px;padding:10px 11px;font:inherit;background:#fff}.sm186-form button{grid-column:1/-1;justify-self:start}
  .sm186-dialog{width:min(96vw,1050px);max-height:90vh;border:0;border-radius:20px;padding:0;box-shadow:0 28px 80px rgba(7,27,48,.28)}.sm186-dialog::backdrop{background:rgba(7,22,38,.52)}.sm186-dialog-body{padding:18px}.sm186-dialog-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}.sm186-dialog-head h2{margin:0}.sm186-close{border:0;background:#edf3f8;border-radius:10px;width:38px;height:38px;font-size:1.25rem}
  .sm186-qr{display:grid;place-items:center;margin:14px auto;padding:12px;background:#fff;border:1px solid #dce5ee;border-radius:16px;max-width:450px}.sm186-qr img{width:min(100%,420px);height:auto}.sm186-video{width:100%;max-height:58vh;border-radius:14px;background:#071a2f;object-fit:cover}.sm186-scan-frame{position:relative;margin-top:12px}.sm186-scan-frame:after{content:"";position:absolute;left:15%;right:15%;top:18%;bottom:18%;border:3px solid rgba(255,255,255,.9);border-radius:16px;pointer-events:none}
  .sm186-table-wrap{overflow:auto;border:1px solid #dde6ef;border-radius:14px;margin-top:14px}.sm186-table{border-collapse:collapse;width:100%;font-size:.8rem}.sm186-table th,.sm186-table td{padding:10px;border-bottom:1px solid #edf1f5;text-align:left;white-space:nowrap}.sm186-table th{background:#f6f8fb}.sm186-status-full{color:#087443;font-weight:900}.sm186-status-partial{color:#9b6700;font-weight:900}.sm186-status-minimal{color:#b24a00;font-weight:900}.sm186-status-absent{color:#af1530;font-weight:900}
  @media(max-width:720px){.sm186-form{grid-template-columns:1fr}.sm186-form label.full{grid-column:auto}.sm186-code-entry{flex-direction:column}.sm186-tabs{width:100%;box-sizing:border-box}.sm186-tabs button{flex:1}}
  `;
  document.head.appendChild(style);
}

function dialog(id){
  let d=$(`#${id}`);
  if(!d){d=document.createElement("dialog");d.id=id;d.className="sm186-dialog";document.body.appendChild(d)}
  return d;
}

async function residentMeetings(message=""){
  closeDrawer();
  history.replaceState(null,"",`${location.pathname}#schedule-meetings`);
  setHeader();
  const root=$("#content");if(!root)return;
  root.innerHTML=`<div class="sm186-page">${tabs("meetings")}${message?`<div class="sm186-success">${esc(message)}</div>`:""}<section class="sm186-hero"><h2>Meetings</h2><p>Online meetings use attendance numbers announced by Admin. Physical meetings use the in-app QR scanner.</p></section><div id="sm186ResidentList" class="sm186-grid"><div class="sm186-card">Loading…</div></div></div>`;
  try{
    const rows=await rpc("get_my_attendance_meetings_v179");
    const box=$("#sm186ResidentList");
    if(!rows?.length){box.innerHTML='<div class="sm186-card"><h3>No planned meetings</h3></div>';return}
    const now=Date.now();
    box.innerHTML=rows.map(m=>{
      const open=now>=new Date(m.checkin_opens_at).getTime()&&now<=new Date(m.checkin_closes_at).getTime();
      const points=Array.isArray(m.my_checkpoints)?m.my_checkpoints:[];
      const pointText=points.length?points.map(p=>`Check-in ${p.checkpoint_no}: ${dt(p.checked_in_at)}`).join(" · "):"No online check-ins completed yet.";
      const physical=m.meeting_mode==='physical';
      return `<article class="sm186-card">
        <span class="sm186-badge ${physical?'physical':'online'}">${physical?'Physical · QR':'Online · number'}</span>
        <h3>${esc(m.title)}</h3>
        <div class="sm186-meta"><span><b>Meeting:</b> ${dt(m.starts_at)}${m.ends_at?` → ${dt(m.ends_at)}`:''}</span>${m.venue?`<span>📍 ${esc(m.venue)}</span>`:''}<span><b>Check-in window:</b> ${dt(m.checkin_opens_at)} → ${dt(m.checkin_closes_at)}</span></div>
        ${physical?(m.attended?`<div class="sm186-success" style="margin-top:12px">You checked in successfully.</div>`:(open?`<div class="sm186-actions"><button type="button" class="sm186-btn" data-sm186-scan="${m.id}">Scan QR code</button></div>`:`<div class="sm186-note">The QR scanner becomes available during the check-in window.</div>`)):`<div class="sm186-note"><b>Your check-ins:</b> ${Number(m.my_checkpoint_count||0)} / ${Number(m.checkpoint_total||0)}<br>${esc(pointText)}</div>${open?`<div class="sm186-code-entry"><input inputmode="numeric" pattern="[0-9]*" maxlength="8" placeholder="Enter Admin number" data-sm186-code-input="${m.id}"><button type="button" class="sm186-btn" data-sm186-submit-code="${m.id}">Check in</button></div>`:`<div class="sm186-note">Number entry is available during the check-in window.</div>`}`}
      </article>`;
    }).join("");
  }catch(e){$("#sm186ResidentList").innerHTML=`<div class="sm186-card">${esc(e.message||e)}</div>`}
}

async function adminMeetings(message=""){
  closeDrawer();
  history.replaceState(null,"",`${location.pathname}#schedule-meetings`);
  setHeader();
  const root=$("#content");if(!root)return;
  root.innerHTML=`<div class="sm186-page">${tabs("meetings")}${message?`<div class="sm186-success">${esc(message)}</div>`:""}<section class="sm186-hero"><h2>Meetings</h2><p>Create physical QR meetings or online meetings with repeated Admin-chosen attendance numbers.</p></section>
  <form id="sm186MeetingForm" class="sm186-form">
    <label class="full">Meeting title<input name="title" required minlength="3"></label>
    <label>Date<input name="date" type="date" required></label>
    <label>Type<select name="mode"><option value="physical">Physical meeting · QR</option><option value="online">Online meeting · numbers</option></select></label>
    <label>Starts<input name="starts" type="datetime-local" required></label>
    <label>Ends (optional)<input name="ends" type="datetime-local"></label>
    <label>Check-in opens<input name="opens" type="datetime-local" required></label>
    <label>Check-in closes<input name="closes" type="datetime-local" required></label>
    <label>Venue<input name="venue"></label><label>Notes<input name="notes"></label>
    <button class="sm186-btn" type="submit">Create meeting</button>
  </form><div id="sm186AdminList" class="sm186-grid"><div class="sm186-card">Loading…</div></div></div>`;
  const form=$("#sm186MeetingForm");form.date.value=localDate();
  form.addEventListener("submit",async e=>{e.preventDefault();const btn=form.querySelector('button[type="submit"]');btn.disabled=true;try{await rpc("owner_create_attendance_meeting_v167",{p_title:form.title.value,p_meeting_date:form.date.value,p_starts_at:toIso(form.starts.value),p_ends_at:toIso(form.ends.value),p_checkin_opens_at:toIso(form.opens.value),p_checkin_closes_at:toIso(form.closes.value),p_meeting_mode:form.mode.value,p_venue:form.venue.value,p_notes:form.notes.value});await adminMeetings("Meeting created successfully.")}catch(err){alert(err.message||err);btn.disabled=false}});
  await paintAdminMeetings();
}

async function paintAdminMeetings(){
  const box=$("#sm186AdminList");if(!box)return;
  try{
    const rows=await rpc("owner_list_attendance_meetings_v179");
    if(!rows?.length){box.innerHTML='<div class="sm186-card"><h3>No meetings created</h3></div>';return}
    box.innerHTML=rows.map(m=>{
      const online=m.meeting_mode==='online',cp=m.current_checkpoint;
      return `<article class="sm186-card"><span class="sm186-badge ${online?'online':'physical'}">${online?'Online · number':'Physical · QR'}</span><h3>${esc(m.title)}</h3><div class="sm186-meta"><span><b>Meeting:</b> ${dt(m.starts_at)}${m.ends_at?` → ${dt(m.ends_at)}`:''}</span><span><b>Check-in:</b> ${dt(m.checkin_opens_at)} → ${dt(m.checkin_closes_at)}</span><span><b>${Number(m.attendance_count||0)}</b> residents recorded</span>${online?`<span><b>${Number(m.checkpoint_total||0)}</b> check-ins created</span>`:''}</div>
      ${online&&cp?`<div class="sm186-current-code"><small>CHECK-IN ${cp.checkpoint_no} · CURRENT NUMBER</small><strong>${esc(cp.code)}</strong><small>When you create the next number, this one stops accepting new check-ins.</small></div>`:''}
      ${online?`<div class="sm186-code-entry"><input inputmode="numeric" pattern="[0-9]*" maxlength="8" placeholder="Choose 4–8 digit number" data-sm186-admin-code="${m.id}"><button type="button" class="sm186-btn" data-sm186-create-code="${m.id}">${cp?'Create next check-in':'Start first check-in'}</button></div>`:`<div class="sm186-actions"><button type="button" class="sm186-btn" data-sm186-show-qr="${m.id}">Show QR</button><button type="button" class="sm186-btn secondary" data-sm186-new-qr="${m.id}">Generate new QR</button></div>`}
      <div class="sm186-actions"><button type="button" class="sm186-btn secondary" data-sm186-report="${m.id}">Attendance report</button></div></article>`;
    }).join("");
  }catch(e){box.innerHTML=`<div class="sm186-card">${esc(e.message||e)}</div>`}
}

async function showQr(meetingId){
  const d=dialog("sm186QrDialog");
  d.innerHTML=`<div class="sm186-dialog-body"><div class="sm186-dialog-head"><div><h2>Physical meeting QR</h2><p>Residents open Meetings and tap Scan QR code.</p></div><button class="sm186-close" type="button">×</button></div><div id="sm186QrBox" class="sm186-qr">Generating QR…</div></div>`;
  d.querySelector(".sm186-close").onclick=()=>d.close();d.showModal();
  try{const{data,error}=await sb.functions.invoke("attendance-qr-v179",{body:{meeting_id:meetingId}});if(error)throw error;if(!data?.data_url)throw new Error(data?.error||"QR generation failed");$("#sm186QrBox").innerHTML=`<img alt="Meeting check-in QR" src="${data.data_url}">`}catch(e){$("#sm186QrBox").innerHTML=`<div class="sm186-note">${esc(e.message||e)}</div>`}
}

function stopScanner(){
  if(scanState?.timer)cancelAnimationFrame(scanState.timer);
  if(scanState?.stream)scanState.stream.getTracks().forEach(t=>t.stop());
  scanState=null;
}

function qrTokenFromValue(raw){
  const s=String(raw||"").trim();
  const direct=s.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);if(direct)return direct[0];
  try{const u=new URL(s,location.href);const m=(u.hash||"").match(/^#attendance-checkin=([0-9a-f-]{36})$/i);return m?.[1]||null}catch{return null}
}

async function finishPhysicalScan(raw){
  const token=qrTokenFromValue(raw);if(!token)throw new Error("This is not a valid meeting QR code");
  await rpc("resident_attendance_checkin_v167",{p_qr_token:token,p_meeting_id:null});
  stopScanner();$("#sm186ScanDialog")?.close();await residentMeetings("You checked in successfully.");
}

async function openScanner(){
  const d=dialog("sm186ScanDialog");
  d.innerHTML=`<div class="sm186-dialog-body"><div class="sm186-dialog-head"><div><h2>Scan meeting QR</h2><p>Point the rear camera at the QR displayed by Admin.</p></div><button class="sm186-close" type="button">×</button></div><div class="sm186-scan-frame"><video id="sm186Video" class="sm186-video" autoplay muted playsinline></video></div><div id="sm186ScanStatus" class="sm186-note">Starting camera…</div><div class="sm186-code-entry"><input id="sm186QrPaste" placeholder="Or paste the QR link"><button type="button" class="sm186-btn secondary" id="sm186QrPasteBtn">Use link</button></div></div>`;
  d.querySelector(".sm186-close").onclick=()=>{stopScanner();d.close()};
  d.addEventListener("close",stopScanner,{once:true});
  d.showModal();
  $("#sm186QrPasteBtn").onclick=async()=>{try{await finishPhysicalScan($("#sm186QrPaste").value)}catch(e){alert(e.message||e)}};
  try{
    if(!navigator.mediaDevices?.getUserMedia)throw new Error("Camera access is not available in this browser. You can paste the QR link below instead.");
    if(typeof BarcodeDetector==='undefined')throw new Error("QR camera scanning is not supported by this browser version. You can paste the QR link below instead.");
    const detector=new BarcodeDetector({formats:["qr_code"]});
    const stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:"environment"}},audio:false});
    const video=$("#sm186Video");video.srcObject=stream;await video.play();
    scanState={stream,timer:null,busy:false,last:0};$("#sm186ScanStatus").textContent="Camera ready — hold the QR inside the square.";
    const scan=async(ts)=>{
      if(!scanState)return;
      if(!scanState.busy&&ts-scanState.last>250){scanState.busy=true;scanState.last=ts;try{const codes=await detector.detect(video);if(codes?.[0]?.rawValue){await finishPhysicalScan(codes[0].rawValue);return}}catch(e){if(String(e?.name||"")!=="NotFoundError")$("#sm186ScanStatus").textContent=e.message||String(e)}finally{if(scanState)scanState.busy=false}}
      if(scanState)scanState.timer=requestAnimationFrame(scan);
    };
    scanState.timer=requestAnimationFrame(scan);
  }catch(e){$("#sm186ScanStatus").textContent=e.message||String(e)}
}

async function showReport(meetingId){
  const d=dialog("sm186ReportDialog");
  d.innerHTML=`<div class="sm186-dialog-body"><div class="sm186-dialog-head"><div><h2>Attendance report</h2><p>Each online number is a separate check-in checkpoint.</p></div><button class="sm186-close" type="button">×</button></div><div id="sm186Report">Loading…</div></div>`;
  d.querySelector(".sm186-close").onclick=()=>d.close();d.showModal();
  try{
    const rows=await rpc("owner_attendance_report_v179",{p_meeting_id:meetingId});
    const total=Math.max(0,...rows.map(r=>Number(r.checkpoint_total||0)));
    const headers=Array.from({length:total},(_,i)=>`<th>Check-in ${i+1}</th>`).join("");
    const cls=s=>s==='Full attendance'?'full':s==='Partial attendance'?'partial':s==='Minimal attendance'?'minimal':'absent';
    const body=rows.map(r=>{const map=new Map((Array.isArray(r.checkpoints)?r.checkpoints:[]).map(p=>[Number(p.checkpoint_no),p]));const cells=Array.from({length:total},(_,i)=>{const p=map.get(i+1);return `<td>${p?`✓ ${dt(p.checked_in_at)}`:'—'}</td>`}).join("");return `<tr><td><b>${esc(r.resident_name)}</b></td><td>${esc(r.residency_year||'—')}</td>${cells}<td>${Number(r.attendance_percent||0)}%</td><td class="sm186-status-${cls(r.attendance_status)}">${esc(r.attendance_status)}</td></tr>`}).join("");
    $("#sm186Report").innerHTML=`<div class="sm186-note"><b>Full attendance</b> = all check-ins · <b>Partial</b> = 50–99% · <b>Minimal</b> = 1–49% · <b>Absent</b> = none.</div><div class="sm186-table-wrap"><table class="sm186-table"><thead><tr><th>Resident</th><th>Year</th>${headers}<th>Attendance</th><th>Result</th></tr></thead><tbody>${body}</tbody></table></div>`;
  }catch(e){$("#sm186Report").innerHTML=`<div class="sm186-note">${esc(e.message||e)}</div>`}
}

async function openMeetings(message=""){
  closeDrawer();
  if(role==='owner')await adminMeetings(message);else if(role==='resident')await residentMeetings(message);
}

async function handleExternalQr(){
  const m=location.hash.match(/^#attendance-checkin=([0-9a-f-]{36})$/i);
  if(!m||role!=='resident')return false;
  try{await rpc("resident_attendance_checkin_v167",{p_qr_token:m[1],p_meeting_id:null});await residentMeetings("You checked in successfully.")}catch(e){history.replaceState(null,"",`${location.pathname}#schedule-meetings`);await residentMeetings();alert(e.message||e)}
  return true;
}

document.addEventListener("click",async e=>{
  const nav=e.target.closest?.("#nav button,#nav a");if(nav){closeDrawer();requestAnimationFrame(closeDrawer);setTimeout(closeDrawer,80)}
  const tab=e.target.closest?.("[data-sm186-tab]");
  if(tab){e.preventDefault();if(tab.dataset.sm186Tab==='meetings'){await openMeetings();return}const n=scheduleNav();if(n){closeDrawer();n.click()}return}
  const submit=e.target.closest?.("[data-sm186-submit-code]");
  if(submit){const id=submit.dataset.sm186SubmitCode,input=$(`[data-sm186-code-input="${id}"]`),code=String(input?.value||"").trim();if(!/^[0-9]{4,8}$/.test(code)){alert("Enter the 4–8 digit number announced by Admin.");return}submit.disabled=true;try{await rpc("resident_online_checkpoint_v179",{p_meeting_id:id,p_code:code});await residentMeetings("You checked in successfully.")}catch(err){alert(err.message||err);submit.disabled=false}return}
  const scan=e.target.closest?.("[data-sm186-scan]");if(scan){await openScanner();return}
  const make=e.target.closest?.("[data-sm186-create-code]");
  if(make){const id=make.dataset.sm186CreateCode,input=$(`[data-sm186-admin-code="${id}"]`),code=String(input?.value||"").trim();if(!/^[0-9]{4,8}$/.test(code)){alert("Choose a number between 4 and 8 digits.");return}make.disabled=true;try{const r=await rpc("owner_create_online_checkpoint_v186",{p_meeting_id:id,p_code:code});await adminMeetings(`Check-in ${r.checkpoint_no} started with number ${r.code}.`)}catch(err){alert(err.message||err);make.disabled=false}return}
  const qr=e.target.closest?.("[data-sm186-show-qr]");if(qr){await showQr(qr.dataset.sm186ShowQr);return}
  const newQr=e.target.closest?.("[data-sm186-new-qr]");if(newQr){if(!confirm("Generate a new QR? The previous QR will stop working immediately."))return;try{await rpc("owner_regenerate_attendance_qr_v167",{p_meeting_id:newQr.dataset.sm186NewQr});await showQr(newQr.dataset.sm186NewQr)}catch(err){alert(err.message||err)}return}
  const report=e.target.closest?.("[data-sm186-report]");if(report){await showReport(report.dataset.sm186Report);return}
},true);

async function boot(){
  addStyles();
  try{const{data:sess}=await sb.auth.getSession();const uid=sess?.session?.user?.id;if(!uid)return;const{data:p}=await sb.from("profiles").select("role,is_active").eq("id",uid).maybeSingle();if(!p?.is_active)return;role=String(p.role||"")}catch{return}
  normalizeScheduleNav();decorateSchedule();
  const nav=$("#nav");if(nav)new MutationObserver(()=>normalizeScheduleNav()).observe(nav,{childList:true,subtree:true});
  const content=$("#content");if(content)new MutationObserver(()=>decorateSchedule()).observe(content,{childList:true,subtree:false});
  if(await handleExternalQr())return;
  if(location.hash==='#schedule-meetings')await openMeetings();
}

window.addEventListener("hashchange",()=>{closeDrawer();if(/^#attendance-checkin=/i.test(location.hash))void handleExternalQr();else if(location.hash==='#schedule-meetings')void openMeetings()});
boot();
