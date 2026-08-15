import { sb } from "./supabase.js";

const ICONS = [
  { re:/^attended$/i, cls:"mode-attended", icon:"👁", label:"Attended" },
  { re:/^(performed\s+assisted|performed\s+with\s+assistance|with\s+assistance)$/i, cls:"mode-assisted", icon:"🤝", label:"Performed assisted" },
  { re:/^(performed\s+unassisted|performed\s+solo\s+without\s+guidance|solo\s+without\s+guidance)$/i, cls:"mode-unassisted", icon:"🩺", label:"Performed unassisted" },
  { re:/^(supervise|supervised)$/i, cls:"mode-supervise", icon:"👥", label:"Supervised" },
];
let fieldCache = null;
let fieldLoading = false;

function activityMatch(text) {
  const clean = String(text || "").replace(/\s+/g," ").trim();
  return ICONS.find((item) => item.re.test(clean));
}
function normalizeVisibleTerms(root=document) {
  root.querySelectorAll("th,.tag,.requirement-mode-label,.minimum-mode-label,.activity-mode-label-target").forEach((node) => {
    if (node.children.length && node.querySelector(".activity-mode-icon")) return;
    const text = String(node.textContent || "").replace(/\s+/g," ").trim();
    const replacement = activityMatch(text);
    if (replacement && text !== replacement.label) node.textContent = replacement.label;
  });
}
function applyIcons(root=document) {
  root.querySelectorAll("th,.tag,.requirement-mode-label,.minimum-mode-label,.activity-mode-label-target").forEach((node) => {
    if (node.dataset.activityIconV125 === "1") return;
    const raw = String(node.textContent || "").replace(/Achievement\s*\/\s*Target/ig,"").replace(/Achievement/ig,"").replace(/Target/ig,"").replace(/\s+/g," ").trim();
    const match = activityMatch(raw);
    if (!match) return;
    node.dataset.activityIconV125 = "1";
    node.textContent = match.label;
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
  document.querySelectorAll(".assessor-supervision-strip").forEach((node)=>node.remove());
  if (document.querySelector(".assessor-field-strip")) return;
  const fields = await getFields();
  if (!fields.length) return;
  const unique = new Map();
  fields.forEach((row) => {
    const key = `${row.field_key}:${row.tier}`;
    if (!unique.has(key)) unique.set(key,row);
  });
  const strip = document.createElement("div");
  strip.className = "assessor-field-strip";
  strip.innerHTML = `<small>Audit fields</small>${[...unique.values()].map((row) => `<span class="assessor-field-badge ${row.tier === "lead_professor" ? "professor" : "faculty"}" title="${row.tier === "lead_professor" ? "Professor-level final audit" : "First-level faculty audit"}">${row.field_label}</span>`).join("")}`;
  const lead = document.querySelector("#content > .lead");
  if (lead) lead.after(strip); else document.querySelector("#content")?.prepend(strip);
}
function compactHistoricalTable(modal) {
  const table = modal?.querySelector(".prior-readonly-summary table.prior-count-table");
  if (!table || table.dataset.auditFourModes === "1") return;
  const headers = [...table.querySelectorAll("thead th")].map((th)=>String(th.textContent||"").replace(/\s+/g," ").trim().toLowerCase());
  const superviseIndex = headers.findIndex((h)=>/supervise/.test(h));
  const attendedIndex = headers.findIndex((h)=>h === "attended");
  const assistanceIndex = headers.findIndex((h)=>/with assistance/.test(h));
  const guidedIndex = headers.findIndex((h)=>/solo under guidance/.test(h));
  const unassistedIndex = headers.findIndex((h)=>/solo without guidance/.test(h));
  const notesIndex = headers.findIndex((h)=>h === "notes");
  if ([attendedIndex,assistanceIndex,guidedIndex,unassistedIndex,superviseIndex].some((i)=>i<0)) return;
  const rows = [...table.querySelectorAll("tbody tr")].map((tr) => {
    const cells=[...tr.cells];
    const number=(i)=>Number(String(cells[i]?.textContent||"0").trim())||0;
    const name=String(cells[0]?.textContent||"Manual").trim();
    const note=notesIndex>=0?String(cells[notesIndex]?.textContent||"").trim():"";
    return {name,note,attended:number(attendedIndex),assisted:number(assistanceIndex)+number(guidedIndex),unassisted:number(unassistedIndex),supervised:number(superviseIndex)};
  });
  table.dataset.auditFourModes="1";
  table.innerHTML=`<thead><tr><th>Manual</th><th>Attended</th><th>Performed assisted</th><th>Performed unassisted</th><th>Supervised</th></tr></thead><tbody>${rows.map((r)=>`<tr><td><b>${r.name}</b>${r.note&&r.note!=="—"?`<small class="audit-inline-note">${r.note}</small>`:""}</td><td>${r.attended}</td><td>${r.assisted}</td><td>${r.unassisted}</td><td>${r.supervised}</td></tr>`).join("")}</tbody>`;
}
function classifyPriorModal() {
  const dialog = document.querySelector("#modal");
  const modal = document.querySelector("#modalBody .prior-review-modal");
  if (!dialog) return;
  dialog.classList.toggle("prior-review-compact", Boolean(modal));
  if (modal) {
    compactHistoricalTable(modal);
    normalizeVisibleTerms(modal);
    applyIcons(modal);
  }
}
function enhance() {
  normalizeVisibleTerms(document);
  applyIcons(document);
  void replaceSupervisionStrip();
  classifyPriorModal();
}

new MutationObserver(enhance).observe(document.documentElement,{childList:true,subtree:true,characterData:true});
window.addEventListener("hashchange",()=>setTimeout(enhance,60));
document.querySelector("#modal")?.addEventListener("close",()=>document.querySelector("#modal")?.classList.remove("prior-review-compact"));
setInterval(enhance,1100);
enhance();
