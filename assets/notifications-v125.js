import { sb } from "./supabase.js";

// One-way migration from the legacy GitHub Pages origin. Push subscriptions are
// origin-bound, so old-origin clients must move to alexcardiology and subscribe there.
if (location.hostname.toLowerCase() === "drmohamedalaa90.github.io") {
  try {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.getRegistrations().then((regs) => Promise.all(regs.map((r) => r.unregister()))).catch(() => {});
    }
  } catch (_) {}
  const target = `https://alexcardiology.github.io/Residents/${location.pathname.split('/').pop() || 'app.html'}${location.search}${location.hash}`;
  location.replace(target);
}

const VAPID_PUBLIC = "BC5H5L4dqb6VTsWheVyxIS2j_Ol3pDyMbu9osQOtCghIT5qYM3GvF7IFxqSG0G6CLg0yKz_HS1oUVtBZekXrcj8";
let busy = false;

function toast(text) {
  const node = document.querySelector("#toast");
  if (!node) return;
  node.textContent = text; node.style.display = "block";
  setTimeout(() => { node.style.display = "none"; }, 4200);
}
function vapidBytes(base64) {
  const padding = "=".repeat((4 - base64.length % 4) % 4);
  const raw = atob((base64 + padding).replace(/-/g,"+").replace(/_/g,"/"));
  return Uint8Array.from([...raw].map((ch) => ch.charCodeAt(0)));
}
function pushSupport() {
  return {
    serviceWorker: "serviceWorker" in navigator,
    pushManager: "PushManager" in window,
    notification: "Notification" in window,
  };
}
function fullySupported() {
  const s = pushSupport();
  return s.serviceWorker && s.pushManager && s.notification;
}
function androidLike() {
  return /Android/i.test(navigator.userAgent || "");
}
function likelyInAppBrowser() {
  const ua = navigator.userAgent || "";
  return /FBAN|FBAV|Instagram|Line\/|wv\)|; wv|WhatsApp/i.test(ua);
}
function unsupportedMessage() {
  if (androidLike()) {
    if (likelyInAppBrowser()) return "Notifications are not available inside this in-app browser. Open Cardiology Residents in Chrome, Edge or Samsung Internet, then tap the bell again.";
    return "This Android browser does not expose Web Push. Open Cardiology Residents in Chrome, Edge or Samsung Internet, then tap the bell again.";
  }
  return "Push notifications are not supported by this browser. Please open the portal in a browser that supports web notifications.";
}
async function registration() {
  if (!fullySupported()) return null;
  const swUrl = new URL("../push-sw.js", import.meta.url);
  return navigator.serviceWorker.register(swUrl.href);
}
async function saveSubscription(sub) {
  const json = sub.toJSON();
  const keys = json.keys || {};
  const { error } = await sb.rpc("register_push_subscription_v125", {
    p_endpoint: json.endpoint,
    p_p256dh: keys.p256dh,
    p_auth: keys.auth,
    p_device_label: `${navigator.platform || "Device"} · ${navigator.userAgent.includes("Mobile") ? "Mobile" : "Web"} · ${location.hostname}`,
  });
  if (error) throw error;
}
async function ensureSubscription(askPermission = false) {
  if (busy) return false;
  busy = true;
  try {
    const reg = await registration();
    if (!reg) return false;
    let permission = Notification.permission;
    if (askPermission && permission === "default") permission = await Notification.requestPermission();
    if (permission !== "granted") return false;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: vapidBytes(VAPID_PUBLIC) });
    await saveSubscription(sub);
    return true;
  } finally { busy = false; updateButton(); }
}
function updateButton() {
  const btn = document.querySelector("#notificationEnableButton");
  if (!btn) return;
  // Never hide the bell. Android users in unsupported webviews need a visible
  // affordance that explains how to open the portal in a push-capable browser.
  btn.hidden = false;
  const supported = fullySupported();
  const permission = supported ? Notification.permission : "unsupported";
  btn.classList.toggle("is-enabled", permission === "granted");
  btn.classList.toggle("is-denied", permission === "denied");
  btn.classList.toggle("is-unsupported", permission === "unsupported");
  btn.textContent = permission === "denied" ? "🔕" : "🔔";
  btn.title = permission === "granted"
    ? "Push notifications enabled"
    : permission === "denied"
      ? "Notifications blocked in browser settings"
      : permission === "unsupported"
        ? "Tap for notification setup instructions"
        : "Enable push notifications";
  btn.setAttribute("aria-label",btn.title);
}
function installButton() {
  const header = document.querySelector(".workspace > header");
  if (!header || document.querySelector("#notificationEnableButton")) return;
  const btn = document.createElement("button");
  btn.id = "notificationEnableButton";
  btn.type = "button";
  const refresh = document.querySelector("#mobileHeaderRefresh");
  header.insertBefore(btn, refresh || null);
  btn.addEventListener("click", async () => {
    if (!fullySupported()) return alert(unsupportedMessage());
    if (Notification.permission === "denied") {
      return alert(androidLike()
        ? "Notifications are blocked for this site. Open your browser Site settings → Notifications → Allow for alexcardiology.github.io, then return here and tap the bell again."
        : "Notifications are blocked. Allow them in your browser/site settings first.");
    }
    try {
      const ok = await ensureSubscription(true);
      toast(ok ? "Push notifications enabled" : "Notification permission was not enabled");
    } catch (error) { alert(error?.message || String(error)); }
  });
  updateButton();
}
async function boot() {
  installButton();
  const { data } = await sb.auth.getSession();
  if (!data?.session) return;
  if (fullySupported() && Notification.permission === "granted") {
    try { await ensureSubscription(false); } catch (error) { console.warn("Push registration failed",error); }
  }
}
new MutationObserver(installButton).observe(document.documentElement,{childList:true,subtree:true});
sb.auth.onAuthStateChange((_event,session) => { if (session) setTimeout(boot,100); });
boot();