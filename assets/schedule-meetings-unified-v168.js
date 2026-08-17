import { sb } from "./supabase.js";

const $=(s,r=document)=>r.querySelector(s);
const $$=(s,r=document)=>[...r.querySelectorAll(s)];
const sleep=(ms)=>new Promise(r=>setTimeout(r,ms));
let currentMode="schedule";
let lastScanBusy=false;
let navBusy=false;

function norm(t){return String(t||"").trim().toLowerCase();}
function closeDrawer(){
  const aside=$("aside"),backdrop=$("#backdrop");
  document.body?.classList.remove("drawer-open","nav-open","menu-open");
  document.documentElement?.classList.remove("drawer-open","nav-open","menu-open");
  aside?.classList.remove("open","active","show");
  backdrop?.classList.remove("show","active","open");
  try{$("#drawerClose")?.click()}catch{}
}
function navItems(){return $$("#nav button,#nav a");}
function scheduleBtn(){return navItems().find(b=>/^(schedule|schedule\s*&\s*meetings)$/i.test((b.textContent||"").trim()));}
function meetingBtn(){return $("#nav [data-attendance-nav]")||navItems().find(b=>/meeting attendance/i.test(b.textContent||""));}

function addStyles(){
  if($("#scheduleMeetingsStyles168"))return;
  const s=document.createElement("style");s.id="scheduleMeetingsStyles168";s.textContent=`
    .attendance-actions button[data-qr],.attendance-actions button[data-qr] *,#attendanceQrDialog .attendance-actions button:not(.danger){color:#fff!important;-webkit-text-fill-color:#fff!important}
    .sm-tabs{display:flex;gap:8px;padding:6px;background:#eef4f9;border:1px solid #d9e4ee;border-radius:16px;width:max-content;max-width:100%;margin:0 0 16px}
    .sm-tabs button{border:0;background:transparent;color:#24445f;padding:10px 15px;border-radius:11px;font-weight:900;cursor:pointer;white-space:nowrap}
    .sm-tabs button.active{background:#0b3764;color:#fff!important;-webkit-text-fill-color:#fff!important;box-shadow:0 4px 12px rgba(11,55,100,.18)}
    .attendance-scan-btn{margin-top:12px;background:#0b3764!important;color:#fff!important;-webkit-text-fill-color:#fff!important;border:0!important;border-radius:12px!important;padding:10px 13px!important;font-weight:900!important;cursor:pointer!important}
    .attendance-scan-btn:disabled{opacity:.55;cursor:wait!important}
    .attendance-scan-note{margin-top:8px;font-size:.78rem;color:#607386}
    .attendance-attended-check{display:inline-flex;align-items:center;gap:7px;margin-top:10px;padding:8px 11px;border-radius:999px;background:#e7f7ee;color:#087443;font-weight:900}
    #attendanceQrPicker168{display:none}
  `;document.head.appendChild(s);
}

function insertTabs(mode){
  const root=$("#content");if(!root)return;
  let tabs=root.querySelector(".sm-tabs");
  if(!tabs){
    tabs=document.createElement("div");tabs.className="sm-tabs";
    tabs.innerHTML='<button type="button" data-sm="schedule">Schedule</button><button type="button" data-sm="meetings">Meetings</button>';
    root.prepend(tabs);
    tabs.querySelector('[data-sm="schedule"]').addEventListener("click",openSchedule);
    tabs.querySelector('[data-sm="meetings"]').addEventListener("click",openMeetings);
  }
  tabs.querySelector('[data-sm="schedule"]')?.classList.toggle("active",mode==="schedule");
  tabs.querySelector('[data-sm="meetings"]')?.classList.toggle("active",mode==="meetings");
}

async function waitForMeetingButton(timeout=2500){
  const start=Date.now();
  while(Date.now()-start<timeout){const b=meetingBtn();if(b)return b;await sleep(50)}
  return null;
}
async function waitForScheduleButton(timeout=2500){
  const start=Date.now();
  while(Date.now()-start<timeout){const b=scheduleBtn();if(b)return b;await sleep(50)}
  return null;
}

async function openSchedule(){
  if(navBusy)return;navBusy=true;currentMode="schedule";closeDrawer();
  try{
    const b=await waitForScheduleButton();
    if(!b)throw new Error("Schedule navigation is not ready yet.");
    b.dataset.smProgrammatic="1";b.click();delete b.dataset.smProgrammatic;
    await sleep(140);insertTabs("schedule");
  }finally{closeDrawer();navBusy=false}
}
async function openMeetings(){
  if(navBusy)return;navBusy=true;currentMode="meetings";closeDrawer();
  try{
    const b=await waitForMeetingButton();
    if(!b)throw new Error("Meeting attendance is still loading. Please try again.");
    b.dataset.smProgrammatic="1";b.click();delete b.dataset.smProgrammatic;
    await sleep(160);insertTabs("meetings");enhanceResidentMeetings();
  }catch(e){alert(e.message||e)}finally{closeDrawer();navBusy=false}
}

function wireNav(){
  const s=scheduleBtn(),m=meetingBtn();
  if(s){
    if((s.textContent||"").trim()!=="Schedule & meetings")s.textContent="Schedule & meetings";
    if(!s.dataset.smWired){s.dataset.smWired="1";s.addEventListener("click",()=>{if(s.dataset.smProgrammatic)return;currentMode="schedule";setTimeout(()=>{insertTabs("schedule");closeDrawer()},120)})}
  }
  if(m){
    m.style.display="none";
    if(!m.dataset.smWired){m.dataset.smWired="1";m.addEventListener("click",()=>{if(m.dataset.smProgrammatic)return;currentMode="meetings";setTimeout(()=>{insertTabs("meetings");enhanceResidentMeetings();closeDrawer()},120)})}
  }
  navItems().forEach(b=>{if(!b.dataset.smDrawerWired){b.dataset.smDrawerWired="1";b.addEventListener("click",()=>setTimeout(closeDrawer,0))}})
}

async function decodeImage(file){
  if("BarcodeDetector" in window){const bitmap=await createImageBitmap(file);const detector=new BarcodeDetector({formats:["qr_code"]});const codes=await detector.detect(bitmap);bitmap.close?.();return codes?.[0]?.rawValue||""}
  if(!window.jsQR){await new Promise((resolve,reject)=>{const sc=document.createElement("script");sc.src="https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js";sc.onload=resolve;sc.onerror=reject;document.head.appendChild(sc)})}
  const img=await createImageBitmap(file);const canvas=document.createElement("canvas");canvas.width=img.width;canvas.height=img.height;const ctx=canvas.getContext("2d");ctx.drawImage(img,0,0);const data=ctx.getImageData(0,0,canvas.width,canvas.height);img.close?.();return window.jsQR?.(data.data,data.width,data.height)?.data||"";
}
function tokenFromQr(value){try{const u=new URL(value,location.href);const m=(u.hash||"").match(/attendance-checkin=([^&]+)/);return m?decodeURIComponent(m[1]):""}catch{return String(value||"").match(/attendance-checkin=([^&\s]+)/)?.[1]||""}}
async function scanForMeeting(meetingId,btn){
  if(lastScanBusy)return;lastScanBusy=true;btn.disabled=true;btn.textContent="Reading QR…";
  try{
    let input=$("#attendanceQrPicker168");if(!input){input=document.createElement("input");input.id="attendanceQrPicker168";input.type="file";input.accept="image/*";input.setAttribute("capture","environment");document.body.appendChild(input)}
    const file=await new Promise(resolve=>{input.value="";input.onchange=()=>resolve(input.files?.[0]||null);input.click()});if(!file)return;
    const token=tokenFromQr(await decodeImage(file));if(!token)throw new Error("QR code could not be read. Please scan the meeting QR again.");
    const {error}=await sb.rpc("resident_attendance_checkin_v167",{p_qr_token:token,p_meeting_id:meetingId});if(error)throw error;
    const card=btn.closest?.(".attendance-card");btn.outerHTML='<div class="attendance-attended-check">✓ You attended this meeting</div>';const badge=card?.querySelector(".attendance-badge.wait");if(badge){badge.className="attendance-badge ok";badge.textContent="✓ Attended"}
    const toast=$("#toast");if(toast){toast.textContent="Attendance recorded successfully";toast.style.display="block";setTimeout(()=>toast.style.display="none",3000)}
  }catch(e){alert(e?.message||String(e))}finally{lastScanBusy=false;if(document.body.contains(btn)){btn.disabled=false;btn.textContent="Scan QR code"}}
}

function enhanceResidentMeetings(){
  const cards=$$("#attendanceResidentList .attendance-card");
  cards.forEach(card=>{
    if(card.dataset.smEnhanced)return;card.dataset.smEnhanced="1";
    const attended=[...card.querySelectorAll(".attendance-badge")].some(x=>/attended/i.test(x.textContent||""));
    if(attended){const meta=card.querySelector(".attendance-meta");if(meta&&!card.querySelector(".attendance-attended-check")){const check=document.createElement("div");check.className="attendance-attended-check";check.textContent="✓ You attended this meeting";meta.after(check)}return}
    const physical=[...card.querySelectorAll(".attendance-badge")].some(x=>/physical/i.test(x.textContent||""));if(!physical)return;
    const title=card.querySelector("h3")?.textContent?.trim()||"";
    (async()=>{try{const {data,error}=await sb.rpc("get_my_attendance_meetings_v167");if(error)throw error;const m=(data||[]).find(x=>String(x.title||"").trim()===title&&!x.attended&&x.meeting_mode==="physical");if(!m)return;const actions=document.createElement("div");actions.className="attendance-actions";actions.innerHTML='<button class="attendance-scan-btn" type="button">Scan QR code</button><div class="attendance-scan-note">Scan the QR displayed by the Admin. A successful scan marks you attended immediately.</div>';card.appendChild(actions);actions.querySelector("button").onclick=e=>scanForMeeting(m.id,e.currentTarget)}catch{}})();
  });
}

function observe(){
  const root=$("#content"),nav=$("#nav");
  let contentTimer=0,navTimer=0;
  if(root)new MutationObserver(()=>{clearTimeout(contentTimer);contentTimer=setTimeout(()=>{if(currentMode==="meetings"||location.hash.startsWith("#attendance")){insertTabs("meetings");enhanceResidentMeetings()}else if(/schedule/i.test($("#title")?.textContent||"")){insertTabs("schedule")}},90)}).observe(root,{childList:true,subtree:true});
  if(nav)new MutationObserver(()=>{clearTimeout(navTimer);navTimer=setTimeout(wireNav,40)}).observe(nav,{childList:true,subtree:true,characterData:true});
}

addStyles();observe();
let tries=0;const boot=setInterval(()=>{wireNav();tries++;if(tries>120)clearInterval(boot)},100);
window.addEventListener("hashchange",()=>{if(location.hash.startsWith("#attendance")){currentMode="meetings";setTimeout(()=>{insertTabs("meetings");enhanceResidentMeetings();closeDrawer()},140)}});
