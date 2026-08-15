import { sb } from "./supabase.js";

const MODES = [
  ["attended", "Attended"],
  ["assisted", "Performed assisted"],
  ["solo_unguided", "Performed unassisted"],
  ["supervised", "Supervise"],
];
const ALLOWED_MODES = new Set(MODES.map(([mode]) => mode));
let exportBusy = false;

const escapeHtml = (value) => String(value ?? "").replace(/[&<>'"]/g, (char) => ({
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  "'": "&#39;",
  '"': "&quot;",
})[char]);

function fixOwnerRequirementGrid() {
  const table = document.querySelector(".minimum-requirements-mode-table");
  if (!table) return;

  table.querySelectorAll('[data-participation-mode="solo_guided"]').forEach((input) => {
    input.closest("td")?.remove();
  });

  const headers = [...table.querySelectorAll("thead th")];
  headers.forEach((header) => {
    const text = header.textContent?.trim().toLowerCase() || "";
    if (text.includes("direct guidance")) header.remove();
  });

  const remainingHeaders = [...table.querySelectorAll("thead th")];
  const labels = ["Manual intervention", "Attended", "Performed assisted", "Performed unassisted", "Supervise"];
  remainingHeaders.forEach((header, index) => {
    if (labels[index]) header.textContent = labels[index];
  });

  const intro = document.querySelector(".minimum-requirements-note div:first-child span");
  if (intro) intro.textContent = "Each of the four activity requirements is checked independently. Residents must satisfy every non-zero target.";

  const footer = document.querySelector(".minimum-requirements-footer p");
  if (footer) footer.innerHTML = "Four separate targets only: <b>Attended</b>, <b>Performed assisted</b>, <b>Performed unassisted</b>, and <b>Supervise</b>.";
}

function flattenTargets(rows = []) {
  return (rows || []).flatMap((row) => {
    const targets = Array.isArray(row?.targets) ? row.targets : [];
    return targets
      .filter((target) => ALLOWED_MODES.has(String(target?.participation_mode || "")))
      .map((target) => ({
        intervention_name: String(row?.intervention_name || ""),
        sort_order: Number(row?.sort_order || 0),
        participation_mode: String(target?.participation_mode || ""),
        minimum_required: Math.max(0, Number(target?.minimum_required || 0)),
        timing_note: String(target?.timing_note || "").trim(),
      }))
      .filter((target) => target.minimum_required > 0);
  });
}

function buildRequirementMatrix(targets) {
  const matrix = new Map();
  for (const target of targets) {
    if (!matrix.has(target.intervention_name)) {
      matrix.set(target.intervention_name, {
        intervention_name: target.intervention_name,
        sort_order: target.sort_order,
        values: new Map(),
      });
    }
    matrix.get(target.intervention_name).values.set(target.participation_mode, target);
  }
  return [...matrix.values()].sort((a, b) => a.sort_order - b.sort_order || a.intervention_name.localeCompare(b.intervention_name));
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
      sb.rpc("get_logbook_minimum_progress_v1096", { p_resident_id: null }),
      sb.auth.getUser(),
    ]);
    if (progressError) throw progressError;
    if (userError) throw userError;

    const userId = userData?.user?.id;
    if (!userId) throw new Error("Signed-in resident not found.");
    const { data: profile, error: profileError } = await sb
      .from("profiles")
      .select("display_name,residency_year,role")
      .eq("id", userId)
      .single();
    if (profileError) throw profileError;
    if (String(profile?.role || "") !== "resident") throw new Error("PDF export is available from the resident minimum-requirements page.");

    const targets = flattenTargets(progress || []);
    const matrix = buildRequirementMatrix(targets);
    const generated = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date());
    const residentName = String(profile?.display_name || "Resident");
    const year = Number(profile?.residency_year || 0);

    const rowsHtml = matrix.length
      ? matrix.map((row) => `<tr>
          <td class="procedure">${escapeHtml(row.intervention_name)}</td>
          ${MODES.map(([mode]) => {
            const target = row.values.get(mode);
            if (!target) return "<td class=\"empty\">—</td>";
            return `<td><b>${escapeHtml(target.minimum_required)}</b>${target.timing_note ? `<small>${escapeHtml(target.timing_note)}</small>` : ""}</td>`;
          }).join("")}
        </tr>`).join("")
      : `<tr><td colspan="5" class="empty-row">No minimum requirements are configured for this residency year.</td></tr>`;

    popup.document.open();
    popup.document.write(`<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(residentName)} - Year ${escapeHtml(year)} Minimum Requirements</title>
  <style>
    @page{size:A4 landscape;margin:12mm}
    *{box-sizing:border-box}
    body{margin:0;color:#10253d;font-family:Arial,Helvetica,sans-serif;background:#fff}
    .head{display:flex;justify-content:space-between;gap:20px;align-items:flex-start;border-bottom:3px solid #123a63;padding-bottom:12px;margin-bottom:16px}
    .brand{font-size:13px;font-weight:800;color:#1c6db2;letter-spacing:.08em;text-transform:uppercase}
    h1{margin:4px 0 4px;font-size:24px;color:#0b2747}
    .sub{margin:0;color:#52667b;font-size:12px}
    .meta{text-align:right;font-size:12px;line-height:1.6;color:#52667b}
    .meta b{color:#10253d}
    .notice{margin:0 0 14px;padding:10px 12px;border-radius:9px;background:#eef6ff;border:1px solid #cbdff1;font-size:11px;line-height:1.45}
    table{width:100%;border-collapse:collapse;table-layout:fixed;font-size:10.5px}
    th,td{border:1px solid #b9c9d8;padding:8px 7px;vertical-align:middle;text-align:center}
    th{background:#0b2747;color:#fff;font-size:10px;line-height:1.25}
    th:first-child,td.procedure{text-align:left;width:29%}
    td.procedure{font-weight:750;color:#0b2747;background:#f8fbfe}
    td b{font-size:12px}
    td small{display:block;margin-top:4px;color:#7a5200;font-size:8.5px;line-height:1.2}
    .empty{color:#a5afba}
    .empty-row{padding:24px;color:#718094}
    .foot{margin-top:12px;color:#68788b;font-size:9px;line-height:1.4}
    @media print{button{display:none!important}}
  </style>
</head>
<body>
  <section class="head">
    <div><div class="brand">Cardiology Training & Assessment</div><h1>Minimum procedural requirements</h1><p class="sub">Resident-specific requirement sheet · Year ${escapeHtml(year)}</p></div>
    <div class="meta"><b>${escapeHtml(residentName)}</b><br>Residency Year ${escapeHtml(year)}<br>Generated ${escapeHtml(generated)}</div>
  </section>
  <p class="notice">Requirements are deliberately separated into the four program categories. There is <b>no combined case-total requirement</b> shown here.</p>
  <table>
    <thead><tr><th>Intervention</th>${MODES.map(([, label]) => `<th>${escapeHtml(label)}</th>`).join("")}</tr></thead>
    <tbody>${rowsHtml}</tbody>
  </table>
  <p class="foot">A dash means no minimum requirement is configured for that activity category. Use your browser's print dialog and choose <b>Save as PDF</b>.</p>
  <script>setTimeout(() => window.print(), 250);<\/script>
</body>
</html>`);
    popup.document.close();
  } catch (error) {
    try { popup?.close(); } catch (_) {}
    alert(error?.message || "Could not export the minimum requirements PDF.");
  } finally {
    exportBusy = false;
    button.disabled = false;
    button.textContent = originalText;
  }
}

function ensureResidentExportButton() {
  if (!document.querySelector(".minimum-resident-hero")) return;
  if (document.querySelector("[data-export-minimum-requirements-pdf]")) return;

  const button = document.createElement("button");
  button.type = "button";
  button.className = "btn secondary";
  button.dataset.exportMinimumRequirementsPdf = "1";
  button.textContent = "Export requirements PDF";
  button.addEventListener("click", () => void exportRequirementsPdf(button));

  const hero = document.querySelector(".minimum-resident-hero");
  const actions = document.createElement("div");
  actions.className = "inline-actions minimum-requirements-export-actions";
  actions.style.marginBottom = "10px";
  actions.appendChild(button);
  hero?.before(actions);
}

function applyEnhancements() {
  fixOwnerRequirementGrid();
  ensureResidentExportButton();
}

const content = document.querySelector("#content");
if (content) {
  new MutationObserver(() => applyEnhancements()).observe(content, { childList: true, subtree: true });
}
applyEnhancements();
