import { sb } from "./supabase.js";

let currentUserId = "";
let currentRole = "";
let cachedScheduleName = "";
let profileLoaded = false;
let loadingPromise = null;

const escapeHtml = (value) =>
  String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[char]);

async function loadOwnProfile() {
  if (profileLoaded) return;
  if (loadingPromise) return loadingPromise;
  loadingPromise = (async () => {
    try {
      const { data: sessionData } = await sb.auth.getSession();
      currentUserId = String(sessionData?.session?.user?.id || "");
      if (!currentUserId) return;
      const { data, error } = await sb
        .from("profiles")
        .select("role,faculty_schedule_name")
        .eq("id", currentUserId)
        .single();
      if (error) throw error;
      currentRole = String(data?.role || "");
      cachedScheduleName = String(data?.faculty_schedule_name || "").trim();
      profileLoaded = true;
    } catch (error) {
      console.warn("Could not load faculty schedule name", error);
    } finally {
      loadingPromise = null;
    }
  })();
  return loadingPromise;
}

function buildScheduleNameField(value = "") {
  const label = document.createElement("label");
  label.className = "faculty-schedule-name-field full";
  label.dataset.facultyScheduleField = "1";
  label.innerHTML = `
    <span class="faculty-schedule-name-title">
      <span>Name in faculty schedules</span>
      <b>IMPORTANT</b>
    </span>
    <input
      name="faculty_schedule_name"
      value="${escapeHtml(value)}"
      maxlength="80"
      autocomplete="off"
      dir="auto"
      placeholder="Example: مرزوق"
      required
    >
    <small>Write your name exactly as it appears in the faculty duty/rotation schedules. El Médico uses this name to match you with your assignments.</small>
  `;
  return label;
}

async function ensureField() {
  const form = document.querySelector("#profileForm");
  if (!form || form.dataset.facultyScheduleEnhanced === "1") return;
  await loadOwnProfile();
  if (currentRole !== "resident") return;

  form.dataset.facultyScheduleEnhanced = "1";
  const displayInput = form.querySelector('input[name="display_name"]');
  const displayLabel = displayInput?.closest("label");
  const scheduleField = buildScheduleNameField(cachedScheduleName);
  if (displayLabel) displayLabel.insertAdjacentElement("afterend", scheduleField);
  else form.prepend(scheduleField);

  const input = scheduleField.querySelector('input[name="faculty_schedule_name"]');
  input?.addEventListener("input", () => {
    cachedScheduleName = String(input.value || "").trim();
    scheduleField.classList.toggle("is-empty", !cachedScheduleName);
  });
  scheduleField.classList.toggle("is-empty", !cachedScheduleName);
}

async function saveScheduleName(form) {
  if (currentRole !== "resident" || !currentUserId) return;
  const input = form.querySelector('input[name="faculty_schedule_name"]');
  if (!input) return;
  const value = String(input.value || "").trim();
  if (!value) return;
  try {
    const { error } = await sb
      .from("profiles")
      .update({ faculty_schedule_name: value })
      .eq("id", currentUserId);
    if (error) throw error;
    cachedScheduleName = value;
  } catch (error) {
    console.error("Could not save faculty schedule name", error);
    const toast = document.querySelector("#toast");
    if (toast) {
      toast.textContent = "Your other profile details were saved, but the faculty schedule name could not be updated. Please try again.";
      toast.style.display = "block";
      setTimeout(() => { toast.style.display = "none"; }, 4500);
    }
  }
}

document.addEventListener("submit", (event) => {
  const form = event.target;
  if (!(form instanceof HTMLFormElement) || form.id !== "profileForm") return;
  void saveScheduleName(form);
}, true);

const observer = new MutationObserver(() => { void ensureField(); });
observer.observe(document.documentElement, { childList: true, subtree: true });
void loadOwnProfile().then(ensureField);
