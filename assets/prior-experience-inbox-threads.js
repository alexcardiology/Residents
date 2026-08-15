import { sb } from "./supabase.js";

let enhancing=false;
let threads=new Map();
const esc=(value)=>String(value??"").replace(/[&<>'"]/g,(char)=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"})[char]);
const unwrap=(result)=>{if(result?.error)throw result.error;return result?.data;};
const fmt=(value)=>{if(!value)return"";const d=new Date(value);return new Intl.DateTimeFormat("en-GB",{day:"2-digit",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"}).format(d);};
function timelineHtml(thread){
  const events=Array.isArray(thread.events)?thread.events:[];
  return `<div class="modal prior-thread-modal"><div class="modal-head"><div><span class="eyebrow">Prior Experience thread</span><h2>${esc(thread.subject||"Prior Experience update")}</h2><p>All updates about this same verification issue stay together here. The Inbox title always reflects the newest update.</p></div><button type="button" data-close>×</button></div><div class="prior-thread-timeline">${events.map((event,index)=>`<article class="prior-thread-event"><span class="prior-thread-dot">${index+1}</span><div><div class="prior-thread-event-head"><b>${esc(event.subject||"Update")}</b><small>${fmt(event.created_at)}</small></div><p>${esc(event.body||"").replace(/\n/g,"<br>")}</p>${event.sender_name?`<small>System update · ${esc(event.sender_name)}</small>`:""}</div></article>`).join("")||'<div class="mail-empty">No thread history available.</div>'}</div><div class="actions"><button type="button" class="btn" data-close>Close</button></div></div>`;
}
function customRow(thread){
  const unread=!thread.is_read;
  const events=Array.isArray(thread.events)?thread.events:[];
  const preview=String(thread.latest_body||events.at(-1)?.body||"").replace(/\s+/g," ").trim();
  return `<article class="message-row prior-thread-row ${unread?"unread":"read"}" data-message-category="normal" data-message-search="${esc(`${thread.subject||""} ${preview} prior experience`.toLowerCase())}" data-prior-thread-shell="${esc(thread.message_id)}"><input class="message-select" type="checkbox" value="${esc(thread.message_id)}" aria-label="Select Prior Experience thread"><button class="message-open prior-thread-open" type="button" data-prior-thread-key="${esc(thread.thread_key)}"><span class="message-person"><span class="message-direction">Prior Experience</span>Verification updates</span><span class="message-subject"><span class="decision-title"><span class="decision-icon ${unread?"reconsider":"approved_updates"}" aria-hidden="true">${unread?"●":"✓"}</span><span>${esc(thread.subject||"Prior Experience update")}</span></span><small class="thread-preview">${esc(preview||"Open thread")}${events.length>1?` · ${events.length} updates`:""}</small></span><small>${fmt(thread.created_at)}</small></button></article>`;
}
async function loadThreads(){
  try{return unwrap(await sb.rpc("get_prior_experience_inbox_threads_v124"))||[];}catch(error){console.warn("Prior Experience inbox threads unavailable",error);return[];}
}
function updateUnreadBadges(){
  const panel=document.querySelector('.mail-panel[data-mail-panel="inbox"]');
  if(!panel)return;
  const count=panel.querySelectorAll('.message-row.unread').length;
  document.querySelectorAll('[data-inbox-badge]').forEach((badge)=>{badge.textContent=String(count);badge.hidden=count===0;});
  const tabBadge=document.querySelector('[data-mail-tab="inbox"] .nav-badge');
  if(tabBadge){tabBadge.textContent=String(count);tabBadge.hidden=count===0;}
}
async function enhanceInbox(){
  if(enhancing)return;
  const title=String(document.querySelector("#title")?.textContent||"").trim().toLowerCase();
  if(title!=="inbox")return;
  const list=document.querySelector('.mail-panel[data-mail-panel="inbox"] .message-list');
  if(!list)return;
  enhancing=true;
  try{
    const data=await loadThreads();
    threads=new Map(data.map((thread)=>[String(thread.thread_key),thread]));
    data.forEach((thread)=>{
      const shell=list.querySelector(`[data-message-id="${CSS.escape(String(thread.message_id))}"]`)?.closest('.message-row');
      if(!shell)return;
      if(shell.dataset.priorThreadReplaced==="1")return;
      const holder=document.createElement("div");holder.innerHTML=customRow(thread);
      const replacement=holder.firstElementChild;
      shell.replaceWith(replacement);
    });
    updateUnreadBadges();
  }finally{enhancing=false;}
}
async function openThread(key,row){
  const thread=threads.get(String(key));if(!thread)return;
  try{await sb.rpc("mark_prior_experience_thread_read_v124",{p_thread_key:String(key)});}catch(error){console.warn(error);}
  thread.is_read=true;
  row?.classList.remove("unread");row?.classList.add("read");
  updateUnreadBadges();
  const modal=document.querySelector("#modal"),body=document.querySelector("#modalBody");
  if(!modal||!body)return;
  body.innerHTML=timelineHtml(thread);modal.showModal();
}
document.addEventListener("click",(event)=>{
  const button=event.target.closest("[data-prior-thread-key]");
  if(!button)return;
  event.preventDefault();event.stopImmediatePropagation();
  void openThread(button.dataset.priorThreadKey,button.closest('.message-row'));
},true);
new MutationObserver(()=>void enhanceInbox()).observe(document.documentElement,{childList:true,subtree:true});
window.addEventListener("hashchange",()=>setTimeout(()=>void enhanceInbox(),80));
setInterval(()=>void enhanceInbox(),1200);
void enhanceInbox();
