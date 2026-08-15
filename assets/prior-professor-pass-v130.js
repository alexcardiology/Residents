import { sb } from "./supabase.js";

let selectedKey="",busy=false,timer=0;
const esc=(v)=>String(v??"").replace(/[&<>'"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"})[c]);
const unwrap=(r)=>{if(r?.error)throw r.error;return r?.data};
async function enhance(){
  if(busy)return;const form=document.querySelector("#modalBody #priorExperienceReviewForm.prior-review-modal");if(!form)return;const row=window.priorExperienceReviewRows?.get(String(selectedKey||""));if(!row||row.assessor_level!=="professor")return;const holder=form.querySelector(".prior-faculty-opinions");if(!holder||holder.dataset.passOpinionsV130==="1")return;busy=true;
  try{const data=unwrap(await sb.rpc("get_prior_experience_submission_v1069",{p_logbook_id:Number(row.logbook_id)}));const professor=(data?.scope_verifications||[]).find(v=>Number(v.id)===Number(row.review_id));const fieldKey=professor?.field_key;if(!fieldKey)return;const passed=(data?.scope_verifications||[]).filter(v=>v.assessor_level==="faculty"&&v.field_key===fieldKey&&v.status==="passed");passed.forEach(v=>{const article=document.createElement("article");article.className="pass-opinion";article.innerHTML=`<div><b>${esc(v.scope_name)}</b><span class="tag neutral">Pass</span></div><strong>${esc(v.assessor_name||"Faculty auditor")}</strong><p>${esc(v.note||"Pass recorded without comment. Pass is neutral unless a majority of assigned first-level auditors choose Pass, which escalates the manual to professor review.")}</p>`;holder.appendChild(article)});holder.dataset.passOpinionsV130="1"}catch(error){console.warn("Pass opinions",error)}finally{busy=false}
}
function schedule(){clearTimeout(timer);timer=setTimeout(()=>void enhance(),140)}
document.addEventListener("click",event=>{const b=event.target.closest("[data-prior-review-open]");if(b){selectedKey=String(b.dataset.priorReviewOpen||"");setTimeout(()=>void enhance(),180)}},true);const modalBody=document.querySelector("#modalBody");if(modalBody)new MutationObserver(schedule).observe(modalBody,{childList:true,subtree:true});
