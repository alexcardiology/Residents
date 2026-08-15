import { sb } from "./supabase.js";

let currentRole = "";
let residentEnhancing = false;
let lastResidentSignature = "";
let observerTimer = null;

const esc = (value) => String(value ?? "").replace(/[&<>'"]/g, (char) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;",
})[char]);

const unwrap = (result) => {
  if (result?.error) throw result.error;
  return result?.data;
};

function ensureOption(select, name, beforeName = "") {
  if (!select || [...select.options].some((option) => option.textContent.trim().toLowerCase() === name.toLowerCase())) return;
  const option = document.createElement("option");
  option.value = name;
  option.textContent = name;
  const reference = [...select.options].find((item) => item.textContent.trim() === beforeName);
  if (reference) select.insertBefore(option, reference); else select.appendChild(option);
}

function priorManualRow(name) {
  const row = document.createElement("tr");
  row.dataset.priorIntervention = name;
  row.innerHTML = `<td><b>${esc(name)}</b></td><td><input class="prior-count-input" type="number" min="0" max="9999" value="0" data-prior-count="attended_count"></td><td><input class="prior-count-input" type="number" min="0" max="9999" value="0" data-prior-count="assisted_count"></td><td><input class="prior-count-input" type="number" min="0" max="9999" value="0" data-prior-count="solo_guided_count"></td><td><input class="prior-count-input" type="number" min="0" max="9999" value="0" data-prior-count="solo_unguided_count"></td><td><input value="" data-prior-intervention-notes placeholder="Optional"></td>`;
  return row;
}

function ensureManuals() {
  document.querySelectorAll('select[name="procedure_name"]').forEach((select) => {
    ensureOption(select, "Ablation", "Pericardiocentesis");
    ensureOption(select, "Holter monitoring", "Nuclear imaging");
  });

  const rows = [...document.querySelectorAll("tr[data-prior-intervention]")];
  if (!rows.length) return;
  const has = (name) => rows.some((row) => String(row.dataset.priorIntervention || "").toLowerCase() === name.toLowerCase());
  if (!has("Ablation")) {
    const reference = rows.find((row) => row.dataset.priorIntervention === "Pericardiocentesis");
    const row = priorManualRow("Ablation");
    if (reference) reference.before(row); else rows.at(-1)?.after(row);
  }
  const refreshed = [...document.querySelectorAll("tr[data-prior-intervention]")];
  if (!refreshed.some((row) => String(row.dataset.priorIntervention || "").toLowerCase() === "holter monitoring")) {
    const reference = refreshed.find((row) => row.dataset.priorIntervention === "Nuclear imaging");
    const row = priorManualRow("Holter monitoring");
    if (reference) reference.before(row); else refreshed.at(-1)?.after(row);
  }
}

function hideLegacyPriorAssessorAssignment() {
  document.querySelectorAll('[data-go="owner-prior-experience-assignments"]').forEach((node) => {
    node.hidden = true;
    node.setAttribute("aria-hidden", "true");
  });
}

function enhanceHierarchyOverlayCopy() {
  const overlay = document.querySelector("#auditHierarchyOverlay");
  if (!overlay) return;
  const headText = overlay.querySelector(".audit-hierarchy-head-copy p");
  if (headText) headText.textContent = "Drag assessors into each field. Prior Experience starts with the faculty audit level; professors provide the higher final field approval.";
  const headings = [...overlay.querySelectorAll(".audit-tier-heading")];
  headings.forEach((heading) => {
    const bold = heading.querySelector("b");
    const note = heading.querySelector("span");
    if (!bold) return;
    if (/professor/i.test(bold.textContent || "")) {
      bold.textContent = "Higher final level · Professors";
      if (note) note.textContent = "Maximum 2 · any 1 final approval";
    } else {
      bold.textContent = "First audit level · Assistant lecturers & lecturers";
      if (note) note.textContent = "2–8 assigned · any 2 approvals per manual";
    }
  });
  const foot = overlay.querySelector(".audit-hierarchy-foot p");
  if (foot) foot.innerHTML = "<b>Prior Experience chain:</b> after both senior verifiers approve, every submitted manual goes to the first-level faculty auditors in its field. Any 2 faculty approvals complete that manual. When every submitted manual in a field is complete, the professor level opens; any 1 assigned professor approval completes that field.";
}

function decisionBadge(status) {
  const value = String(status || "pending");
  if (value === "approved") return '<span class="tag success">Approved</span>';
  if (value === "rejected") return '<span class="tag danger">Rejected</span>';
  if (value === "not_required") return '<span class="tag neutral">Closed</span>';
  return '<span class="tag warning">Pending</span>';
}

function latestReconsideration(data, reviewId) {
  return (data?.reconsiderations || [])
    .filter((row) => row.review_kind === "scope_verification" && String(row.review_id) === String(reviewId))
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0] || null;
}

function reconsiderationAction(data, verification) {
  if (verification?.status !== "rejected" || currentRole !== "resident") return "";
  const rec = latestReconsideration(data, verification.id);
  if (rec?.status === "requested") return '<span class="tag warning">Reconsideration pending</span>';
  if (rec?.status === "approved") return '<span class="tag success">Reconsideration approved</span>';
  if (rec?.status === "rejected") return '<span class="tag danger">Reconsideration rejected</span>';
  return `<button class="btn small reclaim-button" data-prior-reconsider="scope_verification" data-prior-review-id="${esc(verification.id)}" data-prior-reviewer="${esc(verification.assessor_name || "Reviewer")}" data-prior-scope="${esc(verification.scope_name || verification.field_label || "")}">Request to reconsider</button>`;
}

function seniorAction(data, review) {
  if (review?.status !== "rejected" || currentRole !== "resident") return "";
  const rec = (data?.reconsiderations || [])
    .filter((row) => row.review_kind === "senior" && String(row.review_id) === String(review.id))
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0];
  if (rec?.status === "requested") return '<span class="tag warning">Reconsideration pending</span>';
  if (rec?.status === "approved") return '<span class="tag success">Reconsideration approved</span>';
  if (rec?.status === "rejected") return '<span class="tag danger">Reconsideration rejected</span>';
  return `<button class="btn small reclaim-button" data-prior-reconsider="senior" data-prior-review-id="${esc(review.id)}" data-prior-reviewer="${esc(review.senior_name || "Senior resident")}" data-prior-scope="Whole prior logbook">Request to reconsider</button>`;
}

function reviewerLines(data, rows) {
  if (!rows.length) return '<span class="prior-audit-waiting">Not opened yet</span>';
  return `<div class="prior-audit-reviewers">${rows.map((row) => `<div class="prior-audit-reviewer"><b>${esc(row.assessor_name || "Reviewer")}</b>${decisionBadge(row.status)}${row.note ? `<small>${esc(row.note)}</small>` : ""}${reconsiderationAction(data, row)}</div>`).join("")}</div>`;
}

function stageStepper(data) {
  const progress = data?.audit_progress || { stage: "senior_only", fields: [] };
  const seniorsApproved = (data?.senior_reviews || []).filter((row) => row.status === "approved").length >= 2;
  const facultyComplete = (progress.fields || []).length > 0 && (progress.fields || []).every((field) => field.faculty_complete);
  const professorComplete = (progress.fields || []).length > 0 && (progress.fields || []).every((field) => field.field_complete);
  const fullyApproved = data?.header?.status === "approved";
  const step = (num, title, caption, complete, current) => `<div class="prior-audit-step ${complete ? "complete" : ""} ${current ? "current" : ""}"><span>${complete ? "✓" : num}</span><div><b>${title}</b><small>${caption}</small></div></div>`;
  return `<section class="prior-audit-stepper">
    ${step(1,"2 senior verifiers","Both approve the submitted historical record",seniorsApproved,!seniorsApproved)}
    ${step(2,"First-level manual audit","2 faculty approvals for every submitted manual",facultyComplete,seniorsApproved && !facultyComplete)}
    ${step(3,"Professor field audit","1 professor approval after all manuals in that field pass",professorComplete,facultyComplete && !professorComplete)}
    ${step(4,"Prior Experience verified","Historical record accepted; minimum targets remain separate",fullyApproved,professorComplete && !fullyApproved)}
  </section>`;
}

function renderHierarchyTimeline(data) {
  const seniorRows = (data?.senior_reviews || []).map((row) => `<tr><td><b>${esc(row.senior_name || "Senior resident")}</b></td><td>${decisionBadge(row.status)}</td><td>${esc(row.note || "—")}</td><td>${seniorAction(data, row)}</td></tr>`).join("");
  const verifications = data?.scope_verifications || [];
  const progressFields = data?.audit_progress?.fields || [];
  const fieldSections = progressFields.map((field) => {
    const manualRows = (field.manuals || []).map((manual) => {
      const rows = verifications.filter((row) => row.assessor_level === "faculty" && row.field_key === field.field_key && row.scope_name === manual.intervention_name);
      return `<tr><td><b>${esc(manual.intervention_name)}</b></td><td><span class="prior-audit-score ${Number(manual.faculty_approved) >= 2 ? "complete" : ""}">${Number(manual.faculty_approved) || 0}/2</span></td><td>${reviewerLines(data, rows)}</td></tr>`;
    }).join("");
    const professorRows = verifications.filter((row) => row.assessor_level === "professor" && row.field_key === field.field_key);
    const professorState = field.faculty_complete
      ? reviewerLines(data, professorRows)
      : '<span class="prior-audit-waiting">Locked until every submitted manual in this field has 2 faculty approvals.</span>';
    const setupWarning = Number(field.faculty_assigned) < 2 || Number(field.professor_assigned) < 1
      ? `<div class="prior-audit-setup-warning"><b>Admin hierarchy incomplete for this field.</b><span>${Number(field.faculty_assigned)}/2 minimum faculty · ${Number(field.professor_assigned)}/1 minimum professor assigned.</span></div>`
      : "";
    return `<section class="prior-audit-field-progress">
      <div class="prior-audit-field-title"><div><span>Audit field</span><h4>${esc(field.field_label)}</h4></div><span class="tag ${field.field_complete ? "success" : field.faculty_complete ? "warning" : "neutral"}">${field.field_complete ? "Field approved" : field.faculty_complete ? "Waiting for professor" : "First-level audit"}</span></div>
      ${setupWarning}
      <div class="table-scroll"><table class="table compact-evidence-table"><thead><tr><th>Submitted manual</th><th>Faculty approvals</th><th>First-level reviewers</th></tr></thead><tbody>${manualRows || '<tr><td colspan="3">No manuals submitted in this field.</td></tr>'}</tbody></table></div>
      <div class="prior-professor-stage"><div><b>Higher professor audit</b><small>Opens only after all manuals above have 2 approvals. Any 1 assigned professor completes the field.</small></div>${professorState}</div>
    </section>`;
  }).join("");
  return `<section class="card prior-verification-card prior-hierarchy-verification" data-hierarchy-rendered="1">
    <div class="section-head"><div><span class="eyebrow">Verification chain</span><h3>Senior → manual audit → professor field audit</h3></div></div>
    ${stageStepper(data)}
    <h4>Stage 1 · Senior-resident verification — both are required</h4>
    <div class="table-scroll"><table class="table compact-evidence-table"><thead><tr><th>Senior resident</th><th>Status</th><th>Comment</th><th></th></tr></thead><tbody>${seniorRows || '<tr><td colspan="4">Senior reviews appear after final submission.</td></tr>'}</tbody></table></div>
    <div class="prior-audit-fields-list">${fieldSections || '<div class="prior-audit-empty">No manual intervention requires hierarchy audit. Conferences remain covered by the two senior verifiers.</div>'}</div>
  </section>`;
}

function stageLabel(data) {
  const stage = data?.header?.status === "approved" ? "complete" : data?.audit_progress?.stage;
  return ({
    senior_only: "Waiting for the 2 senior verifiers",
    setup_required: "Waiting for Admin to complete the relevant audit hierarchy",
    faculty_audit: "First-level manual audit in progress · 2 approvals required per manual",
    professor_audit: "Professor field audit in progress",
    complete: "✓ Prior Experience fully verified",
  })[stage] || "Hierarchy audit in progress";
}

function updatePriorCopy(data = null) {
  const alert = document.querySelector(".prior-experience-alert");
  const alertParagraph = alert?.querySelector("p");
  if (alertParagraph) alertParagraph.innerHTML = "Record experience completed before routine use of this e-logbook. <b>You may submit even when these historical counts do not meet the current minimum targets.</b> After submission: 2 senior verifiers → 2 first-level faculty approvals for each submitted manual → professor approval for each represented field.";

  const step3 = [...document.querySelectorAll(".prior-draft-card")].find((card) => /choose two senior verifiers/i.test(card.textContent || ""));
  const step3p = step3?.querySelector("p");
  if (step3p) step3p.innerHTML = "Choose two eligible senior residents. <b>Both must approve first.</b> The relevant manuals then move automatically to the first-level faculty auditors defined in the Admin hierarchy.";

  const finalCard = document.querySelector(".prior-final-submit-card p");
  if (finalCard) finalCard.innerHTML = "<b>Save draft</b> keeps everything editable. <b>Final submission</b> locks the historical record and starts the 2-senior → faculty manual audit → professor field audit chain. Meeting current minimum targets is not required to submit Prior Experience.";

  document.querySelectorAll(".prior-review-queue .section-head p").forEach((node) => {
    node.textContent = "Two senior verifiers act first. Then each submitted manual needs 2 first-level faculty approvals; only completed fields move to the professor audit level.";
  });

  if (data) {
    const oldBadges = [...document.querySelectorAll(".prior-experience-alert .tag, .prior-summary-head .tag")];
    oldBadges.forEach((badge) => {
      if (/assessor verification|senior-approved/i.test(badge.textContent || "")) badge.textContent = stageLabel(data);
    });
  }
}

async function enhanceResidentPriorPage() {
  if (residentEnhancing || currentRole !== "resident") return;
  const content = document.querySelector("#content");
  if (!content || !(/prior experience/i.test(document.querySelector("#title")?.textContent || "") || content.querySelector(".prior-experience-form,.prior-verification-card"))) return;
  residentEnhancing = true;
  try {
    const data = unwrap(await sb.rpc("get_prior_experience_submission_v1069", { p_logbook_id: null }));
    updatePriorCopy(data);
    if (!data) return;
    const signature = `${data?.header?.id || ""}:${data?.header?.updated_at || ""}:${data?.scope_verifications?.length || 0}:${data?.senior_reviews?.map((row) => row.status).join(",") || ""}`;
    const card = content.querySelector(".prior-verification-card");
    if (card && (signature !== lastResidentSignature || !card.dataset.hierarchyRendered)) {
      card.outerHTML = renderHierarchyTimeline(data);
      lastResidentSignature = signature;
    }
  } catch (error) {
    console.warn("Could not enhance Prior Experience hierarchy view", error);
  } finally {
    residentEnhancing = false;
  }
}

function enhanceReviewQueue() {
  const map = window.priorExperienceReviewRows;
  if (!(map instanceof Map)) return;
  document.querySelectorAll("[data-prior-review-open]").forEach((button) => {
    const row = map.get(button.getAttribute("data-prior-review-open"));
    if (!row || !["faculty", "professor"].includes(String(row.assessor_level || ""))) return;
    const tr = button.closest("tr");
    const stageCell = tr?.children?.[1];
    if (stageCell) stageCell.innerHTML = row.assessor_level === "faculty"
      ? `<b>First-level manual audit</b><small>${esc(row.scope_name)} · 2 approvals needed</small>`
      : `<b>Higher professor field audit</b><small>${esc(row.scope_name)} · final field approval</small>`;
  });
}

function interventionTable(interventions) {
  const rows = (interventions || []).map((row) => `<tr><td><b>${esc(row.intervention_name)}</b></td><td>${Number(row.attended_count) || 0}</td><td>${Number(row.assisted_count) || 0}</td><td>${Number(row.solo_guided_count) || 0}</td><td>${Number(row.solo_unguided_count) || 0}</td><td>${esc(row.notes || "—")}</td></tr>`).join("");
  return `<div class="table-scroll"><table class="table prior-count-table"><thead><tr><th>Intervention</th><th>Attended</th><th>With assistance</th><th>Solo under guidance</th><th>Solo without guidance</th><th>Notes</th></tr></thead><tbody>${rows || '<tr><td colspan="6">No submitted manuals in this field.</td></tr>'}</tbody></table></div>`;
}

async function enhanceReviewerModal(buttonKey) {
  const map = window.priorExperienceReviewRows;
  const row = map instanceof Map ? map.get(buttonKey) : null;
  if (!row || !["faculty", "professor"].includes(String(row.assessor_level || ""))) return;
  await new Promise((resolve) => setTimeout(resolve, 80));
  const modal = document.querySelector("#modalBody .prior-review-modal");
  if (!modal) return;
  const eyebrow = modal.querySelector(".modal-head .eyebrow");
  if (eyebrow) eyebrow.textContent = row.assessor_level === "faculty" ? "First-level manual audit" : "Higher professor field audit";
  const heading = modal.querySelector(".modal-head h2");
  if (heading && row.assessor_level === "professor") heading.textContent = `${row.scope_name} field`;

  const summary = modal.querySelector(".prior-readonly-summary");
  if (row.assessor_level === "faculty") {
    if (summary && !summary.querySelector(".prior-modal-audit-rule")) {
      const note = document.createElement("div");
      note.className = "prior-modal-audit-rule";
      note.innerHTML = "<b>First-level rule:</b> this manual needs approvals from any 2 faculty auditors assigned to its field.";
      summary.prepend(note);
    }
    return;
  }

  try {
    const data = unwrap(await sb.rpc("get_prior_experience_submission_v1069", { p_logbook_id: Number(row.logbook_id) }));
    const interventions = (data?.interventions || []).filter((item) => item.field_key === row.field_key);
    const field = (data?.audit_progress?.fields || []).find((item) => item.field_key === row.field_key);
    if (summary) summary.innerHTML = `<div class="prior-modal-audit-rule professor"><b>Professor-level field review:</b> every submitted manual below has already received 2 first-level faculty approvals. Your approval completes the ${esc(row.scope_name)} field.</div><div class="prior-summary-head"><div><span class="eyebrow">Resident</span><h3>${esc(data?.header?.resident_name || row.resident_name)}</h3><small>Year ${esc(data?.header?.residency_year || row.residency_year)}</small></div><span class="tag warning">${Number(field?.professor_approved) || 0}/1 professor approval</span></div><h4>Submitted manuals in ${esc(row.scope_name)}</h4>${interventionTable(interventions)}`;
  } catch (error) {
    console.warn("Could not load professor field evidence", error);
  }
}

function redirectLegacyRoute() {
  if (!location.hash.includes("owner-prior-experience-assignments")) return;
  location.hash = "owner-logbook-center";
  setTimeout(() => document.querySelector(".audit-hierarchy-tile,.audit-hierarchy-nav")?.click(), 180);
}

function enhanceDom() {
  ensureManuals();
  hideLegacyPriorAssessorAssignment();
  enhanceHierarchyOverlayCopy();
  enhanceReviewQueue();
  updatePriorCopy();
  void enhanceResidentPriorPage();
}

async function resolveRole() {
  try {
    const { data } = await sb.auth.getSession();
    const uid = data?.session?.user?.id;
    if (!uid) return;
    const profile = unwrap(await sb.from("profiles").select("role").eq("id", uid).maybeSingle());
    currentRole = String(profile?.role || "");
  } catch (_) {}
}

document.addEventListener("click", (event) => {
  const reviewButton = event.target.closest("[data-prior-review-open]");
  if (reviewButton) {
    const key = reviewButton.getAttribute("data-prior-review-open");
    setTimeout(() => void enhanceReviewerModal(key), 0);
  }
});

window.addEventListener("hashchange", () => {
  redirectLegacyRoute();
  setTimeout(enhanceDom, 100);
});

await resolveRole();
redirectLegacyRoute();

const root = document.querySelector("#shell") || document.body;
new MutationObserver(() => {
  clearTimeout(observerTimer);
  observerTimer = setTimeout(enhanceDom, 90);
}).observe(root, { childList: true, subtree: true });

setTimeout(enhanceDom, 80);
setTimeout(enhanceDom, 500);
setTimeout(enhanceDom, 1400);
