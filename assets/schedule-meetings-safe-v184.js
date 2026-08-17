import { sb } from "./supabase.js";

const $=(s,r=document)=>r.querySelector(s);
const $$=(s,r=document)=>[...r.querySelectorAll(s)];
const CAIRO="Africa/Cairo";
let role="";

const esc=v=>String(v??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));
const dt=v=>{if(!v)return"—";return new Intl.DateTimeFormat("en-GB",{timeZone:CAIRO,day:"2-digit",month:"2-digit",year:"numeric",hour:"2-digit",minute:"2-digit"}).format(new Date(v));};
const rpc=(name,args={})=>sb.rpc(name,args).then(({data,error})=>{if(error)throw error;return data;});
const toIso=v=>v?new Date(`${v}:00+03:00`).toISOString():null;
const localDate=()=>new Intl.DateTimeFormat("en-CA",{timeZone:CAIRO}).format(new Date());

function closeDrawer(){
  document.body.classList.remove("drawer-open","nav-open","menu-open");
  document.documentElement.classList.remove("drawer-open","nav-open","menu-open");
  $("#shell")?.classList.remove("drawer-open","nav-open","menu-open","open");
  $("aside")?.classList.remove("open","active","show");
  $("#backdrop")?.classList.remove("show","active","open");
}

function setHead(){
  if($("#crumb"))$("#crumb").textContent=role==="owner"?"ADMIN":"RESIDENT";
  if($("#title"))$("#title").textContent="Schedule & meetings";
}

function scheduleNav(){
  return $$("#nav button,#nav a").find(n=>n.hasAttribute("data-resident-schedule-link")||n.hasAttribute("data-admin-schedule-link")||/^(schedule|schedule\s*&\s*meetings)$/i.test((n.textContent||"").trim()));
}

function renameScheduleNav(){
  const n=scheduleNav();if(!n)return;
  const badge=n.querySelector(".nav-badge");
  let label=[...n.children].find(x=>x!==badge);
  if(label)label.textContent="Schedule & meetings";else n.textContent="Schedule & meetings";
  n.setAttribute("aria-label","Schedule & meetings");
}

function addStyles(){
  if($("#smSafe184Styles"))return;
  const s=document.createElement("style");s.id="smSafe184Styles";s.textContent=`
.sm-safe-tabs{display:flex;gap:8px;padding:6px;background:#edf4f9;border:1px solid #d9e4ee;border-radius:16px;width:max-content;max-width:100%;margin:0 0 16px}.sm-safe-tabs button{border:0;background:transparent;color:#24445f;padding:10px 17px;border-radius:11px;font-weight:900;cursor:pointer}.sm-safe-tabs button.active{background:#0b3764;color:#fff!important;-webkit-text-fill-color:#fff!important}.sm-safe-page{display:grid;gap:16px}.sm-safe-hero{padding:20px;border:1px solid #dbe7f2;border-radius:20px;background:linear-gradient(145deg,#fff,#f6fbff)}.sm-safe-hero h2{margin:0;font-size:1.45rem}.sm-safe-hero p{margin:6px 0 0;color:#617386}.sm-safe-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:14px}.sm-safe-card{border:1px solid #dbe4ee;border-radius:18px;padding:17px;background:#fff;box-shadow:0 8px 24px rgba(10,42,73,.05)}.sm-safe-card h3{margin:8px 0}.sm-safe-meta{display:grid;gap:6px;color:#5f7184;font-size:.84rem}.sm-safe-badge{display:inline-flex;padding:5px 9px;border-radius:999px;font-size:.72rem;font-weight:900}.sm-safe-badge.ok{background:#e7f7ee;color:#087443}.sm-safe-badge.wait{background:#fff3cf;color:#8a5d00}.sm-safe-badge.physical{background:#e8f1ff;color:#1659a3}.sm-safe-badge.online{background:#f0eaff;color:#6238a3}.sm-safe-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}.sm-safe-actions button,.sm-safe-primary{border:0;border-radius:11px;padding:10px 13px;font-weight:900;cursor:pointer;background:#0b3764;color:#fff!important;-webkit-text-fill-color:#fff!important}.sm-safe-actions .secondary{background:#edf3f8;color:#0c2f51!important;-webkit-text-fill-color:#0c2f51!important}.sm-safe-note{margin-top:10px;padding:11px 13px;border-radius:12px;background:#f5f8fb;color:#607386;font-size:.82rem}.sm-safe-success{margin-top:10px;padding:10px 12px;border-radius:12px;background:#e8f7ee;color:#08683e;font-weight:900}.sm-safe-codebox{margin-top:12px;padding:16px;border-radius:16px;background:#081f3a;color:#fff;text-align:center}.sm-safe-code{font-size:2.3rem;letter-spacing:.15em;font-weight:950;margin:5px 0}.sm-safe-code-entry{display:flex;gap:8px;margin-top:12px}.sm-safe-code-entry input{flex:1;min-width:0;border:1px solid #cbd9e7;border-radius:12px;padding:11px 13px;font-size:1.05rem;font-weight:900;letter-spacing:.12em}.sm-safe-form{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;padding:16px;border:1px solid #dbe4ee;border-radius:18px;background:#fff}.sm-safe-form label{display:grid;gap:6px;font-weight:800;font-size:.8rem}.sm-safe-form label.full{grid-column:1/-1}.sm-safe-form input,.sm-safe-form select,.sm-safe-form textarea{width:100%;box-sizing:border-box;border:1px solid #ccd9e6;border-radius:11px;padding:10px 11px;font:inherit;background:#fff}.sm-safe-form button{grid-column:1/-1;justify-self:start}.sm-safe-dialog{width:min(96vw,1050px);max-height:90vh;border:0;border-radius:20px;padding:0;box-shadow:0 28px 80px rgba(7,27,48,.28)}.sm-safe-dialog::backdrop{background:rgba(7,22,38,.52)}.sm-safe-dialog-body{padding:20px}.sm-safe-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}.sm-safe-head h2{margin:0}.sm-safe-close{border:0;background:#edf3f8;border-radius:10px;width:38px;height:38px;font-size:1.25rem}.sm-safe-qr{display:grid;place-items:center;margin:16px auto;padding:14px;background:#fff;border:1px solid #dce5ee;border-radius:18px;max-width:450px}.sm-safe-qr img{width:min(100%,420px);height:auto}.sm-safe-table-wrap{overflow:auto;border:1px solid #dde6ef;border-radius:14px;margin-top:14px}.sm-safe-table{border-collapse:collapse;width:100%;font-size:.8rem}.sm-safe-table th,.sm-safe-table td{padding:10px;border-bottom:1px solid #edf1f5;text-align:left;white-space:nowrap}.sm-safe-table th{background:#f6f8fb}.sm-safe-full{color:#087443;font-weight:900}.sm-safe-partial{color:#9b6700;font-weight:900}.sm-safe-minimal{color:#b24a00;font-weight:900}.sm-safe-absent{color:#af1530;font-weight:900}@media(max-width:720px){.sm-safe-form{grid-template-columns:1fr}.sm-safe-form label.full{grid-column:auto}.sm-safe-code-entry{flex-direction:column}}
`;document.head.appendChild(s);
}

function tabs(active){return `<div class="sm-safe-tabs" data-sm-safe-tabs><button type="button" data-sm-safe="schedule" class="${active==='schedule'?'active':''}">Schedule</button><button type="button" data-sm-safe="meetings" class="${active==='meetings'?'active':''}">Meetings</button></div>`;}

function looksLikeSchedule(){
  const c=$("#content");return !!c&&(!!c.querySelector(".schedule-page,.admin-schedule-page")||/Shifts, duties\s*&\s*substitutions|Schedule substitutions/i.test(c.textContent||""));
}

function injectScheduleTabs(){
  renameScheduleNav();
  if(!looksLikeSchedule())return;
  setHead();
  const c=$("#content");
  if(!c.querySelector("[data-sm-safe-tabs]")){const w=document.createElement("div");w.innerHTML=tabs("schedule");c.prepend(w.firstElementChild);}
}

function afterScheduleRender(){
  [50,150,350].forEach(ms=>setTimeout(()=>{injectScheduleTabs();closeDrawer();},ms));
}

function dialog(id){let d=$(`#${id}`);if(!d){d=document.createElement("dialog");d.id=id;d.className="sm-safe-dialog";document.body.appendChild(d);}return d;}

async function renderResidentMeetings(message=""){
  setHead();const c=$("#content");if(!c)return;
  c.innerHTML=`<div class="sm-safe-page">${tabs("meetings")}<section class="sm-safe-hero"><h2>Meeting attendance</h2><p>Physical meetings use the Admin QR. Online meetings use changing attendance codes during the meeting.</p></section>${message?`<div class="sm-safe-success">${esc(message)}</div>`:""}<div id="smSafeResidentList" class="sm-safe-grid"><div class="sm-safe-card">Loading…</div></div></div>`;
  try{
    const rows=await rpc("get_my_attendance_meetings_v179"),box=$("#smSafeResidentList");if(!box)return;
    if(!rows?.length){box.innerHTML='<div class="sm-safe-card"><h3>No planned meetings</h3><div class="sm-safe-meta">No meetings are currently planned.</div></div>';return;}
    const now=Date.now();
    box.innerHTML=rows.map(m=>{const open=now>=new Date(m.checkin_opens_at).getTime()&&now<=new Date(m.checkin_closes_at).getTime();const points=Array.isArray(m.my_checkpoints)?m.my_checkpoints:[];return `<article class="sm-safe-card"><span class="sm-safe-badge ${m.attended?'ok':'wait'}">${m.attended?'✓ Checked-in':'Not checked in'}</span> <span class="sm-safe-badge ${m.meeting_mode}">${m.meeting_mode==='physical'?'Physical · QR':'Online · codes'}</span><h3>${esc(m.title)}</h3><div class="sm-safe-meta"><span><b>Meeting starts:</b> ${dt(m.starts_at)}${m.ends_at?` · <b>ends:</b> ${dt(m.ends_at)}`:''}</span>${m.venue?`<span>📍 ${esc(m.venue)}</span>`:''}<span><b>Check-in for this meeting starts:</b> ${dt(m.checkin_opens_at)} · <b>ends:</b> ${dt(m.checkin_closes_at)}</span></div>${m.meeting_mode==='physical'?(m.attended?`<div class="sm-safe-success">✓ You checked-in successfully<br><small>Check-in time: ${dt(m.checked_in_at)}</small></div>`:`<div class="sm-safe-note">Scan the QR shown by the Admin during the check-in window.</div>`):`<div class="sm-safe-note"><b>Your progress:</b> ${Number(m.my_checkpoint_count||0)} / ${Number(m.checkpoint_total||0)} checkpoints${points.length?`<br>${points.map(p=>`Check-in ${p.checkpoint_no}: ${dt(p.checked_in_at)}`).join(" · ")}`:''}</div>${open?`<div class="sm-safe-code-entry"><input inputmode="numeric" maxlength="6" pattern="[0-9]*" placeholder="Enter 6-digit code" data-code-input="${m.id}"><button class="sm-safe-primary" data-submit-code="${m.id}">Check in</button></div>`:`<div class="sm-safe-note">Code entry is available only during the meeting check-in window.</div>`}`}</article>`;}).join("");
    box.querySelectorAll("[data-submit-code]").forEach(btn=>btn.onclick=async()=>{const id=btn.dataset.submitCode,input=box.querySelector(`[data-code-input="${id}"]`),code=String(input?.value||"").trim();if(!/^\d{6}$/.test(code))return alert("Enter the 6-digit attendance code.");try{const r=await rpc("resident_online_checkpoint_v179",{p_meeting_id:id,p_code:code});await renderResidentMeetings(`✓ Check-in ${r.checkpoint_no} recorded successfully at ${dt(r.checked_in_at)}.`);}catch(e){alert(e.message||e);}});
  }catch(e){const b=$("#smSafeResidentList");if(b)b.innerHTML=`<div class="sm-safe-card">${esc(e.message||e)}</div>`;}
}

async function renderAdminMeetings(){
  setHead();const c=$("#content");if(!c)return;
  c.innerHTML=`<div class="sm-safe-page">${tabs("meetings")}<section class="sm-safe-hero"><h2>Resident meeting attendance</h2><p>Physical meetings: generate a secure QR. Online meetings: generate changing six-digit checkpoints as often as needed.</p></section><form id="smSafeForm" class="sm-safe-form"><label class="full">Meeting title<input name="title" required minlength="3"></label><label>Date<input name="date" type="date" required></label><label>Type<select name="mode"><option value="physical">Physical meeting · QR</option><option value="online">Online meeting · changing codes</option></select></label><label>Starts<input name="starts" type="datetime-local" required></label><label>Ends (optional)<input name="ends" type="datetime-local"></label><label>Check-in opens<input name="opens" type="datetime-local" required></label><label>Check-in closes<input name="closes" type="datetime-local" required></label><label>Venue<input name="venue"></label><label>Notes<input name="notes"></label><button class="sm-safe-primary" type="submit">Create meeting</button></form><div id="smSafeAdminList" class="sm-safe-grid"><div class="sm-safe-card">Loading…</div></div></div>`;
  const f=$("#smSafeForm");f.date.value=localDate();f.onsubmit=async e=>{e.preventDefault();try{await rpc("owner_create_attendance_meeting_v167",{p_title:f.title.value,p_meeting_date:f.date.value,p_starts_at:toIso(f.starts.value),p_ends_at:toIso(f.ends.value),p_checkin_opens_at:toIso(f.opens.value),p_checkin_closes_at:toIso(f.closes.value),p_meeting_mode:f.mode.value,p_venue:f.venue.value,p_notes:f.notes.value});await renderAdminMeetings();}catch(err){alert(err.message||err);}};
  await paintAdmin();
}

async function paintAdmin(){
  const box=$("#smSafeAdminList");if(!box)return;
  try{
    const rows=await rpc("owner_list_attendance_meetings_v179");if(!rows?.length){box.innerHTML='<div class="sm-safe-card"><h3>No meetings created</h3></div>';return;}
    box.innerHTML=rows.map(m=>{const cp=m.current_checkpoint;return `<article class="sm-safe-card"><span class="sm-safe-badge ${m.is_active?'ok':'wait'}">${m.is_active?'Active':'Archived'}</span> <span class="sm-safe-badge ${m.meeting_mode}">${m.meeting_mode==='physical'?'Physical · QR':'Online · codes'}</span><h3>${esc(m.title)}</h3><div class="sm-safe-meta"><span><b>Meeting starts:</b> ${dt(m.starts_at)}${m.ends_at?` · <b>ends:</b> ${dt(m.ends_at)}`:''}</span><span><b>Check-in:</b> ${dt(m.checkin_opens_at)} → ${dt(m.checkin_closes_at)}</span><span><b>${Number(m.attendance_count||0)}</b> residents checked in</span>${m.meeting_mode==='online'?`<span><b>${Number(m.checkpoint_total||0)}</b> checkpoints generated</span>`:''}</div>${m.meeting_mode==='online'&&cp?`<div class="sm-safe-codebox"><small>CHECK-IN ${cp.checkpoint_no} · CURRENT CODE</small><div class="sm-safe-code">${esc(cp.code)}</div></div>`:''}<div class="sm-safe-actions">${m.meeting_mode==='physical'?`<button data-qr="${m.id}">Show QR</button><button class="secondary" data-newqr="${m.id}">New QR</button>`:`<button data-code="${m.id}">Generate ${cp?'next':'first'} code</button>`}<button class="secondary" data-report="${m.id}">Attendance report</button></div></article>`;}).join("");
    rows.forEach(m=>{box.querySelector(`[data-qr="${m.id}"]`)?.addEventListener("click",()=>showQr(m));box.querySelector(`[data-newqr="${m.id}"]`)?.addEventListener("click",async()=>{if(!confirm("Generate a new QR? The previous QR will immediately stop working."))return;try{await rpc("owner_regenerate_attendance_qr_v167",{p_meeting_id:m.id});await paintAdmin();}catch(e){alert(e.message||e);}});box.querySelector(`[data-code="${m.id}"]`)?.addEventListener("click",async()=>{try{const r=await rpc("owner_generate_online_checkpoint_v179",{p_meeting_id:m.id});await paintAdmin();alert(`Check-in ${r.checkpoint_no} code: ${r.code}`);}catch(e){alert(e.message||e);}});box.querySelector(`[data-report="${m.id}"]`)?.addEventListener("click",()=>showReport(m));});
  }catch(e){box.innerHTML=`<div class="sm-safe-card">${esc(e.message||e)}</div>`;}
}

async function showQr(m){
  const d=dialog("smSafeQrDialog");d.innerHTML=`<div class="sm-safe-dialog-body"><div class="sm-safe-head"><div><h2>${esc(m.title)}</h2><p>Residents scan this QR during the check-in window.</p></div><button class="sm-safe-close">×</button></div><div id="smSafeQrBox" class="sm-safe-qr">Generating secure QR…</div></div>`;d.querySelector(".sm-safe-close").onclick=()=>d.close();d.showModal();
  try{const {data,error}=await sb.functions.invoke("attendance-qr-v179",{body:{meeting_id:m.id}});if(error)throw error;if(!data?.data_url)throw new Error(data?.error||"QR generation failed");$("#smSafeQrBox").innerHTML=`<img alt="Meeting check-in QR" src="${data.data_url}">`;}catch(e){$("#smSafeQrBox").innerHTML=`<div class="sm-safe-note">${esc(e.message||e)}</div>`;}
}

async function showReport(m){
  const d=dialog("smSafeReportDialog");d.innerHTML=`<div class="sm-safe-dialog-body"><div class="sm-safe-head"><div><h2>${esc(m.title)}</h2><p>Attendance report</p></div><button class="sm-safe-close">×</button></div><div id="smSafeReport">Loading…</div></div>`;d.querySelector(".sm-safe-close").onclick=()=>d.close();d.showModal();
  try{const rows=await rpc("owner_attendance_report_v179",{p_meeting_id:m.id}),total=Math.max(0,...rows.map(r=>Number(r.checkpoint_total||0))),heads=Array.from({length:total},(_,i)=>`<th>Check-in ${i+1}</th>`).join("");const cls=s=>s==='Full attendance'?'full':s==='Partial attendance'?'partial':s==='Minimal attendance'?'minimal':'absent';const body=rows.map(r=>{const map=new Map((Array.isArray(r.checkpoints)?r.checkpoints:[]).map(p=>[Number(p.checkpoint_no),p]));const cells=Array.from({length:total},(_,i)=>{const p=map.get(i+1);return `<td>${p?`✓ ${dt(p.checked_in_at)}`:'—'}</td>`;}).join("");return `<tr><td><b>${esc(r.resident_name)}</b></td><td>${esc(r.residency_year||'—')}</td>${cells}<td>${Number(r.attendance_percent||0)}%</td><td class="sm-safe-${cls(r.attendance_status)}">${esc(r.attendance_status)}</td></tr>`;}).join("");$("#smSafeReport").innerHTML=`<div class="sm-safe-note">Full = all checkpoints · Partial = 50–99% · Minimal = 1–49% · Absent = none.</div><div class="sm-safe-table-wrap"><table class="sm-safe-table"><thead><tr><th>Resident</th><th>Year</th>${heads}<th>Attendance</th><th>Result</th></tr></thead><tbody>${body}</tbody></table></div>`;}catch(e){$("#smSafeReport").innerHTML=`<div class="sm-safe-note">${esc(e.message||e)}</div>`;}
}

async function openMeetings(message=""){
  closeDrawer();history.replaceState(null,"",`${location.pathname}#schedule-meetings`);if(!role)await getRole();if(role==="owner")await renderAdminMeetings();else await renderResidentMeetings(message);closeDrawer();
}

function openSchedule(){
  const n=scheduleNav();if(!n)return;history.replaceState(null,"",role==="owner"?"#admin-schedule":"#resident-schedule");n.click();afterScheduleRender();
}

async function getRole(){
  try{const{data:s}=await sb.auth.getSession(),id=s?.session?.user?.id;if(!id)return"";const{data:p}=await sb.from("profiles").select("role,is_active").eq("id",id).maybeSingle();if(!p?.is_active)return"";role=String(p.role||"");return role;}catch{return"";}
}

async function handleQrHash(){
  const m=location.hash.match(/^#attendance-checkin=([0-9a-f-]{36})$/i);if(!m||role!=="resident")return false;
  try{const r=await rpc("resident_attendance_checkin_v167",{p_qr_token:m[1],p_meeting_id:null});await openMeetings(`✓ You checked-in successfully at ${dt(r.checked_in_at)}.`);}catch(e){await openMeetings();alert(e.message||e);}return true;
}

document.addEventListener("click",e=>{
  const meeting=e.target.closest?.('[data-sm-safe="meetings"]');if(meeting){e.preventDefault();e.stopImmediatePropagation();void openMeetings();return;}
  const schedule=e.target.closest?.('[data-sm-safe="schedule"]');if(schedule){e.preventDefault();e.stopImmediatePropagation();openSchedule();return;}
  const nav=e.target.closest?.("#nav button,#nav a");if(nav){setTimeout(closeDrawer,0);if(nav===scheduleNav())afterScheduleRender();}
},true);

window.addEventListener("hashchange",()=>{if(location.hash==="#schedule-meetings")void openMeetings();else if(location.hash==="#resident-schedule"||location.hash==="#admin-schedule")afterScheduleRender();});

async function boot(){
  addStyles();await getRole();if(!role)return;
  renameScheduleNav();
  const nav=$("#nav");if(nav)new MutationObserver(()=>renameScheduleNav()).observe(nav,{childList:true,subtree:false});
  if(await handleQrHash())return;
  if(location.hash==="#schedule-meetings")await openMeetings();else if(location.hash==="#resident-schedule"||location.hash==="#admin-schedule")afterScheduleRender();
  else setTimeout(renameScheduleNav,200);
}

boot();
