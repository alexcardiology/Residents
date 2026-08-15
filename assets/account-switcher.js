import { sb } from "./supabase.js";

const ACCOUNTS = [
  {
    email: "drmohamedalaa90@gmail.com",
    label: "Admin",
    subtitle: "drmohamedalaa90@gmail.com",
  },
  {
    email: "drmohamedalaa90@icloud.com",
    label: "Dr. Mohamed Alaa",
    subtitle: "Assessor · drmohamedalaa90@icloud.com",
  },
];
const ALLOWED = new Set(ACCOUNTS.map((account) => account.email.toLowerCase()));
const VAULT_KEY = "cardiology-account-switch-sessions-v1";
const REMEMBER_KEY = "cardiology-account-switch-remember-v1";

const button = document.querySelector("#accountSwitchButton");
let currentEmail = "";
let currentSession = null;
let dialog = null;
let busy = false;

const safeJson = (value, fallback = {}) => {
  try { return JSON.parse(value); } catch (_) { return fallback; }
};
const readVault = () => safeJson(localStorage.getItem(VAULT_KEY) || "{}", {});
const writeVault = (vault) => localStorage.setItem(VAULT_KEY, JSON.stringify(vault));
const clearVault = () => localStorage.removeItem(VAULT_KEY);
const rememberEnabled = () => localStorage.getItem(REMEMBER_KEY) !== "0";
const setRememberEnabled = (enabled) => localStorage.setItem(REMEMBER_KEY, enabled ? "1" : "0");

function rememberSession(session) {
  if (!rememberEnabled()) return;
  const email = String(session?.user?.email || "").toLowerCase();
  if (!ALLOWED.has(email) || !session?.access_token || !session?.refresh_token) return;
  const vault = readVault();
  vault[email] = {
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    user_id: session.user.id,
    saved_at: Date.now(),
  };
  writeVault(vault);
}

async function rememberCurrentSession() {
  const { data } = await sb.auth.getSession();
  const session = data?.session || null;
  if (session) {
    currentSession = session;
    currentEmail = String(session.user?.email || "").toLowerCase();
    rememberSession(session);
  }
  return session;
}

function paintSwitchButton() {
  if (!button) return;
  const otherAccount = ACCOUNTS.find((account) => account.email.toLowerCase() !== currentEmail);
  const target = otherAccount?.label || "account";
  button.innerHTML = `<span class="account-switch-button-icon" aria-hidden="true">⇄</span><span class="account-switch-button-text">Switch to ${target}</span>`;
  button.setAttribute("aria-label", `Switch to ${target}`);
  button.setAttribute("title", `Switch to ${target}`);
}

function ensureDialog() {
  if (dialog) return dialog;
  dialog = document.createElement("dialog");
  dialog.id = "accountSwitcherDialog";
  dialog.className = "account-switch-dialog";
  dialog.innerHTML = `<div class="account-switch-shell"></div>`;
  document.body.appendChild(dialog);
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) dialog.close();
  });
  dialog.addEventListener("close", () => { busy = false; });
  return dialog;
}

function accountCard(account, vault) {
  const email = account.email.toLowerCase();
  const isCurrent = email === currentEmail;
  const remembered = rememberEnabled() && Boolean(vault[email]?.access_token && vault[email]?.refresh_token);
  return `
    <section class="account-switch-card ${isCurrent ? "is-current" : ""}" data-account-card="${email}">
      <div class="account-switch-avatar">${account.label.slice(0, 1).toUpperCase()}</div>
      <div class="account-switch-copy">
        <strong>${account.label}</strong>
        <small>${account.subtitle}</small>
      </div>
      ${isCurrent
        ? `<span class="account-current-badge">Current</span>`
        : `<button type="button" class="account-switch-action" data-switch-email="${email}">${remembered ? "Switch" : "Add"}</button>`}
      ${!isCurrent && !remembered ? `
        <form class="account-switch-login" data-login-email="${email}" hidden>
          <label>
            <span>Password</span>
            <div class="account-password-wrap">
              <input type="password" name="password" autocomplete="current-password" required>
              <button type="button" class="account-password-eye" aria-label="Show password">◉</button>
            </div>
          </label>
          <button type="submit" class="account-login-submit">Sign in once & switch</button>
        </form>` : ""}
    </section>`;
}

function renderDialog(message = "") {
  const modal = ensureDialog();
  const vault = readVault();
  const shell = modal.querySelector(".account-switch-shell");
  const remembered = rememberEnabled();
  shell.innerHTML = `
    <header class="account-switch-head">
      <div>
        <small>ACCOUNT SWITCHER</small>
        <h2>Switch user</h2>
        <p>Move between your Admin and Assessor workspaces on this device.</p>
      </div>
      <button type="button" class="account-switch-close" aria-label="Close">×</button>
    </header>
    ${message ? `<div class="account-switch-message">${message}</div>` : ""}
    <label class="account-remember-option">
      <input type="checkbox" data-remember-accounts ${remembered ? "checked" : ""}>
      <span><b>Remember both accounts on this device</b><small>Keep one-tap switching available after normal log out and the next sign-in.</small></span>
    </label>
    <div class="account-switch-list">
      ${ACCOUNTS.map((account) => accountCard(account, vault)).join("")}
    </div>
    <footer>Passwords are never saved. If Supabase invalidates or revokes a saved session, that account will ask for its password once to reconnect.</footer>`;

  shell.querySelector(".account-switch-close")?.addEventListener("click", () => modal.close());
  shell.querySelector("[data-remember-accounts]")?.addEventListener("change", async (event) => {
    const enabled = Boolean(event.currentTarget.checked);
    setRememberEnabled(enabled);
    if (!enabled) {
      clearVault();
      renderDialog("Remember me is off. Saved account-switch sessions were removed from this browser.");
      return;
    }
    await rememberCurrentSession();
    renderDialog("Remember me is on. Your account-switch sessions will remain available on this device.");
  });
  shell.querySelectorAll("[data-switch-email]").forEach((action) => {
    action.addEventListener("click", () => handleAccountAction(action.dataset.switchEmail));
  });
  shell.querySelectorAll(".account-password-eye").forEach((eye) => {
    eye.addEventListener("click", () => {
      const input = eye.closest(".account-password-wrap")?.querySelector("input");
      if (!input) return;
      input.type = input.type === "password" ? "text" : "password";
      eye.setAttribute("aria-label", input.type === "password" ? "Show password" : "Hide password");
    });
  });
  shell.querySelectorAll("[data-login-email]").forEach((form) => {
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const password = String(new FormData(form).get("password") || "");
      void signInAndSwitch(form.dataset.loginEmail, password);
    });
  });
}

async function handleAccountAction(email) {
  if (busy || !email || email === currentEmail) return;
  const vault = readVault();
  if (!rememberEnabled() || !vault[email]?.access_token || !vault[email]?.refresh_token) {
    const form = ensureDialog().querySelector(`[data-login-email="${email}"]`);
    if (form) {
      form.hidden = false;
      form.querySelector("input")?.focus();
    }
    return;
  }
  busy = true;
  const previous = await rememberCurrentSession();
  try {
    const { data, error } = await sb.auth.setSession({
      access_token: vault[email].access_token,
      refresh_token: vault[email].refresh_token,
    });
    if (error) throw error;
    const restoredEmail = String(data?.session?.user?.email || "").toLowerCase();
    if (restoredEmail !== email) throw new Error("The saved session belongs to another account.");
    rememberSession(data.session);
    location.reload();
  } catch (error) {
    const nextVault = readVault();
    delete nextVault[email];
    writeVault(nextVault);
    if (previous?.access_token && previous?.refresh_token) {
      await sb.auth.setSession({ access_token: previous.access_token, refresh_token: previous.refresh_token }).catch(() => {});
    }
    currentEmail = String(previous?.user?.email || currentEmail).toLowerCase();
    paintSwitchButton();
    busy = false;
    renderDialog("That saved session expired. Enter the password once to reconnect this account.");
    const form = ensureDialog().querySelector(`[data-login-email="${email}"]`);
    if (form) {
      form.hidden = false;
      form.querySelector("input")?.focus();
    }
  }
}

async function signInAndSwitch(email, password) {
  if (busy || !email || !password) return;
  busy = true;
  const previous = await rememberCurrentSession();
  const submit = ensureDialog().querySelector(`[data-login-email="${email}"] .account-login-submit`);
  if (submit) {
    submit.disabled = true;
    submit.textContent = "Signing in…";
  }
  try {
    const { data, error } = await sb.auth.signInWithPassword({ email, password });
    if (error) throw error;
    if (!data?.session) throw new Error("No session was returned.");
    const signedEmail = String(data.session.user?.email || "").toLowerCase();
    if (signedEmail !== email) throw new Error("Unexpected account returned.");
    rememberSession(data.session);
    location.reload();
  } catch (error) {
    if (previous?.access_token && previous?.refresh_token) {
      await sb.auth.setSession({ access_token: previous.access_token, refresh_token: previous.refresh_token }).catch(() => {});
      rememberSession(previous);
      currentEmail = String(previous.user?.email || currentEmail).toLowerCase();
    }
    paintSwitchButton();
    busy = false;
    renderDialog("Could not switch: check the password and try again.");
    const form = ensureDialog().querySelector(`[data-login-email="${email}"]`);
    if (form) {
      form.hidden = false;
      form.querySelector("input")?.focus();
    }
  }
}

async function init() {
  const { data: userData } = await sb.auth.getUser();
  currentEmail = String(userData?.user?.email || "").toLowerCase();
  if (!ALLOWED.has(currentEmail)) return;
  await rememberCurrentSession();
  if (button) {
    paintSwitchButton();
    button.hidden = false;
    button.addEventListener("click", () => {
      void rememberCurrentSession().finally(() => {
        paintSwitchButton();
        renderDialog();
        ensureDialog().showModal();
      });
    });
  }

  sb.auth.onAuthStateChange((event, session) => {
    if (event !== "SIGNED_OUT" && session && ALLOWED.has(String(session.user?.email || "").toLowerCase())) {
      currentEmail = String(session.user?.email || "").toLowerCase();
      rememberSession(session);
      paintSwitchButton();
    }
  });

  // Deliberately do not clear the saved account-switch vault on normal logout.
  // This is what lets the other remembered account remain available after the next sign-in.
}

void init();
