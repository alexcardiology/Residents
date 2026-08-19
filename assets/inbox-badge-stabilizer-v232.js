import { sb } from "./supabase.js";

const root = document.documentElement;
let lastVerifiedCount = null;
let settling = true;
let syncing = false;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function countUnreadThreads(messages = [], reviewActions = []) {
  const reviewByMessage = new Map(
    (reviewActions || []).map((row) => [String(row?.message_id ?? ""), String(row?.review_id ?? "")]),
  );
  const unread = new Set();
  for (const message of messages || []) {
    if (message?.is_read) continue;
    const reviewId = reviewByMessage.get(String(message?.id ?? ""));
    unread.add(reviewId ? `review:${reviewId}` : `message:${message?.id}`);
  }
  return unread.size;
}

async function readAuthoritativeCount() {
  const [{ data: messages, error: messageError }, { data: reviewActions, error: reviewError }] = await Promise.all([
    sb.rpc("get_private_messages", { p_box: "inbox" }),
    sb.rpc("get_my_review_message_actions_v1051"),
  ]);
  if (messageError) throw messageError;
  if (reviewError) throw reviewError;
  return countUnreadThreads(messages || [], reviewActions || []);
}

function paint(count) {
  const value = Math.max(0, Number(count) || 0);
  document.querySelectorAll("[data-inbox-badge]").forEach((badge) => {
    badge.textContent = String(value);
    badge.hidden = value === 0;
  });
  document.querySelectorAll('.mailbox-tab[data-mail-tab="inbox"] .inline-badge').forEach((badge) => {
    badge.textContent = String(value);
    badge.hidden = value === 0;
  });
}

async function syncVerifiedCount() {
  if (syncing) return;
  syncing = true;
  try {
    const count = await readAuthoritativeCount();
    lastVerifiedCount = count;
    paint(count);
  } catch (_) {
    // Keep the application's own badge state if the verification request fails.
  } finally {
    syncing = false;
  }
}

async function stabilizeStartup() {
  try {
    const { data } = await sb.auth.getSession();
    if (!data?.session) {
      root.classList.remove("inbox-badge-booting");
      settling = false;
      return;
    }

    // Do not expose the first transient count. The app performs several startup
    // mailbox/workflow reads, and old read-state can briefly arrive before the
    // final authoritative inbox state.
    await sleep(850);

    let previous = null;
    let stableReads = 0;
    for (let attempt = 0; attempt < 7; attempt += 1) {
      try {
        const count = await readAuthoritativeCount();
        lastVerifiedCount = count;
        stableReads = count === previous ? stableReads + 1 : 1;
        previous = count;
        if (stableReads >= 2) break;
      } catch (_) {}
      await sleep(260);
    }

    if (lastVerifiedCount !== null) paint(lastVerifiedCount);
  } finally {
    root.classList.remove("inbox-badge-booting");
    settling = false;

    // One final pass catches a late workflow/read-state update without allowing
    // a stale number to flash during initial rendering.
    setTimeout(syncVerifiedCount, 650);
    setTimeout(syncVerifiedCount, 1500);
  }
}

new MutationObserver(() => {
  if (lastVerifiedCount === null) return;
  if (settling) paint(lastVerifiedCount);
}).observe(document.documentElement, { childList: true, subtree: true });

void stabilizeStartup();
