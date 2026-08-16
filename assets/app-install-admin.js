import { sb } from "./supabase.js";

const TABLE = "app_install_events";
const VERSION = "20260816";
const CAIRO_TIME_ZONE = "Africa/Cairo";
let refreshTimer = null;
let statsPromise = null;

function addStyles() {
  if (document.querySelector("#iosInstallAnalyticsStyles")) return;
  const style = document.createElement("style");
  style.id = "iosInstallAnalyticsStyles";
  style.textContent = `
    .ios-install-analytics-card{appearance:none;width:100%;min-width:0;min-height:142px;border:1px solid rgba(166,31,51,.16);border-radius:22px;padding:20px;text-align:left;cursor:pointer;background:linear-gradient(145deg,#fff 0%,#fff8fa 100%);box-shadow:0 12px 30px rgba(67,8,18,.07);color:var(--ink,#29171d);font:inherit;transition:transform .16s ease,box-shadow .16s ease,border-color .16s ease}.ios-install-analytics-card:hover{transform:translateY(-2px);box-shadow:0 16px 36px rgba(67,8,18,.11);border-color:rgba(166,31,51,.3)}.ios-install-analytics-card:focus-visible{outline:3px solid rgba(166,31,51,.22);outline-offset:2px}.ios-install-analytics-eyebrow{display:block;color:var(--blue,#a61f33);font-size:.72rem;font-weight:900;letter-spacing:.08em;text-transform:uppercase}.ios-install-analytics-number{display:block;margin-top:8px;font-size:2.2rem;line-height:1;font-weight:900;letter-spacing:-.04em}.ios-install-analytics-label{display:block;margin-top:5px;font-size:.93rem;font-weight:800}.ios-install-analytics-meta{display:block;margin-top:9px;color:var(--muted,#756168);font-size:.78rem;line-height:1.4}.ios-install-analytics-card.is-error .ios-install-analytics-number{font-size:1.15rem;letter-spacing:0}.ios-install-analytics-dialog{width:min(92vw,760px);max-height:86vh;border:0;border-radius:26px;padding:0;box-shadow:0 28px 90px rgba(28,8,14,.28);color:var(--ink,#29171d);background:#fff}.ios-install-analytics-dialog::backdrop{background:rgba(20,8,12,.54);backdrop-filter:blur(3px)}.ios-install-analytics-dialog-shell{padding:26px}.ios-install-analytics-dialog-head{display:flex;align-items:flex-start;justify-content:space-between;gap:18px}.ios-install-analytics-dialog-head h2{margin:3px 0 0;font-size:1.65rem;letter-spacing:-.025em}.ios-install-analytics-dialog-head p{margin:6px 0 0;color:var(--muted,#756168);font-size:.9rem}.ios-install-analytics-close{appearance:none;border:1px solid #ead8dd;background:#fff;border-radius:12px;width:38px;height:38px;cursor:pointer;font-size:1.35rem;line-height:1;color:#64111f}.ios-install-analytics-metrics{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:11px;margin-top:22px}.ios-install-analytics-metric{padding:15px;border:1px solid #f0e2e6;border-radius:17px;background:#fff9fa}.ios-install-analytics-metric strong{display:block;font-size:1.55rem;letter-spacing:-.03em}.ios-install-analytics-metric span{display:block;margin-top:4px;color:#756168;font-size:.73rem;line-height:1.25}.ios-install-analytics-note{margin-top:18px;padding:13px 15px;border-radius:15px;background:#f8f1f3;color:#60454d;font-size:.82rem;line-height:1.5}.ios-install-analytics-table-wrap{margin-top:20px;overflow:auto;border:1px solid #f0e2e6;border-radius:16px}.ios-install-analytics-table{width:100%;border-collapse:collapse;font-size:.82rem}.ios-install-analytics-table th,.ios-install-analytics-table td{padding:10px 12px;border-bottom:1px solid #f3e8eb;text-align:left;white-space:nowrap}.ios-install-analytics-table th{background:#fbf6f7;color:#6d4f58;font-size:.7rem;text-transform:uppercase;letter-spacing:.05em}.ios-install-analytics-table tr:last-child td{border-bottom:0}.ios-install-analytics-foot{margin-top:15px;color:#806c72;font-size:.75rem;line-height:1.45}@media(max-width:680px){.ios-install-analytics-dialog-shell{padding:20px}.ios-install-analytics-metrics{grid-template-columns:repeat(2,minmax(0,1fr))}.ios-install-analytics-dialog{width:94vw}.ios-install-analytics-card{min-height:132px}}
  `;
  document.head.appendChild(style);
}

function cairoDay(value) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: CAIRO_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(value));
  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${map.year}-${map.month}-${map.day}`;
}

function formatCairoDateTime(value) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: CAIRO_TIME_ZONE,
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

async function countType(eventType) {
  const result = await sb.from(TABLE).select("id", { count: "exact", head: true }).eq("event_type", eventType).eq("installer_version", VERSION);
  if (result.error) throw result.error;
  return Number(result.count || 0);
}

async function fetchStats(force = false) {
  if (statsPromise && !force) return statsPromise;
  statsPromise = (async () => {
    const recentSince = new Date(Date.now() - 32 * 86400000).toISOString();
    const [views, installs, recentResult, lastInstallResult, firstEventResult] = await Promise.all([
      countType("installer_view"),
      countType("standalone_launch"),
      sb.from(TABLE).select("event_type,created_at").eq("installer_version", VERSION).gte("created_at", recentSince).order("created_at", { ascending: false }).limit(5000),
      sb.from(TABLE).select("created_at").eq("installer_version", VERSION).eq("event_type", "standalone_launch").order("created_at", { ascending: false }).limit(1).maybeSingle(),
      sb.from(TABLE).select("created_at").eq("installer_version", VERSION).order("created_at", { ascending: true }).limit(1).maybeSingle(),
    ]);
    if (recentResult.error) throw recentResult.error;
    if (lastInstallResult.error) throw lastInstallResult.error;
    if (firstEventResult.error) throw firstEventResult.error;

    const rows = recentResult.data || [];
    const today = cairoDay(new Date());
    let todayViews = 0;
    let todayInstalls = 0;
    const dailyMap = new Map();
    for (const row of rows) {
      const day = cairoDay(row.created_at);
      if (!dailyMap.has(day)) dailyMap.set(day, { day, views: 0, installs: 0 });
      const bucket = dailyMap.get(day);
      if (row.event_type === "installer_view") {
        bucket.views += 1;
        if (day === today) todayViews += 1;
      } else if (row.event_type === "standalone_launch") {
        bucket.installs += 1;
        if (day === today) todayInstalls += 1;
      }
    }

    return {
      views,
      installs,
      todayViews,
      todayInstalls,
      lastInstallAt: lastInstallResult.data?.created_at || null,
      trackingSince: firstEventResult.data?.created_at || null,
      daily: [...dailyMap.values()].sort((a, b) => b.day.localeCompare(a.day)),
    };
  })();
  try {
    return await statsPromise;
  } finally {
    statsPromise = null;
  }
}

function renderCard(card, stats) {
  card.classList.remove("is-error");
  card.innerHTML = `
    <span class="ios-install-analytics-eyebrow">iPhone app</span>
    <strong class="ios-install-analytics-number">${stats.installs}</strong>
    <span class="ios-install-analytics-label">confirmed installs</span>
    <small class="ios-install-analytics-meta">${stats.views} unique installer visitor${stats.views === 1 ? "" : "s"} · ${stats.todayInstalls} installed today · Tap for details</small>
  `;
}

function renderError(card) {
  card.classList.add("is-error");
  card.innerHTML = `
    <span class="ios-install-analytics-eyebrow">iPhone app</span>
    <strong class="ios-install-analytics-number">Analytics unavailable</strong>
    <small class="ios-install-analytics-meta">Tap to retry.</small>
  `;
}

function ensureDialog() {
  let dialog = document.querySelector("#iosInstallAnalyticsDialog");
  if (dialog) return dialog;
  dialog = document.createElement("dialog");
  dialog.id = "iosInstallAnalyticsDialog";
  dialog.className = "ios-install-analytics-dialog";
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) dialog.close();
  });
  document.body.appendChild(dialog);
  return dialog;
}

async function openDetails() {
  const dialog = ensureDialog();
  dialog.innerHTML = `<div class="ios-install-analytics-dialog-shell"><div class="ios-install-analytics-dialog-head"><div><span class="ios-install-analytics-eyebrow">iPhone app analytics</span><h2>Loading…</h2></div><button class="ios-install-analytics-close" type="button" aria-label="Close">×</button></div></div>`;
  dialog.querySelector(".ios-install-analytics-close")?.addEventListener("click", () => dialog.close());
  if (!dialog.open) dialog.showModal();
  try {
    const stats = await fetchStats(true);
    const recentDays = stats.daily.slice(0, 14);
    const rows = recentDays.length
      ? recentDays.map((item) => `<tr><td>${item.day}</td><td>${item.views}</td><td>${item.installs}</td></tr>`).join("")
      : `<tr><td colspan="3">No tracked activity yet.</td></tr>`;
    dialog.innerHTML = `
      <div class="ios-install-analytics-dialog-shell">
        <div class="ios-install-analytics-dialog-head">
          <div><span class="ios-install-analytics-eyebrow">iPhone app analytics</span><h2>Install activity</h2><p>Clean installer · 16 Aug 2026</p></div>
          <button class="ios-install-analytics-close" type="button" aria-label="Close">×</button>
        </div>
        <div class="ios-install-analytics-metrics">
          <div class="ios-install-analytics-metric"><strong>${stats.installs}</strong><span>Confirmed Home Screen installs</span></div>
          <div class="ios-install-analytics-metric"><strong>${stats.views}</strong><span>Unique iPhone installer visitors</span></div>
          <div class="ios-install-analytics-metric"><strong>${stats.todayInstalls}</strong><span>Confirmed installs today</span></div>
          <div class="ios-install-analytics-metric"><strong>${stats.todayViews}</strong><span>Installer visitors today</span></div>
        </div>
        <div class="ios-install-analytics-note"><b>Confirmed install</b> means the Cardiology Residents Home Screen web app was launched in standalone mode at least once. This is more useful than simply counting visits to the install instructions.</div>
        <div class="ios-install-analytics-table-wrap"><table class="ios-install-analytics-table"><thead><tr><th>Date</th><th>Installer visitors</th><th>Confirmed installs</th></tr></thead><tbody>${rows}</tbody></table></div>
        <div class="ios-install-analytics-foot">Last confirmed install: <b>${formatCairoDateTime(stats.lastInstallAt)}</b>${stats.trackingSince ? ` · Tracking started ${formatCairoDateTime(stats.trackingSince)}` : " · Tracking begins with the first new visit"}. Counts are anonymous and do not store a resident name, email, phone number or user-agent string.</div>
      </div>`;
    dialog.querySelector(".ios-install-analytics-close")?.addEventListener("click", () => dialog.close());
  } catch (error) {
    console.warn("iPhone install analytics could not load", error);
    dialog.innerHTML = `<div class="ios-install-analytics-dialog-shell"><div class="ios-install-analytics-dialog-head"><div><span class="ios-install-analytics-eyebrow">iPhone app analytics</span><h2>Could not load analytics</h2><p>Please close this panel and try again.</p></div><button class="ios-install-analytics-close" type="button" aria-label="Close">×</button></div></div>`;
    dialog.querySelector(".ios-install-analytics-close")?.addEventListener("click", () => dialog.close());
  }
}

async function enhanceOwnerDashboard() {
  const grid = document.querySelector(".owner-dashboard-grid");
  if (!grid || grid.querySelector("[data-ios-install-analytics]")) return;
  const card = document.createElement("button");
  card.type = "button";
  card.className = "ios-install-analytics-card";
  card.dataset.iosInstallAnalytics = "1";
  card.innerHTML = `<span class="ios-install-analytics-eyebrow">iPhone app</span><strong class="ios-install-analytics-number">—</strong><span class="ios-install-analytics-label">loading install count</span><small class="ios-install-analytics-meta">Admin only</small>`;
  card.addEventListener("click", openDetails);
  grid.appendChild(card);
  try {
    renderCard(card, await fetchStats());
  } catch (error) {
    console.warn("iPhone install analytics tile could not load", error);
    renderError(card);
  }
}

function scheduleEnhance() {
  clearTimeout(refreshTimer);
  refreshTimer = setTimeout(() => void enhanceOwnerDashboard(), 100);
}

async function init() {
  try {
    const { data: sessionData } = await sb.auth.getSession();
    const userId = sessionData?.session?.user?.id;
    if (!userId) return;
    const { data: profile, error } = await sb.from("profiles").select("role,is_active").eq("id", userId).maybeSingle();
    if (error) throw error;
    if (profile?.role !== "owner" || profile?.is_active === false) return;
    addStyles();
    const content = document.querySelector("#content");
    if (!content) return;
    new MutationObserver(scheduleEnhance).observe(content, { childList: true, subtree: true });
    scheduleEnhance();
  } catch (error) {
    console.warn("Admin iPhone install analytics could not initialize", error);
  }
}

void init();
