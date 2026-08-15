import { sb } from "./supabase.js";

const submissionCache = new Map();
let selectedReviewKey = "";
let enhancing = false;

const esc = (value) => String(value ?? "").replace(/[&<>'"]/g, (char) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;",
})[char]);
const unwrap = (result) => { if (result?.error) throw result.error; return result?.data; };
const fmtDate = (value) => {
  if (!value) return "—";
  const d = new Date(value);
  return `${String(d.getDate()).padStart(2,"0")}-${String(d.getMonth()+1).padStart(2,"0")}-${d.getFullYear()}`;
};
function modal(html){const body=document.querySelector("#modalBody"),dialog=document.querySelector("#modal");if(!body||!dialog)return;body.innerHTML=html;dialog.showModal();}

async function loadSubmission(logbookId, fresh = false) {
  const key = String(logbookId || "");
  if (!key) return null;
  const cached = submissionCache.get(key);
  if (!fresh && cached && Date.now() - cached.ts < 4500) return cached.promise;
  const promise = (async () => {
    try { return unwrap(await sb.rpc("get_prior_experience_submission_v1069", { p_logbook_id: Number(logbookId) })); }
    catch (error) { console.warn("Could not load Prior Experience summary", error); return null; }
  })();
  submissionCache.set(key,{ts:Date.now(),promise});
  return promise;
}
function seniorReviews(data) { return Array.isArray(data?.senior_reviews) ? data.senior_reviews : []; }
function approvedSeniorNames(data) {
  return seniorReviews(data).filter((row) => String(row.status) === "approved").map((row) => String(row.senior_name || "Senior resident").trim()).filter(Boolean);
}
function seniorStatusHtml(data) {
  const reviews = seniorReviews(data);
  if (!reviews.length) return '<span class="prior-request-senior-empty">Senior verifiers not available</span>';
  return `<div class="prior-request-senior-chips">${reviews.map((review) => {
    const status = String(review.status || "pending");
    const cls = status === "approved" ? "approved" : status === "rejected" ? "rejected" : "pending";
    const icon = status === "approved" ? "✓" : status === "rejected" ? "×" : "…";
    return `<span class="prior-request-senior-chip ${cls}"><b>${icon}</b>${esc(review.senior_name || "Senior resident")}</span>`;
  }).join("")}</div>`;
}
function auditProgressHtml(data) {
  const scopes = Array.isArray(data?.scope_verifications) ? data.scope_verifications : [];
  const faculty = scopes.filter((row)=>row.assessor_level === "faculty" && row.status !== "not_required");
  const professors = scopes.filter((row)=>row.assessor_level === "professor" && row.status !== "not_required");
  const facApproved = faculty.filter((row)=>row.status === "approved").length;
  const profApproved = professors.filter((row)=>row.status === "approved").length;
  const overall = String(data?.header?.status || "");
  const overallLabel = overall === "approved" ? "Fully approved" : overall === "rejected" ? "Rejected / returned" : overall === "assessor_review" ? "Assessor audit in progress" : overall === "senior_review" ? "Senior verification" : overall || "In progress";
  const overallCls = overall === "approved" ? "approved" : overall === "rejected" ? "rejected" : "pending";
  return `<div class="prior-downstream-progress"><span class="prior-request-senior-chip ${faculty.length && facApproved===faculty.length ? "approved" : "pending"}"><b>${faculty.length && facApproved===faculty.length ? "✓" : "…"}</b>Faculty ${facApproved}/${faculty.length}</span><span class="prior-request-senior-chip ${professors.length && profApproved===professors.length ? "approved" : "pending"}"><b>${professors.length && profApproved===professors.length ? "✓" : "…"}</b>Professor ${profApproved}/${professors.length}</span><span class="prior-request-senior-chip ${overallCls}"><b>${overall === "approved" ? "✓" : overall === "rejected" ? "×" : "…"}</b>${esc(overallLabel)}</span></div>`;
}
function stageLabel(row) {
  if (row?.review_kind === "senior") return { kicker: "Stage 1", title: "Senior verification", detail: "Whole Prior Experience logbook" };
  if (row?.assessor_level === "professor") return { kicker: "Stage 3", title: "Professor field audit", detail: row.scope_name || "Field audit" };
  return { kicker: "Stage 2", title: "First-level manual audit", detail: row?.scope_name || "Manual audit" };
}
function statusCellHtml(row,data){
  if(row.review_kind!=="senior") return row.reconsideration_status === "requested" ? `<span class="tag warning">Reconsideration requested</span><small>${esc(row.reconsideration_reason || "")}</small>` : '<span class="tag warning">Pending verification</span>';
  if(row.reconsideration_status === "requested") return `<span class="tag warning">Reconsideration requested</span><small>${esc(row.reconsideration_reason || "")}</small>`;
  const status=String(row.review_status||"pending");
  const own = status === "approved" ? '<span class="tag success">Your decision · Approved</span>' : status === "rejected" ? '<span class="tag danger">Your decision · Rejected</span>' : '<span class="tag warning">Your decision pending</span>';
  return `${own}${status!=="pending"?auditProgressHtml(data):""}`;
}
async function enhanceQueueRow(tr, row) {
  if (!tr || !row) return;
  const cells = tr.cells;
  if (!cells || cells.length < 4) return;
  const stage = stageLabel(row);
  cells[1].innerHTML = `<div class="prior-request-stage"><span>${esc(stage.kicker)}</span><b>${esc(stage.title)}</b><small>${esc(stage.detail)}</small></div>`;
  const data = await loadSubmission(row.logbook_id, row.review_kind === "senior" && row.review_status !== "pending");
  if (!data) return;
  let seniorBlock = cells[1].querySelector(".prior-request-senior-summary");
  if(!seniorBlock){ seniorBlock=document.createElement("div"); seniorBlock.className="prior-request-senior-summary"; cells[1].appendChild(seniorBlock); }
  if (row.review_kind === "senior") seniorBlock.innerHTML = `<span>Two senior verifiers</span>${seniorStatusHtml(data)}`;
  else {
    const approved = approvedSeniorNames(data);
    seniorBlock.innerHTML = `<span>Senior-verified by</span>${approved.length ? `<div class="prior-request-senior-chips">${approved.map((name) => `<span class="prior-request-senior-chip approved"><b>✓</b>${esc(name)}</span>`).join("")}</div>` : seniorStatusHtml(data)}`;
  }
  cells[2].innerHTML=statusCellHtml(row,data);
  const button=cells[3].querySelector("[data-prior-review-open]");
  if(button && row.review_kind==="senior" && row.review_status!=="pending" && row.reconsideration_status!=="requested"){
    button.textContent="View history";
    button.classList.add("secondary");
    button.dataset.priorSeniorHistory="1";
  }
}
async function enhanceLogbookRequests() {
  if (enhancing) return;
  const title = String(document.querySelector("#title")?.textContent || "").trim().toLowerCase();
  if (title !== "logbook requests") return;
  const section = document.querySelector(".prior-review-queue");
  if (!section) return;
  enhancing = true;
  try {
    const heading = section.querySelector(".section-head h3");
    const copy = section.querySelector(".section-head p");
    if (heading) heading.textContent = "Prior Experience audit requests";
    if (copy) copy.textContent = "Senior history stays visible after your decision. Faculty and professor progress updates here as the resident moves through the audit.";
    section.classList.add("prior-review-logbook-only");
    const buttons = [...section.querySelectorAll("[data-prior-review-open]")];
    await Promise.all(buttons.map(async (button) => {
      const key = String(button.dataset.priorReviewOpen || "");
      const row = window.priorExperienceReviewRows?.get(key);
      if (row) await enhanceQueueRow(button.closest("tr"), row);
    }));
  } finally { enhancing = false; }
}
async function enhanceReviewerModal() {
  const reviewModal = document.querySelector("#modalBody .prior-review-modal");
  if (!reviewModal || reviewModal.dataset.priorSeniorSummary === "1") return;
  const row = window.priorExperienceReviewRows?.get(String(selectedReviewKey || ""));
  if (!row) return;
  reviewModal.dataset.priorSeniorSummary = "1";
  const data = await loadSubmission(row.logbook_id,true);
  if (!data) return;
  const block = document.createElement("section");
  block.className = "prior-review-senior-verification-strip";
  const approved = approvedSeniorNames(data);
  if (row.review_kind === "senior") block.innerHTML = `<div><span>Stage 1 · Senior verification</span><b>Two senior residents must verify this record</b></div>${seniorStatusHtml(data)}`;
  else block.innerHTML = `<div><span>Senior verification completed</span><b>Verified before this ${row.assessor_level === "professor" ? "professor audit" : "faculty audit"}</b></div>${approved.length ? `<div class="prior-request-senior-chips">${approved.map((name) => `<span class="prior-request-senior-chip approved"><b>✓</b>${esc(name)}</span>`).join("")}</div>` : seniorStatusHtml(data)}`;
  reviewModal.querySelector(".modal-head")?.after(block);
}
function historyInterventions(data){
  const rows=Array.isArray(data?.interventions)?data.interventions:[];
  if(!rows.length)return '<div class="prior-system-report-empty">No historical intervention counts were entered.</div>';
  return `<div class="table-scroll"><table class="table prior-history-table"><thead><tr><th>Manual</th><th>Attended</th><th>Performed assisted</th><th>Performed unassisted</th><th>Supervised</th></tr></thead><tbody>${rows.map((row)=>`<tr><td><b>${esc(row.intervention_name)}</b></td><td>${Number(row.attended_count)||0}</td><td>${(Number(row.assisted_count)||0)+(Number(row.solo_guided_count)||0)}</td><td>${Number(row.solo_unguided_count)||0}</td><td>${Number(row.supervised_count)||0}</td></tr>`).join("")}</tbody></table></div>`;
}
function decisionHistory(data,level,title){
  const rows=(data?.scope_verifications||[]).filter((row)=>row.assessor_level===level && ["approved","rejected","pending"].includes(String(row.status)));
  if(!rows.length)return `<section class="prior-history-stage"><h3>${esc(title)}</h3><p>Not started yet.</p></section>`;
  return `<section class="prior-history-stage"><h3>${esc(title)}</h3><div class="prior-history-decisions">${rows.map((row)=>`<article><div><b>${esc(row.scope_name)}</b><span class="tag ${row.status==='approved'?'success':row.status==='rejected'?'danger':'warning'}">${esc(row.status)}</span></div><small>${esc(row.assessor_name||"Assigned assessor")}${row.decided_at?` · ${fmtDate(row.decided_at)}`:""}</small>${row.note?`<p>${esc(row.note)}</p>`:""}</article>`).join("")}</div></section>`;
}
async function openSeniorHistory(row){
  const data=await loadSubmission(row.logbook_id,true); if(!data)return;
  modal(`<div class="modal prior-senior-history-modal"><div class="modal-head"><div><span class="eyebrow">Prior Experience history</span><h2>${esc(row.resident_name)}</h2><p>Year ${esc(row.residency_year)} · Your senior-verifier decision remains attached to the full audit trail.</p></div><button type="button" data-close>×</button></div><section class="prior-history-stage"><h3>Senior verification</h3>${seniorStatusHtml(data)}${auditProgressHtml(data)}</section><section class="prior-history-stage"><h3>Historical interventions</h3>${historyInterventions(data)}</section>${decisionHistory(data,"faculty","First-level faculty decisions")}${decisionHistory(data,"professor","Professor field decisions")}<div class="actions"><button type="button" class="btn secondary" data-close>Close</button></div></div>`);
}
function removeAnyStalePriorRequestsFromInbox() {
  const title = String(document.querySelector("#title")?.textContent || "").trim().toLowerCase();
  if (title !== "inbox") return;
  const requestSubjects = ["prior experience senior verification","prior experience · first-level manual audit","prior experience · professor field audit"];
  document.querySelectorAll(".mail-thread,.message-row,.mail-row,.inbox-row,article,tr").forEach((node) => {
    const text = String(node.textContent || "").toLowerCase();
    if (requestSubjects.some((subject) => text.includes(subject))) node.remove();
  });
}
function enhance() { void enhanceLogbookRequests(); void enhanceReviewerModal(); removeAnyStalePriorRequestsFromInbox(); }

document.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-prior-review-open]");
  if (!button) return;
  const key=String(button.dataset.priorReviewOpen||"");
  const row=window.priorExperienceReviewRows?.get(key);
  if(button.dataset.priorSeniorHistory==="1" && row){event.preventDefault();event.stopImmediatePropagation();await openSeniorHistory(row);return;}
  selectedReviewKey = key;
  setTimeout(() => void enhanceReviewerModal(), 80);
}, true);
new MutationObserver(enhance).observe(document.documentElement, { childList: true, subtree: true });
window.addEventListener("hashchange", () => setTimeout(enhance, 50));
setInterval(enhance, 4200);
enhance();
