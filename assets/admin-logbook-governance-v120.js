import { sb } from "./supabase.js";

const RANKS = [
  ["professor", "Professor"],
  ["associate_professor", "Associate Professor"],
  ["lecturer", "Lecturer"],
  ["assistant_lecturer", "Assistant Lecturer"],
  ["senior_resident", "Senior Resident"],
  ["fellow", "Fellow"],
];
const esc = (v) => String(v ?? "").replace(/[&<>'"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"})[c]);
const unwrap = (r) => { if (r?.error) throw r.error; return r?.data; };
const rankLabel = (v) => RANKS.find(([k]) => k === v)?.[1] || "Rank not set";
let owner = false;
let ranks = [];
let rankMap = new Map();
let busy = false;

async function loadRanks(force=false){
  if (!owner) return [];
  if (!force && ranks.length) return ranks;
  ranks = unwrap(await sb.rpc("owner_get_assessor_academic_ranks_v119")) || [];
  rankMap = new Map(ranks.map(r => [String(r.id), r]));
  return ranks;
}
function options(selected=""){
  return `<option value="">Set rank…</option>${RANKS.map(([v,l])=>`<option value="${v}" ${v===selected?"selected":""}>${l}</option>`).join("")}`;
}
function hideLegacy(){
  document.querySelectorAll('[data-go="owner-logbook-requirement-assessors"],[data-go="owner-prior-experience-assignments"],.audit-hierarchy-nav').forEach(n=>{n.hidden=true;n.setAttribute("aria-hidden","true")});
  const route=location.hash.replace(/^#/,"");
  if (["owner-logbook-requirement-assessors","owner-prior-experience-assignments"].includes(route)) location.hash="owner-logbook-center";
}
function card(title,value,desc,attrs="",cls=""){
  return `<button type="button" class="admin-logbook-tool ${cls}" ${attrs}><span>${esc(title)}</span><strong>${esc(value)}</strong><small>${esc(desc)}</small></button>`;
}
function unifyLogbooks(){
  if (!owner || String(document.querySelector("#title")?.textContent||"").trim()!=="Logbook centre") return;
  const content=document.querySelector("#content"), old=content?.querySelector(".hub-grid");
  if (!old || content.querySelector(".admin-logbook-unified")) return;
  old.outerHTML=`<div class="admin-logbook-unified">
    <div class="admin-logbook-workflow-note"><b>One Logbooks workspace</b><span>Audit hierarchy is now the only manual-audit assignment source. The old per-manual assessor assignment tools are retired.</span></div>
    <section class="admin-logbook-group"><div class="admin-logbook-group-head"><span>01</span><div><h3>Resident e-logbooks</h3><p>Daily activity, approvals and follow-up.</p></div></div><div class="admin-logbook-tools-grid">
      ${card("Resident logbooks","Open","Review, export or reset resident logbooks",'data-go="logbook"')}
      ${card("Logbook requests","Review","Senior, first-level faculty and professor audit requests",'data-go="logbook-requests"')}
      ${card("Pending requests","48h","Unanswered approvals and overdue follow-up",'data-go="owner-pending-requests"',"warning")}
      ${card("Intervention audit","Fairness","Compare exposure, trials and outcomes by year",'data-go="owner-intervention-audit"')}
    </div></section>
    <section class="admin-logbook-group governance"><div class="admin-logbook-group-head"><span>02</span><div><h3>Standards & audit governance</h3><p>Targets, hierarchy and assessor academic grades.</p></div></div><div class="admin-logbook-tools-grid">
      ${card("Minimum requirements","Targets","Edit Attended / Assisted / Unassisted / Supervise targets",'data-go="owner-logbook-requirements"',"accent")}
      ${card("Audit hierarchy","4 fields","Intervention · EP · Imaging · Basic interventions","","hierarchy audit-hierarchy-tile")}
      ${card("Assessor academic ranks","6 grades","Professor · Associate Professor · Lecturer · Assistant Lecturer · Senior Resident · Fellow",'data-open-assessor-ranks',"rank")}
    </div></section>
    <section class="admin-logbook-group"><div class="admin-logbook-group-head"><span>03</span><div><h3>Prior Experience</h3><p>Retrospective evidence uses two senior verifiers, then the same audit hierarchy.</p></div></div><div class="admin-logbook-tools-grid">
      ${card("Prior Experience status","Audit","Track draft, senior review, faculty audit, professor audit and final verification",'data-go="owner-prior-experience-status"')}
    </div></section>
    <section class="admin-logbook-group compact"><div class="admin-logbook-group-head"><span>04</span><div><h3>Maintenance</h3><p>Administrative housekeeping only.</p></div></div><div class="admin-logbook-tools-grid">
      ${card("Message cleanup","Clean","Clear message copies without changing resident evidence",'data-go="message-cleanup"')}
    </div></section>
  </div>`;
  const p=content.querySelector(".lead p"); if(p) p.textContent="All resident logbook activity, standards, Prior Experience and audit governance in one Admin workspace.";
}
function accountsStrip(){
  if (!owner || String(document.querySelector("#title")?.textContent||"").trim()!=="Accounts & roles") return;
  const content=document.querySelector("#content"); if(!content || content.querySelector(".assessor-rank-account-strip")) return;
  const strip=document.createElement("section"); strip.className="assessor-rank-account-strip";
  strip.innerHTML=`<div><b>Assessor academic rank</b><span>Classify every Assessor as Professor, Associate Professor, Lecturer, Assistant Lecturer, Senior Resident or Fellow.</span></div><button type="button" data-open-assessor-ranks>Manage ranks</button>`;
  const lead=content.querySelector(".lead"); if(lead?.nextSibling) content.insertBefore(strip,lead.nextSibling); else content.prepend(strip);
}
async function openRanks(){
  await loadRanks(true); document.querySelector("#assessorRankOverlay")?.remove();
  const el=document.createElement("div"); el.id="assessorRankOverlay"; el.className="assessor-rank-overlay";
  el.innerHTML=`<section class="assessor-rank-panel"><div class="assessor-rank-head"><div><small>ADMIN · FACULTY CLASSIFICATION</small><h2>Assessor academic ranks</h2><p>Portal role remains Assessor; academic rank describes seniority and hierarchy eligibility.</p></div><button type="button" data-close-assessor-ranks>×</button></div><div class="assessor-rank-filter"><input type="search" placeholder="Search assessor…" data-rank-search><span>${ranks.length} assessors</span></div><div class="assessor-rank-list">${ranks.map(r=>`<label class="assessor-rank-row" data-rank-text="${esc(`${r.display_name||""} ${r.username||""} ${r.email||""}`.toLowerCase())}"><span class="assessor-rank-avatar">${esc((r.display_name||r.username||"?").trim().charAt(0).toUpperCase())}</span><span class="assessor-rank-person"><b>${esc(r.display_name||r.username||"Assessor")}</b><small>@${esc(r.username||"")}</small></span><select data-rank-assessor="${esc(r.id)}">${options(r.academic_rank||"")}</select></label>`).join("")}</div><div class="assessor-rank-foot"><p><b>Hierarchy:</b> Professor / Associate Professor = higher final level. Lecturer / Assistant Lecturer = first audit level. Senior Resident / Fellow are valid assessor classifications but are not faculty hierarchy positions.</p><button type="button" data-close-assessor-ranks>Done</button></div></section>`;
  document.body.appendChild(el);
}
async function saveRank(select){
  const value=String(select.value||""); if(!value) return;
  const id=String(select.dataset.rankAssessor||""); select.disabled=true;
  try{const updated=unwrap(await sb.rpc("owner_set_assessor_academic_rank_v119",{p_assessor_id:id,p_academic_rank:value})); const old=rankMap.get(id)||{}; const row={...old,...updated,academic_rank:value}; rankMap.set(id,row); ranks=ranks.map(x=>String(x.id)===id?row:x); paintHierarchyRanks();}
  catch(e){alert(e?.message||"Could not save academic rank.");}
  finally{select.disabled=false;}
}
function paintHierarchyRanks(){
  document.querySelectorAll("#auditHierarchyOverlay .audit-person-card[data-audit-person]").forEach(card=>{
    const id=String(card.dataset.auditPerson||""), row=rankMap.get(id), rank=row?.academic_rank||"";
    let chip=card.querySelector(".audit-rank-chip"); if(!chip){chip=document.createElement("span");chip.className="audit-rank-chip";card.querySelector(".audit-person-copy")?.appendChild(chip);} chip.textContent=rankLabel(rank);chip.dataset.rank=rank||"unset";
    if(card.closest(".audit-assessor-list")&&!card.querySelector(".audit-inline-rank-select")){const s=document.createElement("select");s.className="audit-inline-rank-select";s.dataset.rankAssessor=id;s.innerHTML=options(rank);s.addEventListener("pointerdown",e=>e.stopPropagation());s.addEventListener("click",e=>e.stopPropagation());card.appendChild(s);}
  });
  document.querySelectorAll("#auditHierarchyOverlay .audit-slot[data-audit-slot]").forEach(slot=>{
    slot.classList.remove("rank-invalid"); const c=slot.querySelector(".audit-person-card[data-audit-person]"); if(!c)return; const rank=rankMap.get(String(c.dataset.auditPerson||""))?.academic_rank||""; if(!rank)return;
    const valid=slot.dataset.tier==="lead_professor"?["professor","associate_professor"].includes(rank):["lecturer","assistant_lecturer"].includes(rank); if(!valid)slot.classList.add("rank-invalid");
  });
}
async function enhanceHierarchy(){
  const overlay=document.querySelector("#auditHierarchyOverlay"); if(!owner||!overlay)return; await loadRanks();
  const p=overlay.querySelector(".audit-hierarchy-head-copy p"); if(p)p.textContent="Drag assessors into the field hierarchy. This is now the single assignment system for manual and logbook audit.";
  overlay.querySelectorAll(".audit-tier-heading").forEach(h=>{const b=h.querySelector("b"),n=h.querySelector("span"); if(/professor/i.test(b?.textContent||"")){b.textContent="Higher final level · Professors / Associate Professors";if(n)n.textContent="Maximum 2 · one final approval";}else if(b){b.textContent="First audit level · Lecturers / Assistant Lecturers";if(n)n.textContent="2–8 assigned · two approvals per manual";}});
  const foot=overlay.querySelector(".audit-hierarchy-foot p"); if(foot)foot.innerHTML="<b>Single source of truth:</b> this hierarchy supplies auditors for Prior Experience and minimum-requirement E-logbook review. Old per-manual assignment is retired.";
  paintHierarchyRanks();
}
async function enhance(){if(!owner||busy)return;busy=true;try{hideLegacy();unifyLogbooks();accountsStrip();await enhanceHierarchy();}finally{busy=false;}}

document.addEventListener("click",async e=>{if(e.target.closest("[data-open-assessor-ranks]")){e.preventDefault();try{await openRanks();}catch(err){alert(err?.message||"Could not open assessor ranks.");}} if(e.target.closest("[data-close-assessor-ranks]")){e.preventDefault();document.querySelector("#assessorRankOverlay")?.remove();}});
document.addEventListener("change",e=>{const s=e.target.closest("[data-rank-assessor]");if(s)void saveRank(s);});
document.addEventListener("input",e=>{const input=e.target.closest("[data-rank-search]");if(!input)return;const q=String(input.value||"").toLowerCase().trim();document.querySelectorAll(".assessor-rank-row").forEach(r=>r.hidden=Boolean(q&&!(r.dataset.rankText||"").includes(q)));});
window.addEventListener("hashchange",()=>void enhance());

try{const {data:a}=await sb.auth.getSession();const uid=a?.session?.user?.id;if(uid){const {data:p}=await sb.from("profiles").select("role").eq("id",uid).single();owner=p?.role==="owner";}}catch(_){owner=false;}
if(owner){new MutationObserver(()=>void enhance()).observe(document.documentElement,{childList:true,subtree:true});setInterval(()=>void enhance(),700);void enhance();}
