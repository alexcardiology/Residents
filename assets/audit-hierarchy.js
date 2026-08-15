import { sb } from "./supabase.js";

const FIELD_ORDER = ["intervention", "ep", "imaging", "basic_interventions"];
let isOwner = false;
let hierarchyData = null;
let hierarchyState = new Map();
let selectedPersonId = "";
let overlay = null;
let dragPersonId = "";

const escapeHtml = (value) => String(value ?? "").replace(/[&<>'"]/g, (char) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;",
})[char]);

const unwrap = (result) => {
  if (result?.error) throw result.error;
  return result?.data;
};

const initials = (name) => String(name || "?")
  .replace(/\b(professor|prof|dr)\.?\b/gi, "")
  .trim()
  .split(/\s+/)
  .filter(Boolean)
  .slice(0, 2)
  .map((part) => part.charAt(0).toUpperCase())
  .join("") || "?";

function personById(id) {
  return (hierarchyData?.people || []).find((person) => String(person.id) === String(id));
}

function createEmptyState() {
  const next = new Map();
  for (const field of hierarchyData?.fields || []) {
    const state = {
      lead_professor: Array(2).fill(null),
      faculty_auditor: Array(8).fill(null),
    };
    for (const assignment of field.assignments || []) {
      const tier = assignment.tier;
      const index = Math.max(0, Number(assignment.position || 1) - 1);
      if (state[tier] && index < state[tier].length) state[tier][index] = String(assignment.assessor_id);
    }
    next.set(field.field_key, state);
  }
  hierarchyState = next;
}

function personCard(person, removable = false) {
  if (!person) return "";
  const selected = selectedPersonId === String(person.id) ? " is-selected" : "";
  const avatar = person.avatar_url
    ? `<span class="audit-person-avatar"><img src="${escapeHtml(person.avatar_url)}" alt=""></span>`
    : `<span class="audit-person-avatar">${escapeHtml(initials(person.display_name || person.username))}</span>`;
  return `<div class="audit-person-card${selected}" draggable="true" data-audit-person="${escapeHtml(person.id)}" title="Drag to a hierarchy slot">
    ${avatar}
    <span class="audit-person-copy"><b>${escapeHtml(person.display_name || person.username || "Assessor")}</b><small>@${escapeHtml(person.username || "assessor")}</small></span>
    ${removable ? '<button type="button" class="audit-remove-slot" data-remove-audit-person title="Remove from this position">×</button>' : '<span class="audit-drag-grip" aria-hidden="true">⋮⋮</span>'}
  </div>`;
}

function fieldCounts(fieldKey) {
  const state = hierarchyState.get(fieldKey);
  const lead = state?.lead_professor?.filter(Boolean).length || 0;
  const faculty = state?.faculty_auditor?.filter(Boolean).length || 0;
  return { lead, faculty, total: lead + faculty };
}

function fieldStatus(fieldKey) {
  const { lead, faculty, total } = fieldCounts(fieldKey);
  if (!total) return { cls: "empty", label: "Not configured" };
  if (lead >= 1 && lead <= 2 && faculty >= 2 && faculty <= 8) return { cls: "ready", label: "Hierarchy ready" };
  return { cls: "", label: "Needs completion" };
}

function slotHtml(fieldKey, tier, position) {
  const personId = hierarchyState.get(fieldKey)?.[tier]?.[position - 1];
  const person = personId ? personById(personId) : null;
  const emptyLabel = tier === "lead_professor" ? `Professor ${position}` : `Faculty ${position}`;
  return `<div class="audit-slot ${person ? "" : "empty-slot"}" data-audit-slot data-field="${escapeHtml(fieldKey)}" data-tier="${escapeHtml(tier)}" data-position="${position}">
    ${person ? personCard(person, true) : `<span>${emptyLabel}<br><small>Drop assessor here</small></span>`}
  </div>`;
}

function renderField(field) {
  const status = fieldStatus(field.field_key);
  const counts = fieldCounts(field.field_key);
  const manuals = Array.isArray(field.manuals) ? field.manuals : [];
  return `<section class="audit-field-card" data-audit-field-card="${escapeHtml(field.field_key)}">
    <div class="audit-field-head">
      <div><h3>${escapeHtml(field.field_label)}</h3><p>${counts.lead}/2 professor${counts.lead === 1 ? "" : "s"} · ${counts.faculty}/8 assistant lecturers / lecturers</p></div>
      <span class="audit-field-status ${status.cls}">${escapeHtml(status.label)}</span>
    </div>
    <div class="audit-manuals"><b>Manuals covered by this field</b><div class="audit-manual-chips">${manuals.map((manual) => `<span class="audit-manual-chip">${escapeHtml(manual.intervention_name)}</span>`).join("") || '<span class="audit-manual-chip">No manuals mapped</span>'}</div></div>
    <div class="audit-tier">
      <div class="audit-tier-heading"><b>Top of hierarchy · Professors</b><span>Maximum 2</span></div>
      <div class="audit-slot-grid">${[1,2].map((position) => slotHtml(field.field_key, "lead_professor", position)).join("")}</div>
    </div>
    <div class="audit-tier">
      <div class="audit-tier-heading"><b>Second level · Assistant lecturers & lecturers</b><span>2–8 required when configured</span></div>
      <div class="audit-slot-grid faculty">${[1,2,3,4,5,6,7,8].map((position) => slotHtml(field.field_key, "faculty_auditor", position)).join("")}</div>
      ${counts.total ? `<button type="button" class="audit-field-clear" data-clear-audit-field="${escapeHtml(field.field_key)}">Clear this field hierarchy</button>` : ""}
    </div>
  </section>`;
}

function renderOverlay() {
  if (!overlay || !hierarchyData) return;
  const people = Array.isArray(hierarchyData.people) ? hierarchyData.people : [];
  const fields = [...(hierarchyData.fields || [])].sort((a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0));
  overlay.innerHTML = `
    <div class="audit-hierarchy-head">
      <div class="audit-hierarchy-head-copy"><small>ADMIN · LOGBOOK AUDIT GOVERNANCE</small><h2>Manual & Logbook Audit Hierarchy</h2><p>Drag assessors from the left into the correct field. Each configured field has up to 2 professors above 2–8 assistant lecturers / lecturers.</p></div>
      <button type="button" class="audit-hierarchy-close" data-close-audit-hierarchy aria-label="Close">×</button>
    </div>
    <div class="audit-hierarchy-body">
      <aside class="audit-assessor-bank">
        <div class="audit-assessor-bank-head"><b>Assessors</b><span>Drag a person into any hierarchy slot. On touch devices, tap a person then tap the destination slot.</span><input class="audit-assessor-search" type="search" placeholder="Search assessors…" data-audit-search></div>
        <div class="audit-assessor-list" data-audit-people-list>${people.map((person) => personCard(person)).join("")}</div>
      </aside>
      <main class="audit-fields-scroll"><div class="audit-fields-grid">${fields.map(renderField).join("")}</div></main>
    </div>
    <div class="audit-hierarchy-foot">
      <p><b>Audit chain:</b> field faculty auditors perform the working audit; the professor level sits above them for senior oversight. A field cannot be saved as configured with fewer than 2 second-level auditors.</p>
      <div class="audit-hierarchy-foot-actions"><button type="button" class="btn secondary" data-close-audit-hierarchy>Close</button><button type="button" class="btn audit-save-button" data-save-audit-hierarchy>Save hierarchy</button></div>
    </div>`;
}

function assignPerson(personId, fieldKey, tier, position) {
  const state = hierarchyState.get(fieldKey);
  if (!state || !state[tier] || !personById(personId)) return;
  for (const key of ["lead_professor", "faculty_auditor"]) {
    state[key] = state[key].map((value) => String(value || "") === String(personId) ? null : value);
  }
  state[tier][position - 1] = String(personId);
  selectedPersonId = "";
  renderOverlay();
}

function removeSlot(fieldKey, tier, position) {
  const state = hierarchyState.get(fieldKey);
  if (!state?.[tier]) return;
  state[tier][position - 1] = null;
  renderOverlay();
}

function clearField(fieldKey) {
  const state = hierarchyState.get(fieldKey);
  if (!state) return;
  state.lead_professor = Array(2).fill(null);
  state.faculty_auditor = Array(8).fill(null);
  renderOverlay();
}

function collectAssignments() {
  const rows = [];
  for (const [fieldKey, state] of hierarchyState.entries()) {
    for (const tier of ["lead_professor", "faculty_auditor"]) {
      state[tier].forEach((personId, index) => {
        if (!personId) return;
        rows.push({ field_key: fieldKey, assessor_id: personId, tier, position: index + 1 });
      });
    }
  }
  return rows;
}

function validateHierarchy() {
  const problems = [];
  for (const field of hierarchyData?.fields || []) {
    const { lead, faculty, total } = fieldCounts(field.field_key);
    if (!total) continue;
    if (lead < 1) problems.push(`${field.field_label}: add at least one professor at the top.`);
    if (faculty < 2) problems.push(`${field.field_label}: add at least two assistant lecturers / lecturers.`);
  }
  return problems;
}

function showOverlayToast(message) {
  const old = document.querySelector(".audit-hierarchy-toast");
  old?.remove();
  const node = document.createElement("div");
  node.className = "audit-hierarchy-toast";
  node.textContent = message;
  document.body.appendChild(node);
  setTimeout(() => node.remove(), 2400);
}

async function saveHierarchy(button) {
  const problems = validateHierarchy();
  if (problems.length) {
    alert(`Please complete the hierarchy first:\n\n${problems.join("\n")}`);
    return;
  }
  const original = button.textContent;
  button.disabled = true;
  button.textContent = "Saving…";
  try {
    hierarchyData = unwrap(await sb.rpc("owner_save_logbook_audit_hierarchy_v116", { p_assignments: collectAssignments() }));
    createEmptyState();
    renderOverlay();
    showOverlayToast("Audit hierarchy saved");
  } catch (error) {
    alert(error?.message || "Could not save the audit hierarchy.");
  } finally {
    const current = document.querySelector("[data-save-audit-hierarchy]");
    if (current) { current.disabled = false; current.textContent = original; }
  }
}

async function openHierarchy() {
  try {
    hierarchyData = unwrap(await sb.rpc("owner_get_logbook_audit_hierarchy_v116"));
    createEmptyState();
    selectedPersonId = "";
    overlay?.remove();
    overlay = document.createElement("div");
    overlay.className = "audit-hierarchy-overlay";
    overlay.id = "auditHierarchyOverlay";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    document.body.appendChild(overlay);
    renderOverlay();
  } catch (error) {
    alert(error?.message || "Could not open the audit hierarchy.");
  }
}

function closeHierarchy() {
  overlay?.remove();
  overlay = null;
  selectedPersonId = "";
}

function ensureAblationManual() {
  document.querySelectorAll('select[name="procedure_name"]').forEach((select) => {
    if ([...select.options].some((option) => option.textContent.trim().toLowerCase() === "ablation")) return;
    const option = document.createElement("option");
    option.value = "Ablation";
    option.textContent = "Ablation";
    const reference = [...select.options].find((item) => item.textContent.trim() === "Pericardiocentesis");
    if (reference) select.insertBefore(option, reference); else select.appendChild(option);
  });

  const priorRows = [...document.querySelectorAll("tr[data-prior-intervention]")];
  if (priorRows.length && !priorRows.some((row) => String(row.dataset.priorIntervention || "").toLowerCase() === "ablation")) {
    const row = document.createElement("tr");
    row.dataset.priorIntervention = "Ablation";
    row.innerHTML = '<td><b>Ablation</b></td><td><input class="prior-count-input" type="number" min="0" max="9999" value="0" data-prior-count="attended_count"></td><td><input class="prior-count-input" type="number" min="0" max="9999" value="0" data-prior-count="assisted_count"></td><td><input class="prior-count-input" type="number" min="0" max="9999" value="0" data-prior-count="solo_guided_count"></td><td><input class="prior-count-input" type="number" min="0" max="9999" value="0" data-prior-count="solo_unguided_count"></td><td><input value="" data-prior-intervention-notes placeholder="Optional"></td>';
    const reference = priorRows.find((item) => String(item.dataset.priorIntervention || "") === "Pericardiocentesis");
    if (reference) reference.before(row); else priorRows.at(-1)?.after(row);
  }
}

function ensureOwnerEntrypoints() {
  if (!isOwner) return;
  const nav = document.querySelector("#nav");
  if (nav && !nav.querySelector(".audit-hierarchy-nav")) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "audit-hierarchy-nav";
    button.innerHTML = "<span>Audit hierarchy</span>";
    const logbooksButton = [...nav.querySelectorAll("button")].find((item) => /logbooks/i.test(item.textContent || ""));
    if (logbooksButton?.nextSibling) nav.insertBefore(button, logbooksButton.nextSibling); else nav.appendChild(button);
  }

  const content = document.querySelector("#content");
  const titleText = String(document.querySelector("#title")?.textContent || "").toLowerCase();
  if (content && titleText.includes("logbook centre") && !content.querySelector(".audit-hierarchy-tile")) {
    const grid = content.querySelector(".hub-grid") || content.querySelector(".dashboard-grid");
    if (grid) {
      const tile = document.createElement("button");
      tile.type = "button";
      tile.className = "dashboard-tile audit-hierarchy-tile";
      tile.innerHTML = "<span>Audit hierarchy</span><strong>4 fields</strong><small>Drag professors and faculty into the audit chain</small>";
      grid.appendChild(tile);
    }
  }
}

function applyRuntimeEnhancements() {
  ensureAblationManual();
  ensureOwnerEntrypoints();
}

document.addEventListener("click", (event) => {
  if (event.target.closest(".audit-hierarchy-nav, .audit-hierarchy-tile")) {
    event.preventDefault();
    void openHierarchy();
    return;
  }
  if (event.target.closest("[data-close-audit-hierarchy]")) {
    event.preventDefault();
    closeHierarchy();
    return;
  }
  const removeButton = event.target.closest("[data-remove-audit-person]");
  if (removeButton) {
    event.preventDefault();
    event.stopPropagation();
    const slot = removeButton.closest("[data-audit-slot]");
    if (slot) removeSlot(slot.dataset.field, slot.dataset.tier, Number(slot.dataset.position));
    return;
  }
  const clearButton = event.target.closest("[data-clear-audit-field]");
  if (clearButton) {
    event.preventDefault();
    clearField(clearButton.dataset.clearAuditField);
    return;
  }
  const saveButton = event.target.closest("[data-save-audit-hierarchy]");
  if (saveButton) {
    event.preventDefault();
    void saveHierarchy(saveButton);
    return;
  }
  const personCardNode = event.target.closest(".audit-assessor-list .audit-person-card");
  if (personCardNode) {
    event.preventDefault();
    selectedPersonId = String(personCardNode.dataset.auditPerson || "");
    renderOverlay();
    return;
  }
  const emptySlot = event.target.closest("[data-audit-slot].empty-slot");
  if (emptySlot && selectedPersonId) {
    event.preventDefault();
    assignPerson(selectedPersonId, emptySlot.dataset.field, emptySlot.dataset.tier, Number(emptySlot.dataset.position));
  }
}, true);

document.addEventListener("input", (event) => {
  const search = event.target.closest("[data-audit-search]");
  if (!search) return;
  const query = String(search.value || "").trim().toLowerCase();
  document.querySelectorAll(".audit-assessor-list .audit-person-card").forEach((card) => {
    card.hidden = query && !String(card.textContent || "").toLowerCase().includes(query);
  });
});

document.addEventListener("dragstart", (event) => {
  const card = event.target.closest("[data-audit-person]");
  if (!card) return;
  dragPersonId = String(card.dataset.auditPerson || "");
  try { event.dataTransfer.setData("text/plain", dragPersonId); event.dataTransfer.effectAllowed = "move"; } catch (_) {}
});

document.addEventListener("dragover", (event) => {
  const slot = event.target.closest("[data-audit-slot]");
  if (!slot) return;
  event.preventDefault();
  slot.classList.add("drag-over");
  try { event.dataTransfer.dropEffect = "move"; } catch (_) {}
});

document.addEventListener("dragleave", (event) => {
  const slot = event.target.closest("[data-audit-slot]");
  slot?.classList.remove("drag-over");
});

document.addEventListener("drop", (event) => {
  const slot = event.target.closest("[data-audit-slot]");
  if (!slot) return;
  event.preventDefault();
  slot.classList.remove("drag-over");
  let personId = dragPersonId;
  try { personId = event.dataTransfer.getData("text/plain") || personId; } catch (_) {}
  if (personId) assignPerson(personId, slot.dataset.field, slot.dataset.tier, Number(slot.dataset.position));
  dragPersonId = "";
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && overlay) closeHierarchy();
});

async function resolveOwner() {
  try {
    const { data: sessionData } = await sb.auth.getSession();
    const userId = sessionData?.session?.user?.id;
    if (!userId) return false;
    const { data: profile, error } = await sb.from("profiles").select("role,is_active").eq("id", userId).maybeSingle();
    if (error) throw error;
    return String(profile?.role || "").toLowerCase() === "owner" && profile?.is_active !== false;
  } catch (_) {
    return false;
  }
}

isOwner = await resolveOwner();
applyRuntimeEnhancements();
const content = document.querySelector("#content");
if (content) new MutationObserver(applyRuntimeEnhancements).observe(content, { childList: true, subtree: true });
const nav = document.querySelector("#nav");
if (nav) new MutationObserver(applyRuntimeEnhancements).observe(nav, { childList: true, subtree: true });

sb.auth.onAuthStateChange(async () => {
  isOwner = await resolveOwner();
  if (!isOwner) closeHierarchy();
  setTimeout(applyRuntimeEnhancements, 0);
});
