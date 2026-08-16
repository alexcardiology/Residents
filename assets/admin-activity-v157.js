import { sb } from "./supabase.js";

const ANDROID_VERSION = "android-mobile-latest";
const ONLINE_WINDOW_MS = 2 * 60 * 1000;
const CAIRO_TZ = "Africa/Cairo";
let ownerReady = false;
let refreshTimer = null;

function addStyles() {
  if (document.querySelector("#adminActivityV157Styles")) return;
  const style = document.createElement("style");
  style.id = "adminActivityV157Styles";
  style.textContent = `
    .admin-live-card{appearance:none;width:100%;min-width:0;min-height:142px;border:1px solid rgba(166,31,51,.16);border-radius:22px;padding:20px;text-align:left;cursor:pointer;background:linear-gradient(145deg,#fff 0%,#fff8fa 100%);box-shadow:0 12px 30px rgba(67,8,18,.07);color:var(--ink,#29171d);font:inherit;transition:.16s ease}.admin-live-card:hover{transform:translateY(-2px);box-shadow:0 16px 36px rgba(67,8,18,.11)}.admin-live-card .kicker{display:block;color:var(--blue,#a61f33);font-size:.72rem;font-weight:900;letter-spacing:.08em;text-transform:uppercase}.admin-live-card .big{display:block;margin-top:8px;font-size:2.2rem;line-height:1;font-weight:900;letter-spacing:-.04em}.admin-live-card .label{display:block;margin-top:5px;font-size:.93rem;font-weight:800}.admin-live-card .meta{display:block;margin-top:9px;color:var(--muted,#756168);font-size:.78rem;line-height:1.4}.admin-live-card .online-dot{display:inline-block;width:8px;height:8px;border-radius:50%;background:#18a55b;box-shadow:0 0 0 4px rgba(24,165,91,.12);margin-right:6px}.admin-activity-dialog{width:min(95vw,1040px);max-height:88vh;border:0;border-radius:26px;padding:0;box-shadow:0 28px 90px rgba(28,8,14,.28);color:var(--ink,#29171d);background:#fff}.admin-activity-dialog::backdrop{background:rgba(20,8,12,.54);backdrop-filter:blur(3px)}.admin-activity-shell{padding:26px}.admin-activity-head{display:flex;align-items:flex-start;justify-content:space-between;gap:18px}.admin-activity-head h2{margin:3px 0 0;font-size:1.65rem}.admin-activity-head p{margin:6px 0 0;color:#756168;font-size:.88rem}.admin-activity-close{appearance:none;border:1px solid #ead8dd;background:#fff;border-radius:12px;width:38px;height:38px;cursor:pointer;font-size:1.35rem}.admin-activity-metrics{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:11px;margin-top:22px}.admin-activity-metric{padding:15px;border:1px solid #f0e2e6;border-radius:17px;background:#fff9fa}.admin-activity-metric strong{display:block;font-size:1.55rem}.admin-activity-metric span{display:block;margin-top:4px;color:#756168;font-size:.73rem}.admin-activity-table-wrap{margin-top:20px;overflow:auto;border:1px solid #f0e2e6;border-radius:16px}.admin-activity-table{width:100%;border-collapse:collapse;font-size:.79rem}.admin-activity-table th,.admin-activity-table td{padding:10px 12px;border-bottom:1px solid #f3e8eb;text-align:left;white-space:nowrap}.admin-activity-table th{position:sticky;top:0;background:#fbf6f7;color:#6d4f58;font-size:.68rem;text-transform:uppercase;letter-spacing:.05em;z-index:1}.admin-activity-table tr:last-child td{border-bottom:0}.presence{display:inline-flex;align-items:center;gap:6px;font-weight:850}.presence.online{color:#14834a}.presence.offline{color:#7b6a70}.presence i{width:8px;height:8px;border-radius:50%;background:currentColor}.admin-activity-note{margin-top:16px;padding:13px 15px;border-radius:15px;background:#f8f1f3;color:#60454d;font-size:.8rem;line-height:1.5}@media(max-width:720px){.admin-activity-shell{padding:19px}.admin-activity-metrics{grid-template-columns:repeat(2,minmax(0,1fr))}.admin-live-card{min-height:132px}}
  `;
  document.head.appendChild(style);
}

function formatDateTime(value) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-GB", { timeZone: CAIRO_TZ, day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

function relativeTime(value) {
  if (!value) return "Never";
  const diff = Math.max(0, Date.now() - new Date(value).getTime());
  if (diff < 60000) return "Just now";
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} h ago`;
  const days = Math.floor(hrs / 24);
  return `${days} d ago`;
}

function ensureDialog(id) {
  let dialog = document.querySelector(`#${id}`);
  if (dialog) return dialog;
  dialog = document.createElement("dialog");
  dialog.id = id;
  dialog.className = "admin-activity-dialog";
  dialog.addEventListener("click", (event) => { if (event.target === dialog) dialog.close(); });
  document.body.appendChild(dialog);
  return dialog;
}

async function androidStats() {
  const { data, error } = await sb.from("app_install_events")
    .select("event_type,created_at")
    .eq("platform", "android")
    .eq("installer_version", ANDROID_VERSION)
    .order("created_at", { ascending: false })
    .limit(5000);
  if (error) throw error;
  const rows = data || [];
  const installs = rows.filter((row) => row.event_type === "native_launch");
  const downloads = rows.filter((row) => row.event_type === "download_click");
  const views = rows.filter((row) => row.event_type === "installer_view");
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: CAIRO_TZ }).format(new Date());
  const isToday = (value) => new Intl.DateTimeFormat("en-CA", { timeZone: CAIRO_TZ }).format(new Date(value)) === today;
  return {
    installs: installs.length,
    downloads: downloads.length,
    views: views.length,
    todayInstalls: installs.filter((row) => isToday(row.created_at)).length,
    todayDownloads: downloads.filter((row) => isToday(row.created_at)).length,
    lastInstallAt: installs[0]?.created_at || null,
  };
}

async function userActivityRows() {
  const [{ data: activity, error: activityError }, { data: profiles, error: profileError }] = await Promise.all([
    sb.from("app_user_activity").select("*").order("last_active_at", { ascending: false }),
    sb.from("profiles").select("id,display_name,username,email,role,is_active").order("display_name"),
  ]);
  if (activityError) throw activityError;
  if (profileError) throw profileError;
  const profileMap = new Map((profiles || []).map((row) => [String(row.id), row]));
  return (activity || []).map((row) => ({ ...row, profile: profileMap.get(String(row.user_id)) || {} }));
}

async function openAndroidDetails() {
  const dialog = ensureDialog("androidInstallAnalyticsDialog");
  dialog.innerHTML = `<div class="admin-activity-shell"><div class="admin-activity-head"><div><span class="kicker">Android app analytics</span><h2>Loading…</h2></div><button class="admin-activity-close" type="button">×</button></div></div>`;
  dialog.querySelector(".admin-activity-close")?.addEventListener("click", () => dialog.close());
  if (!dialog.open) dialog.showModal();
  try {
    const stats = await androidStats();
    dialog.innerHTML = `<div class="admin-activity-shell"><div class="admin-activity-head"><div><span class="kicker">Android app analytics</span><h2>Android installer</h2><p>Stable mobile-latest APK</p></div><button class="admin-activity-close" type="button">×</button></div><div class="admin-activity-metrics"><div class="admin-activity-metric"><strong>${stats.installs}</strong><span>Confirmed Android app launches</span></div><div class="admin-activity-metric"><strong>${stats.downloads}</strong><span>Unique APK download clicks</span></div><div class="admin-activity-metric"><strong>${stats.todayInstalls}</strong><span>Confirmed installs today</span></div><div class="admin-activity-metric"><strong>${stats.todayDownloads}</strong><span>APK downloads today</span></div></div><div class="admin-activity-note"><b>Confirmed install</b> means the signed Android app was actually opened and reached the live Cardiology Residents portal at least once. A download click alone does not prove Android completed installation.<br><br>Last confirmed Android launch: <b>${formatDateTime(stats.lastInstallAt)}</b>.</div></div>`;
    dialog.querySelector(".admin-activity-close")?.addEventListener("click", () => dialog.close());
  } catch (error) {
    console.warn("Android analytics unavailable", error);
  }
}

async function openUserActivity() {
  const dialog = ensureDialog("userActivityAnalyticsDialog");
  dialog.innerHTML = `<div class="admin-activity-shell"><div class="admin-activity-head"><div><span class="kicker">Admin only</span><h2>Loading user activity…</h2></div><button class="admin-activity-close" type="button">×</button></div></div>`;
  dialog.querySelector(".admin-activity-close")?.addEventListener("click", () => dialog.close());
  if (!dialog.open) dialog.showModal();
  try {
    const rows = await userActivityRows();
    const now = Date.now();
    const online = rows.filter((row) => now - new Date(row.last_active_at).getTime() <= ONLINE_WINDOW_MS);
    const emailLogins = rows.filter((row) => row.last_login_method === "email");
    const body = rows.length ? rows.map((row) => {
      const isOnline = now - new Date(row.last_active_at).getTime() <= ONLINE_WINDOW_MS;
      const p = row.profile || {};
      const platform = row.last_platform === "android_app" ? "Android app" : row.last_platform === "ios_app" ? "iPhone app" : "Web";
      return `<tr><td><b>${p.display_name || p.username || "User"}</b><br><small>@${p.username || ""}</small></td><td>${p.email || "—"}</td><td>${p.role || "—"}</td><td>${row.last_login_method || "—"}</td><td>${platform}</td><td><span class="presence ${isOnline ? "online" : "offline"}"><i></i>${isOnline ? "Online" : "Offline"}</span></td><td>${isOnline ? formatDateTime(row.session_started_at) : "—"}</td><td title="${formatDateTime(row.last_active_at)}">${relativeTime(row.last_active_at)}</td></tr>`;
    }).join("") : `<tr><td colspan="8">No user activity has been recorded yet.</td></tr>`;
    dialog.innerHTML = `<div class="admin-activity-shell"><div class="admin-activity-head"><div><span class="kicker">Admin only</span><h2>User activity</h2><p>Current presence and last sign-in/activity across web, iPhone and Android.</p></div><button class="admin-activity-close" type="button">×</button></div><div class="admin-activity-metrics"><div class="admin-activity-metric"><strong>${online.length}</strong><span>Online now</span></div><div class="admin-activity-metric"><strong>${rows.length}</strong><span>Users tracked since activation</span></div><div class="admin-activity-metric"><strong>${emailLogins.length}</strong><span>Last signed in by email</span></div><div class="admin-activity-metric"><strong>${rows.filter((r) => r.last_platform === "android_app" || r.last_platform === "ios_app").length}</strong><span>Last active in installed app</span></div></div><div class="admin-activity-table-wrap"><table class="admin-activity-table"><thead><tr><th>User</th><th>Email</th><th>Role</th><th>Login method</th><th>Last platform</th><th>Status</th><th>Online since</th><th>Last active</th></tr></thead><tbody>${body}</tbody></table></div><div class="admin-activity-note">“Online” means the account has sent an authenticated activity heartbeat within the last 2 minutes. Tracking starts from this deployment; it cannot reconstruct activity from before it was enabled.</div></div>`;
    dialog.querySelector(".admin-activity-close")?.addEventListener("click", () => dialog.close());
  } catch (error) {
    console.warn("User activity analytics unavailable", error);
  }
}

async function paintCards() {
  const grid = document.querySelector(".owner-dashboard-grid");
  if (!grid) return;

  let androidCard = grid.querySelector("[data-android-install-analytics]");
  if (!androidCard) {
    androidCard = document.createElement("button");
    androidCard.type = "button";
    androidCard.className = "admin-live-card";
    androidCard.dataset.androidInstallAnalytics = "1";
    androidCard.addEventListener("click", openAndroidDetails);
    grid.appendChild(androidCard);
  }

  let activityCard = grid.querySelector("[data-user-activity-analytics]");
  if (!activityCard) {
    activityCard = document.createElement("button");
    activityCard.type = "button";
    activityCard.className = "admin-live-card";
    activityCard.dataset.userActivityAnalytics = "1";
    activityCard.addEventListener("click", openUserActivity);
    grid.appendChild(activityCard);
  }

  try {
    const [android, users] = await Promise.all([androidStats(), userActivityRows()]);
    const online = users.filter((row) => Date.now() - new Date(row.last_active_at).getTime() <= ONLINE_WINDOW_MS).length;
    androidCard.innerHTML = `<span class="kicker">Android app</span><strong class="big">${android.installs}</strong><span class="label">confirmed installs</span><small class="meta">${android.downloads} APK download click${android.downloads === 1 ? "" : "s"} · ${android.todayInstalls} installed today · Tap for details</small>`;
    activityCard.innerHTML = `<span class="kicker">User activity</span><strong class="big"><span class="online-dot"></span>${online}</strong><span class="label">online now</span><small class="meta">${users.length} tracked user${users.length === 1 ? "" : "s"} · email sign-in + last active · Tap for details</small>`;
  } catch (error) {
    console.warn("Admin activity cards unavailable", error);
  }
}

function schedulePaint() {
  clearTimeout(refreshTimer);
  refreshTimer = setTimeout(() => void paintCards(), 120);
}

async function init() {
  try {
    const { data: { session } } = await sb.auth.getSession();
    if (!session?.user) return;
    const { data: profile, error } = await sb.from("profiles").select("role,is_active").eq("id", session.user.id).maybeSingle();
    if (error || profile?.role !== "owner" || profile?.is_active === false) return;
    ownerReady = true;
    addStyles();
    const content = document.querySelector("#content");
    if (content) new MutationObserver(schedulePaint).observe(content, { childList: true, subtree: true });
    window.addEventListener("hashchange", schedulePaint);
    window.setInterval(() => { if (ownerReady) void paintCards(); }, 30000);
    schedulePaint();
  } catch (error) {
    console.warn("Admin activity analytics could not initialize", error);
  }
}

void init();
