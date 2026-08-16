import { sb } from "./supabase.js";

const isCleanupRoute = () => location.hash.replace(/^#/, "") === "message-cleanup";

function toast(message) {
  const node = document.querySelector("#toast");
  if (!node) return;
  node.textContent = message;
  node.style.display = "block";
  clearTimeout(window.__cleanupToastTimer);
  window.__cleanupToastTimer = setTimeout(() => { node.style.display = "none"; }, 3500);
}

async function rpc(name, args = undefined) {
  const result = args === undefined ? await sb.rpc(name) : await sb.rpc(name, args);
  if (result.error) throw result.error;
  return result.data;
}

async function deleteAllMessages(button) {
  if (button.dataset.cleanupBusy === "1") return;
  button.dataset.cleanupBusy = "1";
  const oldText = button.textContent;
  button.disabled = true;
  try {
    const before = (await rpc("owner_message_cleanup_summary")) || [];
    const total = Number(before.find((row) => String(row.category) === "all")?.message_count || 0);
    if (!total) {
      alert("There are no messages to delete.");
      return;
    }

    if (!confirm(`Delete ALL ${total} program messages? This removes Inbox/Sent message records for all users. Resident My logbook records and exported logbook data remain unchanged.`)) return;

    button.textContent = "Deleting…";
    const deleted = Number(await rpc("owner_cleanup_message_categories", {
      p_categories: [],
      p_delete_all: true,
    }) || 0);

    // Verify the backend result instead of assuming the RPC succeeded visually.
    const after = (await rpc("owner_message_cleanup_summary")) || [];
    const remaining = Number(after.find((row) => String(row.category) === "all")?.message_count || 0);

    if (remaining > 0) {
      throw new Error(`${remaining} message${remaining === 1 ? "" : "s"} still remain after cleanup.`);
    }

    toast(`${deleted || total} message${(deleted || total) === 1 ? "" : "s"} deleted. Resident logbooks were not changed.`);
    // Re-render with fresh counts. Reloading the same hash is the most reliable way to
    // update every message badge/list maintained by the main application module.
    setTimeout(() => location.reload(), 250);
  } catch (error) {
    console.error("Delete all messages failed", error);
    alert(`Could not delete all messages: ${error?.message || error}`);
  } finally {
    button.dataset.cleanupBusy = "0";
    button.disabled = false;
    button.textContent = oldText;
  }
}

// Capture phase intentionally runs before the older delegated handler. This makes the
// action reliable even when the click lands on a nested element or the older handler throws.
document.addEventListener("click", (event) => {
  if (!isCleanupRoute()) return;
  const button = event.target instanceof Element ? event.target.closest("[data-cleanup-delete-all]") : null;
  if (!button) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  void deleteAllMessages(button);
}, true);
