import { sb } from "./supabase.js";

let isOwner = false;
let paintQueued = false;

const ROOT_ROUTES = new Set(["", "dashboard"]);
const LOGBOOK_ROUTES = new Set([
  "logbook",
  "logbook-requests",
  "owner-intervention-audit",
  "owner-logbook-requirements",
  "owner-logbook-requirement-assessors",
  "owner-prior-experience-status",
  "owner-prior-experience-assignments",
  "owner-pending-requests",
  "message-cleanup",
]);
const ASSESSMENT_ROUTES = new Set(["assessments", "assignments", "owner-assessment-schedules"]);

function currentRoute(){
  return String(location.hash || "#dashboard").replace(/^#/, "").split("?")[0] || "dashboard";
}

function parentRoute(route){
  if (route === "owner-logbook-center") return "dashboard";
  if (route === "owner-assessment-center") return "dashboard";
  if (LOGBOOK_ROUTES.has(route) || route.includes("prior-experience") || route.includes("logbook")) return "owner-logbook-center";
  if (ASSESSMENT_ROUTES.has(route) || route.includes("assessment")) return "owner-assessment-center";
  return "dashboard";
}

function ensureBackButton(){
  if (!isOwner) return;
  const route = currentRoute();
  const content = document.querySelector("#content");
  if (!content) return;
  const existing = content.querySelector(":scope > .admin-global-back-row");
  if (ROOT_ROUTES.has(route)) {
    existing?.remove();
    return;
  }
  if (existing) return;
  const row = document.createElement("div");
  row.className = "admin-global-back-row";
  row.innerHTML = '<button type="button" class="admin-global-back" data-admin-global-back><span class="admin-back-arrow" aria-hidden="true">←</span><span>Back</span></button>';
  content.prepend(row);
}

function parseRgbToken(token){
  const match = String(token || "").match(/rgba?\(([^)]+)\)/i);
  if (!match) return null;
  const parts = match[1].split(",").map((part)=>Number.parseFloat(part.trim()));
  if (parts.length < 3 || parts.slice(0,3).some((v)=>Number.isNaN(v))) return null;
  return { r:parts[0], g:parts[1], b:parts[2], a:parts.length>3 && Number.isFinite(parts[3]) ? parts[3] : 1 };
}

function isRedSurface(c){
  if (!c || c.a <= .04) return false;
  const brightness = .299*c.r + .587*c.g + .114*c.b;
  return c.r >= 55 && c.r > c.g * 1.38 && c.r > c.b * 1.12 && brightness < 175;
}

function backgroundState(el, parentRed){
  const style = getComputedStyle(el);
  const bg = parseRgbToken(style.backgroundColor);
  const image = String(style.backgroundImage || "none");
  if (image !== "none") {
    const colors = [...image.matchAll(/rgba?\([^)]+\)/gi)].map((m)=>parseRgbToken(m[0])).filter(Boolean);
    if (colors.some(isRedSurface)) return true;
    if (colors.length && colors.every((c)=>c.a > .5)) return false;
  }
  if (bg && bg.a >= .55) return isRedSurface(bg);
  if (bg && bg.a > .04) return parentRed || isRedSurface(bg);
  return parentRed;
}

function paintRedText(){
  if (!isOwner || !document.documentElement.classList.contains("admin-red-theme")) return;
  const root = document.body;
  if (!root) return;
  const walk = (el, parentRed=false) => {
    if (!(el instanceof HTMLElement)) return;
    const red = backgroundState(el, parentRed);
    el.classList.toggle("admin-on-red-surface", red);
    for (const child of el.children) walk(child, red);
  };
  walk(root, false);
}

function schedulePaint(){
  if (paintQueued) return;
  paintQueued = true;
  requestAnimationFrame(()=>{
    paintQueued = false;
    ensureBackButton();
    paintRedText();
  });
}

document.addEventListener("click", (event)=>{
  const button = event.target.closest("[data-admin-global-back]");
  if (!button || !isOwner) return;
  event.preventDefault();
  location.hash = parentRoute(currentRoute());
});

window.addEventListener("hashchange", schedulePaint);

try {
  const { data: sessionData } = await sb.auth.getSession();
  const uid = sessionData?.session?.user?.id;
  if (uid) {
    const { data: profile } = await sb.from("profiles").select("role").eq("id", uid).maybeSingle();
    isOwner = String(profile?.role || "") === "owner";
  }
} catch (_) {
  isOwner = false;
}

if (isOwner) {
  new MutationObserver(schedulePaint).observe(document.documentElement, { childList:true, subtree:true, attributes:true, attributeFilter:["class","style"] });
  setTimeout(schedulePaint, 0);
  setTimeout(schedulePaint, 350);
  setTimeout(schedulePaint, 1000);
}
