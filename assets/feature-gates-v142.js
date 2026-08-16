import { sb } from "./supabase.js";

if (!document.querySelector('link[data-feature-gates-styles]')) {
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = new URL("./feature-gates-v141.css?v=1.0.142", import.meta.url).href;
  link.dataset.featureGatesStyles = "1";
  document.head.appendChild(link);
}

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
};

const state = {
  user: null,
  profile: null,
  flags: {
    chapters: false,
    prior_experience_logbook: false,
  },
  ready: false,
  painting: false,
};

const route = () => String(location.hash || "#dashboard").replace(/^#/, "").split("?")[0] || "dashboard";
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

function soonCard(title, body, compact = false) {
  return `<section class="feature-coming-soon ${compact ? "compact" : ""}" data-feature-gate-ui="1">
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
  if (!state.flags.chapters) {
    const badge = document.createElement("span");
    badge.className = "feature-nav-soon";
    badge.textContent = "Soon";
    button.appendChild(badge);
  }
}

function gateChapters() {
  addSoonBadgeToChaptersNav();
  const content = document.querySelector("#content");
  if (!content) return;

  if (route() !== "chapters" || state.flags.chapters || isOwner()) {
    delete content.dataset.featureChaptersGate;
    return;
  }

  const alreadyGated = content.dataset.featureChaptersGate === "1" && content.querySelector(".feature-coming-soon[data-feature-gate-ui='1']");
  if (alreadyGated) return;

  content.dataset.featureChaptersGate = "1";
  const title = document.querySelector("#title");
  if (title) title.textContent = "My chapters";
  content.innerHTML = soonCard(
    "Chapters",
    "Your curriculum chapters are being prepared and will be available soon.",
  );
}

function clearPriorHidden() {
  document.querySelectorAll("#content .feature-prior-hidden-v141").forEach((node) => {
    node.classList.remove("feature-prior-hidden-v141");
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
    document.querySelector('[data-feature-prior-soon="1"]')?.remove();
    return;
  }

  const currentRoute = route();
  if (!["logbook", "logbook-requests", "dashboard"].includes(currentRoute)) return;
  const content = document.querySelector("#content");
  if (!content) return;

  let foundPriorUi = false;
  content.querySelectorAll('[class*="prior-"], [id*="prior"], [class*="prior_"], [id*="prior_"]').forEach((node) => {
    if (node.closest('[data-feature-gate-ui="1"]')) return;
    node.classList.add("feature-prior-hidden-v141");
    foundPriorUi = true;
  });

  content.querySelectorAll("button, a, [role='button']").forEach((node) => {
    if (!isPriorControl(node)) return;
    node.classList.add("feature-prior-hidden-v141");
    foundPriorUi = true;
  });

  if (currentRoute === "dashboard" && !foundPriorUi) return;
  if (content.querySelector('[data-feature-prior-soon="1"]')) return;

  const notice = document.createElement("div");
  notice.dataset.featurePriorSoon = "1";
  notice.dataset.featureGateUi = "1";
  notice.innerHTML = soonCard(
    "Prior experience logbook",
    "This section will be available soon. Your current training logbook remains available normally.",
    true,
  );
  const lead = content.querySelector(":scope > .lead");
  if (lead) lead.after(notice);
  else content.prepend(notice);
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
  if (existing) {
    const status = existing.querySelector(".feature-status");
    const input = existing.querySelector("[data-feature-toggle]");
    const enabled = Boolean(state.flags[key]);
    if (status) {
      status.textContent = enabled ? "Allowed" : "Not allowed";
      status.classList.toggle("allowed", enabled);
      status.classList.toggle("blocked", !enabled);
    }
    if (input && input.checked !== enabled && !input.disabled) input.checked = enabled;
    return;
  }

  const wrapper = document.createElement("div");
  wrapper.innerHTML = adminControlMarkup(key);
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
    const { data, error } = await sb
      .from("portal_feature_flags")
      .update({
        enabled,
        updated_at: new Date().toISOString(),
        updated_by: state.user?.id || null,
      })
      .eq("feature_key", key)
      .select("feature_key,enabled")
      .single();
    if (error) throw error;
    state.flags[key] = Boolean(data?.enabled);
    toast(`${FEATURES[key].label}: ${state.flags[key] ? "allowed" : "not allowed"}`);
  } catch (error) {
    state.flags[key] = previous;
    toast(error?.message || "Could not update access setting");
  } finally {
    input.disabled = false;
    ensureAdminControl();
    paint();
  }
}

function paint() {
  if (!state.ready || state.painting) return;
  state.painting = true;
  try {
    gateChapters();
    gatePriorExperience();
    ensureAdminControl();
  } finally {
    state.painting = false;
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
    (flags || []).forEach((row) => {
      if (row.feature_key in state.flags) state.flags[row.feature_key] = Boolean(row.enabled);
    });
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

void loadState();
