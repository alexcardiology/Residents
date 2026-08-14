import { sb } from "./supabase.js";

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
    const profile = await loadActiveProfile(session.user.id);
    if (!profile?.is_active) {
      await sb.auth.signOut();
      return;
    }
    // A persisted authenticated session should go straight back to the portal.
    location.replace("app.html#dashboard");
  } catch (error) {
    // Keep the stored session on temporary network/profile-read errors.
    console.warn("Could not restore portal session yet:", error);
  }
}

async function authenticate(form, reviewAccess = false) {
  const message = form.querySelector(".msg");
  const button = form.querySelector("button");
  const formData = new FormData(form);
  const email = String(formData.get("identifier") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "");

  message.textContent = "";
  button.disabled = true;

  try {
    if (!email.includes("@")) {
      throw new Error("Please use your email temporarily. Username login will be restored after access is working.");
    }

    const { data, error } = await sb.auth.signInWithPassword({ email, password });
    if (error) throw error;
    if (!data.user) throw new Error("Unable to sign in.");

    let profile;
    try {
      profile = await loadActiveProfile(data.user.id);
    } catch (profileError) {
      // Do not destroy a valid persisted session because of a temporary fetch/RLS/network error.
      message.textContent = "Signed in, but your profile could not be loaded. Refresh in a moment.";
      button.disabled = false;
      return;
    }

    if (!profile?.is_active) {
      await sb.auth.signOut();
      throw new Error("Account inactive. Contact the admin.");
    }

    if (reviewAccess && !["observer", "assessor"].includes(profile.role)) {
      throw new Error("Review access is available only to observers and assessors.");
    }
    if (!reviewAccess && profile.role === "observer") {
      throw new Error("Observers must use the Write a Review section.");
    }

    if (reviewAccess && profile.role === "assessor") {
      location.replace("app.html#write-review");
      return;
    }
    location.replace("app.html#dashboard");
  } catch (error) {
    // Invalid credentials do not create a session. For a valid existing session, keep it
    // unless access itself was explicitly revoked/inactivated above.
    message.textContent = error?.message || "Unable to sign in. Please try again.";
    button.disabled = false;
  }
}

document.querySelector("#mainLogin")?.addEventListener("submit", (event) => {
  event.preventDefault();
  authenticate(event.currentTarget, false);
});

document.querySelector("#reviewLogin")?.addEventListener("submit", (event) => {
  event.preventDefault();
  authenticate(event.currentTarget, true);
});

restoreExistingSession();
