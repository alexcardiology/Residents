import { sb } from "./supabase.js";

let ownerReady = false;
let deleteBusy = false;

const route = () => String(location.hash || "#dashboard").replace(/^#/, "").split("?")[0] || "dashboard";

function ensureStyle() {
  if (document.querySelector("#adminLogbookDeleteStyleV160")) return;
  const style = document.createElement("style");
  style.id = "adminLogbookDeleteStyleV160";
  style.textContent = `
    html.admin-red-theme .admin-logbook-delete-v160,
    body.admin-red-theme .admin-logbook-delete-v160,
    .admin-logbook-delete-v160{
      margin-left:8px!important;
      background:#fff1f2!important;
      color:#111827!important;
      -webkit-text-fill-color:#111827!important;
      border:1px solid #fecdd3!important;
      font-weight:800!important;
      text-shadow:none!important;
    }
    html.admin-red-theme .admin-logbook-delete-v160:hover,
    body.admin-red-theme .admin-logbook-delete-v160:hover,
    .admin-logbook-delete-v160:hover{
      background:#ffe4e6!important;
      color:#111827!important;
      -webkit-text-fill-color:#111827!important;
      border-color:#fda4af!important;
    }
    html.admin-red-theme .admin-logbook-delete-v160[disabled],
    body.admin-red-theme .admin-logbook-delete-v160[disabled],
    .admin-logbook-delete-v160[disabled]{
      opacity:.55!important;
      cursor:wait!important;
      color:#111827!important;
      -webkit-text-fill-color:#111827!important;
    }
    .logbook-history-table-card td[data-label="Actions"]{white-space:nowrap}
  `;
  document.head.appendChild(style);
}

function forceBlackDeleteText(button) {
  if (!button) return;
  button.style.setProperty("color", "#111827", "important");
  button.style.setProperty("-webkit-text-fill-color", "#111827", "important");
  button.style.setProperty("text-shadow", "none", "important");
}

function addDeleteButtons() {
  if (!ownerReady || route() !== "logbook") return;
  const content = document.querySelector("#content");
  if (!content) return;
  content.querySelectorAll(".logbook-history-table-card tbody tr").forEach((row) => {
    const details = row.querySelector("[data-logbook-detail]");
    if (!details) return;
    const entryId = String(details.getAttribute("data-logbook-detail") || "").trim();
    if (!entryId) return;
    const existing = row.querySelector("[data-owner-delete-logbook-entry]");
    if (existing) {
      forceBlackDeleteText(existing);
      return;
    }
    const button = document.createElement("button");
    button.type = "button";
    button.className = "btn small admin-logbook-delete-v160";
    button.dataset.ownerDeleteLogbookEntry = entryId;
    button.textContent = "Delete";
    button.title = "Admin only: permanently delete this logbook entry";
    forceBlackDeleteText(button);
    details.insertAdjacentElement("afterend", button);
  });
}

function cellText(row, label) {
  return String(row?.querySelector(`td[data-label="${label}"]`)?.innerText || "").replace(/\s+/g, " ").trim() || "—";
}

function showToast(message) {
  const toast = document.querySelector("#toast");
  if (!toast) return;
  toast.textContent = message;
  toast.style.display = "block";
  setTimeout(() => { toast.style.display = "none"; }, 2200);
}

async function deleteEntry(button) {
  if (deleteBusy) return;
  const entryId = String(button.dataset.ownerDeleteLogbookEntry || "").trim();
  const row = button.closest("tr");
  if (!entryId || !row) return;

  const resident = cellText(row, "Resident");
  const activity = cellText(row, "Activity");
  const date = cellText(row, "Date");
  const status = cellText(row, "Status");
  const ok = window.confirm(
    `Delete this resident logbook entry?\n\nResident: ${resident}\nActivity: ${activity}\nDate: ${date}\nStatus: ${status}\n\nThis permanently removes the logbook record and its linked approval/reconsideration history. This cannot be undone.`
  );
  if (!ok) return;

  deleteBusy = true;
  button.disabled = true;
  const oldText = button.textContent;
  button.textContent = "Deleting…";
  forceBlackDeleteText(button);
  try {
    const { error } = await sb.rpc("owner_delete_resident_logbook_entry_v160", { p_entry_id: entryId });
    if (error) throw error;
    window.logbookEntryRows?.delete?.(entryId);
    row.remove();
    const countTag = document.querySelector(".logbook-history-table-card .panel-heading .tag");
    if (countTag) {
      const remaining = document.querySelectorAll(".logbook-history-table-card tbody tr").length;
      countTag.textContent = `${remaining} record${remaining === 1 ? "" : "s"}`;
    }
    showToast("Logbook entry deleted.");
  } catch (error) {
    console.error("Admin logbook delete failed", error);
    alert(`Could not delete this logbook entry: ${error?.message || error}`);
    button.disabled = false;
    button.textContent = oldText;
    forceBlackDeleteText(button);
  } finally {
    deleteBusy = false;
  }
}

async function init() {
  try {
    const { data: sessionData } = await sb.auth.getSession();
    const userId = sessionData?.session?.user?.id;
    if (!userId) return;
    const { data: profile, error } = await sb.from("profiles").select("role,is_active").eq("id", userId).maybeSingle();
    if (error || !profile || profile.role !== "owner" || profile.is_active === false) return;
    ownerReady = true;
    ensureStyle();
    addDeleteButtons();

    const content = document.querySelector("#content");
    if (content) {
      let queued = false;
      new MutationObserver(() => {
        if (queued) return;
        queued = true;
        requestAnimationFrame(() => {
          queued = false;
          addDeleteButtons();
        });
      }).observe(content, { childList: true, subtree: true });
    }
    window.addEventListener("hashchange", () => setTimeout(addDeleteButtons, 80));
  } catch (error) {
    console.warn("Admin logbook delete controls unavailable", error);
  }
}

document.addEventListener("click", (event) => {
  const button = event.target.closest?.("[data-owner-delete-logbook-entry]");
  if (!button || !ownerReady) return;
  event.preventDefault();
  event.stopPropagation();
  void deleteEntry(button);
});

void init();
