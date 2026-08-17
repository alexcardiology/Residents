import { sb, AUTH_PERSISTENCE_KEY } from "./supabase-v175.js";

const AUTH_STORAGE_PREFIX = "sb-dwkkhqmifmmxubtuaqbd-auth-token";
const MIGRATION_KEY = "cardiology-auth-client-version";

function clearStaleAuthOnce() {
  if (localStorage.getItem(MIGRATION_KEY) === "175") return;
  for (const storage of [localStorage, sessionStorage]) {
    try {
      const remove = [];
      for (let i = 0; i < storage.length; i += 1) {
        const key = storage.key(i) || "";
        if (key.startsWith(AUTH_STORAGE_PREFIX)) remove.push(key);
      }
      remove.forEach((key) => storage.removeItem(key));
    } catch (_) {}
  }
  localStorage.removeItem("cardiology-account-switch-sessions-v1");
  localStorage.setItem(MIGRATION_KEY, "175");
}

clearStaleAuthOnce();

function detectPlatform() {
  try {
    const cap = window.Capacitor;
    if (cap?.isNativePlatform?.() === true) {
      const platform = String(cap?.getPlatform?.() || "").toLowerCase();
      if (platform === "android") return "android_app";
      if (platform === "ios") return "ios_app";
    }
  } catch (_) {}
  if (window.navigator.standalone === true || window.matchMedia?.("(display-mode: standalone)")?.matches === true) {
    return /Android/i.test(navigator.userAgent || "") ? "android_app" : "ios_app";
  }
  return "web";
}

function syncKeepSignedInControl() {
  const checkbox = document.querySelector('#mainLogin input[name="keepSignedIn"]');
  if (!checkbox) return;
  const saved = localStorage.getItem(AUTH_PERSISTENCE_KEY);
  if (saved !== null) checkbox.checked = saved !== "0";
}

async function loadActiveProfile(userId) {
  const { data: profile, error } = await sb
    .from("profiles")
    .select("role,is_active")
    .eq("id", userId)
    .single();
  if (error) throw error;
  return profile;
}

async function restoreExistingSession() {
  try {
    const { data: { session }, error } = await sb.auth.getSession();
    if (error || !session?.user) return;
    const { data: verified, error: verifyError } = await sb.auth.getUser(session.access_token);
    if (verifyError || verified?.user?.id !== session.user.id) return;
    const profile = await loadActiveProfile(session.user.id);
    if (!profile?.is_active) return;
    location.replace("app.html?auth=175#dashboard");
  } catch (error) {
    console.warn("Could not restore portal session yet:", error);
  }
}

async function authenticate(form) {
  const message = form.querySelector(".msg");
  const button = form.querySelector('button[type="submit"]');
  const formData = new FormData(form);
  const email = String(formData.get("identifier") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "");
  const keepSignedIn = formData.get("keepSignedIn") === "on";

  message.textContent = "";
  button.disabled = true;

  try {
    if (!email.includes("@")) throw new Error("Please use your email temporarily. Username login will be restored after access is working.");
    localStorage.setItem(AUTH_PERSISTENCE_KEY, keepSignedIn ? "1" : "0");

    const { data, error } = await sb.auth.signInWithPassword({ email, password });
    if (error) throw error;
    if (!data?.user?.id || !data?.session?.access_token) throw new Error("Unable to create a valid session.");

    const { data: verified, error: verifyError } = await sb.auth.getUser(data.session.access_token);
    if (verifyError || verified?.user?.id !== data.user.id) throw new Error("Your sign-in was accepted, but the session could not be verified.");

    const profile = await loadActiveProfile(data.user.id);
    if (!profile?.is_active) {
      await sb.auth.signOut();
      throw new Error("Account inactive. Please contact the training team.");
    }

    try {
      await sb.rpc("record_user_activity", {
        p_event: "login",
        p_login_method: "email",
        p_platform: detectPlatform(),
        p_path: location.pathname,
      });
    } catch (_) {}

    location.replace("app.html?auth=175#dashboard");
  } catch (error) {
    const raw = String(error?.message || "Unable to sign in. Please try again.");
    message.textContent = /api\s*key|apikey|invalid key/i.test(raw)
      ? "Portal authentication is reconnecting. Please try once more."
      : raw;
    button.disabled = false;
  }
}

document.querySelector("#mainLogin")?.addEventListener("submit", (event) => {
  event.preventDefault();
  authenticate(event.currentTarget);
});

syncKeepSignedInControl();
restoreExistingSession();
