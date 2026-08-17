import { sb } from "./supabase.js";

let role = "";
let residencyYear = null;
let paintTimer = null;
let lastRoute = "";

function toast(text) {
  const node = document.querySelector("#toast");
  if (!node) return;
  node.textContent = text;
  node.style.display = "block";
  setTimeout(() => { node.style.display = "none"; }, 3200);
}

function addStyles() {
  if (document.querySelector("#seniorLogbookGateStyles")) return;
  const style = document.createElement("style");
  style.id = "seniorLogbookGateStyles";
  style.textContent = `
    .senior-gate-admin-card{margin:18px 0;padding:20px;border:1px solid #ead7dc;border-radius:20px;background:#fff;box-shadow:0 10px 28px rgba(67,8,18,.06)}
    .senior-gate-admin-card h3{margin:0 0 6px;font-size:1.05rem}.senior-gate-admin-card p{margin:0;color:var(--muted,#6b7280);font-size:.86rem;line-height:1.5}
    .senior-gate-row{display:flex;align-items:center;justify-content:space-between;gap:18px;margin-top:16px;padding:14px 16px;border-radius:15px;background:#fbf7f8}
    .senior-gate-toggle{appearance:none;border:0;border-radius:999px;padding:10px 16px;font:inherit;font-weight:900;cursor:pointer;min-width:110px}.senior-gate-toggle.on{background:#16794b;color:#fff}.senior-gate-toggle.off{background:#e9dde0;color:#5e3a43}
    .senior-gate-warning{margin:0 0 18px;padding:16px 18px;border:1px solid #efb1bd;border-radius:17px;background:#fff2f4;color:#741225;display:flex;align-items:center;justify-content:space-between;gap:16px}
    .senior-gate-warning b{display:block;margin-bottom:4px}.senior-gate-warning p{margin:0;font-size:.84rem;line-height:1.45}.senior-gate-warning button{border:0;border-radius:12px;background:#741225;color:#fff;padding:10px 14px;font-weight:900;cursor:pointer;white-space:nowrap}
    @media(max-width:720px){.senior-gate-row,.senior-gate-warning{align-items:flex-start;flex-direction:column}.senior-gate-warning button{width:100%}}
  `;
  document.head.appendChild(style);
}

async function getProfile() {
  const { data: sessionData } = await sb.auth.getSession();
  const id = sessionData?.session?.user?.id;
  if (!id) return;
  const { data } = await sb.from("profiles").select("role,residency_year,is_active").eq("id",id).maybeSingle();
  role = String(data?.role || "");
  residencyYear = Number(data?.residency_year) || null;
}

async function paintOwnerOption() {
  if (role !== "owner") return;
  if (location.hash !== "#owner-tools") return;
  const content = document.querySelector("#content");
  if (!content || content.querySelector("[data-senior-logbook-gate-admin]")) return;
  const { data, error } = await sb.rpc("owner_get_senior_logbook_gate_v167");
  if (error) return;
  const enabled = data?.enabled !== false;
  const card = document.createElement("section");
  card.className = "senior-gate-admin-card";
  card.dataset.seniorLogbookGateAdmin = "1";
  card.innerHTML = `<h3>Senior-resident response gate</h3><p>When enabled, Year 2–5 senior residents who have any pending junior manual-intervention logbook request cannot record a new logbook activity until they approve or reject all pending junior requests.</p><div class="senior-gate-row"><div><b>${enabled ? "Rule is active" : "Rule is paused"}</b><p>${enabled ? "Pending junior requests block new senior logbook entries." : "Senior residents can record activities even with pending junior requests."}</p></div><button type="button" class="senior-gate-toggle ${enabled ? "on" : "off"}">${enabled ? "Enabled" : "Disabled"}</button></div>`;
  const btn = card.querySelector("button");
  btn.addEventListener("click", async () => {
    btn.disabled = true;
    try {
      const { data: updated, error: updateError } = await sb.rpc("owner_set_senior_logbook_gate_v167", { p_enabled: !enabled });
      if (updateError) throw updateError;
      card.remove();
      toast(updated?.enabled ? "Senior response gate enabled" : "Senior response gate disabled");
      setTimeout(paintOwnerOption, 30);
    } catch (err) {
      alert(err?.message || String(err));
      btn.disabled = false;
    }
  });
  content.prepend(card);
}

async function paintSeniorWarning() {
  if (role !== "resident" || !residencyYear || residencyYear < 2 || residencyYear > 5) return;
  if (location.hash !== "#logbook") return;
  const content = document.querySelector("#content");
  if (!content || content.querySelector("[data-senior-logbook-gate-warning]")) return;
  const { data, error } = await sb.rpc("get_my_senior_logbook_gate_v167");
  if (error || !data?.blocked) return;
  const count = Number(data.pending_requests) || 0;
  const warning = document.createElement("div");
  warning.className = "senior-gate-warning";
  warning.dataset.seniorLogbookGateWarning = "1";
  warning.innerHTML = `<div><b>Respond to junior logbook requests first</b><p>You have ${count} pending junior logbook request${count === 1 ? "" : "s"}. New activities cannot be recorded until you approve or reject ${count === 1 ? "this request" : "these requests"}.</p></div><button type="button">Open Logbook requests</button>`;
  warning.querySelector("button").addEventListener("click", () => { location.hash = "#logbook-requests"; });
  content.prepend(warning);
}

function schedulePaint() {
  const route = location.hash || "#dashboard";
  if (route !== lastRoute) lastRoute = route;
  clearTimeout(paintTimer);
  paintTimer = setTimeout(() => {
    void paintOwnerOption();
    void paintSeniorWarning();
  }, 180);
}

async function boot() {
  addStyles();
  await getProfile();
  schedulePaint();
  window.addEventListener("hashchange", schedulePaint);
  const content = document.querySelector("#content");
  if (content) new MutationObserver(() => schedulePaint()).observe(content,{childList:true});
}

void boot();
