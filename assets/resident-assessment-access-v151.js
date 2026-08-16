import { sb } from "./supabase.js";

const FEATURE_KEY = "resident_assessments";
const ADMIN_ROUTE = "owner-assessment-center";
const RESIDENT_ROUTE = "assessments";

const state = {
  user: null,
  profile: null,
  enabled: true,
  ready: false,
  painting: false,
};

const route = () => String(location.hash || "#dashboard").replace(/^#/, "").split("?")[0];
const isOwner = () => state.profile?.role === "owner";
const isResident = () => state.profile?.role === "resident";

function toast(message) {
  const node = document.querySelector("#toast");
  if (!node) return;
  node.textContent = message;
  node.style.display = "block";
  clearTimeout(window.__residentAssessmentAccessToast);
  window.__residentAssessmentAccessToast = setTimeout(() => {
    node.style.display = "none";
  }, 2800);
}

function controlMarkup() {
  return `<section class="feature-admin-control" data-feature-gate-ui="1" data-resident-assessment-access-control="1">
    <div class="feature-admin-copy">
      <small>ACCESS CONTROL</small>
      <h3>Resident assessments</h3>
      <p>Allow or hide the My assessments section for all residents. Assessor and Admin assessment tools are not affected.</p>
    </div>
    <label class="feature-switch-wrap">
      <span class="feature-status ${state.enabled ? "allowed" : "blocked"}">${state.enabled ? "Allowed" : "Not allowed"}</span>
      <span class="feature-switch">
        <input type="checkbox" data-resident-assessment-access-toggle ${state.enabled ? "checked" : ""} aria-label="Allow residents to access assessments">
        <span class="feature-switch-track"><span></span></span>
      </span>
    </label>
  </section>`;
}

function ensureAdminControl() {
  document.querySelectorAll("[data-resident-assessment-access-control]").forEach((node) => {
    if (!isOwner() || route() !== ADMIN_ROUTE) node.remove();
  });
  if (!isOwner() || route() !== ADMIN_ROUTE) return;

  const content = document.querySelector("#content");
  if (!content) return;
  const existing = content.querySelector("[data-resident-assessment-access-control]");
  const markup = controlMarkup();
  if (existing) {
    if (existing.outerHTML !== markup) existing.outerHTML = markup;
    return;
  }

  const wrapper = document.createElement("div");
  wrapper.innerHTML = markup;
  const node = wrapper.firstElementChild;
  const lead = content.querySelector(":scope > .lead");
  if (lead) lead.after(node);
  else content.prepend(node);
}

function markHidden(node) {
  if (!node || node.dataset.residentAssessmentAccessHidden === "1") return;
  node.dataset.residentAssessmentAccessHidden = "1";
  node.hidden = true;
}

function restoreHidden() {
  document.querySelectorAll('[data-resident-assessment-access-hidden="1"]').forEach((node) => {
    node.hidden = false;
    delete node.dataset.residentAssessmentAccessHidden;
  });
}

function unavailableMarkup() {
  return `<section class="feature-coming-soon" data-resident-assessment-access-blocked="1">
    <div class="feature-coming-soon-icon" aria-hidden="true">🔒</div>
    <div>
      <small>NOT CURRENTLY AVAILABLE</small>
      <h2>My assessments</h2>
      <p>The assessment section is currently hidden by the training program Admin.</p>
    </div>
  </section>`;
}

function gateResidentAssessments() {
  if (!isResident()) return;

  if (state.enabled) {
    restoreHidden();
    return;
  }

  /* Hide every normal entry point to the resident assessment section. */
  document.querySelectorAll('#nav [data-go="assessments"], #content [data-go="assessments"]').forEach(markHidden);

  if (route() !== RESIDENT_ROUTE) return;
  const content = document.querySelector("#content");
  if (!content || content.querySelector('[data-resident-assessment-access-blocked="1"]')) return;
  const title = document.querySelector("#title");
  if (title) title.textContent = "My assessments";
  content.innerHTML = unavailableMarkup();
}

async function updateAccess(enabled, input) {
  if (!isOwner()) return;
  const previous = state.enabled;
  state.enabled = enabled;
  input.disabled = true;
  ensureAdminControl();
  try {
    const { error } = await sb
      .from("portal_feature_flags")
      .update({
        enabled,
        updated_at: new Date().toISOString(),
        updated_by: state.user?.id || null,
      })
      .eq("feature_key", FEATURE_KEY);
    if (error) throw error;
    toast(`Resident assessments: ${enabled ? "allowed" : "not allowed"}`);
  } catch (error) {
    state.enabled = previous;
    ensureAdminControl();
    toast(error?.message || "Could not update resident assessment access");
  }
}

function paint() {
  if (!state.ready || state.painting) return;
  state.painting = true;
  try {
    ensureAdminControl();
    gateResidentAssessments();
  } finally {
    state.painting = false;
  }
}

async function refreshFlag() {
  if (!state.user) return;
  try {
    const { data, error } = await sb
      .from("portal_feature_flags")
      .select("enabled")
      .eq("feature_key", FEATURE_KEY)
      .single();
    if (error) throw error;
    const next = data?.enabled !== false;
    const changed = next !== state.enabled;
    state.enabled = next;
    if (changed && isResident()) {
      location.reload();
      return;
    }
    paint();
  } catch (error) {
    console.warn("Resident assessment access flag could not be refreshed", error);
  }
}

async function loadState() {
  try {
    const { data: sessionData } = await sb.auth.getSession();
    state.user = sessionData?.session?.user || null;
    if (!state.user) return;

    const [{ data: profile }, { data: flag, error: flagError }] = await Promise.all([
      sb.from("profiles").select("role,is_active").eq("id", state.user.id).single(),
      sb.from("portal_feature_flags").select("enabled").eq("feature_key", FEATURE_KEY).single(),
    ]);
    if (flagError) throw flagError;
    state.profile = profile || null;
    state.enabled = flag?.enabled !== false;
  } catch (error) {
    console.warn("Resident assessment access could not be loaded", error);
  } finally {
    state.ready = true;
    paint();
  }
}

document.addEventListener("change", (event) => {
  const input = event.target.closest?.("[data-resident-assessment-access-toggle]");
  if (!input) return;
  void updateAccess(Boolean(input.checked), input);
});

const observer = new MutationObserver(() => {
  clearTimeout(window.__residentAssessmentAccessPaint);
  window.__residentAssessmentAccessPaint = setTimeout(paint, 70);
});
observer.observe(document.querySelector("#shell") || document.body, { childList: true, subtree: true });
window.addEventListener("hashchange", () => setTimeout(paint, 60));
setInterval(paint, 5000);
setInterval(() => void refreshFlag(), 12000);

void loadState();
