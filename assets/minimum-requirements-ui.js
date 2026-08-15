import { sb } from "./supabase.js";

const MODES = [
  ["attended", "Attended"],
  ["assisted", "Performed assisted"],
  ["solo_unguided", "Performed unassisted"],
  ["supervised", "Supervise"],
];
const MODE_ORDER = new Map(MODES.map(([mode], index) => [mode, index]));
const ALLOWED_MODES = new Set(MODES.map(([mode]) => mode));
let exportBusy = false;
let ownerRowsCache = null;
let ownerYear = 1;

const escapeHtml = (value) => String(value ?? "").replace(/[&<>'"]/g, (char) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;",
})[char]);

const unwrap = (result) => {
  if (result?.error) throw result.error;
  return result?.data;
};

const toast = (message) => {
  const node = document.querySelector("#toast");
  if (!node) return;
  node.textContent = message;
  node.classList.add("show");
  setTimeout(() => node.classList.remove("show"), 2200);
};

function flattenTargets(rows = []) {
  return (rows || []).flatMap((row) => {
    const targets = Array.isArray(row?.targets) ? row.targets : [];
    return targets
      .filter((target) => ALLOWED_MODES.has(String(target?.participation_mode || "")))
      .map((target) => ({
        intervention_name: String(row?.intervention_name || ""),
        sort_order: Number(row?.sort_order || 0),
        assessor_names: Array.isArray(row?.assessor_names) ? row.assessor_names : [],
        participation_mode: String(target?.participation_mode || ""),
        participation_label: String(target?.participation_label || MODES.find(([mode]) => mode === target?.participation_mode)?.[1] || ""),
        minimum_required: Math.max(0, Number(target?.minimum_required || 0)),
        verified_count: Math.max(0, Number(target?.verified_count || 0)),
        pending_count: Math.max(0, Number(target?.pending_count || 0)),
        missing_count: Math.max(0, Number(target?.missing_count || 0)),
        requirement_met: Boolean(target?.requirement_met),
        timing_note: String(target?.timing_note || "").trim(),
      }))
      .filter((target) => target.minimum_required > 0);
  }).sort((a, b) => a.sort_order - b.sort_order || (MODE_ORDER.get(a.participation_mode) ?? 99) - (MODE_ORDER.get(b.participation_mode) ?? 99));
}

function buildRequirementMatrix(targets) {
  const matrix = new Map();
  for (const target of targets) {
    if (!matrix.has(target.intervention_name)) {
      matrix.set(target.intervention_name, { intervention_name: target.intervention_name, sort_order: target.sort_order, values: new Map() });
    }
    matrix.get(target.intervention_name).values.set(target.participation_mode, target);
  }
  return [...matrix.values()].sort((a, b) => a.sort_order - b.sort_order || a.intervention_name.localeCompare(b.intervention_name));
}

function targetStatus(target) {
  if (target.requirement_met || target.verified_count >= target.minimum_required) return '<span class="tag success">✓ Met</span>';
  return `<span class="tag warning">${escapeHtml(target.missing_count)} missing</span>`;
}

function renderResidentTargetTable(targets) {
  if (!targets.length) return '<div class="panel-empty">No minimum procedural requirements are configured for this residency year.</div>';
  return `<div class="table-scroll"><table class="table resident-minimum-table resident-minimum-target-table">
    <thead><tr><th>Intervention</th><th>Required activity</th><th>Minimum</th><th>Verified</th><th>Pending</th><th>Missing</th><th>Timing</th><th>Status</th><th>Assigned assessors</th></tr></thead>
    <tbody>${targets.map((target) => `<tr>
      <td><b>${escapeHtml(target.intervention_name)}</b></td>
      <td><span class="tag neutral">${escapeHtml(target.participation_label)}</span></td>
      <td><b>${escapeHtml(target.minimum_required)}</b></td>
      <td>${escapeHtml(target.verified_count)}</td>
      <td>${escapeHtml(target.pending_count)}</td>
      <td>${escapeHtml(target.missing_count)}</td>
      <td>${target.timing_note ? `<small class="minimum-timing-note">${escapeHtml(target.timing_note)}</small>` : "—"}</td>
      <td>${targetStatus(target)}</td>
      <td>${target.assessor_names.length ? target.assessor_names.map((name) => `<span class="signature-chip assessor">${escapeHtml(name)}</span>`).join(" ") : '<span class="tag neutral">Not assigned</span>'}</td>
    </tr>`).join("")}</tbody>
  </table></div>`;
}

async function enhanceResidentPage(hero) {
  if (!hero || hero.dataset.fourCategoryEnhanced === "loading" || hero.dataset.fourCategoryEnhanced === "ready") return;
  hero.dataset.fourCategoryEnhanced = "loading";
  try {
    const [progressResult, submissionResult] = await Promise.all([
      sb.rpc("get_logbook_minimum_progress_v1096", { p_resident_id: null }),
      sb.rpc("get_my_logbook_requirement_submission_v1096"),
    ]);
    const progress = unwrap(progressResult) || [];
    const submission = unwrap(submissionResult) || null;
    const targets = flattenTargets(progress);
    const missingTargets = targets.filter((target) => !target.requirement_met && target.missing_count > 0);

    hero.classList.toggle("needs-work", missingTargets.length > 0);
    hero.classList.toggle("ready", missingTargets.length === 0 && targets.length > 0);
    const heading = hero.querySelector("h2");
    const paragraph = hero.querySelector("p");
    if (heading) heading.textContent = targets.length ? (missingTargets.length ? "Activity requirements still incomplete" : "All activity requirements are met") : "No minimum requirements configured";
    if (paragraph) paragraph.textContent = targets.length
      ? "Each intervention is checked separately as Attended, Performed assisted, Performed unassisted, and Supervise. No combined case total is used."
      : "No minimum procedural targets are currently configured for your residency year.";

    const card = document.querySelector(".minimum-resident-card");
    if (card) {
      const note = card.querySelector(".minimum-rules-note");
      if (note) note.innerHTML = '<b>Four separate activity targets</b><span>Attended · Performed assisted · Performed unassisted · Supervise. Every non-zero target must be fulfilled independently; they are never collapsed into one total.</span>';
      const oldTable = card.querySelector(".resident-minimum-table")?.closest(".table-scroll");
      if (oldTable) oldTable.outerHTML = renderResidentTargetTable(targets);

      let actions = card.querySelector(".minimum-resident-actions");
      if (!actions) {
        actions = document.createElement("div");
        actions.className = "minimum-resident-actions";
        card.appendChild(actions);
      }
      actions.querySelectorAll("[data-submit-minimum-logbook], [data-four-category-submit]").forEach((node) => node.remove());
      if (missingTargets.length) {
        if (!actions.querySelector('[data-go="logbook"]')) {
          const add = document.createElement("button");
          add.type = "button";
          add.className = "btn secondary";
          add.dataset.go = "logbook";
          add.textContent = "Add missing cases / update E-logbook";
          actions.prepend(add);
        }
      } else if (targets.length) {
        const status = String(submission?.status || "").toLowerCase();
        if (status === "pending") {
          const disabled = document.createElement("button");
          disabled.type = "button";
          disabled.className = "btn";
          disabled.disabled = true;
          disabled.textContent = "Assessment already submitted";
          actions.appendChild(disabled);
        } else if (status !== "approved") {
          const submit = document.createElement("button");
          submit.type = "button";
          submit.className = "btn success-button";
          submit.dataset.fourCategorySubmit = "1";
          submit.textContent = status === "returned" ? "Re-submit for assessment" : "Submit for assessment";
          actions.appendChild(submit);
        }
      }
    }

    ensureResidentExportButton(hero);
    hero.dataset.fourCategoryEnhanced = "ready";
  } catch (error) {
    console.error("Four-category resident requirement enhancement failed", error);
    hero.dataset.fourCategoryEnhanced = "error";
  }
}

function ownerRowsForYear(rows, year) {
  return (rows || []).filter((row) => Number(row.residency_year) === Number(year) && ALLOWED_MODES.has(String(row.participation_mode || "")));
}

function renderOwnerForm(form, rows, year) {
  const yearRows = ownerRowsForYear(rows, year);
  const interventions = [...new Map((rows || []).map((row) => [String(row.intervention_name), { name: String(row.intervention_name), sort: Number(row.sort_order || 0) }])).values()]
    .sort((a, b) => a.sort - b.sort || a.name.localeCompare(b.name));
  const values = new Map(yearRows.map((row) => [`${String(row.intervention_name)}~${String(row.participation_mode)}`, row]));

  form.classList.add("minimum-requirements-card");
  form.dataset.fourCategoryEnhanced = "ready";
  form.innerHTML = `
    <section class="minimum-year-tabs" aria-label="Residency year">${[1,2,3,4,5].map((item) => `<button type="button" class="${item === year ? "active" : ""}" data-four-category-year="${item}">Year ${item}</button>`).join("")}</section>
    <div class="minimum-requirements-note">
      <div><b>Year ${year}</b><span>Set the four activity requirements independently. Residents are never shown or assessed against a combined total.</span></div>
      <div class="minimum-zero-key"><strong>0</strong><span>= no requirement</span></div>
    </div>
    <div class="table-scroll minimum-requirements-scroll">
      <table class="table minimum-requirements-table minimum-requirements-mode-table">
        <thead><tr><th>Manual intervention</th>${MODES.map(([, label]) => `<th>${escapeHtml(label)}</th>`).join("")}</tr></thead>
        <tbody>${interventions.map((intervention) => `<tr><th scope="row"><span class="minimum-manual-name">${escapeHtml(intervention.name)}</span></th>${MODES.map(([mode, label]) => {
          const row = values.get(`${intervention.name}~${mode}`) || {};
          const timing = String(row.timing_note || "");
          return `<td><input class="minimum-requirement-input" type="number" min="0" max="9999" step="1" inputmode="numeric" value="${escapeHtml(Number(row.minimum_required) || 0)}" data-logbook-minimum data-intervention="${escapeHtml(intervention.name)}" data-residency-year="${year}" data-participation-mode="${escapeHtml(mode)}" data-timing-note="${escapeHtml(timing)}" aria-label="${escapeHtml(intervention.name)} · ${escapeHtml(label)} · Year ${year}">${timing ? `<small class="minimum-timing-note">${escapeHtml(timing)}</small>` : ""}</td>`;
        }).join("")}</tr>`).join("")}</tbody>
      </table>
    </div>
    <div class="minimum-requirements-footer"><p>Four separate targets only: <b>Attended</b>, <b>Performed assisted</b>, <b>Performed unassisted</b>, and <b>Supervise</b>.</p><button class="btn" type="submit">Save Year ${year} requirements</button></div>`;
}

async function enhanceOwnerPage(form) {
  if (!form || form.dataset.fourCategoryEnhanced === "loading" || form.dataset.fourCategoryEnhanced === "ready") return;
  form.dataset.fourCategoryEnhanced = "loading";
  try {
    if (!ownerRowsCache) ownerRowsCache = unwrap(await sb.rpc("owner_get_logbook_requirements_v1083")) || [];
    const existingYear = Number(form.querySelector("[data-residency-year]")?.dataset.residencyYear || 1);
    ownerYear = Math.max(1, Math.min(5, Number(ownerYear || existingYear || 1)));
    renderOwnerForm(form, ownerRowsCache, ownerYear);
  } catch (error) {
    console.error("Four-category owner requirement enhancement failed", error);
    form.dataset.fourCategoryEnhanced = "error";
  }
}

async function saveOwnerRequirements(form) {
  const button = form.querySelector('button[type="submit"]');
  const original = button?.textContent || "Save requirements";
  if (button) { button.disabled = true; button.textContent = "Saving…"; }
  try {
    const requirements = [...form.querySelectorAll("[data-logbook-minimum]")].map((input) => ({
      intervention_name: String(input.dataset.intervention || ""),
      residency_year: Number(input.dataset.residencyYear),
      participation_mode: String(input.dataset.participationMode || ""),
      minimum_required: Math.max(0, Math.floor(Number(input.value) || 0)),
      timing_note: String(input.dataset.timingNote || "") || null,
    }));
    unwrap(await sb.rpc("owner_save_logbook_requirements_v1083", { p_requirements: requirements }));
    ownerRowsCache = null;
    toast(`Year ${ownerYear} minimum requirements saved`);
    ownerRowsCache = unwrap(await sb.rpc("owner_get_logbook_requirements_v1083")) || [];
    renderOwnerForm(form, ownerRowsCache, ownerYear);
  } catch (error) {
    alert(error?.message || "Could not save minimum requirements.");
  } finally {
    if (button?.isConnected) { button.disabled = false; button.textContent = original; }
  }
}

async function submitResidentRequirements(button) {
  if (button.disabled) return;
  button.disabled = true;
  const original = button.textContent;
  button.textContent = "Submitting…";
  try {
    unwrap(await sb.rpc("resident_submit_logbook_requirements_v1096"));
    toast("E-logbook submitted for minimum-requirement assessment");
    setTimeout(() => location.reload(), 450);
  } catch (error) {
    alert(error?.message || "The minimum requirements could not be submitted.");
    button.disabled = false;
    button.textContent = original;
  }
}

async function exportRequirementsPdf(button) {
  if (exportBusy) return;
  exportBusy = true;
  const originalText = button.textContent;
  button.disabled = true;
  button.textContent = "Preparing PDF…";
  const popup = window.open("", "_blank", "noopener,noreferrer");
  try {
    if (!popup) throw new Error("Allow pop-ups once to export the PDF.");
    popup.document.write("<!doctype html><title>Preparing requirements…</title><body style='font-family:Arial,sans-serif;padding:32px'>Preparing your minimum-requirement PDF…</body>");
    popup.document.close();

    const [{ data: progress, error: progressError }, { data: userData, error: userError }] = await Promise.all([
      sb.rpc("get_logbook_minimum_progress_v1096", { p_resident_id: null }), sb.auth.getUser(),
    ]);
    if (progressError) throw progressError;
    if (userError) throw userError;
    const userId = userData?.user?.id;
    if (!userId) throw new Error("Signed-in resident not found.");
    const { data: profile, error: profileError } = await sb.from("profiles").select("display_name,residency_year,role").eq("id", userId).single();
    if (profileError) throw profileError;
    if (String(profile?.role || "") !== "resident") throw new Error("PDF export is available from the resident minimum-requirements page.");

    const targets = flattenTargets(progress || []);
    const matrix = buildRequirementMatrix(targets);
    const generated = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date());
    const residentName = String(profile?.display_name || "Resident");
    const year = Number(profile?.residency_year || 0);
    const rowsHtml = matrix.length ? matrix.map((row) => `<tr><td class="procedure">${escapeHtml(row.intervention_name)}</td>${MODES.map(([mode]) => {
      const target = row.values.get(mode);
      return target ? `<td><b>${escapeHtml(target.minimum_required)}</b>${target.timing_note ? `<small>${escapeHtml(target.timing_note)}</small>` : ""}</td>` : '<td class="empty">—</td>';
    }).join("")}</tr>`).join("") : '<tr><td colspan="5" class="empty-row">No minimum requirements are configured for this residency year.</td></tr>';

    popup.document.open();
    popup.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(residentName)} - Year ${escapeHtml(year)} Minimum Requirements</title><style>
      @page{size:A4 landscape;margin:12mm}*{box-sizing:border-box}body{margin:0;color:#10253d;font-family:Arial,Helvetica,sans-serif;background:#fff}.head{display:flex;justify-content:space-between;gap:20px;align-items:flex-start;border-bottom:3px solid #123a63;padding-bottom:12px;margin-bottom:16px}.brand{font-size:13px;font-weight:800;color:#1c6db2;letter-spacing:.08em;text-transform:uppercase}h1{margin:4px 0;font-size:24px;color:#0b2747}.sub{margin:0;color:#52667b;font-size:12px}.meta{text-align:right;font-size:12px;line-height:1.6;color:#52667b}.meta b{color:#10253d}.notice{margin:0 0 14px;padding:10px 12px;border-radius:9px;background:#eef6ff;border:1px solid #cbdff1;font-size:11px;line-height:1.45}table{width:100%;border-collapse:collapse;table-layout:fixed;font-size:10.5px}th,td{border:1px solid #b9c9d8;padding:8px 7px;vertical-align:middle;text-align:center}th{background:#0b2747;color:#fff;font-size:10px;line-height:1.25}th:first-child,td.procedure{text-align:left;width:29%}td.procedure{font-weight:750;color:#0b2747;background:#f8fbfe}td b{font-size:12px}td small{display:block;margin-top:4px;color:#7a5200;font-size:8.5px;line-height:1.2}.empty{color:#a5afba}.empty-row{padding:24px;color:#718094}.foot{margin-top:12px;color:#68788b;font-size:9px;line-height:1.4}
    </style></head><body><section class="head"><div><div class="brand">Cardiology Training & Assessment</div><h1>Minimum procedural requirements</h1><p class="sub">Resident-specific requirement sheet · Year ${escapeHtml(year)}</p></div><div class="meta"><b>${escapeHtml(residentName)}</b><br>Residency Year ${escapeHtml(year)}<br>Generated ${escapeHtml(generated)}</div></section><p class="notice">Requirements are separated into the four program categories. There is <b>no combined case-total requirement</b>.</p><table><thead><tr><th>Intervention</th>${MODES.map(([, label]) => `<th>${escapeHtml(label)}</th>`).join("")}</tr></thead><tbody>${rowsHtml}</tbody></table><p class="foot">A dash means no minimum is configured for that activity. In the print dialog choose <b>Save as PDF</b>.</p><script>setTimeout(()=>window.print(),250);<\/script></body></html>`);
    popup.document.close();
  } catch (error) {
    try { popup?.close(); } catch (_) {}
    alert(error?.message || "Could not export the minimum requirements PDF.");
  } finally {
    exportBusy = false;
    if (button.isConnected) { button.disabled = false; button.textContent = originalText; }
  }
}

function ensureResidentExportButton(hero) {
  if (!hero || document.querySelector("[data-export-minimum-requirements-pdf]")) return;
  const button = document.createElement("button");
  button.type = "button";
  button.className = "btn secondary";
  button.dataset.exportMinimumRequirementsPdf = "1";
  button.textContent = "Export requirements PDF";
  const actions = document.createElement("div");
  actions.className = "inline-actions minimum-requirements-export-actions";
  actions.style.marginBottom = "10px";
  actions.appendChild(button);
  hero.before(actions);
}

function applyEnhancements() {
  const ownerForm = document.querySelector("#ownerLogbookRequirementsForm");
  if (ownerForm) void enhanceOwnerPage(ownerForm);
  const residentHero = document.querySelector(".minimum-resident-hero");
  if (residentHero) void enhanceResidentPage(residentHero);
}

document.addEventListener("submit", (event) => {
  const form = event.target?.closest?.("#ownerLogbookRequirementsForm");
  if (!form) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  void saveOwnerRequirements(form);
}, true);

document.addEventListener("click", (event) => {
  const yearButton = event.target?.closest?.("[data-four-category-year]");
  if (yearButton) {
    event.preventDefault();
    event.stopImmediatePropagation();
    ownerYear = Math.max(1, Math.min(5, Number(yearButton.dataset.fourCategoryYear || 1)));
    const form = document.querySelector("#ownerLogbookRequirementsForm");
    if (form && ownerRowsCache) renderOwnerForm(form, ownerRowsCache, ownerYear);
    return;
  }
  const exportButton = event.target?.closest?.("[data-export-minimum-requirements-pdf]");
  if (exportButton) {
    event.preventDefault();
    event.stopImmediatePropagation();
    void exportRequirementsPdf(exportButton);
    return;
  }
  const submitButton = event.target?.closest?.("[data-four-category-submit]");
  if (submitButton) {
    event.preventDefault();
    event.stopImmediatePropagation();
    void submitResidentRequirements(submitButton);
  }
}, true);

const content = document.querySelector("#content");
if (content) new MutationObserver(applyEnhancements).observe(content, { childList: true, subtree: true });
applyEnhancements();
