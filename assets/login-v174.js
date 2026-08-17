import {
  sb,
  AUTH_PERSISTENCE_KEY,
  SUPABASE_URL,
  SUPABASE_BROWSER_KEY,
} from "./supabase-v174.js";

const AUTH_STORAGE_PREFIX = "sb-dwkkhqmifmmxubtuaqbd-auth-token";
const MIGRATION_KEY = "cardiology-auth-client-version";

function clearStaleAuthOnce() {
  if (localStorage.getItem(MIGRATION_KEY) === "174") return;
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
  localStorage.setItem(MIGRATION_KEY, "174");
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

async function passwordGrant(email, password) {
  const response = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    mode: "cors",
    cache: "no-store",
    credentials: "omit",
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_BROWSER_KEY,
      Authorization: `Bearer ${SUPABASE_BROWSER_KEY}`,
      "X-Client-Info": "cardiology-residents-auth-v174",
    },
    body: JSON.stringify({ email, password }),
  });

  let payload = null;
  try { payload = await response.json(); } catch (_) {}
  if (!response.ok) {
    const err = new Error(payload?.msg || payload?.message || payload?.error_description || payload?.error || `Sign-in failed (${response.status})`);
    err.status = response.status;
    err.code = payload?.code || payload?.error_code || "";
    throw err;
  }
  if (!payload?.access_token || !payload?.refresh_token || !payload?.user) throw new Error("Unable to create a valid session.");
  return payload;
}

async function signInFresh(email, password) {
  const grant = await passwordGrant(email, password);
  const result = await sb.auth.setSession({ access_token: grant.access_token, refresh_token: grant.refresh_token });
  if (result.error) throw result.error;
  return { client: sb, user: result.data.user || grant.user, session: result.data.session };
}

async function loadActiveProfile(client, userId) {
  const { data: profile, error } = await client
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
    const profile = await loadActiveProfile(sb, session.user.id);
    if (!profile?.is_active) return;
    location.replace("app.html#dashboard");
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

    const auth = await signInFresh(email, password);
    if (!auth?.user?.id || !auth?.session?.access_token) throw new Error("Unable to create a valid session.");

    const { data: verified, error: verifyError } = await auth.client.auth.getUser(auth.session.access_token);
    if (verifyError || verified?.user?.id !== auth.user.id) throw new Error("Your sign-in was accepted, but the session could not be verified.");

    const profile = await loadActiveProfile(auth.client, auth.user.id);
    if (!profile?.is_active) throw new Error("Account inactive. Please contact the training team.");

    try {
      await auth.client.rpc("record_user_activity", {
        p_event: "login",
        p_login_method: "email",
        p_platform: detectPlatform(),
        p_path: location.pathname,
      });
    } catch (_) {}

    location.replace("app.html#dashboard");
  } catch (error) {
    const raw = String(error?.message || "Unable to sign in. Please try again.");
    message.textContent = /api\s*key|apikey|invalid key/i.test(raw)
      ? "Portal authentication could not connect. Please try again in a moment."
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
