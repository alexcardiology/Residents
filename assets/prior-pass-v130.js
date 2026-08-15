import { sb } from "./supabase.js";

let selectedKey="",enhancing=false;
const esc=(v)=>String(v??"").replace(/[&<>'"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"})[c]);
const unwrap=(r)=>{if(r?.error)throw r.error;return r?.data};
function toast(text){const n=document.querySelector("#toast");if(!n)return;n.textContent=text;n.style.display="block";setTimeout(()=>n.style.display="none",3200)}
function currentRow(){return window.priorExperienceReviewRows?.get(String(selectedKey||""))||null}
function installSeniorPass(){
  const form=document.querySelector("#modalBody #priorExperienceReviewForm.prior-review-modal");if(!form||form.querySelector("[data-prior-pass-senior]"))return;
  const row=currentRow();if(!row||row.review_kind!=="senior"||String(row.review_status)!=="pending")return;
  const actions=form.querySelector(".actions");if(!actions)return;
  const btn=document.createElement("button");btn.type="button";btn.className="btn pass-button";btn.dataset.priorPassSenior="1";btn.textContent="Pass";btn.title="Do not verify this record. The resident will choose another senior verifier.";
  const reject=actions.querySelector('[data-prior-review-decision="rejected"]');actions.insertBefore(btn,reject||actions.children[1]||null);
  let note=form.querySelector(".prior-pass-explanation");if(!note){note=document.createElement("small");note.className="prior-pass-explanation";note.textContent="Pass = you do not verify this Prior Experience record. It goes back to the resident to choose another senior verifier.";actions.before(note)}
}
async function passSenior(button){
  const row=currentRow();if(!row)return;const form=button.closest("form"),note=String(form?.querySelector('textarea[name="note"]')?.value||"").trim();button.disabled=true;
  try{unwrap(await sb.rpc("review_prior_experience_v1069",{p_review_kind:"senior",p_review_id:Number(row.review_id),p_decision:"passed",p_note:note||null}));row.review_status="passed";toast("Passed · resident will choose another senior verifier");document.querySelector("#modal")?.close();setTimeout(()=>location.reload(),280)}catch(error){alert(error?.message||String(error));button.disabled=false}
}
async function replacementData(){
  const[data,candidates]=await Promise.all([sb.rpc("get_prior_experience_submission_v1069",{p_logbook_id:null}),sb.rpc("get_prior_experience_eligible_seniors_v1068")]);
  return{data:unwrap(data),candidates:unwrap(candidates)||[]};
}
async function enhanceReplacement(){
  if(enhancing)return;const title=String(document.querySelector("#title")?.textContent||"");if(!/Prior Experience Logbook/i.test(title))return;
  const content=document.querySelector("#content");if(!content||content.querySelector("[data-prior-pass-replacement-card]"))return;enhancing=true;
  try{
    const{data,candidates}=await replacementData();if(!data?.header)return;
    const activeIds=new Set([String(data.header.senior_1_id||""),String(data.header.senior_2_id||"")]);
    const passed=(data.senior_reviews||[]).filter(r=>r.status==="passed"&&activeIds.has(String(r.senior_id)));
    if(!passed.length)return;
    const used=new Set((data.senior_reviews||[]).map(r=>String(r.senior_id)));
    const available=candidates.filter(c=>!used.has(String(c.id)));
    const card=document.createElement("section");card.className="card prior-pass-replacement-card";card.dataset.priorPassReplacementCard="1";
    card.innerHTML=`<div class="section-head"><div><span class="eyebrow">Senior verifier replacement</span><h3>Choose another senior verifier</h3><p>A selected senior chose Pass. Their Pass remains in the audit history but does not count as verification.</p></div></div><div class="prior-pass-replacement-list">${passed.map(r=>`<form data-prior-replace-senior="${r.id}" class="prior-pass-replacement-row"><div><b>${esc(r.senior_name||"Senior resident")}</b><span class="tag neutral">Passed</span>${r.note?`<small>${esc(r.note)}</small>`:""}</div><select name="new_senior_id" required><option value="">Choose replacement senior</option>${available.map(c=>`<option value="${c.id}">${esc(c.display_name)} · Year ${c.residency_year}</option>`).join("")}</select><button class="btn" type="submit" ${available.length?"":"disabled"}>Send replacement request</button></form>`).join("")}</div>`;
    const verification=content.querySelector(".prior-verification-card,.prior-hierarchy-verification,.prior-experience-form");if(verification)verification.before(card);else content.prepend(card)
  }catch(error){console.warn("Replacement senior UI",error)}finally{enhancing=false}
}
document.addEventListener("click",(event)=>{const review=event.target.closest("[data-prior-review-open]");if(review){selectedKey=String(review.dataset.priorReviewOpen||"");setTimeout(installSeniorPass,60)}const pass=event.target.closest("[data-prior-pass-senior]");if(pass){event.preventDefault();event.stopImmediatePropagation();void passSenior(pass)}},true);
document.addEventListener("submit",async(event)=>{const form=event.target;if(!(form instanceof HTMLFormElement)||!form.dataset.priorReplaceSenior)return;event.preventDefault();event.stopImmediatePropagation();const senior=form.querySelector('select[name="new_senior_id"]')?.value,btn=form.querySelector('button[type="submit"]');if(!senior)return alert("Choose a replacement senior verifier.");btn.disabled=true;try{unwrap(await sb.rpc("resident_replace_passed_prior_senior_v130",{p_passed_review_id:Number(form.dataset.priorReplaceSenior),p_new_senior_id:senior}));toast("Replacement senior verifier selected");setTimeout(()=>location.reload(),280)}catch(error){alert(error?.message||String(error));btn.disabled=false}},true);
let timer=0;const schedule=()=>{clearTimeout(timer);timer=setTimeout(()=>{installSeniorPass();void enhanceReplacement()},100)};const content=document.querySelector("#content"),modalBody=document.querySelector("#modalBody");if(content)new MutationObserver(schedule).observe(content,{childList:true,subtree:true});if(modalBody)new MutationObserver(schedule).observe(modalBody,{childList:true,subtree:true});window.addEventListener("hashchange",()=>setTimeout(()=>void enhanceReplacement(),100));void enhanceReplacement();
