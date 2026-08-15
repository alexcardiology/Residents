import { sb } from "./supabase.js";

const MODES = [
  ["attended", "Attended"],
  ["assisted", "Performed assisted"],
  ["solo_unguided", "Performed unassisted"],
  ["supervised", "Supervise"],
];

const escapeHtml = (value) => String(value ?? "").replace(/[&<>'"]/g, (char) => ({
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  "'": "&#39;",
  '"': "&quot;",
})[char]);

function buildRows(progress = []) {
  return (progress || [])
    .map((row) => {
      const targets = new Map();
      for (const target of Array.isArray(row?.targets) ? row.targets : []) {
        const mode = String(target?.participation_mode || "");
        if (!MODES.some(([allowed]) => allowed === mode)) continue;
        targets.set(mode, {
          minimum: Math.max(0, Number(target?.minimum_required || 0)),
          achievement: Math.max(0, Number(target?.verified_count || 0)),
        });
      }
      return {
        name: String(row?.intervention_name || "").trim(),
        sort: Number(row?.sort_order || 0),
        targets,
      };
    })
    .filter((row) => row.name && MODES.some(([mode]) => (row.targets.get(mode)?.minimum || 0) > 0))
    .sort((a, b) => a.sort - b.sort || a.name.localeCompare(b.name));
}

function targetCell(target) {
  const minimum = Math.max(0, Number(target?.minimum || 0));
  return minimum > 0
    ? `<span class="resident-target-number">${escapeHtml(minimum)}</span>`
    : '<span class="resident-requirement-none">—</span>';
}

function achievementCell(target) {
  const minimum = Math.max(0, Number(target?.minimum || 0));
  if (minimum <= 0) return '<span class="resident-requirement-none">—</span>';
  const achievement = Math.max(0, Number(target?.achievement || 0));
  const state = achievement >= minimum ? "is-met" : achievement > 0 ? "is-progress" : "is-zero";
  return `<span class="resident-achievement-number ${state}">${escapeHtml(achievement)}</span>`;
}

function renderTable(rows, showAchievements) {
  if (!rows.length) {
    return '<div class="panel-empty">No minimum procedural requirements are configured for this residency year.</div>';
  }

  const header = showAchievements
    ? `<thead>
        <tr class="resident-requirement-group-head">
          <th rowspan="2" class="resident-intervention-head">Intervention</th>
          ${MODES.map(([, label]) => `<th colspan="2" class="resident-mode-head">${escapeHtml(label)}</th>`).join("")}
        </tr>
        <tr class="resident-requirement-subhead">
          ${MODES.map(() => '<th class="resident-achievement-head">Achievement</th><th class="resident-target-head">Target</th>').join("")}
        </tr>
      </thead>`
    : `<thead><tr class="resident-requirement-group-head">
        <th class="resident-intervention-head">Intervention</th>
        ${MODES.map(([, label]) => `<th class="resident-mode-head">${escapeHtml(label)}</th>`).join("")}
      </tr></thead>`;

  const body = rows.map((row) => {
    const cells = MODES.map(([mode]) => {
      const target = row.targets.get(mode) || { minimum: 0, achievement: 0 };
      if (!showAchievements) return `<td class="resident-target-cell">${targetCell(target)}</td>`;
      return `<td class="resident-achievement-cell">${achievementCell(target)}</td><td class="resident-target-cell">${targetCell(target)}</td>`;
    }).join("");
    return `<tr><th scope="row" class="resident-intervention-cell">${escapeHtml(row.name)}</th>${cells}</tr>`;
  }).join("");

  return `<div class="table-scroll resident-requirements-table-scroll">
    <table class="table resident-requirements-matrix-table ${showAchievements ? "show-achievements" : "targets-only"}">
      ${header}
      <tbody>${body}</tbody>
    </table>
  </div>`;
}

function renderMatrix(card, rows) {
  const oldMatrix = card.querySelector("[data-resident-requirements-matrix]");
  if (oldMatrix) oldMatrix.remove();

  const oldTable = card.querySelector(".resident-minimum-table")?.closest(".table-scroll");
  if (oldTable) oldTable.remove();

  const matrix = document.createElement("section");
  matrix.className = "resident-requirements-matrix";
  matrix.dataset.residentRequirementsMatrix = "1";
  matrix.innerHTML = `
    <div class="resident-requirements-toolbar">
      <div class="resident-requirements-toolbar-copy">
        <b>Minimum requirements</b>
        <span>One intervention per row · targets shown by activity</span>
      </div>
      <label class="resident-achievements-toggle">
        <span class="resident-achievements-toggle-copy">
          <b>Show my achievements</b>
          <small>Compare verified achievement with target</small>
        </span>
        <input type="checkbox" data-resident-achievements-toggle aria-label="Show my achievements">
        <span class="resident-achievements-switch" aria-hidden="true"></span>
      </label>
    </div>
    <div data-resident-requirements-table>${renderTable(rows, false)}</div>`;

  const note = card.querySelector(".minimum-rules-note");
  if (note) note.insertAdjacentElement("afterend", matrix);
  else card.prepend(matrix);

  matrix.querySelector("[data-resident-achievements-toggle]")?.addEventListener("change", (event) => {
    const showAchievements = Boolean(event.currentTarget.checked);
    matrix.classList.toggle("achievements-visible", showAchievements);
    const host = matrix.querySelector("[data-resident-requirements-table]");
    if (host) host.innerHTML = renderTable(rows, showAchievements);
  });
}

let applying = false;

async function applyResidentMatrix() {
  if (applying) return;
  const hero = document.querySelector(".minimum-resident-hero");
  const card = document.querySelector(".minimum-resident-card");
  if (!hero || !card) return;
  if (hero.dataset.fourCategoryEnhanced !== "ready") return;
  if (card.dataset.residentMatrixVersion === "114") return;

  applying = true;
  card.dataset.residentMatrixVersion = "loading";
  try {
    const { data, error } = await sb.rpc("get_logbook_minimum_progress_v1096", { p_resident_id: null });
    if (error) throw error;
    const rows = buildRows(data || []);
    renderMatrix(card, rows);
    card.dataset.residentMatrixVersion = "114";
  } catch (error) {
    console.error("Resident minimum-requirement matrix failed", error);
    delete card.dataset.residentMatrixVersion;
  } finally {
    applying = false;
  }
}

let scheduled = false;
function scheduleApply() {
  if (scheduled) return;
  scheduled = true;
  requestAnimationFrame(() => {
    scheduled = false;
    void applyResidentMatrix();
  });
}

const content = document.querySelector("#content");
if (content) {
  new MutationObserver(scheduleApply).observe(content, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["data-four-category-enhanced"],
  });
}

document.addEventListener("DOMContentLoaded", scheduleApply, { once: true });
scheduleApply();
