import { sb } from "./supabase.js";

async function authenticate(form, reviewAccess = false) {
  const message = form.querySelector(".msg");
  const button = form.querySelector("button");
  const formData = new FormData(form);

  const email = String(
    formData.get("identifier") || "",
  )
    .trim()
    .toLowerCase();

  const password = String(
    formData.get("password") || "",
  );

  message.textContent = "";
  button.disabled = true;

  try {
    if (!email.includes("@")) {
      throw new Error(
        "Please use your email temporarily. Username login will be restored after access is working.",
      );
    }

    const { data, error } =
      await sb.auth.signInWithPassword({
        email,
        password,
      });

    if (error) throw error;
    if (!data.user) {
      throw new Error("Unable to sign in.");
    }

    const { data: profile, error: profileError } =
      await sb
        .from("profiles")
        .select("role,is_active")
        .eq("id", data.user.id)
        .single();

    if (profileError || !profile) {
      throw new Error("Unable to load your account profile.");
    }

    if (!profile.is_active) {
      await sb.auth.signOut();
      throw new Error(
        "Account inactive. Contact the owner.",
      );
    }

    if (
      reviewAccess &&
      !["observer", "assessor"].includes(profile.role)
    ) {
      throw new Error(
        "Review access is available only to observers and assessors.",
      );
    }

    if (
      !reviewAccess &&
      profile.role === "observer"
    ) {
      throw new Error(
        "Observers must use the Write a Review section.",
      );
    }

    if (
      reviewAccess &&
      profile.role === "assessor"
    ) {
      location.replace("app.html#write-review");
      return;
    }

    location.replace("app.html#dashboard");
  } catch (error) {
    await sb.auth.signOut();

    message.textContent =
      error?.message ||
      "Unable to sign in. Please try again.";

    button.disabled = false;
  }
}

document
  .querySelector("#mainLogin")
  .addEventListener("submit", (event) => {
    event.preventDefault();
    authenticate(event.currentTarget, false);
  });

document
  .querySelector("#reviewLogin")
  .addEventListener("submit", (event) => {
    event.preventDefault();
    authenticate(event.currentTarget, true);
  });
