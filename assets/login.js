import { sb, AUTH_PERSISTENCE_KEY } from "./supabase.js?v=1.0.92";

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
    const profile = await loadActiveProfile(session.user.id);
    if (!profile?.is_active) {
      await sb.auth.signOut();
      return;
    }
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
    if (!data.user) throw new Error("Unable to sign in.");

    let profile;
    try {
      profile = await loadActiveProfile(data.user.id);
    } catch (profileError) {
      message.textContent = "Signed in, but your profile could not be loaded. Refresh in a moment.";
      button.disabled = false;
      return;
    }

    if (!profile?.is_active) {
      await sb.auth.signOut();
      throw new Error("Account inactive. Please contact the training team.");
    }

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
