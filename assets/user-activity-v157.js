import { sb } from "./supabase.js";

// Edge-quota protection: activity presence is intentionally coarse-grained.
// One heartbeat every 15 minutes is enough for admin activity monitoring and
// avoids turning normal clicks/focus/navigation into background Edge traffic.
const HEARTBEAT_MS = 15 * 60 * 1000;
let heartbeatTimer = null;
let trackingEnabled = false;
let activityInFlight = false;

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

async function sendActivity(eventName = "heartbeat") {
  if (!trackingEnabled || activityInFlight) return;
  activityInFlight = true;
  try {
    const { error } = await sb.rpc("record_user_activity", {
      p_event: eventName,
      p_login_method: null,
      p_platform: detectPlatform(),
      p_path: `${location.pathname}${location.hash || ""}`,
    });
    if (error) throw error;
  } catch (error) {
    console.debug("User activity heartbeat unavailable", error);
  } finally {
    activityInFlight = false;
  }
}

async function init() {
  try {
    // Resolve the session once at startup instead of on every heartbeat.
    const { data: { session } } = await sb.auth.getSession();
    if (!session?.user) return;

    trackingEnabled = true;
    await sendActivity("session_start");

    heartbeatTimer = window.setInterval(() => {
      if (document.visibilityState === "visible") void sendActivity("heartbeat");
    }, HEARTBEAT_MS);

    // Record an explicit logout when possible, but never block logout UX.
    document.addEventListener("click", (event) => {
      if (!event.target.closest?.("#logout")) return;
      if (heartbeatTimer) {
        clearInterval(heartbeatTimer);
        heartbeatTimer = null;
      }
      void sendActivity("logout").finally(() => { trackingEnabled = false; });
    }, true);
  } catch (error) {
    console.debug("User activity tracking unavailable", error);
  }
}

void init();
