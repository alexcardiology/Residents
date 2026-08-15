import { sb } from "./supabase.js";

let profile=null,rendering=false,badgeBusy=false,adminRendering=false;
const esc=(v)=>String(v??"").replace(/[&<>'"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"})[c]);
const unwrap=(r)=>{if(r?.error)throw r.error;return r?.data};
const dateLabel=(value)=>{if(!value)return"—";const[y,m,d]=String(value).slice(0,10).split("-");return`${d}-${m}-${y}`};
function toast(text){const n=document.querySelector("#toast");if(!n)return;n.textContent=text;n.style.display="block";setTimeout(()=>n.style.display="none",3200)}
function typeLabel(type){return type==="duty"?"Duty":"Shift"}
function typeIcon(type){return type==="duty"?"🌙":"🕒"}
function statusInfo(status){return({
  pending_substitute:["Waiting for involved resident","pending"],
  pending_admin:["Involved resident approved · waiting senior approval","pending"],
  approved:["Approved","approved"],
  rejected_substitute:["Declined by involved resident","rejected"],
  rejected_admin:["Senior approval declined","rejected"],
  cancelled:["Cancelled","rejected"]
})[status]||[status,"pending"]}
function recInfo(row){
  if(row.reconsideration_status==="requested")return`<span class="schedule-status pending">Reconsideration requested</span>`;
  if(row.reconsideration_status==="approved")return`<span class="schedule-status approved">Reconsideration approved</span>`;
  if(row.reconsideration_status==="rejected")return`<span class="schedule-status rejected">Reconsideration declined</span>`;
  return"";
}
function inlineRejectBox(id,kind,label="Reason for declining"){
  return `<div class="schedule-inline-decision" data-inline-decision="${kind}:${id}" hidden><label>${esc(label)}<textarea maxlength="1000" placeholder="Write the reason here" required></textarea></label><div><button type="button" class="schedule-inline-cancel" data-schedule-hide-decision>Cancel</button><button type="button" class="schedule-inline-confirm reject" data-schedule-confirm-reject="${kind}" data-request-id="${id}">Confirm rejection</button></div></div>`;
}
function inlineReconsiderBox(id){
  return `<div class="schedule-inline-decision reconsider" data-inline-reconsider="${id}" hidden><label>Reason for reconsideration<textarea maxlength="1000" minlength="3" placeholder="Explain why you are asking for the decision to be reconsidered" required></textarea></label><div><button type="button" class="schedule-inline-cancel" data-schedule-hide-reconsider>Cancel</button><button type="button" class="schedule-inline-confirm" data-schedule-confirm-reconsider data-request-id="${id}">Send reconsideration</button></div></div>`;
}
function historyMeta(row){
  const items=[];
  if(row.substitute_note)items.push(`<span class="schedule-chip"><b>Involved resident:</b> ${esc(row.substitute_note)}</span>`);
  if(row.admin_note)items.push(`<span class="schedule-chip"><b>Senior decision:</b> ${esc(row.admin_note)}</span>`);
  if(row.reconsideration_reason)items.push(`<span class="schedule-chip reconsider-chip"><b>Reconsideration:</b> ${esc(row.reconsideration_reason)}</span>`);
  if(row.reconsideration_note)items.push(`<span class="schedule-chip"><b>Reconsideration decision:</b> ${esc(row.reconsideration_note)}</span>`);
  return items.join("");
}
function residentActions(row){
  const isSub=row.viewer_role==="substitute",isRequester=row.viewer_role==="requester";
  if(isSub&&row.status==="pending_substitute")return `<div class="schedule-action-zone"><div class="schedule-actions"><button type="button" class="reject" data-schedule-show-reject="peer" data-request-id="${row.id}">Reject</button><button type="button" class="approve" data-schedule-direct-approve="peer" data-request-id="${row.id}">Approve</button></div>${inlineRejectBox(row.id,"peer")}</div>`;
  if(isSub&&row.reconsideration_status==="requested"&&row.reconsideration_target==="substitute")return `<div class="schedule-action-zone"><div class="schedule-reconsider-callout"><b>Reconsideration requested</b><p>${esc(row.reconsideration_reason||"")}</p></div><div class="schedule-actions"><button type="button" class="reject" data-schedule-show-reject="peer-reconsider" data-request-id="${row.id}">Keep rejection</button><button type="button" class="approve" data-schedule-direct-approve="peer-reconsider" data-request-id="${row.id}">Approve reconsideration</button></div>${inlineRejectBox(row.id,"peer-reconsider","Reason for keeping the rejection")}</div>`;
  if(isRequester&&["rejected_substitute","rejected_admin"].includes(row.status)&&row.reconsideration_status!=="requested")return `<div class="schedule-action-zone"><button type="button" class="schedule-reconsider-button" data-schedule-show-reconsider data-request-id="${row.id}">Request reconsideration</button>${inlineReconsiderBox(row.id)}</div>`;
  return `<div class="schedule-card-status">${recInfo(row)||`<span class="schedule-status ${statusInfo(row.status)[1]}">${esc(statusInfo(row.status)[0])}</span>`}</div>`;
}
function requestCard(row){
  return `<article class="schedule-request-card ${row.viewer_role==="substitute"&&row.status==="pending_substitute"?"action-needed":""}"><div class="schedule-request-main"><strong>${typeIcon(row.request_type)} ${typeLabel(row.request_type)} · ${dateLabel(row.scheduled_date)}</strong><small>${row.viewer_role==="substitute"?`${esc(row.requester_name)} asks you to cover this ${typeLabel(row.request_type).toLowerCase()}.`:`Involved resident: ${esc(row.substitute_name)}`}</small><div class="schedule-request-meta"><span class="schedule-chip">${esc(row.requester_name)} → ${esc(row.substitute_name)}</span><span class="schedule-chip schedule-cause"><b>Cause:</b> ${esc(row.requester_note||"—")}</span>${historyMeta(row)}</div></div>${residentActions(row)}</article>`;
}
async function getProfile(){if(profile)return profile;const{data:sess}=await sb.auth.getSession();const uid=sess?.session?.user?.id;if(!uid)return null;const{data,error}=await sb.from("profiles").select("id,display_name,role,residency_year").eq("id",uid).single();if(error)return null;profile=data;return data}
function navButton(kind,label,badgeAttr){const b=document.createElement("button");b.type="button";b.className="schedule-nav-link";b.dataset[kind]="1";b.innerHTML=`<span>${label}</span><span class="nav-badge" ${badgeAttr} hidden>0</span>`;return b}
function installScheduleNav(){
  const nav=document.querySelector("#nav");if(!nav||!profile)return;
  if(profile.role==="resident"&&!nav.querySelector("[data-resident-schedule-link]")){const b=navButton("residentScheduleLink","Schedule","data-schedule-badge");const anchor=nav.querySelector('[data-go="logbook-requests"]');anchor?anchor.after(b):nav.appendChild(b)}
  if(profile.role==="owner"&&!nav.querySelector("[data-admin-schedule-link]")){const b=navButton("adminScheduleLink","Schedule","data-admin-schedule-badge");const anchor=nav.querySelector('[data-go="owner-logbook-center"]');anchor?anchor.after(b):nav.appendChild(b)}
}
async function refreshBadges(){
  if(badgeBusy||!profile)return;badgeBusy=true;try{
    if(profile.role==="resident"){const c=Number(unwrap(await sb.rpc("get_schedule_badge_count_v130"))||0);document.querySelectorAll("[data-schedule-badge]").forEach(b=>{b.textContent=String(c);b.hidden=c===0})}
    if(profile.role==="owner"){const c=Number(unwrap(await sb.rpc("get_admin_schedule_badge_count_v131"))||0);document.querySelectorAll("[data-admin-schedule-badge]").forEach(b=>{b.textContent=String(c);b.hidden=c===0})}
  }catch(_){}finally{badgeBusy=false}
}
async function renderResidentSchedule(){
  if(rendering||profile?.role!=="resident")return;rendering=true;try{
    const content=document.querySelector("#content");if(!content)return;document.querySelector("#title").textContent="Schedule";document.querySelector("#crumb").textContent="RESIDENT";
    const[candidates,requests]=await Promise.all([sb.rpc("get_schedule_substitution_candidates_v125"),sb.rpc("get_schedule_substitution_requests_v125")]);const people=unwrap(candidates)||[],rows=unwrap(requests)||[];
    const actionRows=rows.filter(r=>(r.viewer_role==="substitute"&&r.status==="pending_substitute")||(r.viewer_role==="substitute"&&r.reconsideration_status==="requested"&&r.reconsideration_target==="substitute"));
    const myRows=rows.filter(r=>r.viewer_role==="requester");const related=rows.filter(r=>r.viewer_role==="substitute"&&!actionRows.some(x=>x.id===r.id));
    const today=new Date();today.setMinutes(today.getMinutes()-today.getTimezoneOffset());const min=today.toISOString().slice(0,10);
    content.innerHTML=`<div class="schedule-page"><section class="schedule-hero"><div><span>Resident schedule</span><h2>Shifts, duties & substitutions</h2><p>The involved resident approves first. Senior approval is the final step.</p></div><div class="schedule-hero-icon">↔</div></section><div class="schedule-grid"><section class="schedule-card"><h3>Request a substitution</h3><p>Choose the type, date, cause and resident who will substitute you.</p><form id="scheduleSubstitutionForm" class="schedule-form"><div class="schedule-type-picker"><label class="schedule-type-option"><input type="radio" name="request_type" value="shift" checked> 🕒 Shift</label><label class="schedule-type-option"><input type="radio" name="request_type" value="duty"> 🌙 Duty</label></div><label>Date<input type="date" name="scheduled_date" min="${min}" required></label><label>Resident who will substitute you<select name="substitute_id" required><option value="">Choose resident</option>${people.map(p=>`<option value="${p.id}">${esc(p.display_name)} · Year ${p.residency_year}</option>`).join("")}</select></label><label>Cause of substitution <small>required</small><textarea name="note" minlength="3" maxlength="1000" required placeholder="State the reason for substitution"></textarea></label><button class="schedule-submit" type="submit">Send to involved resident</button></form></section><section class="schedule-card"><h3>Needs my response</h3><p>These decisions stay inside Schedule.</p><div class="schedule-list">${actionRows.length?actionRows.map(requestCard).join(""):'<div class="schedule-empty">Nothing is waiting for your response.</div>'}</div><h3 class="schedule-subheading">My substitution requests</h3><div class="schedule-list">${myRows.length?myRows.map(requestCard).join(""):'<div class="schedule-empty">You have not requested a substitution yet.</div>'}</div>${related.length?`<h3 class="schedule-subheading">Previous requests involving me</h3><div class="schedule-list">${related.map(requestCard).join("")}</div>`:""}</section></div></div>`;
    try{unwrap(await sb.rpc("mark_schedule_seen_v130"))}catch(_){}await refreshBadges();
  }catch(error){alert(error?.message||String(error))}finally{rendering=false}
}
function adminStatus(row){const[label,cls]=statusInfo(row.status);return `<span class="schedule-status ${cls}">${esc(label)}</span>${row.reconsideration_status?recInfo(row):""}`}
function adminActions(row){
  if(row.reconsideration_status==="requested"&&row.reconsideration_target==="admin")return `<div class="schedule-action-zone"><div class="schedule-reconsider-callout"><b>Resident requested reconsideration</b><p>${esc(row.reconsideration_reason||"")}</p></div><div class="schedule-actions"><button type="button" class="reject" data-schedule-show-reject="admin-reconsider" data-request-id="${row.id}">Keep rejection</button><button type="button" class="approve" data-schedule-direct-approve="admin-reconsider" data-request-id="${row.id}">Approve reconsideration</button></div>${inlineRejectBox(row.id,"admin-reconsider","Reason for keeping the rejection")}</div>`;
  if(row.status==="pending_admin")return `<div class="schedule-action-zone"><div class="schedule-actions"><button type="button" class="reject" data-schedule-show-reject="admin" data-request-id="${row.id}">Reject</button><button type="button" class="approve" data-schedule-direct-approve="admin" data-request-id="${row.id}">Approve</button></div>${inlineRejectBox(row.id,"admin","Reason for rejection")}</div>`;
  if(row.status==="approved")return row.el_medico_informed_at?`<span class="schedule-el-medico-informed">✓ El Médico informed</span>`:`<button type="button" class="schedule-el-medico-button" data-schedule-inform-el-medico data-request-id="${row.id}">Inform El Médico</button>`;
  return"";
}
function adminCard(row){return `<article class="schedule-admin-history-row" data-admin-schedule-row data-status="${esc(row.status)}" data-search="${esc(`${row.requester_name} ${row.substitute_name} ${row.request_type} ${row.cause||""}`.toLowerCase())}"><div class="schedule-admin-primary"><strong>${typeIcon(row.request_type)} ${typeLabel(row.request_type)} · ${dateLabel(row.scheduled_date)}</strong><span>${esc(row.requester_name)} → ${esc(row.substitute_name)}</span><div class="schedule-request-meta"><span class="schedule-chip schedule-cause"><b>Cause:</b> ${esc(row.cause||"—")}</span>${row.substitute_note?`<span class="schedule-chip"><b>Involved resident:</b> ${esc(row.substitute_note)}</span>`:""}${row.admin_note?`<span class="schedule-chip"><b>Senior decision:</b> ${esc(row.admin_note)}</span>`:""}${row.reconsideration_reason?`<span class="schedule-chip reconsider-chip"><b>Reconsideration:</b> ${esc(row.reconsideration_reason)}</span>`:""}</div></div><div class="schedule-admin-state">${adminStatus(row)}${adminActions(row)}</div></article>`}
async function renderAdminSchedule(){
  if(adminRendering||profile?.role!=="owner")return;adminRendering=true;try{
    const content=document.querySelector("#content");if(!content)return;document.querySelector("#title").textContent="Schedule";document.querySelector("#crumb").textContent="ADMIN";
    const rows=unwrap(await sb.rpc("owner_get_schedule_substitutions_v131"))||[];const pending=rows.filter(r=>r.status==="pending_admin"||(r.reconsideration_status==="requested"&&r.reconsideration_target==="admin")).length;
    content.innerHTML=`<div class="admin-schedule-page"><div class="lead"><div><h2>Schedule substitutions</h2><p>Review pending requests, previous decisions and the complete substitution history.</p></div><span class="schedule-status ${pending?"pending":"approved"}">${pending} awaiting senior approval</span></div><section class="card admin-schedule-history"><div class="admin-schedule-tools"><input type="search" data-admin-schedule-search placeholder="Search resident, date or cause"><select data-admin-schedule-filter><option value="all">All statuses</option><option value="pending_admin">Waiting senior approval</option><option value="approved">Approved</option><option value="rejected_substitute">Declined by involved resident</option><option value="rejected_admin">Senior approval declined</option></select></div><div class="schedule-admin-explainer"><b>El Médico synchronization</b><span>After a substitution is fully approved, use <strong>Inform El Médico</strong>. The duty assistant will then use the involved resident as the approved replacement for that date.</span></div><div class="admin-schedule-list">${rows.length?rows.map(adminCard).join(""):'<div class="schedule-empty">No schedule substitution requests yet.</div>'}</div></section></div>`;await refreshBadges();
  }catch(error){alert(error?.message||String(error))}finally{adminRendering=false}
}
function showBox(button,attr){const card=button.closest(".schedule-request-card,.schedule-admin-history-row");card?.querySelector(`[${attr}="${button.dataset.requestId}"]`)?.removeAttribute("hidden")}
function hideClosest(button,selector){button.closest(selector)?.setAttribute("hidden","")}
async function directDecision(kind,id,decision,note=null){
  if(kind==="peer")return unwrap(await sb.rpc("resident_decide_schedule_substitution_v125",{p_request_id:Number(id),p_decision:decision,p_note:note}));
  if(kind==="admin")return unwrap(await sb.rpc("owner_decide_schedule_substitution_v125",{p_request_id:Number(id),p_decision:decision,p_note:note}));
  if(kind==="peer-reconsider")return unwrap(await sb.rpc("resident_decide_schedule_reconsideration_v131",{p_request_id:Number(id),p_decision:decision,p_note:note}));
  if(kind==="admin-reconsider")return unwrap(await sb.rpc("owner_decide_schedule_reconsideration_v131",{p_request_id:Number(id),p_decision:decision,p_note:note}));
}
async function refreshCurrent(){if(location.hash==="#resident-schedule")await renderResidentSchedule();else if(location.hash==="#admin-schedule")await renderAdminSchedule();else await refreshBadges()}
document.addEventListener("click",async(event)=>{
  const residentLink=event.target.closest("[data-resident-schedule-link]");if(residentLink){event.preventDefault();event.stopImmediatePropagation();location.hash="resident-schedule";await renderResidentSchedule();return}
  const adminLink=event.target.closest("[data-admin-schedule-link]");if(adminLink){event.preventDefault();event.stopImmediatePropagation();location.hash="admin-schedule";await renderAdminSchedule();return}
  const showReject=event.target.closest("[data-schedule-show-reject]");if(showReject){event.preventDefault();const card=showReject.closest(".schedule-request-card,.schedule-admin-history-row"),box=card?.querySelector(`[data-inline-decision="${showReject.dataset.scheduleShowReject}:${showReject.dataset.requestId}"]`);box?.removeAttribute("hidden");box?.querySelector("textarea")?.focus();return}
  const hideDecision=event.target.closest("[data-schedule-hide-decision]");if(hideDecision){hideClosest(hideDecision,".schedule-inline-decision");return}
  const approve=event.target.closest("[data-schedule-direct-approve]");if(approve){event.preventDefault();approve.disabled=true;try{await directDecision(approve.dataset.scheduleDirectApprove,approve.dataset.requestId,"approved",null);toast(approve.dataset.scheduleDirectApprove.includes("reconsider")?"Reconsideration approved":"Approved");await refreshCurrent()}catch(e){alert(e?.message||String(e));approve.disabled=false}return}
  const confirmReject=event.target.closest("[data-schedule-confirm-reject]");if(confirmReject){event.preventDefault();const box=confirmReject.closest(".schedule-inline-decision"),note=String(box?.querySelector("textarea")?.value||"").trim();if(note.length<2)return alert("Write the reason before rejecting.");confirmReject.disabled=true;try{await directDecision(confirmReject.dataset.scheduleConfirmReject,confirmReject.dataset.requestId,"rejected",note);toast("Rejection saved");await refreshCurrent()}catch(e){alert(e?.message||String(e));confirmReject.disabled=false}return}
  const showRec=event.target.closest("[data-schedule-show-reconsider]");if(showRec){const box=showRec.closest(".schedule-action-zone")?.querySelector(`[data-inline-reconsider="${showRec.dataset.requestId}"]`);box?.removeAttribute("hidden");box?.querySelector("textarea")?.focus();return}
  const hideRec=event.target.closest("[data-schedule-hide-reconsider]");if(hideRec){hideClosest(hideRec,".schedule-inline-decision");return}
  const sendRec=event.target.closest("[data-schedule-confirm-reconsider]");if(sendRec){const box=sendRec.closest(".schedule-inline-decision"),reason=String(box?.querySelector("textarea")?.value||"").trim();if(reason.length<3)return alert("Write the reason for reconsideration.");sendRec.disabled=true;try{unwrap(await sb.rpc("resident_request_schedule_reconsideration_v131",{p_request_id:Number(sendRec.dataset.requestId),p_reason:reason}));toast("Reconsideration sent");await renderResidentSchedule()}catch(e){alert(e?.message||String(e));sendRec.disabled=false}return}
  const inform=event.target.closest("[data-schedule-inform-el-medico]");if(inform){inform.disabled=true;try{unwrap(await sb.rpc("owner_inform_el_medico_schedule_v131",{p_request_id:Number(inform.dataset.requestId)}));toast("El Médico informed of this approved change");await renderAdminSchedule()}catch(e){alert(e?.message||String(e));inform.disabled=false}return}
},true);
document.addEventListener("submit",async(event)=>{const form=event.target;if(!(form instanceof HTMLFormElement)||form.id!=="scheduleSubstitutionForm")return;event.preventDefault();event.stopImmediatePropagation();const fd=new FormData(form),reason=String(fd.get("note")||"").trim(),btn=form.querySelector("button[type=submit]");if(reason.length<3)return alert("Cause of substitution is required.");if(btn)btn.disabled=true;try{unwrap(await sb.rpc("resident_request_schedule_substitution_v125",{p_request_type:fd.get("request_type"),p_scheduled_date:fd.get("scheduled_date"),p_substitute_id:fd.get("substitute_id"),p_note:reason}));toast("Sent to the involved resident");await renderResidentSchedule()}catch(e){alert(e?.message||String(e));if(btn)btn.disabled=false}},true);
document.addEventListener("input",event=>{const search=event.target.closest("[data-admin-schedule-search]"),filter=event.target.closest("[data-admin-schedule-filter]");if(!search&&!filter)return;const page=event.target.closest(".admin-schedule-page"),q=String(page?.querySelector("[data-admin-schedule-search]")?.value||"").trim().toLowerCase(),status=String(page?.querySelector("[data-admin-schedule-filter]")?.value||"all");page?.querySelectorAll("[data-admin-schedule-row]").forEach(row=>{row.hidden=Boolean((q&&!String(row.dataset.search||"").includes(q))||(status!=="all"&&row.dataset.status!==status))})});
const nav=document.querySelector("#nav");if(nav)new MutationObserver(()=>{installScheduleNav();void refreshBadges()}).observe(nav,{childList:true,subtree:true});
window.addEventListener("hashchange",()=>setTimeout(async()=>{if(location.hash==="#resident-schedule")await renderResidentSchedule();else if(location.hash==="#admin-schedule")await renderAdminSchedule();else await refreshBadges()},70));
sb.auth.onAuthStateChange(()=>{profile=null;setTimeout(async()=>{await getProfile();installScheduleNav();await refreshBadges()},100)});setInterval(()=>void refreshBadges(),8000);
(async()=>{await getProfile();installScheduleNav();await refreshBadges();if(location.hash==="#resident-schedule")await renderResidentSchedule();if(location.hash==="#admin-schedule")await renderAdminSchedule()})();
