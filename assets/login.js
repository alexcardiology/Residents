import { sb } from "./supabase.js";

async function authenticate(form, reviewAccess = false) {
  const message = form.querySelector(".msg");
  const button = form.querySelector("button");
  const formData = new FormData(form);

  const identifier = String(
    formData.get("identifier") || "",
  ).trim();

  const password = String(
    formData.get("password") || "",
  );

  message.textContent = "";
  button.disabled = true;

  try {
    const { data, error } = await sb.functions.invoke(
      "admin-users",
      {
        body: {
          action: "login",
          identifier,
          password,
        },
      },
    );

    if (error) throw error;
    if (data?.error) throw new Error(data.error);

    if (
      !data?.access_token ||
      !data?.refresh_token ||
      !data?.role
    ) {
      throw new Error("Unable to create the login session.");
    }

    if (
      reviewAccess &&
      !["observer", "assessor"].includes(data.role)
    ) {
      throw new Error(
        "Review access is available only to observers and assessors.",
      );
    }

    if (!reviewAccess && data.role === "observer") {
      throw new Error(
        "Observers must use the Write a Review sign-in section.",
      );
    }

    const { error: sessionError } =
      await sb.auth.setSession({
        access_token: data.access_token,
        refresh_token: data.refresh_token,
      });

    if (sessionError) throw sessionError;

    if (reviewAccess && data.role === "assessor") {
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
