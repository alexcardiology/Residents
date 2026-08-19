import { sb } from "./supabase.js";

const root = document.documentElement;
root.classList.add("inbox-badge-booting");

if (!document.querySelector("#inboxBadgeBootStyleV232")) {
  const style = document.createElement("style");
  style.id = "inboxBadgeBootStyleV232";
  style.textContent = `
    html.inbox-badge-booting [data-inbox-badge],
    html.inbox-badge-booting .mailbox-tab[data-mail-tab="inbox"] .inline-badge {
      visibility: hidden !important;
    }
  `;
  document.head.appendChild(style);
}

let lastVerifiedCount = null;
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

function setBadge(badge, value) {
  const text = String(value);
  if (badge.textContent !== text) badge.textContent = text;
  const shouldHide = value === 0;
  if (badge.hidden !== shouldHide) badge.hidden = shouldHide;
}

function paint(count) {
  const value = Math.max(0, Number(count) || 0);
  document.querySelectorAll("[data-inbox-badge]").forEach((badge) => setBadge(badge, value));
  document.querySelectorAll('.mailbox-tab[data-mail-tab="inbox"] .inline-badge').forEach((badge) => setBadge(badge, value));
}

async function syncVerifiedCount() {
  if (syncing) return;
  syncing = true;
  try {
    const count = await readAuthoritativeCount();
    lastVerifiedCount = count;
    paint(count);
  } catch (_) {
    // Leave the application's own badge state untouched if this optional check fails.
  } finally {
    syncing = false;
  }
}

async function stabilizeStartup() {
  try {
    const { data } = await sb.auth.getSession();
    if (!data?.session) return;

    // One short settle window is enough. Do not observe the whole DOM here:
    // repeatedly repainting badge text from a MutationObserver can trigger itself
    // and lock the page on slower devices.
    await sleep(550);
    const first = await readAuthoritativeCount();
    lastVerifiedCount = first;
    paint(first);

    await sleep(250);
    const second = await readAuthoritativeCount();
    lastVerifiedCount = second;
    paint(second);
  } catch (_) {
    // The main application remains the fallback source of truth.
  } finally {
    root.classList.remove("inbox-badge-booting");
    setTimeout(syncVerifiedCount, 1200);
  }
}

void stabilizeStartup();
