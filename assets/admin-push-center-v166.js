import { sb } from "./supabase.js";

let ownerReady = false;
let profilesCache = [];

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (ch) => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
}

function addStyles() {
  if (document.querySelector("#adminPushCenterStyles")) return;
  const style = document.createElement("style");
  style.id = "adminPushCenterStyles";
  style.textContent = `
    .admin-push-nav{width:100%;display:flex;align-items:center;gap:10px;padding:12px 14px;border:0;border-radius:12px;background:transparent;color:inherit;font:inherit;font-weight:800;text-align:left;cursor:pointer}.admin-push-nav:hover,.admin-push-nav.active{background:rgba(255,255,255,.10)}
    .push-center{max-width:1120px;margin:0 auto;padding:8px 0 32px}.push-head{display:flex;justify-content:space-between;align-items:flex-start;gap:16px;margin-bottom:18px}.push-head h2{margin:0;font-size:1.7rem}.push-head p{margin:6px 0 0;color:#6b7280}.push-grid{display:grid;grid-template-columns:minmax(0,1.2fr) minmax(320px,.8fr);gap:18px}.push-card{background:#fff;border:1px solid #eadde1;border-radius:20px;padding:20px;box-shadow:0 10px 28px rgba(67,8,18,.05)}.push-card h3{margin:0 0 14px;font-size:1.05rem}.push-label{display:block;margin:14px 0 6px;font-size:.78rem;font-weight:900;color:#5f4650;text-transform:uppercase;letter-spacing:.04em}.push-input,.push-textarea,.push-select,.push-search{width:100%;box-sizing:border-box;border:1px solid #dccbd0;border-radius:12px;background:#fff;padding:11px 12px;font:inherit;color:#21161a}.push-textarea{min-height:132px;resize:vertical}.push-targets{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}.push-target{display:flex;align-items:center;gap:9px;padding:11px 12px;border:1px solid #eadde1;border-radius:12px;cursor:pointer;font-weight:800;background:#fff}.push-target input{accent-color:#a61f33}.push-target:has(input:checked){border-color:#b91c34;background:#fff6f8}.push-year-row{display:none;margin-top:10px}.push-year-row.show{display:block}.push-manual{display:none;margin-top:12px}.push-manual.show{display:block}.push-people{max-height:300px;overflow:auto;border:1px solid #eadde1;border-radius:13px;margin-top:9px}.push-person{display:flex;align-items:center;gap:10px;padding:10px 12px;border-bottom:1px solid #f2e7ea}.push-person:last-child{border-bottom:0}.push-person span{min-width:0}.push-person b{display:block;font-size:.86rem}.push-person small{display:block;color:#7b6870;font-size:.72rem;margin-top:2px}.push-preview{border:1px solid #d7dce4;border-radius:18px;padding:16px;background:#f8fafc}.push-preview small{display:block;color:#64748b;font-size:.72rem;font-weight:800}.push-preview strong{display:block;margin-top:7px;font-size:1rem}.push-preview p{margin:7px 0 0;color:#334155;white-space:pre-wrap}.push-summary{margin-top:14px;padding:12px;border-radius:12px;background:#faf4f6;color:#654752;font-size:.8rem;line-height:1.45}.push-actions{display:flex;gap:10px;margin-top:16px}.push-send{flex:1;border:0;border-radius:13px;background:#a61f33;color:#fff;padding:12px 15px;font:inherit;font-weight:900;cursor:pointer}.push-send:disabled{opacity:.55;cursor:wait}.push-clear{border:1px solid #decbd1;border-radius:13px;background:#fff;padding:12px 15px;font:inherit;font-weight:850;cursor:pointer}.push-result{margin-top:12px;font-size:.82rem;font-weight:800}.push-result.ok{color:#087443}.push-result.err{color:#b42336}.push-note{margin-top:14px;color:#7a6970;font-size:.75rem;line-height:1.5}@media(max-width:860px){.push-grid{grid-template-columns:1fr}.push-targets{grid-template-columns:1fr}.push-center{padding:2px 0 24px}}
  `;
  document.head.appendChild(style);
}

async function loadProfiles() {
  const [{ data: profiles, error }, { data: caps }] = await Promise.all([
    sb.from("profiles").select("id,display_name,username,email,role,residency_year,is_active").eq("is_active", true).order("display_name"),
    sb.from("profile_role_capabilities").select("profile_id,capability,is_active").eq("capability", "assessor").eq("is_active", true),
  ]);
  if (error) throw error;
  const assessorCap = new Set((caps || []).map((r) => String(r.profile_id)));
  profilesCache = (profiles || []).map((p) => ({ ...p, dualAssessor: assessorCap.has(String(p.id)) }));
}

function personLabel(p) {
  const role = p.role === "resident" ? (p.residency_year ? `Resident · Year ${p.residency_year}` : "Resident") : p.role === "assessor" ? "Assessor" : p.role === "owner" ? "Admin" : p.role;
  return p.dualAssessor ? `${role} + Assessor` : role;
}

function selectedTarget() {
  return document.querySelector('input[name="pushTarget"]:checked')?.value || "all_residents";
}

function updatePreview() {
  const title = document.querySelector("#pushTitle")?.value || "Cardiology Residents";
  const body = document.querySelector("#pushBody")?.value || "Your message will appear here.";
  const preview = document.querySelector("#pushPreview");
  if (preview) preview.innerHTML = `<small>CARDIOLOGY RESIDENTS</small><strong>${esc(title)}</strong><p>${esc(body)}</p>`;
}

function updateTargetPanels() {
  const target = selectedTarget();
  document.querySelector("#pushYearRow")?.classList.toggle("show", target === "year");
  document.querySelector("#pushManual")?.classList.toggle("show", target === "manual");
  updateSummary();
}

function visibleManualPeople(query = "") {
  const q = query.trim().toLowerCase();
  return profilesCache.filter((p) => !q || [p.display_name,p.username,p.email,personLabel(p)].some((v) => String(v || "").toLowerCase().includes(q)));
}

function paintPeople(query = "") {
  const box = document.querySelector("#pushPeople");
  if (!box) return;
  const people = visibleManualPeople(query);
  box.innerHTML = people.length ? people.map((p) => `<label class="push-person"><input type="checkbox" value="${esc(p.id)}" data-push-person><span><b>${esc(p.display_name || p.username || "User")}</b><small>@${esc(p.username || "")} · ${esc(personLabel(p))}</small></span></label>`).join("") : `<div class="push-person"><span><b>No users found</b></span></div>`;
  box.querySelectorAll("[data-push-person]").forEach((el) => el.addEventListener("change", updateSummary));
}

function updateSummary() {
  const node = document.querySelector("#pushSummary");
  if (!node) return;
  const target = selectedTarget();
  let text = "All active residents";
  if (target === "year") {
    const year = Number(document.querySelector("#pushYear")?.value || 1);
    const count = profilesCache.filter((p) => p.role === "resident" && Number(p.residency_year) === year).length;
    text = `Year ${year} residents · ${count} account${count === 1 ? "" : "s"}`;
  } else if (target === "all_residents") {
    const count = profilesCache.filter((p) => p.role === "resident").length;
    text = `All residents · ${count} active account${count === 1 ? "" : "s"}`;
  } else if (target === "all_assessors") {
    const count = profilesCache.filter((p) => p.role === "assessor" || p.dualAssessor).length;
    text = `All assessors · ${count} active assessor account${count === 1 ? "" : "s"}`;
  } else {
    const count = document.querySelectorAll("[data-push-person]:checked").length;
    text = `Manual selection · ${count} selected`;
  }
  node.textContent = text;
}

function renderCenter() {
  const content = document.querySelector("#content");
  if (!content) return;
  document.querySelectorAll("#nav button").forEach((b) => b.classList.remove("active"));
  document.querySelector("[data-admin-push-nav]")?.classList.add("active");
  const crumb = document.querySelector("#crumb"), title = document.querySelector("#title");
  if (crumb) crumb.textContent = "ADMIN";
  if (title) title.textContent = "Push notifications";
  content.innerHTML = `<div class="push-center"><div class="push-head"><div><h2>Push notification center</h2><p>Compose, edit, target and send a push notification from the Admin portal.</p></div></div><div class="push-grid"><section class="push-card"><h3>Recipients</h3><div class="push-targets"><label class="push-target"><input type="radio" name="pushTarget" value="all_residents" checked> All residents</label><label class="push-target"><input type="radio" name="pushTarget" value="year"> Specific year</label><label class="push-target"><input type="radio" name="pushTarget" value="all_assessors"> All assessors</label><label class="push-target"><input type="radio" name="pushTarget" value="manual"> Select manually</label></div><div id="pushYearRow" class="push-year-row"><label class="push-label" for="pushYear">Residency year</label><select id="pushYear" class="push-select"><option value="1">Year 1</option><option value="2">Year 2</option><option value="3">Year 3</option><option value="4">Year 4</option><option value="5">Year 5</option><option value="6">Visitor residents</option><option value="7">Fellows</option></select></div><div id="pushManual" class="push-manual"><input id="pushSearch" class="push-search" placeholder="Search name, username, email or role"><div id="pushPeople" class="push-people"></div></div><div id="pushSummary" class="push-summary"></div></section><section class="push-card"><h3>Notification</h3><label class="push-label" for="pushTitle">Title</label><input id="pushTitle" class="push-input" maxlength="120" value="Cardiology Residents"><label class="push-label" for="pushBody">Message</label><textarea id="pushBody" class="push-textarea" maxlength="1000" placeholder="Write the notification here…"></textarea><label class="push-label" for="pushRoute">Open when tapped</label><select id="pushRoute" class="push-select"><option value="#dashboard">Dashboard</option><option value="#inbox">Inbox</option><option value="#resident-directory">Residents</option><option value="#assessments">Assessments</option><option value="#logbook">Logbooks</option><option value="#logbook-requests">Logbook requests</option></select><label class="push-label">Preview</label><div id="pushPreview" class="push-preview"></div><div class="push-actions"><button id="pushClear" class="push-clear" type="button">Clear</button><button id="pushSend" class="push-send" type="button">Send push notification</button></div><div id="pushResult" class="push-result"></div><div class="push-note">You can freely edit the title, message, recipients and destination before sending. A push that has already been delivered cannot be changed on the recipient's device; send a corrected notification if needed.</div></section></div></div>`;
  paintPeople();
  updatePreview();
  updateSummary();
  content.querySelectorAll('input[name="pushTarget"]').forEach((el) => el.addEventListener("change", updateTargetPanels));
  document.querySelector("#pushYear")?.addEventListener("change", updateSummary);
  document.querySelector("#pushSearch")?.addEventListener("input", (e) => paintPeople(e.target.value));
  document.querySelector("#pushTitle")?.addEventListener("input", updatePreview);
  document.querySelector("#pushBody")?.addEventListener("input", updatePreview);
  document.querySelector("#pushClear")?.addEventListener("click", () => { document.querySelector("#pushTitle").value = "Cardiology Residents"; document.querySelector("#pushBody").value = ""; updatePreview(); });
  document.querySelector("#pushSend")?.addEventListener("click", sendPush);
}

async function sendPush() {
  const button = document.querySelector("#pushSend");
  const result = document.querySelector("#pushResult");
  const title = String(document.querySelector("#pushTitle")?.value || "").trim();
  const body = String(document.querySelector("#pushBody")?.value || "").trim();
  const target = selectedTarget();
  const year = Number(document.querySelector("#pushYear")?.value || 1);
  const user_ids = [...document.querySelectorAll("[data-push-person]:checked")].map((el) => el.value);
  if (!title || !body) { result.className = "push-result err"; result.textContent = "Please enter both a title and a message."; return; }
  if (target === "manual" && !user_ids.length) { result.className = "push-result err"; result.textContent = "Select at least one recipient."; return; }
  if (!confirm(`Send this push notification now?\n\n${title}\n${body}`)) return;
  button.disabled = true; result.className = "push-result"; result.textContent = "Sending…";
  try {
    const { data, error } = await sb.functions.invoke("push-notify", { body: { title, body, route: document.querySelector("#pushRoute")?.value || "#dashboard", target, year, user_ids } });
    if (error) throw error;
    if (data?.error) throw new Error(data.error);
    result.className = "push-result ok";
    result.textContent = `Sent to ${Number(data?.users_reached || 0)} user${Number(data?.users_reached || 0) === 1 ? "" : "s"} on ${Number(data?.sent || 0)} registered device${Number(data?.sent || 0) === 1 ? "" : "s"}. ${Number(data?.targeted_users || 0)} account${Number(data?.targeted_users || 0) === 1 ? "" : "s"} targeted.`;
  } catch (error) {
    result.className = "push-result err";
    result.textContent = error?.message || String(error);
  } finally { button.disabled = false; }
}

function ensureNav() {
  if (!ownerReady) return;
  const nav = document.querySelector("#nav");
  if (!nav || nav.querySelector("[data-admin-push-nav]")) return;
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "admin-push-nav";
  btn.dataset.adminPushNav = "1";
  btn.innerHTML = `<span>🔔</span><span>Push notifications</span>`;
  const inbox = [...nav.querySelectorAll("button")].find((b) => /inbox/i.test(b.textContent || ""));
  nav.insertBefore(btn, inbox || null);
  btn.addEventListener("click", async (event) => { event.preventDefault(); event.stopPropagation(); if (!profilesCache.length) await loadProfiles(); renderCenter(); });
}

async function init() {
  try {
    const { data: { session } } = await sb.auth.getSession();
    if (!session?.user) return;
    const { data: profile } = await sb.from("profiles").select("role,is_active").eq("id", session.user.id).maybeSingle();
    if (profile?.role !== "owner" || profile?.is_active === false) return;
    ownerReady = true;
    addStyles();
    await loadProfiles();
    ensureNav();
    new MutationObserver(ensureNav).observe(document.querySelector("#nav") || document.documentElement, { childList: true, subtree: true });
  } catch (error) {
    console.warn("Admin push center could not initialize", error);
  }
}

void init();
