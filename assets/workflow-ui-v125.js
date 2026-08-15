import { sb } from "./supabase.js";

const ICONS = [
  { re:/^attended$/i, cls:"mode-attended", icon:"👁", label:"Attended" },
  { re:/^(performed\s+assisted|with\s+assistance)$/i, cls:"mode-assisted", icon:"🤝", label:"Performed assisted" },
  { re:/^(performed\s+unassisted|solo\s+without\s+guidance)$/i, cls:"mode-unassisted", icon:"🩺", label:"Performed unassisted" },
  { re:/^supervise$/i, cls:"mode-supervise", icon:"👥", label:"Supervise" },
];
let fieldCache = null;
let fieldLoading = false;

function activityMatch(text) {
  const clean = String(text || "").replace(/\s+/g," ").trim();
  return ICONS.find((item) => item.re.test(clean));
}
function applyIcons(root=document) {
  root.querySelectorAll("th,.tag,.requirement-mode-label,.minimum-mode-label,.activity-mode-label-target").forEach((node) => {
    if (node.dataset.activityIconV125 === "1") return;
    const raw = String(node.childNodes?.[0]?.textContent || node.textContent || "").replace(/Achievement\s*\/\s*Target/ig,"").replace(/Achievement/ig,"").replace(/Target/ig,"").trim();
    const match = activityMatch(raw);
    if (!match) return;
    node.dataset.activityIconV125 = "1";
    const icon = document.createElement("span");
    icon.className = `activity-mode-icon ${match.cls}`;
    icon.setAttribute("aria-hidden","true");
    icon.textContent = match.icon;
    node.prepend(icon);
  });
}
async function getFields() {
  if (fieldCache) return fieldCache;
  if (fieldLoading) return [];
  fieldLoading = true;
  try {
    const { data, error } = await sb.rpc("get_my_audit_fields_v125");
    if (error) throw error;
    fieldCache = data || [];
    return fieldCache;
  } catch (_) { return []; }
  finally { fieldLoading = false; }
}
async function replaceSupervisionStrip() {
  const title = String(document.querySelector("#title")?.textContent || "").trim().toLowerCase();
  if (title !== "logbook requests") return;
  const old = document.querySelector(".assessor-supervision-strip");
  if (!old || old.dataset.fieldStripV125 === "1") return;
  old.dataset.fieldStripV125 = "1";
  const fields = await getFields();
  if (!fields.length) { old.remove(); return; }
  const unique = new Map();
  fields.forEach((row) => {
    const key = `${row.field_key}:${row.tier}`;
    if (!unique.has(key)) unique.set(key,row);
  });
  const strip = document.createElement("div");
  strip.className = "assessor-field-strip";
  strip.innerHTML = `<small>Audit fields</small>${[...unique.values()].map((row) => `<span class="assessor-field-badge ${row.tier === "lead_professor" ? "professor" : "faculty"}" title="${row.tier === "lead_professor" ? "Professor-level final audit" : "First-level faculty audit"}">${row.field_label}</span>`).join("")}`;
  old.replaceWith(strip);
}
function classifyPriorModal() {
  const dialog = document.querySelector("#modal");
  const modal = document.querySelector("#modalBody .prior-review-modal");
  if (!dialog) return;
  dialog.classList.toggle("prior-review-compact", Boolean(modal));
  if (modal) applyIcons(modal);
}
function enhance() {
  applyIcons(document);
  void replaceSupervisionStrip();
  classifyPriorModal();
}

new MutationObserver(enhance).observe(document.documentElement,{childList:true,subtree:true,characterData:true});
window.addEventListener("hashchange",()=>setTimeout(enhance,60));
document.querySelector("#modal")?.addEventListener("close",()=>document.querySelector("#modal")?.classList.remove("prior-review-compact"));
setInterval(enhance,1100);
enhance();
