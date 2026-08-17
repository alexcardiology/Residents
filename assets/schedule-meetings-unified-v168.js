import { sb } from "./supabase.js";

const $=(s,r=document)=>r.querySelector(s);
const $$=(s,r=document)=>[...r.querySelectorAll(s)];
const sleep=(ms)=>new Promise(r=>setTimeout(r,ms));
let currentMode="schedule";
let lastScanBusy=false;

function norm(t){return String(t||"").trim().toLowerCase();}
function closeDrawer(){
  const close=$("#drawerClose");
  if(close){try{close.click()}catch{}}
  document.body?.classList.remove("drawer-open","nav-open","menu-open");
  $("#backdrop")?.classList.remove("show","active","open");
}
function navButtons(){return $$("#nav button");}
function scheduleBtn(){return navButtons().find(b=>/^schedule$/i.test(b.textContent.trim())||/^schedule\s*&\s*meetings$/i.test(b.textContent.trim()));}
function meetingBtn(){return $("#nav [data-attendance-nav]")||navButtons().find(b=>/meeting attendance/i.test(b.textContent));}

function addStyles(){
  if($("#scheduleMeetingsStyles168"))return;
  const s=document.createElement("style");s.id="scheduleMeetingsStyles168";s.textContent=`
    .attendance-actions button[data-qr], .attendance-actions button[data-qr] *, #attendanceQrDialog .attendance-actions button:not(.danger){color:#fff!important;-webkit-text-fill-color:#fff!important}
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
  root.querySelector(".sm-tabs")?.remove();
  const tabs=document.createElement("div");tabs.className="sm-tabs";
  tabs.innerHTML=`<button type="button" data-sm="schedule" class="${mode==="schedule"?"active":""}">Schedule</button><button type="button" data-sm="meetings" class="${mode==="meetings"?"active":""}">Meetings</button>`;
  root.prepend(tabs);
  tabs.querySelector('[data-sm="schedule"]').onclick=()=>openSchedule();
  tabs.querySelector('[data-sm="meetings"]').onclick=()=>openMeetings();
}

async function openSchedule(){
  currentMode="schedule";closeDrawer();
  const b=scheduleBtn();if(!b)return;
  b.dataset.smProgrammatic="1";b.click();delete b.dataset.smProgrammatic;
  await sleep(80);insertTabs("schedule");closeDrawer();
}
async function openMeetings(){
  currentMode="meetings";closeDrawer();
  const b=meetingBtn();if(!b)return;
  b.dataset.smProgrammatic="1";b.click();delete b.dataset.smProgrammatic;
  await sleep(80);insertTabs("meetings");enhanceResidentMeetings();closeDrawer();
}

function wireNav(){
  const s=scheduleBtn(),m=meetingBtn();
  if(s){s.textContent="Schedule & meetings";if(!s.dataset.smWired){s.dataset.smWired="1";s.addEventListener("click",()=>{if(s.dataset.smProgrammatic)return;currentMode="schedule";closeDrawer();setTimeout(()=>{insertTabs("schedule");closeDrawer()},100)})}}
  if(m){m.style.display="none";if(!m.dataset.smWired){m.dataset.smWired="1";m.addEventListener("click",()=>{if(m.dataset.smProgrammatic)return;currentMode="meetings";closeDrawer();setTimeout(()=>{insertTabs("meetings");enhanceResidentMeetings();closeDrawer()},100)})}}
  navButtons().forEach(b=>{if(!b.dataset.smDrawerWired){b.dataset.smDrawerWired="1";b.addEventListener("click",()=>setTimeout(closeDrawer,0))}})
}

async function decodeImage(file){
  if("BarcodeDetector" in window){
    const bitmap=await createImageBitmap(file);const detector=new BarcodeDetector({formats:["qr_code"]});const codes=await detector.detect(bitmap);bitmap.close?.();return codes?.[0]?.rawValue||"";
  }
  if(!window.jsQR){await new Promise((resolve,reject)=>{const sc=document.createElement("script");sc.src="https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js";sc.onload=resolve;sc.onerror=reject;document.head.appendChild(sc)})}
  const img=await createImageBitmap(file);const canvas=document.createElement("canvas");canvas.width=img.width;canvas.height=img.height;const ctx=canvas.getContext("2d");ctx.drawImage(img,0,0);const data=ctx.getImageData(0,0,canvas.width,canvas.height);img.close?.();return window.jsQR?.(data.data,data.width,data.height)?.data||"";
}
function tokenFromQr(value){
  try{const u=new URL(value,location.href);const h=u.hash||"";const m=h.match(/attendance-checkin=([^&]+)/);return m?decodeURIComponent(m[1]):""}catch{return String(value||"").match(/attendance-checkin=([^&\s]+)/)?.[1]||""}
}
async function scanForMeeting(meetingId,btn){
  if(lastScanBusy)return;lastScanBusy=true;btn.disabled=true;btn.textContent="Reading QR…";
  try{
    let input=$("#attendanceQrPicker168");if(!input){input=document.createElement("input");input.id="attendanceQrPicker168";input.type="file";input.accept="image/*";input.setAttribute("capture","environment");document.body.appendChild(input)}
    const file=await new Promise(resolve=>{input.value="";input.onchange=()=>resolve(input.files?.[0]||null);input.click()});
    if(!file)return;
    const decoded=await decodeImage(file);const token=tokenFromQr(decoded);if(!token)throw new Error("QR code could not be read. Please scan the meeting QR again.");
    const {error}=await sb.rpc("resident_attendance_checkin_v167",{p_qr_token:token,p_meeting_id:meetingId});if(error)throw error;
    btn.outerHTML='<div class="attendance-attended-check">✓ Attendance recorded</div>';
    const card=btn.closest?.(".attendance-card");const badge=card?.querySelector(".attendance-badge.wait");if(badge){badge.className="attendance-badge ok";badge.textContent="✓ Attended"}
    const toast=$("#toast");if(toast){toast.textContent="Attendance recorded successfully";toast.style.display="block";setTimeout(()=>toast.style.display="none",3000)}
  }catch(e){alert(e?.message||String(e))}finally{lastScanBusy=false;if(document.body.contains(btn)){btn.disabled=false;btn.textContent="Scan QR code"}}
}

function enhanceResidentMeetings(){
  const cards=$$("#attendanceResidentList .attendance-card");
  cards.forEach(card=>{
    if(card.querySelector(".attendance-attended-check"))return;
    const attended=[...card.querySelectorAll(".attendance-badge")].some(x=>/attended/i.test(x.textContent));
    if(attended){const meta=card.querySelector(".attendance-meta");if(meta&&!card.querySelector(".attendance-attended-check")){const check=document.createElement("div");check.className="attendance-attended-check";check.textContent="✓ You attended this meeting";meta.after(check)};return}
    const physical=[...card.querySelectorAll(".attendance-badge")].some(x=>/physical/i.test(x.textContent));if(!physical)return;
    if(card.querySelector(".attendance-scan-btn"))return;
    const id=card.querySelector("[data-online-checkin]")?.dataset.onlineCheckin || (()=>{const html=card.outerHTML;return html.match(/data-online-checkin="([^"]+)"/)?.[1]||""})();
    // Physical cards have no native button, so obtain the id from the meeting list data by matching title in the RPC below.
    const title=card.querySelector("h3")?.textContent?.trim()||"";
    (async()=>{try{const {data,error}=await sb.rpc("get_my_attendance_meetings_v167");if(error)throw error;const m=(data||[]).find(x=>String(x.title||"").trim()===title&&!x.attended&&x.meeting_mode==="physical");if(!m)return;const actions=document.createElement("div");actions.className="attendance-actions";actions.innerHTML=`<button class="attendance-scan-btn" type="button">Scan QR code</button><div class="attendance-scan-note">Use your phone camera on the QR displayed by the Admin. A successful scan immediately marks you attended.</div>`;card.appendChild(actions);actions.querySelector("button").onclick=e=>scanForMeeting(m.id,e.currentTarget)}catch{}})();
  });
}

function observe(){
  const root=$("#content");if(!root)return;let timer=0;new MutationObserver(()=>{clearTimeout(timer);timer=setTimeout(()=>{wireNav();if(currentMode==="meetings"||location.hash.startsWith("#attendance")){insertTabs("meetings");enhanceResidentMeetings()}else if(/schedule/i.test($("#title")?.textContent||"")){insertTabs("schedule")}},60)}).observe(root,{childList:true,subtree:true});
}

addStyles();
let tries=0;const boot=setInterval(()=>{wireNav();tries++;if(scheduleBtn()||meetingBtn()){clearInterval(boot);observe();if(location.hash.startsWith("#attendance")){currentMode="meetings";setTimeout(()=>{insertTabs("meetings");enhanceResidentMeetings()},150)}}else if(tries>80)clearInterval(boot)},100);
