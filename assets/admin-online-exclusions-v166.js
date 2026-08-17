import { sb } from "./supabase.js";

const EXCLUDED_EMAILS = new Set([
  "drmohamedalaa90@gmail.com",
  "drmohamedalaa90@icloud.com",
]);
const ONLINE_WINDOW_MS = 2 * 60 * 1000;
let ownerReady = false;
let busy = false;

async function filteredActivity() {
  const [{ data: activity, error: aErr }, { data: profiles, error: pErr }] = await Promise.all([
    sb.from("app_user_activity").select("user_id,last_active_at,last_login_method,last_platform"),
    sb.from("profiles").select("id,email,role,is_active"),
  ]);
  if (aErr) throw aErr;
  if (pErr) throw pErr;
  const profileMap = new Map((profiles || []).map((p) => [String(p.id), p]));
  return (activity || []).filter((row) => {
    const p = profileMap.get(String(row.user_id)) || {};
    return !EXCLUDED_EMAILS.has(String(p.email || "").trim().toLowerCase());
  });
}

async function repaint() {
  if (!ownerReady || busy) return;
  busy = true;
  try {
    const rows = await filteredActivity();
    const now = Date.now();
    const online = rows.filter((r) => now - new Date(r.last_active_at).getTime() <= ONLINE_WINDOW_MS).length;
    const emailLogins = rows.filter((r) => r.last_login_method === "email").length;
    const installed = rows.filter((r) => r.last_platform === "android_app" || r.last_platform === "ios_app").length;

    const card = document.querySelector("[data-user-activity-analytics]");
    if (card) {
      const big = card.querySelector(".big");
      const meta = card.querySelector(".meta");
      if (big) big.innerHTML = `<span class="online-dot"></span>${online}`;
      if (meta) meta.textContent = `${rows.length} tracked user${rows.length === 1 ? "" : "s"} · admin accounts excluded · Tap for details`;
    }

    const dialog = document.querySelector("#userActivityAnalyticsDialog");
    if (dialog?.open) {
      for (const tr of dialog.querySelectorAll("tbody tr")) {
        const email = String(tr.children?.[1]?.textContent || "").trim().toLowerCase();
        if (EXCLUDED_EMAILS.has(email)) tr.remove();
      }
      const metrics = dialog.querySelectorAll(".admin-activity-metric strong");
      if (metrics[0]) metrics[0].textContent = String(online);
      if (metrics[1]) metrics[1].textContent = String(rows.length);
      if (metrics[2]) metrics[2].textContent = String(emailLogins);
      if (metrics[3]) metrics[3].textContent = String(installed);
      const note = dialog.querySelector(".admin-activity-note");
      if (note && !note.textContent.includes("Admin accounts are excluded")) {
        note.insertAdjacentHTML("beforeend", "<br><br><b>Admin accounts are excluded</b> from Online now and this activity list.");
      }
    }
  } catch (error) {
    console.warn("Online exclusions could not refresh", error);
  } finally {
    busy = false;
  }
}

async function init() {
  try {
    const { data: { session } } = await sb.auth.getSession();
    if (!session?.user) return;
    const { data: profile } = await sb.from("profiles").select("role,is_active").eq("id", session.user.id).maybeSingle();
    if (profile?.role !== "owner" || profile?.is_active === false) return;
    ownerReady = true;
    setTimeout(repaint, 500);
    setInterval(repaint, 30000);
    const content = document.querySelector("#content");
    if (content) new MutationObserver(() => setTimeout(repaint, 250)).observe(content, { childList: true, subtree: true });
    document.addEventListener("click", (event) => {
      if (event.target?.closest?.("[data-user-activity-analytics]")) setTimeout(repaint, 350);
    }, true);
  } catch (error) {
    console.warn("Online exclusions could not initialize", error);
  }
}

void init();
