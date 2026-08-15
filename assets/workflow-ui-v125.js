import { sb } from "./supabase.js";

const ICONS=[
  {re:/^attended$/i,cls:"mode-attended",icon:"👁",label:"Attended"},
  {re:/^(performed\s+assisted|performed\s+with\s+assistance|with\s+assistance|solo\s+under\s+guidance|performed\s+solo\s+under\s+guidance)$/i,cls:"mode-assisted",icon:"🤝",label:"Performed assisted"},
  {re:/^(performed\s+unassisted|performed\s+solo\s+without\s+guidance|solo\s+without\s+guidance)$/i,cls:"mode-unassisted",icon:"🩺",label:"Performed unassisted"},
  {re:/^(supervise|supervised|supervised\s+another\s+trainee)$/i,cls:"mode-supervise",icon:"👥",label:"Supervised"}
];
let fieldCache=null,fieldLoading=false,enhanceTimer=0;
const esc=(value)=>String(value??"").replace(/[&<>'"]/g,(char)=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"})[char]);
function activityMatch(text){const clean=String(text||"").replace(/\s+/g," ").trim();return ICONS.find(item=>item.re.test(clean))}
function normalizeVisibleTerms(root=document){
  root.querySelectorAll("th,td,.tag,.requirement-mode-label,.minimum-mode-label,.activity-mode-label-target").forEach(node=>{
    if(node.querySelector(".activity-mode-icon"))return;
    const text=String(node.textContent||"").replace(/\s+/g," ").trim(),replacement=activityMatch(text);
    if(replacement&&text!==replacement.label)node.textContent=replacement.label;
  });
  root.querySelectorAll(".prior-system-report-head p").forEach(node=>{
    if(/with assistance|solo under guidance/i.test(node.textContent||"")){
      node.textContent="Historical Prior Experience is compared with the resident's current year-specific minimum targets using the same four standardized activity modes.";
    }
  });
}
function applyIcons(root=document){
  root.querySelectorAll("th,td,.tag,.requirement-mode-label,.minimum-mode-label,.activity-mode-label-target").forEach(node=>{
    if(node.dataset.activityIconV125==="1")return;
    const raw=String(node.textContent||"").replace(/Achievement\s*\/\s*Target/ig,"").replace(/Achievement/ig,"").replace(/Target/ig,"").replace(/\s+/g," ").trim(),match=activityMatch(raw);
    if(!match)return;
    node.dataset.activityIconV125="1";
    node.textContent=match.label;
    const icon=document.createElement("span");
    icon.className=`activity-mode-icon ${match.cls}`;
    icon.setAttribute("aria-hidden","true");
    icon.textContent=match.icon;
    node.prepend(icon);
  });
}
async function getFields(){
  if(fieldCache)return fieldCache;
  if(fieldLoading)return[];
  fieldLoading=true;
  try{const{data,error}=await sb.rpc("get_my_audit_fields_v125");if(error)throw error;fieldCache=data||[];return fieldCache}catch(_){return[]}finally{fieldLoading=false}
}
async function replaceSupervisionStrip(){
  const title=String(document.querySelector("#title")?.textContent||"").trim().toLowerCase();
  if(title!=="logbook requests")return;
  document.querySelectorAll(".assessor-supervision-strip").forEach(node=>node.remove());
  const existing=[...document.querySelectorAll(".assessor-field-strip")];
  if(existing.length){existing.slice(1).forEach(node=>node.remove());return}
  const fields=await getFields();
  if(!fields.length)return;
  const unique=new Map();
  fields.forEach(row=>{const key=`${row.field_key}:${row.tier}`;if(!unique.has(key))unique.set(key,row)});
  const strip=document.createElement("div");
  strip.className="assessor-field-strip";
  strip.innerHTML=`<small>Audit fields</small>${[...unique.values()].map(row=>`<span class="assessor-field-badge ${row.tier==="lead_professor"?"professor":"faculty"}" title="${row.tier==="lead_professor"?"Professor-level final audit":"First-level faculty audit"}">${esc(row.field_label)}</span>`).join("")}`;
  const lead=document.querySelector("#content > .lead");
  if(lead)lead.after(strip);else document.querySelector("#content")?.prepend(strip);
}

function standardizePriorEditableTable(){
  const form=document.querySelector("#priorExperienceDraftForm");
  const table=form?.querySelector("table.prior-count-table");
  if(!table||table.dataset.fourActivityModesV126==="1")return;
  const firstRow=table.querySelector("tbody tr[data-prior-intervention]");
  if(!firstRow)return;
  const firstAssisted=firstRow.querySelector('[data-prior-count="assisted_count"]');
  const firstGuided=firstRow.querySelector('[data-prior-count="solo_guided_count"]');
  const firstUnassisted=firstRow.querySelector('[data-prior-count="solo_unguided_count"]');
  const firstSupervised=firstRow.querySelector('[data-prior-count="supervised_count"]');
  if(!firstAssisted||!firstGuided||!firstUnassisted||!firstSupervised)return;
  const guidedIndex=firstGuided.closest("td")?.cellIndex;
  if(guidedIndex==null||guidedIndex<0)return;
  table.querySelectorAll("tbody tr[data-prior-intervention]").forEach(row=>{
    const assisted=row.querySelector('[data-prior-count="assisted_count"]');
    const guided=row.querySelector('[data-prior-count="solo_guided_count"]');
    if(assisted&&guided&&row.dataset.assistedMergedV126!=="1"){
      assisted.value=String((Number(assisted.value)||0)+(Number(guided.value)||0));
      guided.value="0";
      row.dataset.assistedMergedV126="1";
    }
    guided?.closest("td")?.remove();
  });
  table.querySelector("thead tr")?.children?.[guidedIndex]?.remove();
  const sample=table.querySelector("tbody tr[data-prior-intervention]");
  const labels=[
    ["attended_count","Attended"],
    ["assisted_count","Performed assisted"],
    ["solo_unguided_count","Performed unassisted"],
    ["supervised_count","Supervised"]
  ];
  labels.forEach(([key,label])=>{
    const input=sample?.querySelector(`[data-prior-count="${key}"]`);
    const idx=input?.closest("td")?.cellIndex;
    const th=idx==null?null:table.querySelector("thead tr")?.children?.[idx];
    if(th){th.textContent=label;th.dataset.activityIconV125="0"}
    if(input)input.setAttribute("aria-label",`${label} count`);
  });
  table.dataset.fourActivityModesV126="1";
}

function compactHistoricalTable(table){
  if(!table||table.dataset.auditFourModes==="1")return;
  const headers=[...table.querySelectorAll("thead th")].map(th=>String(th.textContent||"").replace(/\s+/g," ").trim().toLowerCase());
  const superviseIndex=headers.findIndex(h=>/supervise/.test(h));
  const attendedIndex=headers.findIndex(h=>h==="attended");
  const assistanceIndex=headers.findIndex(h=>/performed assisted|with assistance/.test(h));
  const guidedIndex=headers.findIndex(h=>/solo under guidance/.test(h));
  const unassistedIndex=headers.findIndex(h=>/performed unassisted|solo without guidance/.test(h));
  const notesIndex=headers.findIndex(h=>h==="notes");
  if([attendedIndex,assistanceIndex,guidedIndex,unassistedIndex,superviseIndex].some(i=>i<0))return;
  const rows=[...table.querySelectorAll("tbody tr")].map(tr=>{
    const cells=[...tr.cells],number=i=>Number(String(cells[i]?.textContent||"0").trim())||0;
    const name=String(cells[0]?.textContent||"Manual").trim();
    const note=notesIndex>=0?String(cells[notesIndex]?.textContent||"").trim():"";
    return{name,note,attended:number(attendedIndex),assisted:number(assistanceIndex)+number(guidedIndex),unassisted:number(unassistedIndex),supervised:number(superviseIndex)};
  });
  table.dataset.auditFourModes="1";
  table.innerHTML=`<thead><tr><th>Manual</th><th>Attended</th><th>Performed assisted</th><th>Performed unassisted</th><th>Supervised</th></tr></thead><tbody>${rows.map(r=>`<tr><td><b>${esc(r.name)}</b>${r.note&&r.note!=="—"?`<small class="audit-inline-note">${esc(r.note)}</small>`:""}</td><td>${r.attended}</td><td>${r.assisted}</td><td>${r.unassisted}</td><td>${r.supervised}</td></tr>`).join("")}</tbody>`;
}
function compactHistoricalTables(root=document){root.querySelectorAll(".prior-readonly-summary table.prior-count-table").forEach(compactHistoricalTable)}

function normalizePriorPrintDocument(doc){
  try{
    const title=String(doc.querySelector("title")?.textContent||"");
    const h1=String(doc.querySelector("h1")?.textContent||"");
    if(!/Final Prior Experience Logbook/i.test(`${title} ${h1}`))return;
    doc.querySelectorAll("table").forEach(table=>{
      const headers=[...table.querySelectorAll("thead th")];
      const texts=headers.map(th=>String(th.textContent||"").replace(/\s+/g," ").trim().toLowerCase());
      const assistedIndex=texts.findIndex(t=>/with assistance|performed assisted/.test(t));
      const guidedIndex=texts.findIndex(t=>/solo under guidance/.test(t));
      if(assistedIndex>=0&&guidedIndex>=0){
        table.querySelectorAll("tbody tr").forEach(tr=>{
          const cells=[...tr.cells];
          if(cells.length<=Math.max(assistedIndex,guidedIndex))return;
          const assisted=Number(String(cells[assistedIndex]?.textContent||"0").trim())||0;
          const guided=Number(String(cells[guidedIndex]?.textContent||"0").trim())||0;
          cells[assistedIndex].textContent=String(assisted+guided);
          cells[guidedIndex]?.remove();
        });
        headers[guidedIndex]?.remove();
      }
      [...table.querySelectorAll("thead th")].forEach(th=>{
        const text=String(th.textContent||"").replace(/\s+/g," ").trim();
        const match=activityMatch(text);
        if(match)th.textContent=match.label;
      });
      const empty=table.querySelector('tbody td[colspan]');
      if(empty)empty.colSpan=table.querySelectorAll("thead th").length||empty.colSpan;
    });
    doc.querySelectorAll("p").forEach(p=>{
      if(/with assistance|solo under guidance/i.test(p.textContent||""))p.textContent="Historical counts use the same four standardized activity modes.";
    });
  }catch(_){}
}
function installPriorPrintNormalizer(){
  if(window.__priorPrintNormalizerV126)return;
  window.__priorPrintNormalizerV126=true;
  const originalOpen=window.open.bind(window);
  window.open=function(...args){
    const child=originalOpen(...args);
    if(!child)return child;
    let ticks=0;
    const timer=setInterval(()=>{
      ticks+=1;
      try{if(child.closed){clearInterval(timer);return}normalizePriorPrintDocument(child.document)}catch(_){}
      if(ticks>=40)clearInterval(timer);
    },25);
    return child;
  };
}

function classifyPriorModal(){
  const dialog=document.querySelector("#modal"),modal=document.querySelector("#modalBody .prior-review-modal");
  if(!dialog)return;
  dialog.classList.toggle("prior-review-compact",Boolean(modal));
  if(modal){compactHistoricalTables(modal);normalizeVisibleTerms(modal);applyIcons(modal)}
}
function enhance(){
  standardizePriorEditableTable();
  compactHistoricalTables(document);
  normalizeVisibleTerms(document);
  applyIcons(document);
  void replaceSupervisionStrip();
  classifyPriorModal();
}
function scheduleEnhance(){clearTimeout(enhanceTimer);enhanceTimer=setTimeout(enhance,120)}
const content=document.querySelector("#content"),modalBody=document.querySelector("#modalBody");
if(content)new MutationObserver(scheduleEnhance).observe(content,{childList:true,subtree:true});
if(modalBody)new MutationObserver(scheduleEnhance).observe(modalBody,{childList:true,subtree:true});
window.addEventListener("hashchange",()=>setTimeout(enhance,80));
document.querySelector("#modal")?.addEventListener("close",()=>document.querySelector("#modal")?.classList.remove("prior-review-compact"));
setInterval(enhance,8000);
installPriorPrintNormalizer();
enhance();
