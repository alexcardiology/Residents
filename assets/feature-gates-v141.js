import { sb } from "./supabase.js";

const FEATURES = {
  chapters: {
    label: "Chapters",
    adminRoute: "curriculum",
    description: "Controls access to resident curriculum chapters.",
  },
  prior_experience_logbook: {
    label: "Prior experience logbook",
    adminRoute: "owner-logbook-center",
    description: "Controls access to the prior experience logbook and its review workflow.",
  },
  minimum_requirements: {
    label: "Minimum requirements",
    adminRoute: "owner-logbook-requirements",
    description: "Controls resident access to year-specific minimum procedural requirements and progress.",
  },
};

const state = {
  user: null,
  profile: null,
  flags: {
    chapters: false,
    prior_experience_logbook: false,
    minimum_requirements: false,
  },
  ready: false,
  painting: false,
};

const route = () => String(location.hash || "#dashboard").replace(/^#/, "").split("?")[0];
const isOwner = () => state.profile?.role === "owner";

function toast(message) {
  const node = document.querySelector("#toast");
  if (!node) return;
  node.textContent = message;
  node.style.display = "block";
  clearTimeout(window.__featureGateToastTimer);
  window.__featureGateToastTimer = setTimeout(() => {
    node.style.display = "none";
  }, 2800);
}

function soonCard(title, body, compact = false, marker = "") {
  return `<section class="feature-coming-soon ${compact ? "compact" : ""}" data-feature-gate-ui="1" ${marker ? `${marker}="1"` : ""}>
    <div class="feature-coming-soon-icon" aria-hidden="true">⏳</div>
    <div>
      <small>COMING SOON</small>
      <h2>${title}</h2>
      <p>${body}</p>
    </div>
  </section>`;
}

function addSoonBadgeToChaptersNav() {
  const button = document.querySelector('#nav [data-go="chapters"]');
  if (!button) return;
  button.querySelector(".feature-nav-soon")?.remove();
  if (!state.flags.chapters && !isOwner()) {
    const badge = document.createElement("span");
    badge.className = "feature-nav-soon";
    badge.textContent = "Soon";
    button.appendChild(badge);
  }
}

function gateChapters() {
  addSoonBadgeToChaptersNav();
  if (route() !== "chapters" || state.flags.chapters || isOwner()) return;
  const content = document.querySelector("#content");
  if (!content || content.querySelector('[data-feature-chapters-soon="1"]')) return;
  const title = document.querySelector("#title");
  if (title) title.textContent = "My chapters";
  content.innerHTML = soonCard(
    "Chapters",
    "Your curriculum chapters are being prepared and will be available soon.",
    false,
    "data-feature-chapters-soon",
  );
}

function clearPriorHidden() {
  document.querySelectorAll("#content .feature-prior-hidden-v141").forEach((node) => {
    node.classList.remove("feature-prior-hidden-v141");
    if (node.dataset.featurePriorInlineHidden === "1") {
      node.style.removeProperty("display");
      delete node.dataset.featurePriorInlineHidden;
    }
  });
}

function isPriorControl(element) {
  if (!element) return false;
  if (element.closest?.('[data-feature-gate-ui="1"]')) return false;
  const text = String(element.textContent || "").replace(/\s+/g, " ").trim();
  const hasPriorData = [...(element.attributes || [])].some((attr) => /^data-prior/i.test(attr.name));
  const classOrId = `${element.id || ""} ${element.className || ""}`;
  return hasPriorData || /prior[ _-]?(experience|logbook|review|audit|count|system)/i.test(classOrId) || /prior experience/i.test(text);
}

function gatePriorExperience() {
  if (state.flags.prior_experience_logbook || isOwner()) {
    clearPriorHidden();
    document.querySelectorAll('[data-feature-prior-soon="1"]').forEach((node) => node.remove());
    return;
  }

  const currentRoute = route();
  if (!["logbook", "logbook-requests", "dashboard"].includes(currentRoute)) return;
  const content = document.querySelector("#content");
  if (!content) return;

  if (currentRoute === "logbook") {
    const banner = content.querySelector(".prior-experience-alert");
    if (!banner) return;

    banner.classList.add("feature-prior-hidden-v141");
    banner.dataset.featurePriorInlineHidden = "1";
    banner.style.setProperty("display", "none", "important");

    if (!content.querySelector('[data-feature-prior-soon="1"]')) {
      const notice = document.createElement("div");
      notice.dataset.featurePriorSoon = "1";
      notice.dataset.featureGateUi = "1";
      notice.innerHTML = soonCard(
        "Prior Experience Logbook",
        "Your prior-experience logbook is being prepared and will be available soon.",
        true,
      );
      banner.before(notice);
    }
    return;
  }

  content.querySelectorAll('[class*="prior-"], [id*="prior"], [class*="prior_"], [id*="prior_"]').forEach((node) => {
    if (node.closest('[data-feature-gate-ui="1"]')) return;
    node.classList.add("feature-prior-hidden-v141");
  });

  content.querySelectorAll("button, a, [role='button']").forEach((node) => {
    if (!isPriorControl(node)) return;
    node.classList.add("feature-prior-hidden-v141");
  });
}

function clearMinimumRequirementsGate() {
  document.querySelectorAll('#content [data-feature-minimum-hidden="1"]').forEach((node) => {
    node.hidden = false;
    delete node.dataset.featureMinimumHidden;
  });
  document.querySelectorAll('[data-feature-minimum-soon="1"]').forEach((node) => node.remove());
}

function gateMinimumRequirements() {
  if (state.flags.minimum_requirements || isOwner()) {
    clearMinimumRequirementsGate();
    return;
  }

  const currentRoute = route();
  const content = document.querySelector("#content");
  if (!content) return;

  if (currentRoute === "logbook-minimum-requirements") {
    if (content.querySelector('[data-feature-minimum-route-soon="1"]')) return;
    const title = document.querySelector("#title");
    if (title) title.textContent = "My minimum requirements";
    content.innerHTML = soonCard(
      "My minimum requirements",
      "Your year-specific minimum procedural requirements are being prepared and will be available soon.",
      false,
      "data-feature-minimum-route-soon",
    );
    return;
  }

  if (currentRoute !== "logbook") return;
  const banner = content.querySelector(".minimum-access-banner");
  if (!banner) return;

  if (banner.dataset.featureMinimumHidden !== "1") {
    banner.hidden = true;
    banner.dataset.featureMinimumHidden = "1";
  }
  if (content.querySelector('[data-feature-minimum-soon="1"]')) return;

  const notice = document.createElement("div");
  notice.dataset.featureMinimumSoon = "1";
  notice.dataset.featureGateUi = "1";
  notice.innerHTML = soonCard(
    "My minimum requirements",
    "Your year-specific minimum procedural requirements will be available soon.",
    true,
  );
  banner.before(notice);
}

function adminControlMarkup(key) {
  const feature = FEATURES[key];
  const enabled = Boolean(state.flags[key]);
  return `<section class="feature-admin-control" data-feature-gate-ui="1" data-feature-admin-control="${key}">
    <div class="feature-admin-copy">
      <small>ACCESS CONTROL</small>
      <h3>${feature.label}</h3>
      <p>${feature.description}</p>
    </div>
    <label class="feature-switch-wrap">
      <span class="feature-status ${enabled ? "allowed" : "blocked"}">${enabled ? "Allowed" : "Not allowed"}</span>
      <span class="feature-switch">
        <input type="checkbox" data-feature-toggle="${key}" ${enabled ? "checked" : ""} aria-label="Allow ${feature.label}">
        <span class="feature-switch-track"><span></span></span>
      </span>
    </label>
  </section>`;
}

function ensureAdminControl() {
  if (!isOwner()) return;
  const currentRoute = route();
  const key = Object.keys(FEATURES).find((featureKey) => FEATURES[featureKey].adminRoute === currentRoute);
  document.querySelectorAll("[data-feature-admin-control]").forEach((node) => {
    if (!key || node.dataset.featureAdminControl !== key) node.remove();
  });
  if (!key) return;

  const content = document.querySelector("#content");
  if (!content) return;
  const existing = content.querySelector(`[data-feature-admin-control="${key}"]`);
  const markup = adminControlMarkup(key);
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

async function updateFeature(key, enabled, input) {
  if (!FEATURES[key] || !isOwner()) return;
  input.disabled = true;
  const previous = Boolean(state.flags[key]);
  state.flags[key] = enabled;
  ensureAdminControl();
  try {
    const { error } = await sb
      .from("portal_feature_flags")
      .update({
        enabled,
        updated_at: new Date().toISOString(),
        updated_by: state.user?.id || null,
      })
      .eq("feature_key", key);
    if (error) throw error;
    toast(`${FEATURES[key].label}: ${enabled ? "allowed" : "not allowed"}`);
  } catch (error) {
    state.flags[key] = previous;
    ensureAdminControl();
    toast(error?.message || "Could not update access setting");
  }
}

function paint() {
  if (!state.ready || state.painting) return;
  state.painting = true;
  try {
    gateChapters();
    gatePriorExperience();
    gateMinimumRequirements();
    ensureAdminControl();
  } finally {
    state.painting = false;
  }
}

function applyFlags(rows = []) {
  let changed = false;
  rows.forEach((row) => {
    if (!(row.feature_key in state.flags)) return;
    const next = Boolean(row.enabled);
    if (state.flags[row.feature_key] !== next) changed = true;
    state.flags[row.feature_key] = next;
  });
  return changed;
}

async function refreshFlags() {
  if (!state.user) return;
  try {
    const { data, error } = await sb.from("portal_feature_flags").select("feature_key,enabled");
    if (error) throw error;
    const changed = applyFlags(data || []);
    if (changed && !isOwner()) {
      location.reload();
      return;
    }
    paint();
  } catch (error) {
    console.warn("Feature flags could not be refreshed", error);
  }
}

async function loadState() {
  try {
    const { data: sessionData } = await sb.auth.getSession();
    state.user = sessionData?.session?.user || null;
    if (!state.user) return;

    const [{ data: profile }, { data: flags, error: flagsError }] = await Promise.all([
      sb.from("profiles").select("role,is_active").eq("id", state.user.id).single(),
      sb.from("portal_feature_flags").select("feature_key,enabled"),
    ]);
    if (flagsError) throw flagsError;
    state.profile = profile || null;
    applyFlags(flags || []);
  } catch (error) {
    console.warn("Feature gates could not be loaded", error);
  } finally {
    state.ready = true;
    paint();
  }
}

document.addEventListener("change", (event) => {
  const input = event.target.closest?.("[data-feature-toggle]");
  if (!input) return;
  void updateFeature(input.dataset.featureToggle, input.checked, input);
});

document.addEventListener("click", (event) => {
  if (!state.ready || state.flags.prior_experience_logbook || isOwner()) return;
  const control = event.target.closest?.("button, a, [role='button']");
  if (!control || !isPriorControl(control)) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  toast("Prior experience logbook will be available soon.");
}, true);

const observer = new MutationObserver(() => {
  clearTimeout(window.__featureGatePaintTimer);
  window.__featureGatePaintTimer = setTimeout(paint, 80);
});
observer.observe(document.querySelector("#shell") || document.body, { childList: true, subtree: true });
window.addEventListener("hashchange", () => setTimeout(paint, 60));
setInterval(paint, 6000);
setInterval(() => void refreshFlags(), 12000);

void loadState();
