import { sb } from "./supabase.js";

// With 15-minute user heartbeats, "recently active" is a safer and cheaper
// presence signal than continuously polling for second-by-second "online now".
const ONLINE_WINDOW_MS = 20 * 60 * 1000;
const EXCLUDED_EMAILS = new Set([
  "drmohamedalaa90@gmail.com",
  "drmohamedalaa90@icloud.com",
]);
let ownerReady = false;
let loadingDetails = false;

function addStyles(){
  if(document.querySelector("#adminActivityV168Styles")) return;
  const style=document.createElement("style");
  style.id="adminActivityV168Styles";
  style.textContent=`.admin-live-card{appearance:none;width:100%;min-width:0;min-height:142px;border:1px solid rgba(166,31,51,.16);border-radius:22px;padding:20px;text-align:left;cursor:pointer;background:linear-gradient(145deg,#fff 0%,#fff8fa 100%);box-shadow:0 12px 30px rgba(67,8,18,.07);color:var(--ink,#29171d);font:inherit}.admin-live-card .kicker{display:block;color:var(--blue,#a61f33);font-size:.72rem;font-weight:900;letter-spacing:.08em;text-transform:uppercase}.admin-live-card .big{display:block;margin-top:8px;font-size:1.8rem;line-height:1;font-weight:900;letter-spacing:-.03em}.admin-live-card .label{display:block;margin-top:7px;font-size:.93rem;font-weight:800}.admin-live-card .meta{display:block;margin-top:9px;color:var(--muted,#756168);font-size:.78rem;line-height:1.4}.admin-live-card .online-dot{display:inline-block;width:8px;height:8px;border-radius:50%;background:#18a55b;box-shadow:0 0 0 4px rgba(24,165,91,.12);margin-right:6px}.admin-activity-dialog{width:min(95vw,1040px);max-height:88vh;border:0;border-radius:26px;padding:0;box-shadow:0 28px 90px rgba(28,8,14,.28);background:#fff}.admin-activity-dialog::backdrop{background:rgba(20,8,12,.54)}.admin-activity-shell{padding:26px}.admin-activity-head{display:flex;align-items:flex-start;justify-content:space-between;gap:18px}.admin-activity-head h2{margin:3px 0 0;font-size:1.65rem}.admin-activity-head p{margin:6px 0 0;color:#756168;font-size:.88rem}.admin-activity-actions{display:flex;align-items:center;gap:8px}.admin-activity-refresh,.admin-activity-close{border:1px solid #ead8dd;background:#fff;border-radius:12px;height:38px;cursor:pointer;font:inherit;font-weight:800}.admin-activity-refresh{padding:0 13px;color:#6d2533}.admin-activity-close{width:38px;font-size:1.35rem}.admin-activity-metrics{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:11px;margin-top:22px}.admin-activity-metric{padding:15px;border:1px solid #f0e2e6;border-radius:17px;background:#fff9fa}.admin-activity-metric strong{display:block;font-size:1.55rem}.admin-activity-metric span{display:block;margin-top:4px;color:#756168;font-size:.73rem}.admin-activity-table-wrap{margin-top:20px;overflow:auto;border:1px solid #f0e2e6;border-radius:16px}.admin-activity-table{width:100%;border-collapse:collapse;font-size:.79rem}.admin-activity-table th,.admin-activity-table td{padding:10px 12px;border-bottom:1px solid #f3e8eb;text-align:left;white-space:nowrap}.admin-activity-table th{background:#fbf6f7;color:#6d4f58;font-size:.68rem;text-transform:uppercase}.presence{display:inline-flex;align-items:center;gap:6px;font-weight:850}.presence.online{color:#14834a}.presence.offline{color:#7b6a70}.presence i{width:8px;height:8px;border-radius:50%;background:currentColor}`;
  document.head.appendChild(style);
}

function ensureDialog(){
  let d=document.querySelector("#userActivityAnalyticsDialog");
  if(d) return d;
  d=document.createElement("dialog");
  d.id="userActivityAnalyticsDialog";
  d.className="admin-activity-dialog";
  d.addEventListener("click",e=>{if(e.target===d)d.close()});
  document.body.appendChild(d);
  return d;
}

function fmt(v){
  return v?new Intl.DateTimeFormat("en-GB",{timeZone:"Africa/Cairo",day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit"}).format(new Date(v)):"—";
}

function rel(v){
  if(!v)return"Never";
  const m=Math.floor(Math.max(0,Date.now()-new Date(v).getTime())/60000);
  if(m<1)return"Just now";
  if(m<60)return`${m} min ago`;
  const h=Math.floor(m/60);
  return h<24?`${h} h ago`:`${Math.floor(h/24)} d ago`;
}

async function rows(){
  const[{data:activity,error:aerr},{data:profiles,error:perr}]=await Promise.all([
    sb.from("app_user_activity").select("*").order("last_active_at",{ascending:false}),
    sb.from("profiles").select("id,display_name,username,email,role,is_active").order("display_name")
  ]);
  if(aerr)throw aerr;
  if(perr)throw perr;
  const pm=new Map((profiles||[]).map(p=>[String(p.id),p]));
  return(activity||[])
    .map(r=>({...r,profile:pm.get(String(r.user_id))||{}}))
    .filter(r=>!EXCLUDED_EMAILS.has(String(r.profile.email||"").trim().toLowerCase()));
}

function ensureCard(){
  if(!ownerReady)return;
  const grid=document.querySelector(".owner-dashboard-grid");
  if(!grid)return;
  let card=grid.querySelector("[data-user-activity-analytics]");
  if(card)return;
  card=document.createElement("button");
  card.type="button";
  card.className="admin-live-card";
  card.dataset.userActivityAnalytics="1";
  card.innerHTML=`<span class="kicker">User activity</span><strong class="big">Open activity</strong><span class="label">On-demand monitor</span><small class="meta">No background polling · Tap to check recent activity</small>`;
  card.addEventListener("click",openDetails);
  grid.appendChild(card);
}

function updateCardSnapshot(data){
  const card=document.querySelector("[data-user-activity-analytics]");
  if(!card)return;
  const recent=data.filter(r=>Date.now()-new Date(r.last_active_at).getTime()<=ONLINE_WINDOW_MS).length;
  card.innerHTML=`<span class="kicker">User activity</span><strong class="big"><span class="online-dot"></span>${recent}</strong><span class="label">active within 20 min</span><small class="meta">${data.length} tracked users · checked just now · Tap to refresh details</small>`;
}

function renderDetails(d,data){
  const now=Date.now();
  const recent=data.filter(r=>now-new Date(r.last_active_at).getTime()<=ONLINE_WINDOW_MS);
  const body=data.map(r=>{
    const p=r.profile||{};
    const on=now-new Date(r.last_active_at).getTime()<=ONLINE_WINDOW_MS;
    return `<tr><td><b>${p.display_name||p.username||"User"}</b></td><td>${p.email||"—"}</td><td>${p.role||"—"}</td><td><span class="presence ${on?"online":"offline"}"><i></i>${on?"Recently active":"Inactive"}</span></td><td>${on?fmt(r.session_started_at):"—"}</td><td>${rel(r.last_active_at)}</td></tr>`;
  }).join("")||'<tr><td colspan="6">No tracked users.</td></tr>';

  d.innerHTML=`<div class="admin-activity-shell"><div class="admin-activity-head"><div><span class="kicker">Admin only</span><h2>User activity</h2><p>On-demand view. Presence updates about every 15 minutes to protect Edge Function quota.</p></div><div class="admin-activity-actions"><button class="admin-activity-refresh" type="button">↻ Refresh</button><button class="admin-activity-close" type="button">×</button></div></div><div class="admin-activity-metrics"><div class="admin-activity-metric"><strong>${recent.length}</strong><span>Active within 20 min</span></div><div class="admin-activity-metric"><strong>${data.length}</strong><span>Tracked users</span></div></div><div class="admin-activity-table-wrap"><table class="admin-activity-table"><thead><tr><th>User</th><th>Email</th><th>Role</th><th>Status</th><th>Session started</th><th>Last active</th></tr></thead><tbody>${body}</tbody></table></div></div>`;
  d.querySelector(".admin-activity-close")?.addEventListener("click",()=>d.close());
  d.querySelector(".admin-activity-refresh")?.addEventListener("click",()=>void loadDetails(d));
}

async function loadDetails(d){
  if(loadingDetails)return;
  loadingDetails=true;
  d.innerHTML='<div class="admin-activity-shell"><h2>Loading user activity…</h2><p>This view refreshes only when you open it or press Refresh.</p></div>';
  try{
    const data=await rows();
    updateCardSnapshot(data);
    renderDetails(d,data);
  }catch(err){
    console.warn("User activity unavailable",err);
    d.innerHTML='<div class="admin-activity-shell"><h2>User activity unavailable</h2><p>Please close this window and try again.</p><button class="admin-activity-close" type="button">×</button></div>';
    d.querySelector(".admin-activity-close")?.addEventListener("click",()=>d.close());
  }finally{
    loadingDetails=false;
  }
}

async function openDetails(){
  const d=ensureDialog();
  if(!d.open)d.showModal();
  await loadDetails(d);
}

async function init(){
  try{
    const{data:{session}}=await sb.auth.getSession();
    if(!session?.user)return;
    const{data:p,error}=await sb.from("profiles").select("role,is_active").eq("id",session.user.id).maybeSingle();
    if(error||p?.role!=="owner"||p?.is_active===false)return;

    ownerReady=true;
    addStyles();

    const content=document.querySelector("#content");
    if(content)new MutationObserver(()=>setTimeout(ensureCard,80)).observe(content,{childList:true,subtree:false});
    window.addEventListener("hashchange",()=>setTimeout(ensureCard,80));
    setTimeout(ensureCard,120);
  }catch(err){
    console.warn("Admin activity could not initialize",err);
  }
}

init();
