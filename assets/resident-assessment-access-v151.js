import { sb } from "./supabase.js";

const FEATURE_KEY = "resident_assessments";
const ADMIN_ROUTE = "owner-assessment-center";
const RESIDENT_ROUTE = "assessments";

const state = {
  user: null,
  profile: null,
  enabled: true,
  ready: false,
  saving: false,
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
  }, 3000);
}

function controlMarkup() {
  return `<section class="feature-admin-control" data-feature-gate-ui="1" data-resident-assessment-access-control="1">
    <div class="feature-admin-copy">
      <small>ACCESS CONTROL</small>
      <h3>Resident assessments</h3>
      <p>Controls whether residents can use My assessments. When disabled, residents still see the section marked Coming Soon. Assessor and Admin tools are unaffected.</p>
    </div>
    <label class="feature-switch-wrap" data-resident-assessment-switch-label>
      <span class="feature-status ${state.enabled ? "allowed" : "blocked"}" data-resident-assessment-status>${state.enabled ? "Allowed" : "Not allowed"}</span>
      <span class="feature-switch">
        <input type="checkbox" data-resident-assessment-access-toggle ${state.enabled ? "checked" : ""} ${state.saving ? "disabled" : ""} aria-label="Allow residents to access assessments">
        <span class="feature-switch-track"><span></span></span>
      </span>
    </label>
  </section>`;
}

function syncAdminControl() {
  document.querySelectorAll("[data-resident-assessment-access-control]").forEach((node) => {
    if (!isOwner() || route() !== ADMIN_ROUTE) node.remove();
  });
  if (!isOwner() || route() !== ADMIN_ROUTE) return;

  const content = document.querySelector("#content");
  if (!content) return;
  let control = content.querySelector("[data-resident-assessment-access-control]");
  if (!control) {
    const wrapper = document.createElement("div");
    wrapper.innerHTML = controlMarkup();
    control = wrapper.firstElementChild;
    const lead = content.querySelector(":scope > .lead");
    if (lead) lead.after(control);
    else content.prepend(control);
    return;
  }

  const status = control.querySelector("[data-resident-assessment-status]");
  const input = control.querySelector("[data-resident-assessment-access-toggle]");
  if (status) {
    status.textContent = state.enabled ? "Allowed" : "Not allowed";
    status.classList.toggle("allowed", state.enabled);
    status.classList.toggle("blocked", !state.enabled);
  }
  if (input) {
    input.checked = state.enabled;
    input.disabled = state.saving;
  }
}

function addSoonBadgeToAssessmentNav() {
  if (!isResident()) return;
  const button = document.querySelector('#nav [data-go="assessments"]');
  if (!button) return;

  /* Undo the old hide behaviour if an earlier cached pass marked this control. */
  if (button.dataset.residentAssessmentAccessHidden === "1") {
    button.hidden = false;
    delete button.dataset.residentAssessmentAccessHidden;
  }

  button.querySelector(".feature-nav-soon")?.remove();
  if (!state.enabled) {
    const badge = document.createElement("span");
    badge.className = "feature-nav-soon";
    badge.textContent = "Soon";
    button.appendChild(badge);
  }
}

function comingSoonMarkup() {
  return `<section class="feature-coming-soon" data-resident-assessment-access-blocked="1">
    <div class="feature-coming-soon-icon" aria-hidden="true">⏳</div>
    <div>
      <small>COMING SOON</small>
      <h2>Assessments</h2>
      <p>Your assessment section is being prepared and will be available soon.</p>
    </div>
  </section>`;
}

function gateResidentAssessments() {
  if (!isResident()) return;
  addSoonBadgeToAssessmentNav();

  if (state.enabled) return;
  if (route() !== RESIDENT_ROUTE) return;

  const content = document.querySelector("#content");
  if (!content) return;
  const title = document.querySelector("#title");
  if (title) title.textContent = "My assessments";
  if (!content.querySelector('[data-resident-assessment-access-blocked="1"]')) {
    content.innerHTML = comingSoonMarkup();
  }
}

async function readFlag() {
  const { data, error } = await sb
    .from("portal_feature_flags")
    .select("enabled")
    .eq("feature_key", FEATURE_KEY)
    .single();
  if (error) throw error;
  return data?.enabled !== false;
}

async function updateAccess(enabled) {
  if (!isOwner() || state.saving) return;
  const previous = state.enabled;
  state.enabled = enabled;
  state.saving = true;
  syncAdminControl();

  try {
    const { data, error } = await sb.rpc("owner_set_resident_assessment_access", { p_enabled: enabled });
    if (error) throw error;
    state.enabled = Boolean(data);

    const verified = await readFlag();
    state.enabled = verified;
    toast(`Resident assessments: ${verified ? "allowed" : "not allowed"}`);
  } catch (error) {
    state.enabled = previous;
    alert(`Could not change resident assessment access: ${error?.message || error}`);
  } finally {
    state.saving = false;
    syncAdminControl();
  }
}

function paint() {
  if (!state.ready) return;
  syncAdminControl();
  gateResidentAssessments();
}

async function refreshFlag() {
  if (!state.user || state.saving) return;
  try {
    const next = await readFlag();
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

    const [{ data: profile, error: profileError }, enabled] = await Promise.all([
      sb.from("profiles").select("role,is_active").eq("id", state.user.id).single(),
      readFlag(),
    ]);
    if (profileError) throw profileError;
    state.profile = profile || null;
    state.enabled = enabled;
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
  event.stopPropagation();
  void updateAccess(Boolean(input.checked));
});

/* Keyboard/click fallback for browsers where the visually-hidden checkbox change is unreliable. */
document.addEventListener("click", (event) => {
  const label = event.target.closest?.("[data-resident-assessment-switch-label]");
  if (!label || event.target.closest("input")) return;
  const input = label.querySelector("[data-resident-assessment-access-toggle]");
  if (!input || input.disabled) return;
  event.preventDefault();
  void updateAccess(!state.enabled);
});

const observer = new MutationObserver(() => {
  clearTimeout(window.__residentAssessmentAccessPaint);
  window.__residentAssessmentAccessPaint = setTimeout(paint, 80);
});
observer.observe(document.querySelector("#shell") || document.body, { childList: true, subtree: true });
window.addEventListener("hashchange", () => setTimeout(paint, 60));
setInterval(() => void refreshFlag(), 5000);

void loadState();
