import { sb } from "./supabase.js";
import "./feature-gates-v143.js?v=1.0.143";
import "./admin-inbox-penalty-actions-v230.js?v=1.0.232";

let isOwner = false;
let uiQueued = false;
let burstTimers = [];

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
  if (route === "admin-schedule") return "dashboard";
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

function scheduleUi(){
  if (uiQueued) return;
  uiQueued = true;
  requestAnimationFrame(()=>{
    uiQueued = false;
    ensureBackButton();
  });
}

function scheduleUiBurst(){
  burstTimers.forEach((timer)=>clearTimeout(timer));
  burstTimers = [0, 180, 650].map((delay)=>setTimeout(scheduleUi, delay));
}

document.addEventListener("click", (event)=>{
  const button = event.target.closest("[data-admin-global-back]");
  if (!button || !isOwner) return;
  event.preventDefault();
  location.hash = parentRoute(currentRoute());
});

window.addEventListener("hashchange", scheduleUiBurst);

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
  // Keep this module deliberately lightweight. Previous versions scanned every
  // DOM element with getComputedStyle and also observed class/style mutations.
  // On large admin pages that created a feedback loop and froze the portal.
  // Theme colors are handled by CSS; this file now only manages the Back button.
  scheduleUiBurst();
}
