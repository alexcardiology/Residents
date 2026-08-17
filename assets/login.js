import { sb, AUTH_PERSISTENCE_KEY } from "./supabase-v173.js";

function detectPlatform() {
  try {
    const cap = window.Capacitor;
    const native = cap?.isNativePlatform?.() === true;
    const platform = cap?.getPlatform?.();
    if (native && platform === "android") return "android_app";
    if (native && platform === "ios") return "ios_app";
  } catch (_) {}
  if (window.navigator.standalone === true || window.matchMedia?.("(display-mode: standalone)")?.matches === true) {
    return /Android/i.test(navigator.userAgent || "") ? "android_app" : "ios_app";
  }
  return "web";
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

function syncKeepSignedInControl() {
  const checkbox = document.querySelector('#mainLogin input[name="keepSignedIn"]');
  if (!checkbox) return;
  const saved = localStorage.getItem(AUTH_PERSISTENCE_KEY);
  if (saved !== null) checkbox.checked = saved !== "0";
}

async function restoreExistingSession() {
  try {
    const { data: { session }, error } = await sb.auth.getSession();
    if (error || !session?.user) return;

    const { data: verified, error: verifyError } = await sb.auth.getUser();
    if (verifyError || !verified?.user) return;

    const profile = await loadActiveProfile(session.user.id);
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
    if (!email.includes("@")) {
      throw new Error("Please use your email temporarily. Username login will be restored after access is working.");
    }

    localStorage.setItem(AUTH_PERSISTENCE_KEY, keepSignedIn ? "1" : "0");

    const { data, error } = await sb.auth.signInWithPassword({ email, password });
    if (error) throw error;
    if (!data?.session?.access_token || !data?.user) throw new Error("Unable to create a valid session.");

    // Verify the exact newly issued session before entering the portal. Never
    // auto-sign-out a fresh login just because an unrelated request is slow.
    const { data: verified, error: verifyError } = await sb.auth.getUser(data.session.access_token);
    if (verifyError || verified?.user?.id !== data.user.id) {
      throw new Error("Your sign-in was accepted, but the session could not be verified. Please retry once.");
    }

    let profile;
    try {
      profile = await loadActiveProfile(data.user.id);
    } catch (_) {
      message.textContent = "Signed in successfully. Your profile is taking longer to load — please tap Sign in once more.";
      button.disabled = false;
      return;
    }

    if (!profile?.is_active) {
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

    location.replace("app.html#dashboard");
  } catch (error) {
    message.textContent = error?.message || "Unable to sign in. Please try again.";
    button.disabled = false;
  }
}

document.querySelector("#mainLogin")?.addEventListener("submit", (event) => {
  event.preventDefault();
  authenticate(event.currentTarget);
});

syncKeepSignedInControl();
restoreExistingSession();
