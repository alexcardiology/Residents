import { sb } from "./supabase.js";

const IOS_VERSION = "20260816";
const ANDROID_VERSION = "android-mobile-latest";

function isIOSDevice() {
  const ua = navigator.userAgent || "";
  return /iPhone|iPad|iPod/i.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

function isAndroidDevice() {
  return /Android/i.test(navigator.userAgent || "");
}

function nativePlatform() {
  try {
    const cap = window.Capacitor;
    if (cap?.isNativePlatform?.() !== true) return "";
    return String(cap?.getPlatform?.() || "").toLowerCase();
  } catch (_) {
    return "";
  }
}

function keyStorage(platform, version) {
  return `cardiology-${platform}-install-key-${version}`;
}

function getInstallKey(platform, version) {
  const storageKey = keyStorage(platform, version);
  let key = window.localStorage.getItem(storageKey);
  if (key) return key;
  if (globalThis.crypto?.randomUUID) key = globalThis.crypto.randomUUID();
  else if (globalThis.crypto?.getRandomValues) {
    const bytes = new Uint32Array(4);
    globalThis.crypto.getRandomValues(bytes);
    key = Array.from(bytes, (value) => value.toString(16).padStart(8, "0")).join("-");
  } else key = `${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
  window.localStorage.setItem(storageKey, key);
  return key;
}

async function recordEvent(platform, eventType, version) {
  const sentKey = `cardiology-install-analytics-sent:${platform}:${version}:${eventType}`;
  if (window.localStorage.getItem(sentKey) === "1") return;
  try {
    const { error } = await sb.rpc("record_app_install_event_v2", {
      p_platform: platform,
      p_event_type: eventType,
      p_install_key: getInstallKey(platform, version),
      p_installer_version: version,
      p_path: location.pathname,
    });
    if (error) throw error;
    window.localStorage.setItem(sentKey, "1");
  } catch (error) {
    console.debug("App install analytics unavailable", error);
  }
}

const path = location.pathname;
const iosInstaller = /\/iphone-install-20260816\.html$/i.test(path);
const androidInstaller = /\/android\.html$/i.test(path);
const iosStandalone = window.navigator.standalone === true || (isIOSDevice() && window.matchMedia?.("(display-mode: standalone)")?.matches === true);
const platform = nativePlatform();

if (iosInstaller && isIOSDevice()) void recordEvent("ios", "installer_view", IOS_VERSION);
if (androidInstaller && isAndroidDevice()) void recordEvent("android", "installer_view", ANDROID_VERSION);
if (!iosInstaller && iosStandalone) void recordEvent("ios", "standalone_launch", IOS_VERSION);
if (!androidInstaller && platform === "android") void recordEvent("android", "native_launch", ANDROID_VERSION);

document.addEventListener("click", (event) => {
  const link = event.target.closest?.('a[href*="resident-training-android.apk"]');
  if (!link || !isAndroidDevice()) return;
  void recordEvent("android", "download_click", ANDROID_VERSION);
}, true);
