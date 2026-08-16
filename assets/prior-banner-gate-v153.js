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
}

function paint() {
  if (!ready) return;
  if (enabled || isOwner()) {
    restoreBanner();
    return;
  }

  /* On the resident E-logbook page the disabled feature should simply disappear,
     not consume space with either the old priority banner or a replacement notice. */
  if (route() === "logbook") {
    document.querySelectorAll("#content .prior-experience-alert").forEach((node) => {
      node.dataset.priorBannerGateHidden = "1";
      node.style.setProperty("display", "none", "important");
    });
    document.querySelectorAll('#content [data-feature-prior-soon="1"]').forEach((node) => node.remove());
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
