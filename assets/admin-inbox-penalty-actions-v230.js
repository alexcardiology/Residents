import { sb } from "./supabase.js";

const esc=(v)=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[c]);
let ownerPromise=null;
let loading=false;
let rerun=false;
const seenPenaltyMessages=new Set();
let enhanceTimers=[];

function ensureStyles(){
  if(document.querySelector("#adminInboxPenaltyActionsV230Styles"))return;
  const style=document.createElement("style");
  style.id="adminInboxPenaltyActionsV230Styles";
  style.textContent=`
    html.admin-red-theme .message-row[data-inbox-penalty-row="1"]{position:relative;}
    html.admin-red-theme .inbox-penalty-actions{display:flex;align-items:center;justify-content:flex-end;gap:8px;flex-wrap:wrap;margin-left:auto;padding:0 8px 0 12px;align-self:center;z-index:2;}
    html.admin-red-theme .inbox-penalty-actions .btn{min-height:36px;padding:8px 13px;border-radius:12px;font-size:.78rem;font-weight:850;white-space:nowrap;}
    html.admin-red-theme .inbox-penalty-actions .inbox-penalty-question{font-size:.78rem;font-weight:850;color:#3b0710;white-space:nowrap;}
    html.admin-red-theme .inbox-penalty-status{display:inline-flex;align-items:center;min-height:32px;padding:6px 11px;border-radius:999px;font-size:.76rem;font-weight:850;white-space:nowrap;}
    html.admin-red-theme .inbox-penalty-status.approved{color:#08733e;background:#e7f7ee;}
    html.admin-red-theme .inbox-penalty-status.rejected{color:#9d1e31;background:#fdecef;}
    html.admin-red-theme .inbox-penalty-saving{font-size:.76rem;font-weight:800;color:#756168;}
    html.admin-red-theme .inbox-penalty-inline-error{font-size:.76rem;font-weight:800;color:#9d1e31;}
    @media(max-width:900px){html.admin-red-theme .inbox-penalty-actions{width:100%;justify-content:flex-start;padding:8px 0 0 42px;margin-left:0;}}
  `;
  document.head.appendChild(style);
}

async function isOwner(){
  if(!ownerPromise){
    ownerPromise=(async()=>{
      const {data:{session}}=await sb.auth.getSession();
      const uid=session?.user?.id;
      if(!uid)return false;
      const {data}=await sb.from("profiles").select("role").eq("id",uid).maybeSingle();
      return data?.role==="owner";
    })();
  }
  return ownerPromise;
}

function findInboxRow(messageId){
  const id=String(messageId||"");
  const candidates=[...document.querySelectorAll('[data-message-id]')];
  const anchor=candidates.find(el=>String(el.dataset.messageId||"")===id&&String(el.dataset.messageBox||"inbox")==="inbox");
  return anchor?.closest(".message-row")||anchor?.closest("article")||anchor?.closest("li")||null;
}

function findSubjectNode(row){
  if(!row)return null;
  return [...row.querySelectorAll("strong,b,h3,h4,span")].find(el=>/Penalty awaiting approval|Penalty approved|Penalty rejected/i.test(String(el.textContent||"").trim()))||null;
}

function setSubject(row,status){
  const node=findSubjectNode(row);
  if(node)node.textContent=status==="approved"?"Penalty approved":"Penalty rejected";
}

function markRowRead(row){
  row?.classList.remove("unread");
  row?.classList.add("read");
}

function statusHtml(status){
  const label=status==="approved"?"Approved":"Rejected";
  return `<span class="inbox-penalty-status ${status}">${label}</span>`;
}

function actionButtons(item){
  return `<button type="button" class="btn small success" data-inbox-penalty-choice="approved" data-penalty-id="${esc(item.penalty_id)}" data-message-id="${esc(item.message_id)}">Approve</button><button type="button" class="btn small danger" data-inbox-penalty-choice="rejected" data-penalty-id="${esc(item.penalty_id)}" data-message-id="${esc(item.message_id)}">Reject</button>`;
}

function countUnreadThreads(messages=[],reviewActions=[]){
  const reviewByMessage=new Map((reviewActions||[]).map(row=>[String(row.message_id||""),String(row.review_id||"")]));
  const unread=new Set();
  (messages||[]).forEach(message=>{
    if(message?.is_read)return;
    const reviewId=reviewByMessage.get(String(message?.id||""));
    unread.add(reviewId?`review:${reviewId}`:`message:${message?.id}`);
  });
  return unread.size;
}

async function refreshInboxBadge(){
  try{
    const [{data:messages},{data:reviewActions}]=await Promise.all([
      sb.rpc("get_private_messages",{p_box:"inbox"}),
      sb.rpc("get_my_review_message_actions_v1051")
    ]);
    const count=countUnreadThreads(messages||[],reviewActions||[]);
    document.querySelectorAll("[data-inbox-badge]").forEach(badge=>{badge.textContent=String(count);badge.hidden=count===0;});
    document.querySelectorAll('.mailbox-tab[data-mail-tab="inbox"] .inline-badge').forEach(badge=>{badge.textContent=String(count);badge.hidden=count===0;});
  }catch(_){}
}

async function markPenaltySeen(messageId,row){
  const id=String(messageId||"");
  if(!id||seenPenaltyMessages.has(id))return;
  seenPenaltyMessages.add(id);
  try{
    const {error}=await sb.rpc("mark_private_message_read",{p_message_id:id});
    if(error)throw error;
    markRowRead(row);
    await refreshInboxBadge();
  }catch(_){seenPenaltyMessages.delete(id);}
}

function renderItem(item){
  const row=findInboxRow(item.message_id);
  if(!row)return false;
  row.dataset.inboxPenaltyRow="1";
  let holder=row.querySelector("[data-inbox-penalty-actions]");
  if(!holder){
    holder=document.createElement("div");
    holder.className="inbox-penalty-actions";
    holder.dataset.inboxPenaltyActions="1";
    row.appendChild(holder);
  }
  const nextStatus=String(item.status||"");
  const samePenalty=holder.dataset.penaltyId===String(item.penalty_id||"");
  const sameStatus=holder.dataset.status===nextStatus;
  holder.dataset.penaltyId=String(item.penalty_id||"");
  holder.dataset.messageId=String(item.message_id||"");
  holder.dataset.status=nextStatus;

  if(nextStatus==="approved"||nextStatus==="rejected"){
    if(!samePenalty||!sameStatus||!holder.querySelector(".inbox-penalty-status")) holder.innerHTML=statusHtml(nextStatus);
    setSubject(row,nextStatus);
    markRowRead(row);
  }else if(!samePenalty||!sameStatus||!holder.querySelector("[data-inbox-penalty-choice]")){
    holder.innerHTML=actionButtons(item);
  }
  void markPenaltySeen(item.message_id,row);
  return true;
}

async function enhance(){
  if(location.hash!=="#inbox")return;
  if(loading){rerun=true;return;}
  loading=true;
  try{
    ensureStyles();
    if(!(await isOwner()))return;
    const {data,error}=await sb.rpc("owner_penalty_inbox_items_v230");
    if(error)throw error;
    (Array.isArray(data)?data:[]).forEach(renderItem);
  }catch(error){
    console.warn("Admin inbox penalty actions:",error);
  }finally{
    loading=false;
    if(rerun){rerun=false;setTimeout(enhance,100);}
  }
}

function scheduleEnhanceBurst(){
  enhanceTimers.forEach(clearTimeout);
  enhanceTimers=[120,420,900,1600].map(delay=>setTimeout(()=>void enhance(),delay));
}

function renderConfirm(holder,decision,penaltyId,messageId){
  const verb=decision==="approved"?"Approve":"Reject";
  holder.innerHTML=`<span class="inbox-penalty-question">${verb} this penalty?</span><button type="button" class="btn small ${decision==="approved"?"success":"danger"}" data-inbox-penalty-confirm="${decision}" data-penalty-id="${esc(penaltyId)}" data-message-id="${esc(messageId)}">Confirm</button><button type="button" class="btn small secondary" data-inbox-penalty-cancel="1">Cancel</button>`;
}

async function decide(button){
  const decision=String(button.dataset.inboxPenaltyConfirm||"");
  const penaltyId=Number(button.dataset.penaltyId);
  const messageId=String(button.dataset.messageId||"");
  const holder=button.closest("[data-inbox-penalty-actions]");
  const row=holder?.closest(".message-row")||holder?.parentElement;
  if(!holder||!row||!penaltyId||!["approved","rejected"].includes(decision))return;
  [...holder.querySelectorAll("button")].forEach(b=>b.disabled=true);
  holder.insertAdjacentHTML("beforeend",'<span class="inbox-penalty-saving">Saving…</span>');
  const {error}=await sb.rpc("owner_decide_penalty_v1071",{p_penalty_id:penaltyId,p_decision:decision,p_note:null});
  if(error){
    holder.innerHTML=`<span class="inbox-penalty-inline-error">${esc(error.message||"Could not save decision.")}</span><button type="button" class="btn small secondary" data-inbox-penalty-cancel="1">Back</button>`;
    return;
  }
  try{await sb.rpc("mark_private_message_read",{p_message_id:messageId});}catch(_){}
  holder.dataset.status=decision;
  holder.innerHTML=statusHtml(decision);
  setSubject(row,decision);
  markRowRead(row);
  void refreshInboxBadge();
}

document.addEventListener("click",event=>{
  const choice=event.target.closest?.("[data-inbox-penalty-choice]");
  if(choice){event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();const holder=choice.closest("[data-inbox-penalty-actions]");if(holder)renderConfirm(holder,choice.dataset.inboxPenaltyChoice,choice.dataset.penaltyId,choice.dataset.messageId);return;}
  const cancel=event.target.closest?.("[data-inbox-penalty-cancel]");
  if(cancel){event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();const holder=cancel.closest("[data-inbox-penalty-actions]");if(holder)holder.innerHTML=actionButtons({penalty_id:holder.dataset.penaltyId,message_id:holder.dataset.messageId});return;}
  const confirm=event.target.closest?.("[data-inbox-penalty-confirm]");
  if(confirm){event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();void decide(confirm);}
},true);

// IMPORTANT: no body-wide MutationObserver here. This module used to mutate the
// same Inbox DOM that it observed, producing an endless enhance -> DOM mutation
// -> enhance loop. Use bounded route-load retries instead.
window.addEventListener("hashchange",scheduleEnhanceBurst);
if(location.hash==="#inbox")scheduleEnhanceBurst();
