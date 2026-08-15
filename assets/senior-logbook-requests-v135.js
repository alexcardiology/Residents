import { sb } from "./supabase.js";

const esc=(value)=>String(value??"").replace(/[&<>'"]/g,(c)=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"})[c]);
let loading=false,lastSignature="";

function toast(text){
  const node=document.querySelector("#toast");
  if(!node)return;
  node.textContent=text;node.style.display="block";
  setTimeout(()=>{node.style.display="none"},2600);
}
function fmtDate(value){
  if(!value)return "—";
  const d=new Date(`${value}T00:00:00`);
  if(Number.isNaN(d.getTime()))return String(value);
  return d.toLocaleDateString("en-GB",{day:"2-digit",month:"2-digit",year:"numeric"});
}
function requestCard(row){
  return `<article class="senior-request-card" data-senior-entry="${esc(row.id)}">
    <div class="senior-request-main">
      <div class="senior-request-title"><span class="senior-request-icon">✓</span><div><small>Senior verification</small><h3>${esc(row.procedure_name)}</h3></div></div>
      <div class="senior-request-resident"><b>${esc(row.resident_name)}</b><span>Year ${esc(row.residency_year)}</span></div>
    </div>
    <div class="senior-request-meta">
      <span><small>Participation</small><b>${esc(row.participation_mode)}</b></span>
      <span><small>Cases</small><b>${esc(row.case_count)}</b></span>
      <span><small>Date</small><b>${esc(fmtDate(row.activity_date))}</b></span>
      <span><small>Hospital</small><b>${esc(row.hospital||"—")}</b></span>
      <span><small>Next assessor</small><b>${esc(row.assessor_name||"—")}</b></span>
    </div>
    <label class="senior-request-note"><span>Comment</span><textarea rows="2" placeholder="Optional for approval; required for rejection"></textarea></label>
    <div class="senior-request-actions">
      <button type="button" class="btn secondary" data-senior-decision="rejected">Reject</button>
      <button type="button" class="btn primary" data-senior-decision="approved">Approve</button>
    </div>
  </article>`;
}
async function loadRequests(force=false){
  if(loading)return;
  const title=String(document.querySelector("#title")?.textContent||"").trim().toLowerCase();
  if(title!=="logbook requests"){
    document.querySelector("#seniorAssignedRequestsV135")?.remove();
    document.querySelector("#seniorRequestJumpV135")?.remove();
    lastSignature="";
    return;
  }
  loading=true;
  try{
    const {data,error}=await sb.rpc("get_my_senior_logbook_requests_v135");
    if(error)throw error;
    const rows=Array.isArray(data)?data:[];
    const signature=rows.map(row=>`${row.id}:${row.senior_status}:${row.case_count}:${row.created_at}`).join("|");
    if(!force&&signature===lastSignature&&document.querySelector("#seniorAssignedRequestsV135"))return;
    lastSignature=signature;
    document.querySelector("#seniorAssignedRequestsV135")?.remove();
    document.querySelector("#seniorRequestJumpV135")?.remove();
    if(!rows.length)return;
    const content=document.querySelector("#content");
    if(!content)return;
    const panel=document.createElement("section");
    panel.id="seniorAssignedRequestsV135";
    panel.className="senior-assigned-panel";
    panel.innerHTML=`<div class="senior-assigned-head"><div><small>Action required</small><h2>Senior verification requests</h2><p>These requests appear whenever you are selected as the senior verifier, regardless of residency year.</p></div><span>${rows.length}</span></div><div class="senior-request-grid">${rows.map(requestCard).join("")}</div>`;
    const lead=content.querySelector(":scope > .lead");
    const firstCard=lead?.nextElementSibling;
    if(firstCard)content.insertBefore(panel,firstCard);else content.appendChild(panel);

    const jump=document.createElement("button");
    jump.id="seniorRequestJumpV135";
    jump.type="button";
    jump.className="senior-request-jump";
    jump.textContent=`Requests ${rows.length}`;
    jump.addEventListener("click",()=>panel.scrollIntoView({behavior:"smooth",block:"start"}));
    const leadActions=lead?.querySelector(".actions");
    if(leadActions)leadActions.prepend(jump);else lead?.appendChild(jump);
  }catch(error){console.warn("Senior requests",error)}finally{loading=false}
}

document.addEventListener("click",async(event)=>{
  const button=event.target.closest("[data-senior-decision]");
  if(!button)return;
  const card=button.closest("[data-senior-entry]");
  if(!card)return;
  const decision=button.dataset.seniorDecision;
  const note=String(card.querySelector("textarea")?.value||"").trim();
  if(decision==="rejected"&&!note){alert("Please write a reason before rejecting this logbook request.");return}
  card.querySelectorAll("button").forEach(btn=>btn.disabled=true);
  try{
    const {error}=await sb.rpc("review_logbook_entry_v1051",{p_entry_id:card.dataset.seniorEntry,p_decision:decision,p_note:note||null});
    if(error)throw error;
    toast(decision==="approved"?"Senior verification approved":"Logbook request rejected");
    lastSignature="";
    await loadRequests(true);
    setTimeout(()=>location.reload(),300);
  }catch(error){
    alert(error?.message||String(error));
    card.querySelectorAll("button").forEach(btn=>btn.disabled=false);
  }
},true);

let scheduleTimer=0;
const schedule=()=>{clearTimeout(scheduleTimer);scheduleTimer=setTimeout(()=>loadRequests(false),180)};
new MutationObserver(schedule).observe(document.querySelector("#content")||document.body,{childList:true,subtree:true});
window.addEventListener("hashchange",schedule);
setInterval(()=>loadRequests(false),7000);
loadRequests(true);
