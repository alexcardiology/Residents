import { sb } from "./supabase.js";

const VERSION = "20260816";
const INSTALL_KEY_STORAGE = "cardiology-ios-install-key-v20260816";

function isIOSDevice() {
  const ua = navigator.userAgent || "";
  return /iPhone|iPad|iPod/i.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

function getInstallKey() {
  let key = window.localStorage.getItem(INSTALL_KEY_STORAGE);
  if (key) return key;
  if (globalThis.crypto?.randomUUID) key = globalThis.crypto.randomUUID();
  else if (globalThis.crypto?.getRandomValues) {
    const bytes = new Uint32Array(4);
    globalThis.crypto.getRandomValues(bytes);
    key = Array.from(bytes, (value) => value.toString(16).padStart(8, "0")).join("-");
  } else key = `${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
  window.localStorage.setItem(INSTALL_KEY_STORAGE, key);
  return key;
}

async function recordEvent(eventType) {
  const sentKey = `cardiology-ios-analytics-sent:${VERSION}:${eventType}`;
  if (window.localStorage.getItem(sentKey) === "1") return;
  try {
    const { error } = await sb.rpc("record_app_install_event", {
      p_event_type: eventType,
      p_install_key: getInstallKey(),
      p_installer_version: VERSION,
      p_path: location.pathname,
    });
    if (error) throw error;
    window.localStorage.setItem(sentKey, "1");
  } catch (error) {
    console.debug("iPhone install analytics unavailable", error);
  }
}

if (isIOSDevice()) {
  const installerPage = /\/iphone-install-20260816\.html$/i.test(location.pathname);
  const standalone = window.navigator.standalone === true || window.matchMedia?.("(display-mode: standalone)")?.matches === true;
  if (installerPage) void recordEvent("installer_view");
  else if (standalone) void recordEvent("standalone_launch");
}
