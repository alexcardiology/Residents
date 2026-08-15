import { sb } from "./supabase.js";

let selectedReviewRow = null;
let pageEnhancing = false;
const submissionCache = new Map();
const reportCache = new Map();

const esc = (value) => String(value ?? "").replace(/[&<>'"]/g, (char) => ({
  "&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;",
})[char]);
const unwrap = (result) => { if (result?.error) throw result.error; return result?.data; };
const fmtDate = (value) => {
  if (!value) return "—";
  const d = new Date(value);
  return `${String(d.getDate()).padStart(2,"0")}-${String(d.getMonth()+1).padStart(2,"0")}-${d.getFullYear()}`;
};
function toast(text) {
  const node = document.querySelector("#toast");
  if (!node) return;
  node.textContent = text; node.style.display = "block";
  setTimeout(() => { node.style.display = "none"; }, 3200);
}
async function submission(logbookId = null, fresh = false) {
  const key = String(logbookId ?? "self");
  if (fresh) submissionCache.delete(key);
  if (!submissionCache.has(key)) submissionCache.set(key, (async () => {
    try { return unwrap(await sb.rpc("get_prior_experience_submission_v1069", { p_logbook_id: logbookId == null ? null : Number(logbookId) })); }
    catch (error) { console.warn(error); return null; }
  })());
  return submissionCache.get(key);
}
async function targetReport(logbookId = null, fresh = false) {
  const key = String(logbookId ?? "self");
  if (fresh) reportCache.delete(key);
  if (!reportCache.has(key)) reportCache.set(key, (async () => {
    try { return unwrap(await sb.rpc("get_prior_experience_target_report_v124", { p_logbook_id: logbookId == null ? null : Number(logbookId) })) || []; }
    catch (error) { console.warn(error); return []; }
  })());
  return reportCache.get(key);
}
function targetCell(row, mode) {
  const target = (row?.targets || []).find((item) => item.participation_mode === mode);
  if (!target) return '<span class="prior-target-na">—</span>';
  const met = Boolean(target.met);
  return `<span class="prior-target-pair ${met ? "met" : "missing"}"><b>${Number(target.achievement)||0}</b><i>/</i><strong>${Number(target.target)||0}</strong><small>${met ? "✓" : `${Number(target.missing)||0} missing`}</small></span>`;
}
function reportRowsHtml(rows) {
  if (!rows.length) return '<div class="prior-system-report-empty">No minimum target is configured for this audit scope.</div>';
  return `<div class="table-scroll prior-target-report-scroll"><table class="table prior-target-report-table"><thead><tr><th>Manual</th><th>Attended<br><small>Achievement / Target</small></th><th>Performed assisted<br><small>Achievement / Target</small></th><th>Performed unassisted<br><small>Achievement / Target</small></th><th>Supervise<br><small>Achievement / Target</small></th><th>System result</th></tr></thead><tbody>${rows.map((row) => `<tr class="${row.overall_met ? "target-met-row" : "target-missing-row"}"><td><b>${esc(row.intervention_name)}</b>${row.evidence_submitted ? "" : '<small class="prior-not-recorded">No historical count entered</small>'}</td><td>${targetCell(row,"attended")}</td><td>${targetCell(row,"assisted")}</td><td>${targetCell(row,"solo_unguided")}</td><td>${targetCell(row,"supervised")}</td><td><span class="tag ${row.overall_met ? "success" : "warning"}">${row.overall_met ? "Target achieved" : "Below target"}</span></td></tr>`).join("")}</tbody></table></div>`;
}
function facultyOpinionsHtml(data, fieldKey) {
  const rows = (data?.scope_verifications || []).filter((row) => row.assessor_level === "faculty" && row.field_key === fieldKey && ["approved","rejected"].includes(String(row.status)));
  if (!rows.length) return '<div class="prior-system-report-empty">No first-level faculty opinions are recorded yet.</div>';
  return `<div class="prior-faculty-opinions">${rows.map((row) => `<article><div><b>${esc(row.scope_name)}</b><span class="tag ${row.status === "approved" ? "success" : "danger"}">${esc(row.status)}</span></div><strong>${esc(row.assessor_name || "Faculty auditor")}</strong><p>${esc(row.note || "Target achieved — no exception opinion was required at the time of this decision.")}</p></article>`).join("")}</div>`;
}
async function enhanceReviewerModal() {
  const modal = document.querySelector("#modalBody .prior-review-modal");
  if (!modal || modal.dataset.targetEvidenceV124 === "1" || !selectedReviewRow || selectedReviewRow.review_kind === "senior") return;
  modal.dataset.targetEvidenceV124 = "1";
  const [data, report] = await Promise.all([submission(selectedReviewRow.logbook_id), targetReport(selectedReviewRow.logbook_id)]);
  if (!data) return;

  let rows = [];
  if (selectedReviewRow.assessor_level === "professor") {
    rows = report.filter((row) => String(row.field_label || "").toLowerCase() === String(selectedReviewRow.scope_name || "").toLowerCase());
    if (!rows.length) {
      const field = (data?.audit_progress?.fields || []).find((item) => String(item.field_label || "").toLowerCase() === String(selectedReviewRow.scope_name || "").toLowerCase());
      if (field) rows = report.filter((row) => row.field_key === field.field_key);
    }
  } else {
    rows = report.filter((row) => row.intervention_name === selectedReviewRow.scope_name);
  }
  const hasMissing = rows.some((row) => !row.overall_met);
  const fieldKey = rows[0]?.field_key || (data?.audit_progress?.fields || []).find((item) => item.field_label === selectedReviewRow.scope_name)?.field_key || "";

  const block = document.createElement("section");
  block.className = `prior-system-target-report ${hasMissing ? "has-missing" : "all-met"}`;
  block.innerHTML = `<div class="prior-system-report-head"><div><span>SYSTEM TARGET CHECK</span><h3>${selectedReviewRow.assessor_level === "professor" ? `${esc(selectedReviewRow.scope_name)} field` : esc(selectedReviewRow.scope_name)}</h3><p>Historical Prior Experience is compared with the resident's current year-specific minimum targets. Performed assisted includes both “with assistance” and “solo under guidance”.</p></div><span class="tag ${hasMissing ? "warning" : "success"}">${hasMissing ? "Exception opinion required to approve" : "Target achieved"}</span></div>${reportRowsHtml(rows)}${selectedReviewRow.assessor_level === "professor" ? `<div class="prior-first-level-opinion-block"><div class="prior-system-report-subhead"><span>FIRST-LEVEL OPINIONS</span><b>Faculty comments carried forward to professor audit</b></div>${facultyOpinionsHtml(data,fieldKey)}</div>` : ""}`;
  const seniorStrip = modal.querySelector(".prior-review-senior-verification-strip");
  (seniorStrip || modal.querySelector(".modal-head"))?.after(block);

  const textarea = modal.querySelector('textarea[name="note"]');
  if (textarea) {
    const label = textarea.closest("label");
    label?.classList.add("prior-audit-opinion-label");
    const oldHint = label?.querySelector(".prior-opinion-rule");
    oldHint?.remove();
    const hint = document.createElement("span");
    hint.className = `prior-opinion-rule ${hasMissing ? "required" : "optional"}`;
    hint.textContent = hasMissing
      ? selectedReviewRow.assessor_level === "professor"
        ? "Required for approval: write your own professor-level opinion explaining why this below-target field can still be accepted."
        : "Required for approval: write your clinical opinion explaining why this below-target manual can still be accepted."
      : "Target achieved. Comment is optional for approval, but still required for rejection.";
    textarea.before(hint);
    textarea.placeholder = hasMissing ? "Required exception opinion / clinical justification" : "Optional for approval; required for rejection";
    if (hasMissing) textarea.required = true;
  }
}
function insertSuperviseColumn(form, data) {
  const table = form.querySelector("table.prior-count-table");
  if (!table || table.dataset.superviseV124 === "1") return;
  table.dataset.superviseV124 = "1";
  const headRow = table.querySelector("thead tr");
  const noteHead = headRow?.lastElementChild;
  if (noteHead) {
    const th = document.createElement("th"); th.textContent = "Supervise"; headRow.insertBefore(th,noteHead);
  }
  const map = new Map((data?.interventions || []).map((row) => [String(row.intervention_name),Number(row.supervised_count)||0]));
  table.querySelectorAll("tbody tr[data-prior-intervention]").forEach((row) => {
    const notes = row.lastElementChild;
    const td = document.createElement("td");
    td.innerHTML = `<input class="prior-count-input" type="number" min="0" max="9999" value="${map.get(String(row.dataset.priorIntervention)) || 0}" data-prior-count="supervised_count" aria-label="Supervise count">`;
    row.insertBefore(td,notes);
  });
}
function insertReadonlySupervise(data) {
  const table = document.querySelector(".prior-readonly-summary table.prior-count-table");
  if (!table || table.dataset.superviseV124 === "1") return;
  table.dataset.superviseV124 = "1";
  const head = table.querySelector("thead tr");
  const notesHead = head?.lastElementChild;
  if (notesHead) { const th=document.createElement("th"); th.textContent="Supervise"; head.insertBefore(th,notesHead); }
  const map = new Map((data?.interventions || []).map((row) => [String(row.intervention_name).trim(),Number(row.supervised_count)||0]));
  table.querySelectorAll("tbody tr").forEach((row) => {
    const name = String(row.cells?.[0]?.textContent || "").trim();
    const notes = row.lastElementChild;
    if (!notes) return;
    const td=document.createElement("td"); td.textContent=String(map.get(name)||0); row.insertBefore(td,notes);
  });
}
async function savePriorFormWithSupervise(event) {
  const form = event.target;
  if (!(form instanceof HTMLFormElement) || form.id !== "priorExperienceDraftForm" || !form.querySelector('[data-prior-count="supervised_count"]')) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  const submitter = event.submitter;
  const mode = submitter?.dataset.priorSubmitMode || "draft";
  const fd = new FormData(form);
  const interventions = [...form.querySelectorAll("[data-prior-intervention]")].map((row) => ({
    intervention_name: row.dataset.priorIntervention,
    attended_count: Number(row.querySelector('[data-prior-count="attended_count"]')?.value || 0),
    assisted_count: Number(row.querySelector('[data-prior-count="assisted_count"]')?.value || 0),
    solo_guided_count: Number(row.querySelector('[data-prior-count="solo_guided_count"]')?.value || 0),
    solo_unguided_count: Number(row.querySelector('[data-prior-count="solo_unguided_count"]')?.value || 0),
    supervised_count: Number(row.querySelector('[data-prior-count="supervised_count"]')?.value || 0),
    notes: String(row.querySelector("[data-prior-intervention-notes]")?.value || "").trim() || null,
  }));
  const conferences = [...form.querySelectorAll("[data-prior-conference-row]")].map((row) => ({
    conference_name: String(row.querySelector("[data-prior-conference-name]")?.value || "").trim(),
    participation: row.querySelector("[data-prior-conference-role]")?.value || "attended",
    conference_date: row.querySelector("[data-prior-conference-date]")?.value || null,
    notes: String(row.querySelector("[data-prior-conference-notes]")?.value || "").trim() || null,
  })).filter((row) => row.conference_name);
  if (submitter) submitter.disabled = true;
  try {
    unwrap(await sb.rpc("save_prior_experience_draft_v1068", {
      p_senior_1_id: fd.get("senior_1_id") || null,
      p_senior_2_id: fd.get("senior_2_id") || null,
      p_interventions: interventions,
      p_conferences: conferences,
      p_notes: fd.get("resident_notes") || null,
    }));
    if (mode === "final") {
      unwrap(await sb.rpc("submit_prior_experience_v1068"));
      toast("Prior Experience submitted · senior verification started");
    } else toast("Prior Experience draft saved");
    submissionCache.clear(); reportCache.clear();
    setTimeout(() => location.reload(),350);
  } catch (error) {
    alert(error?.message || String(error));
    if (submitter) submitter.disabled = false;
  }
}
function targetPdfRows(report) {
  return report.map((row) => `<tr><td><b>${esc(row.intervention_name)}</b><small>${esc(row.field_label)}</small></td>${["attended","assisted","solo_unguided","supervised"].map((mode) => {
    const t=(row.targets||[]).find((x)=>x.participation_mode===mode);
    return `<td class="${t?.met ? "met" : "missing"}">${t ? `${Number(t.achievement)||0} / ${Number(t.target)||0}${t.met ? " ✓" : ` (${Number(t.missing)||0} missing)`}` : "—"}</td>`;
  }).join("")}<td class="${row.overall_met ? "met" : "missing"}">${row.overall_met ? "Achieved" : "Below target"}</td></tr>`).join("");
}
async function exportFinalPriorExperience() {
  const popup = window.open("","_blank");
  if (!popup) return alert("Please allow pop-ups to export the final Prior Experience logbook.");
  popup.document.write("<p style='font-family:Arial;padding:20px'>Preparing final Prior Experience Logbook…</p>");
  try {
    const data = await submission(null,true);
    if (!data || data?.header?.status !== "approved") throw new Error("Final export becomes available only after the Prior Experience Logbook is fully approved.");
    const report = await targetReport(data.header.id,true);
    const interventions = data.interventions || [];
    const seniors = data.senior_reviews || [];
    const faculty = (data.scope_verifications || []).filter((row) => row.assessor_level === "faculty" && ["approved","rejected"].includes(String(row.status)));
    const professors = (data.scope_verifications || []).filter((row) => row.assessor_level === "professor" && ["approved","rejected"].includes(String(row.status)));
    const interventionRows = interventions.map((row) => `<tr><td><b>${esc(row.intervention_name)}</b></td><td>${Number(row.attended_count)||0}</td><td>${Number(row.assisted_count)||0}</td><td>${Number(row.solo_guided_count)||0}</td><td>${Number(row.solo_unguided_count)||0}</td><td>${Number(row.supervised_count)||0}</td><td>${esc(row.notes||"—")}</td></tr>`).join("");
    const opinionRows = [...faculty,...professors].map((row) => {
      const targetRow = report.find((r) => row.assessor_level === "faculty" ? r.intervention_name===row.scope_name : r.field_key===row.field_key && !r.overall_met);
      const exception = row.assessor_level === "faculty" ? targetRow && !targetRow.overall_met : report.some((r)=>r.field_key===row.field_key && !r.overall_met);
      return `<tr><td>${row.assessor_level === "professor" ? "Professor / second level" : "Faculty / first level"}</td><td><b>${esc(row.scope_name)}</b></td><td>${esc(row.assessor_name||"Reviewer")}</td><td>${esc(row.status)}</td><td>${esc(row.note || (exception ? "Approved before mandatory exception-comment rule." : "Target achieved — no exception opinion required."))}</td></tr>`;
    }).join("");
    popup.document.open();
    popup.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Final Prior Experience Logbook</title><style>
      @page{size:A4 portrait;margin:11mm}*{box-sizing:border-box}body{margin:0;color:#172235;font-family:Arial,sans-serif;font-size:9px}header{display:flex;justify-content:space-between;gap:16px;align-items:flex-end;border-bottom:3px solid #641326;padding-bottom:9px;margin-bottom:13px}h1{margin:0;font-size:19px;color:#4f0e1c}header p{margin:3px 0 0;color:#667588}h2{margin:15px 0 7px;font-size:12px;color:#4f0e1c}table{width:100%;border-collapse:collapse;table-layout:fixed;margin-bottom:10px}th,td{border:1px solid #cad2db;padding:5px;vertical-align:top;overflow-wrap:anywhere}th{background:#671528;color:#fff;font-size:7px;text-transform:uppercase}td small{display:block;color:#6f7b88;margin-top:2px}.met{background:#eff9f3;color:#155f3c}.missing{background:#fff4df;color:#885b00}.verification{display:grid;grid-template-columns:1fr 1fr;gap:8px}.signature-card{border:1px solid #d4dce4;border-radius:8px;padding:8px}.signature-card b{display:block;margin-bottom:3px}.final-note{margin-top:14px;padding:9px;border:1px solid #d4b7be;background:#fff8f9}.hod{margin-top:28px;display:grid;grid-template-columns:1fr 1fr;gap:40px}.sign-line{padding-top:35px;border-bottom:1px solid #263442;text-align:center;font-weight:700}footer{margin-top:14px;text-align:right;color:#7b8794;font-size:7px}</style></head><body>
      <header><div><h1>Final Prior Experience Logbook</h1><p>${esc(data.header.resident_name)} · Year ${esc(data.header.residency_year)}</p></div><div><b>FULLY VERIFIED</b><p>Approved ${fmtDate(data.header.verified_at || data.header.updated_at)}</p></div></header>
      <h2>Historical intervention record</h2><table><thead><tr><th>Manual</th><th>Attended</th><th>With assistance</th><th>Solo under guidance</th><th>Solo without guidance</th><th>Supervise</th><th>Notes</th></tr></thead><tbody>${interventionRows || '<tr><td colspan="7">No intervention counts recorded.</td></tr>'}</tbody></table>
      <h2>System minimum-target comparison</h2><table><thead><tr><th>Manual / field</th><th>Attended</th><th>Performed assisted</th><th>Performed unassisted</th><th>Supervise</th><th>Result</th></tr></thead><tbody>${targetPdfRows(report) || '<tr><td colspan="6">No year-specific targets configured.</td></tr>'}</tbody></table>
      <h2>Senior verification</h2><div class="verification">${seniors.map((row)=>`<div class="signature-card"><b>${esc(row.senior_name||"Senior resident")}</b><span>${esc(row.status)}</span><p>${esc(row.note||"No comment")}</p></div>`).join("")}</div>
      <h2>Faculty and professor audit opinions</h2><table><thead><tr><th>Audit level</th><th>Manual / field</th><th>Reviewer</th><th>Decision</th><th>Opinion / exception justification</th></tr></thead><tbody>${opinionRows || '<tr><td colspan="5">No audit opinions recorded.</td></tr>'}</tbody></table>
      <div class="final-note"><b>Final status:</b> Senior verification and the applicable field hierarchy audits are complete. Any below-target approval is documented above with the responsible faculty/professor opinion.</div>
      <div class="hod"><div><div class="sign-line">Head of Department signature</div></div><div><div class="sign-line">Date / official stamp</div></div></div>
      <footer>Cardiology Resident Training & Assessment · Final Prior Experience Logbook · Generated ${fmtDate(new Date())}</footer>
    </body></html>`);
    popup.document.close(); popup.focus(); setTimeout(()=>popup.print(),350);
  } catch (error) {
    popup.document.body.innerHTML = `<p style="font-family:Arial;padding:20px;color:#8b1c2d">${esc(error?.message || String(error))}</p>`;
  }
}
async function enhancePriorPage() {
  if (pageEnhancing) return;
  const title = String(document.querySelector("#title")?.textContent || "");
  if (!/Prior Experience Logbook/i.test(title)) return;
  pageEnhancing = true;
  try {
    const data = await submission(null);
    if (!data) return;
    const form = document.querySelector("#priorExperienceDraftForm");
    if (form) insertSuperviseColumn(form,data);
    else insertReadonlySupervise(data);
    if (data?.header?.status === "approved" && !document.querySelector("[data-prior-export-final-v124]")) {
      const button = document.createElement("button");
      button.type="button"; button.className="btn success-button prior-final-export-button"; button.dataset.priorExportFinalV124="1";
      button.innerHTML="↧ Export final logbook for Head signature";
      const lead = document.querySelector("#content .lead");
      (lead?.lastElementChild || lead || document.querySelector("#content"))?.appendChild(button);
    }
  } finally { pageEnhancing=false; }
}

document.addEventListener("click", (event) => {
  const reviewButton = event.target.closest("[data-prior-review-open]");
  if (reviewButton) {
    selectedReviewRow = window.priorExperienceReviewRows?.get(String(reviewButton.dataset.priorReviewOpen || "")) || null;
    setTimeout(()=>void enhanceReviewerModal(),100);
  }
  if (event.target.closest("[data-prior-export-final-v124]")) void exportFinalPriorExperience();
}, true);
document.addEventListener("submit", (event) => { void savePriorFormWithSupervise(event); }, true);
new MutationObserver(() => { void enhanceReviewerModal(); void enhancePriorPage(); }).observe(document.documentElement,{childList:true,subtree:true});
window.addEventListener("hashchange",()=>setTimeout(()=>void enhancePriorPage(),80));
setInterval(()=>{ void enhanceReviewerModal(); void enhancePriorPage(); },1000);
void enhancePriorPage();
