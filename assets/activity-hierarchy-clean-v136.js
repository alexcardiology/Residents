const MODE_OPTIONS = [
  { value: "attended", label: "Attended", icon: "👁" },
  { value: "assisted", label: "Performed assisted", icon: "🤝" },
  { value: "solo_unguided", label: "Performed unassisted", icon: "🩺" },
  { value: "supervised", label: "Supervised", icon: "👥" },
];

let timer = 0;
const TEXT_REPLACEMENTS = [
  [/Performed with assistance/gi, "Performed assisted"],
  [/Performed solo under guidance/gi, "Performed assisted"],
  [/Performed solo without guidance/gi, "Performed unassisted"],
  [/Supervised another trainee/gi, "Supervised"],
];

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
  root.querySelectorAll("th").forEach((node) => {
    const text = String(node.textContent || "").replace(/\s+/g, " ").trim();
    if (text === "Supervise") node.textContent = "Supervised";
  });

  const scopes = [root.querySelector?.("#content"), root.querySelector?.("#modalBody")].filter(Boolean);
  scopes.forEach((scope) => {
    const walker = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach((node) => {
      const parent = node.parentElement;
      if (!parent || ["SCRIPT", "STYLE", "TEXTAREA", "OPTION"].includes(parent.tagName)) return;
      let value = node.nodeValue || "";
      let next = value;
      TEXT_REPLACEMENTS.forEach(([pattern, replacement]) => { next = next.replace(pattern, replacement); });
      if (next !== value) node.nodeValue = next;
    });
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
