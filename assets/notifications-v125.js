import { sb } from "./supabase.js";

const VAPID_PUBLIC = "BC5H5L4dqb6VTsWheVyxIS2j_Ol3pDyMbu9osQOtCghIT5qYM3GvF7IFxqSG0G6CLg0yKz_HS1oUVtBZekXrcj8";
let busy = false;

function toast(text) {
  const node = document.querySelector("#toast");
  if (!node) return;
  node.textContent = text; node.style.display = "block";
  setTimeout(() => { node.style.display = "none"; }, 3000);
}
function vapidBytes(base64) {
  const padding = "=".repeat((4 - base64.length % 4) % 4);
  const raw = atob((base64 + padding).replace(/-/g,"+").replace(/_/g,"/"));
  return Uint8Array.from([...raw].map((ch) => ch.charCodeAt(0)));
}
async function registration() {
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return null;
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
    p_device_label: `${navigator.platform || "Device"} · ${navigator.userAgent.includes("Mobile") ? "Mobile" : "Web"}`,
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
  const supported = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
  if (!supported) { btn.hidden = true; return; }
  btn.hidden = false;
  btn.classList.toggle("is-enabled", Notification.permission === "granted");
  btn.classList.toggle("is-denied", Notification.permission === "denied");
  btn.textContent = Notification.permission === "granted" ? "🔔" : Notification.permission === "denied" ? "🔕" : "🔔";
  btn.title = Notification.permission === "granted" ? "Push notifications enabled" : Notification.permission === "denied" ? "Notifications blocked in browser settings" : "Enable push notifications";
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
    if (Notification.permission === "denied") return toast("Notifications are blocked. Allow them in your browser/site settings first.");
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
  if (typeof Notification !== "undefined" && Notification.permission === "granted") {
    try { await ensureSubscription(false); } catch (error) { console.warn("Push registration failed",error); }
  }
}
new MutationObserver(installButton).observe(document.documentElement,{childList:true,subtree:true});
sb.auth.onAuthStateChange((_event,session) => { if (session) setTimeout(boot,100); });
boot();
