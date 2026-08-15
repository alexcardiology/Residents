import { sb } from "./supabase.js";

const RANKS = [
  ["professor", "Professor"],
  ["associate_professor", "Associate Professor"],
  ["lecturer", "Lecturer"],
  ["assistant_lecturer", "Assistant Lecturer"],
  ["senior_resident", "Senior Resident"],
  ["fellow", "Fellow"],
];
const rankLabel = (value) => RANKS.find(([key]) => key === value)?.[1] || "Set rank";
const escapeHtml = (value) => String(value ?? "").replace(/[&<>'"]/g, (char) => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"})[char]);
const unwrap = (result) => { if (result?.error) throw result.error; return result?.data; };

let isOwner = false;
let rankRows = [];
let rankMap = new Map();
let enhancing = false;
let lastWorkspaceSignature = "";

async function refreshRanks(force = false) {
  if (!isOwner) return [];
  if (!force && rankRows.length) return rankRows;
  rankRows = unwrap(await sb.rpc("owner_get_assessor_academic_ranks_v119")) || [];
  rankMap = new Map(rankRows.map((row) => [String(row.id), row]));
  return rankRows;
}

function hideRetiredAssignmentTools() {
  document.querySelectorAll('[data-go="owner-logbook-requirement-assessors"],[data-go="owner-prior-experience-assignments"],.audit-hierarchy-nav').forEach((node) => {
    node.hidden = true;
    node.setAttribute("aria-hidden", "true");
  });
}

function redirectRetiredRoutes() {
  const route = location.hash.replace(/^#/, "");
  if (["owner-logbook-requirement-assessors", "owner-prior-experience-assignments"].includes(route)) {
    location.hash = "owner-logbook-center";
  }
}

function toolCard(title, value, text, attrs = "", cls = "") {
  return `<button type="button" class="admin-logbook-tool ${cls}" ${attrs}><span>${escapeHtml(title)}</span><strong>${escapeHtml(value)}</strong><small>${escapeHtml(text)}</small></button>`;
}

function renderUnifiedLogbookWorkspace() {
  if (!isOwner) return;
  const title = String(document.querySelector("#title")?.textContent || "").trim();
  if (title !== "Logbook centre") return;
  const content = document.querySelector("#content");
  if (!content) return;
  const lead = content.querySelector(".lead");
  const oldGrid = content.querySelector(".hub-grid");
  if (!oldGrid || oldGrid.classList.contains("admin-logbook-unified")) return;
  const signature = `${title}:${oldGrid.childElementCount}`;
  if (signature === lastWorkspaceSignature && content.querySelector(".admin-logbook-unified")) return;
  lastWorkspaceSignature = signature;

  oldGrid.outerHTML = `<div class="admin-logbook-unified">
    <div class="admin-logbook-workflow-note"><b>One Logbooks workspace</b><span>The Audit hierarchy is now the only manual-audit assignment source. Old manual-by-manual assessor assignment tools are retired.</span></div>
    <section class="admin-logbook-group">
      <div class="admin-logbook-group-head"><span>01</span><div><h3>Resident e-logbooks</h3><p>Daily activity, approvals and follow-up.</p></div></div>
      <div class="admin-logbook-tools-grid">
        ${toolCard("Resident logbooks","Open","Review, export or reset resident logbooks",'data-go="logbook"')}
        ${toolCard("Logbook requests","Review","Senior, faculty and professor audit requests",'data-go="logbook-requests"')}
        ${toolCard("Pending requests","48h","Unanswered approvals and overdue follow-up",'data-go="owner-pending-requests"',"warning")}
        ${toolCard("Intervention audit","Fairness","Compare exposure, trials and outcomes by year",'data-go="owner-intervention-audit"')}
      </div>
    </section>
    <section class="admin-logbook-group governance">
      <div class="admin-logbook-group-head"><span>02</span><div><h3>Standards & audit governance</h3><p>Targets, hierarchy and assessor academic grades.</p></div></div>
      <div class="admin-logbook-tools-grid">
        ${toolCard("Minimum requirements","Targets","Edit Attended / Assisted / Unassisted / Supervise targets",'data-go="owner-logbook-requirements"',"accent")}
        ${toolCard("Audit hierarchy","4 fields","Drag faculty and professors into Intervention, EP, Imaging and Basic interventions",'class="audit-hierarchy-tile"',"hierarchy")}
        ${toolCard("Assessor academic ranks","6 grades","Professor · Associate Professor · Lecturer · Assistant Lecturer · Senior Resident · Fellow",'data-open-assessor-ranks',"rank")}
      </div>
    </section>
    <section class="admin-logbook-group">
      <div class="admin-logbook-group-head"><span>03</span><div><h3>Prior Experience</h3><p>Retrospective logbooks follow the same hierarchy after two senior verifiers.</p></div></div>
      <div class="admin-logbook-tools-grid">
        ${toolCard("Prior Experience status","Audit","Track draft, senior review, faculty audit, professor audit and final verification",'data-go="owner-prior-experience-status"')}
      </div>
    </section>
    <section class="admin-logbook-group compact">
      <div class="admin-logbook-group-head"><span>04</span><div><h3>Maintenance</h3><p>Administrative housekeeping only.</p></div></div>
      <div class="admin-logbook-tools-grid">
        ${toolCard("Message cleanup","Clean","Clear message copies without changing resident evidence",'data-go="message-cleanup"')}
      </div>
    </section>
  </div>`;

  if (lead) {
    const p = lead.querySelector("p");
    if (p) p.textContent = "All resident logbook activity, minimum standards, Prior Experience and audit governance in one Admin workspace.";
  }
}

function enhanceAccountsPage() {
  if (!isOwner) return;
  const title = String(document.querySelector("#title")?.textContent || "").trim();
  if (title !== "Accounts & roles") return;
  const content = document.querySelector("#content");
  if (!content || content.querySelector(".assessor-rank-account-strip")) return;
  const lead = content.querySelector(".lead");
  const strip = document.createElement("section");
  strip.className = "assessor-rank-account-strip";
  strip.innerHTML = `<div><b>Assessor academic rank</b><span>Every Assessor can be classified as Professor, Associate Professor, Lecturer, Assistant Lecturer, Senior Resident or Fellow.</span></div><button type="button" data-open-assessor-ranks>Manage ranks</button>`;
  if (lead?.nextSibling) content.insertBefore(strip, lead.nextSibling); else content.prepend(strip);
}

async function setRank(assessorId, academicRank, select = null) {
  const before = select?.value;
  if (select) select.disabled = true;
  try {
    const row = unwrap(await sb.rpc("owner_set_assessor_academic_rank_v119", { p_assessor_id: assessorId, p_academic_rank: academicRank }));
    const existing = rankMap.get(String(assessorId)) || {};
    const merged = { ...existing, ...row, academic_rank: academicRank };
    rankMap.set(String(assessorId), merged);
    rankRows = rankRows.map((item) => String(item.id) === String(assessorId) ? merged : item);
    updateRankVisuals(assessorId);
  } catch (error) {
    if (select) select.value = before || "";
    alert(error?.message || "Could not save academic rank.");
  } finally {
    if (select) select.disabled = false;
  }
}

function rankOptions(selected = "") {
  return `<option value="">Set rank…</option>${RANKS.map(([value,label]) => `<option value="${value}" ${value===selected?"selected":""}>${label}</option>`).join("")}`;
}

async function openRankManager() {
  await refreshRanks(true);
  document.querySelector("#assessorRankOverlay")?.remove();
  const overlay = document.createElement("div");
  overlay.id = "assessorRankOverlay";
  overlay.className = "assessor-rank-overlay";
  overlay.innerHTML = `<section class="assessor-rank-panel">
    <div class="assessor-rank-head"><div><small>ADMIN · FACULTY CLASSIFICATION</small><h2>Assessor academic ranks</h2><p>Rank is separate from the portal role “Assessor”. It controls how people are shown and validated in the audit hierarchy.</p></div><button type="button" data-close-assessor-ranks>×</button></div>
    <div class="assessor-rank-filter"><input type="search" placeholder="Search assessor…" data-rank-search><span>${rankRows.length} assessors</span></div>
    <div class="assessor-rank-list" data-rank-list>${rankRows.map((row) => `<label class="assessor-rank-row" data-rank-search-text="${escapeHtml(`${row.display_name||""} ${row.username||""} ${row.email||""}`.toLowerCase())}"><span class="assessor-rank-avatar">${escapeHtml((row.display_name||row.username||"?").trim().charAt(0).toUpperCase())}</span><span class="assessor-rank-person"><b>${escapeHtml(row.display_name||row.username||"Assessor")}</b><small>@${escapeHtml(row.username||"")}</small></span><select data-rank-assessor="${escapeHtml(row.id)}">${rankOptions(row.academic_rank||"")}</select></label>`).join("")}</div>
    <div class="assessor-rank-foot"><p><b>Hierarchy rule:</b> Professor / Associate Professor belong at the higher level. Lecturer / Assistant Lecturer belong at the first audit level. Senior Resident and Fellow remain valid assessor classifications but are not faculty hierarchy positions.</p><button type="button" data-close-assessor-ranks>Done</button></div>
  </section>`;
  document.body.appendChild(overlay);
}

function updateRankVisuals(assessorId = "") {
  document.querySelectorAll(".audit-person-card[data-audit-person]").forEach((card) => {
    const id = String(card.dataset.auditPerson || "");
    if (assessorId && id !== String(assessorId)) return;
    const row = rankMap.get(id);
    const chip = card.querySelector(".audit-rank-chip");
    if (chip) {
      chip.textContent = rankLabel(row?.academic_rank);
      chip.dataset.rank = row?.academic_rank || "unset";
    }
    const select = card.querySelector(".audit-inline-rank-select");
    if (select) select.value = row?.academic_rank || "";
  });
  validateHierarchyRankClasses();
}

function validateHierarchyRankClasses() {
  document.querySelectorAll(".audit-slot[data-audit-slot]").forEach((slot) => {
    slot.classList.remove("rank-invalid");
    const card = slot.querySelector(".audit-person-card[data-audit-person]");
    if (!card) return;
    const rank = rankMap.get(String(card.dataset.auditPerson || ""))?.academic_rank || "";
    const tier = slot.dataset.tier;
    const valid = tier === "lead_professor"
      ? ["professor","associate_professor"].includes(rank)
      : ["lecturer","assistant_lecturer"].includes(rank);
    if (!valid) slot.classList.add("rank-invalid");
  });
}

async function enhanceHierarchyOverlay() {
  if (!isOwner) return;
  const overlay = document.querySelector("#auditHierarchyOverlay");
  if (!overlay) return;
  await refreshRanks();

  const headText = overlay.querySelector(".audit-hierarchy-head-copy p");
  if (headText) headText.textContent = "Drag ranked assessors into the field hierarchy. This single hierarchy replaces the old manual-by-manual assessor assignment tools.";
  overlay.querySelectorAll(".audit-tier-heading").forEach((heading) => {
    const bold = heading.querySelector("b");
    const note = heading.querySelector("span");
    if (/professor/i.test(bold?.textContent || "")) {
      bold.textContent = "Higher final level · Professors / Associate Professors";
      if (note) note.textContent = "Maximum 2 · one final approval";
    } else if (bold) {
      bold.textContent = "First audit level · Lecturers / Assistant Lecturers";
      if (note) note.textContent = "2–8 assigned · two approvals per manual";
    }
  });
  const foot = overlay.querySelector(".audit-hierarchy-foot p");
  if (foot) foot.innerHTML = "<b>Single source of truth:</b> this hierarchy now supplies manual auditors for Prior Experience and minimum-requirement E-logbook auditing. Old per-manual assessor assignment is retired.";

  overlay.querySelectorAll(".audit-person-card[data-audit-person]").forEach((card) => {
    const id = String(card.dataset.auditPerson || "");
    const row = rankMap.get(id);
    if (!card.querySelector(".audit-rank-chip")) {
      const chip = document.createElement("span");
      chip.className = "audit-rank-chip";
      chip.textContent = rankLabel(row?.academic_rank);
      chip.dataset.rank = row?.academic_rank || "unset";
      card.querySelector(".audit-person-copy")?.appendChild(chip);
    }
    if (card.closest(".audit-assessor-list") && !card.querySelector(".audit-inline-rank-select")) {
      const select = document.createElement("select");
      select.className = "audit-inline-rank-select";
      select.dataset.rankAssessor = id;
      select.innerHTML = rankOptions(row?.academic_rank || "");
      select.addEventListener("pointerdown", (event) => event.stopPropagation());
      select.addEventListener("click", (event) => event.stopPropagation());
      card.appendChild(select);
    }
  });
  validateHierarchyRankClasses();
}

function hierarchyRankProblems() {
  const problems = [];
  document.querySelectorAll("#auditHierarchyOverlay .audit-slot[data-audit-slot]").forEach((slot) => {
    const card = slot.querySelector(".audit-person-card[data-audit-person]");
    if (!card) return;
    const id = String(card.dataset.auditPerson || "");
    const row = rankMap.get(id) || {};
    const rank = row.academic_rank || "";
    const name = row.display_name || card.querySelector("b")?.textContent || "Assessor";
    if (slot.dataset.tier === "lead_professor") {
      if (!["professor","associate_professor"].includes(rank)) problems.push(`${name}: top level requires Professor or Associate Professor.`);
    } else if (!["lecturer","assistant_lecturer"].includes(rank)) {
      problems.push(`${name}: first audit level requires Lecturer or Assistant Lecturer.`);
    }
  });
  return [...new Set(problems)];
}

function installEvents() {
  document.addEventListener("click", async (event) => {
    if (event.target.closest("[data-open-assessor-ranks]")) {
      event.preventDefault();
      try { await openRankManager(); } catch (error) { alert(error?.message || "Could not open assessor ranks."); }
      return;
    }
    if (event.target.closest("[data-close-assessor-ranks]")) {
      event.preventDefault();
      document.querySelector("#assessorRankOverlay")?.remove();
    }
  });

  document.addEventListener("change", (event) => {
    const select = event.target.closest("[data-rank-assessor]");
    if (!select) return;
    const value = String(select.value || "");
    if (!value) return;
    void setRank(select.dataset.rankAssessor, value, select);
  });

  document.addEventListener("input", (event) => {
    const input = event.target.closest("[data-rank-search]");
    if (!input) return;
    const q = String(input.value || "").trim().toLowerCase();
    document.querySelectorAll(".assessor-rank-row").forEach((row) => {
      row.hidden = Boolean(q && !(row.dataset.rankSearchText || "").includes(q));
    });
  });

  document.addEventListener("click", (event) => {
    const save = event.target.closest("#auditHierarchyOverlay [data-save-audit-hierarchy]");
    if (!save) return;
    const problems = hierarchyRankProblems();
    if (!problems.length) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    alert(`Please correct academic ranks before saving:\n\n${problems.join("\n")}`);
  }, true);

  window.addEventListener("hashchange", redirectRetiredRoutes);
}

async function enhance() {
  if (!isOwner || enhancing) return;
  enhancing = true;
  try {
    hideRetiredAssignmentTools();
    redirectRetiredRoutes();
    renderUnifiedLogbookWorkspace();
    enhanceAccountsPage();
    await enhanceHierarchyOverlay();
  } finally {
    enhancing = false;
  }
}

try {
  const { data: authData } = await sb.auth.getSession();
  const uid = authData?.session?.user?.id;
  if (uid) {
    const { data: profile } = await sb.from("profiles").select("role").eq("id", uid).single();
    isOwner = profile?.role === "owner";
  }
} catch (_) {}

if (isOwner) {
  installEvents();
  const observer = new MutationObserver(() => { void enhance(); });
  observer.observe(document.documentElement, { childList: true, subtree: true });
  setInterval(() => { void enhance(); }, 700);
  void enhance();
}
