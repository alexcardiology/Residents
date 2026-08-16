import { sb } from "./supabase.js";

const HEARTBEAT_MS = 60000;
let heartbeatTimer = null;
let lastSentAt = 0;

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

async function sendActivity(eventName = "heartbeat", force = false) {
  const now = Date.now();
  if (!force && now - lastSentAt < 30000) return;
  lastSentAt = now;
  try {
    const { data: { session } } = await sb.auth.getSession();
    if (!session?.user) return;
    const { error } = await sb.rpc("record_user_activity", {
      p_event: eventName,
      p_login_method: null,
      p_platform: detectPlatform(),
      p_path: `${location.pathname}${location.hash || ""}`,
    });
    if (error) throw error;
  } catch (error) {
    console.debug("User activity heartbeat unavailable", error);
  }
}

async function init() {
  await sendActivity("session_start", true);
  heartbeatTimer = window.setInterval(() => {
    if (document.visibilityState === "visible") void sendActivity("heartbeat", true);
  }, HEARTBEAT_MS);

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") void sendActivity("heartbeat", true);
  });
  window.addEventListener("focus", () => void sendActivity("heartbeat"));
  window.addEventListener("hashchange", () => void sendActivity("heartbeat", true));
  ["pointerdown", "keydown", "touchstart"].forEach((name) => {
    window.addEventListener(name, () => void sendActivity("heartbeat"), { passive: true });
  });
}

void init();
