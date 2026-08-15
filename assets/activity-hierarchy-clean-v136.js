const MODE_OPTIONS = [
  { value: "attended", label: "Attended", icon: "👁" },
  { value: "assisted", label: "Performed assisted", icon: "🤝" },
  { value: "solo_unguided", label: "Performed unassisted", icon: "🩺" },
  { value: "supervised", label: "Supervised", icon: "👥" },
];

let timer = 0;

function standardizeParticipationSelector() {
  const container = document.querySelector("#logbookForm .participation-options");
  if (!container || container.dataset.fourModesV136 === "1") return;
  const selected = container.querySelector('input[name="participation_mode"]:checked')?.value || "";
  const normalizedSelected = selected === "solo_guided" ? "assisted" : selected === "solo" ? "solo_unguided" : selected;
  container.innerHTML = MODE_OPTIONS.map((mode) => `
    <label class="standard-participation-option">
      <input type="radio" name="participation_mode" value="${mode.value}" required ${normalizedSelected === mode.value ? "checked" : ""}>
      <span class="standard-mode-icon" aria-hidden="true">${mode.icon}</span>
      <span>${mode.label}</span>
    </label>`).join("");
  container.dataset.fourModesV136 = "1";
}

function normalizeParticipationText(root = document) {
  const replacements = new Map([
    ["Performed with assistance", "Performed assisted"],
    ["Performed solo under guidance", "Performed assisted"],
    ["Performed solo without guidance", "Performed unassisted"],
    ["Supervised another trainee", "Supervised"],
    ["Supervise", "Supervised"],
  ]);
  root.querySelectorAll("td,th,.tag,.activity-mode-label-target,.minimum-mode-label,.requirement-mode-label").forEach((node) => {
    if (node.children.length && !node.matches("th")) return;
    const text = String(node.textContent || "").replace(/\s+/g, " ").trim();
    const next = replacements.get(text);
    if (next) node.textContent = next;
  });
}

function cleanHierarchy() {
  const overlay = document.querySelector("#auditHierarchyOverlay");
  if (!overlay) return;
  overlay.classList.add("hierarchy-clean-v136");

  overlay.querySelectorAll(".audit-rank-chip,.audit-inline-rank-select").forEach((node) => node.remove());
  overlay.querySelectorAll(".audit-slot.rank-invalid").forEach((slot) => slot.classList.remove("rank-invalid"));
  overlay.querySelectorAll(".audit-person-copy small").forEach((node) => node.remove());

  const bankHelp = overlay.querySelector(".audit-assessor-bank-head > span");
  if (bankHelp) bankHelp.textContent = "Drag a name into the correct hierarchy position. On touch devices, tap the name then tap the destination slot.";

  const headCopy = overlay.querySelector(".audit-hierarchy-head-copy p");
  if (headCopy) headCopy.textContent = "Drag assessors into the correct field and hierarchy level. Academic ranks are managed separately from Accounts.";
}

function enhance() {
  standardizeParticipationSelector();
  normalizeParticipationText(document);
  cleanHierarchy();
}

function schedule() {
  clearTimeout(timer);
  timer = setTimeout(enhance, 90);
}

new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true });
window.addEventListener("hashchange", schedule);
setInterval(enhance, 4000);
enhance();
