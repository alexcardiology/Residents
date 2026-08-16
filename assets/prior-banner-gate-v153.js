import { sb } from "./supabase.js";

const FEATURE_KEY = "prior_experience_logbook";
let user = null;
let profile = null;
let enabled = true;
let ready = false;

const route = () => String(location.hash || "#dashboard").replace(/^#/, "").split("?")[0];
const isOwner = () => profile?.role === "owner";

function restoreBanner() {
  document.querySelectorAll('[data-prior-banner-gate-hidden="1"]').forEach((node) => {
    node.style.removeProperty("display");
    delete node.dataset.priorBannerGateHidden;
  });
  document.querySelectorAll('[data-prior-banner-gate-soon="1"]').forEach((node) => node.remove());
}

function ensureComingSoon(banner) {
  if (!banner || banner.parentElement?.querySelector('[data-feature-prior-soon="1"], [data-prior-banner-gate-soon="1"]')) return;
  const notice = document.createElement("section");
  notice.className = "feature-coming-soon compact";
  notice.dataset.featureGateUi = "1";
  notice.dataset.priorBannerGateSoon = "1";
  notice.innerHTML = `
    <div class="feature-coming-soon-icon" aria-hidden="true">⏳</div>
    <div>
      <small>COMING SOON</small>
      <h2>Prior Experience Logbook</h2>
      <p>Your prior-experience logbook is being prepared and will be available soon.</p>
    </div>`;
  banner.before(notice);
}

function paint() {
  if (!ready) return;
  if (enabled || isOwner()) {
    restoreBanner();
    return;
  }

  if (route() === "logbook") {
    document.querySelectorAll("#content .prior-experience-alert").forEach((node) => {
      node.dataset.priorBannerGateHidden = "1";
      node.style.setProperty("display", "none", "important");
      ensureComingSoon(node);
    });
  }
}

async function readFlag() {
  const { data, error } = await sb
    .from("portal_feature_flags")
    .select("enabled")
    .eq("feature_key", FEATURE_KEY)
    .single();
  if (error) throw error;
  return data?.enabled === true;
}

async function load() {
  try {
    const { data: sessionData } = await sb.auth.getSession();
    user = sessionData?.session?.user || null;
    if (!user) return;
    const [{ data: p }, flag] = await Promise.all([
      sb.from("profiles").select("role").eq("id", user.id).single(),
      readFlag(),
    ]);
    profile = p || null;
    enabled = flag;
  } catch (error) {
    console.warn("Prior banner gate could not be loaded", error);
  } finally {
    ready = true;
    paint();
  }
}

async function refresh() {
  if (!user) return;
  try {
    const next = await readFlag();
    if (next !== enabled) {
      enabled = next;
      location.reload();
      return;
    }
    paint();
  } catch (_) {}
}

new MutationObserver(() => {
  clearTimeout(window.__priorBannerGatePaint);
  window.__priorBannerGatePaint = setTimeout(paint, 40);
}).observe(document.querySelector("#shell") || document.body, { childList: true, subtree: true });

window.addEventListener("hashchange", () => setTimeout(paint, 30));
setInterval(() => void refresh(), 5000);
void load();
