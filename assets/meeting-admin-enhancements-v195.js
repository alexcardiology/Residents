import { sb } from './supabase.js';

const $=(s,r=document)=>r.querySelector(s);
const $$=(s,r=document)=>[...r.querySelectorAll(s)];
const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const CAIRO='Africa/Cairo';
const dt=v=>v?new Intl.DateTimeFormat('en-GB',{timeZone:CAIRO,day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}).format(new Date(v)):'—';
const toIso=v=>v?new Date(`${v}:00+03:00`).toISOString():null;
const rpc=async(name,args={})=>{const{data,error}=await sb.rpc(name,args);if(error)throw error;return data};

let profiles=[];
let profileLoad=null;
let armTimer=null;

function addStyles(){
  if($('#meet195Styles'))return;
  const s=document.createElement('style');s.id='meet195Styles';s.textContent=`
    .meet187-card .meet187-meta>span:first-child{font-size:1.14rem!important;font-weight:950!important;color:#0b1f37!important;line-height:1.25;margin:3px 0 5px}
    .meet195-audience{grid-column:1/-1;border:1px solid #dccbd0;border-radius:16px;padding:14px;background:#fffafb}.meet195-audience h3{margin:0 0 5px}.meet195-audience>p{margin:0 0 11px;color:#75646a;font-size:.78rem}.meet195-send{display:flex!important;grid-template-columns:auto 1fr!important;align-items:center;gap:8px;font-size:.86rem!important;margin-bottom:11px}.meet195-send input,.meet195-chip input,.meet195-person input{width:auto!important;accent-color:#a61f33}.meet195-chips{display:flex;flex-wrap:wrap;gap:7px}.meet195-chip{display:flex!important;grid-template-columns:auto 1fr!important;align-items:center;gap:6px;border:1px solid #e0d0d5;border-radius:10px;padding:8px 10px;background:#fff;font-size:.78rem!important;cursor:pointer}.meet195-chip:has(input:checked){border-color:#b4233c;background:#fff1f4}.meet195-manual{display:none;margin-top:11px}.meet195-manual.show{display:block}.meet195-search{width:100%;box-sizing:border-box;border:1px solid #dccbd0;border-radius:10px;padding:9px 10px;font:inherit}.meet195-people{margin-top:7px;max-height:230px;overflow:auto;border:1px solid #eadde1;border-radius:11px;background:#fff}.meet195-person{display:flex!important;grid-template-columns:auto 1fr!important;align-items:center;gap:8px;padding:8px 10px;border-bottom:1px solid #f2e8eb;font-size:.78rem!important}.meet195-person:last-child{border-bottom:0}.meet195-person b{display:block}.meet195-person small{color:#74656a}.meet195-summary{margin-top:8px;color:#784b58;font-size:.76rem;font-weight:850}.meet195-tools{align-items:center}.meet195-notified{font-size:.76rem;font-weight:850;color:#755e66}.meet195-cancel{background:#bf7310!important;color:#fff!important;-webkit-text-fill-color:#fff!important}.meet195-delete{background:#fff0f2!important;color:#a1162d!important;-webkit-text-fill-color:#a1162d!important;border:1px solid #edb7c1!important}.meet195-cancelled{display:inline-flex;padding:5px 9px;border-radius:999px;background:#fde7ea;color:#a1162d;font-size:.72rem;font-weight:950}
    @media(max-width:720px){.meet187-card .meet187-meta>span:first-child{font-size:1.06rem!important}.meet195-audience{padding:12px}}
  `;document.head.appendChild(s);
}

async function loadProfiles(){
  if(profiles.length)return profiles;
  if(profileLoad)return profileLoad;
  profileLoad=(async()=>{
    const [{data:p,error},{data:c}]=await Promise.all([
      sb.from('profiles').select('id,display_name,username,email,role,residency_year,is_active').eq('is_active',true).order('display_name'),
      sb.from('profile_role_capabilities').select('profile_id,capability,is_active').eq('capability','assessor').eq('is_active',true)
    ]);
    if(error)throw error;
    const dual=new Set((c||[]).map(x=>String(x.profile_id)));
    profiles=(p||[]).map(x=>({...x,dualAssessor:dual.has(String(x.id))}));
    return profiles;
  })();
  try{return await profileLoad}finally{profileLoad=null}
}

function roleLabel(p){
  const base=p.role==='resident'?(p.residency_year?`Resident · Year ${p.residency_year}`:'Resident'):p.role==='assessor'?'Assessor':p.role==='owner'?'Admin':String(p.role||'');
  return p.dualAssessor?`${base} + Assessor`:base;
}

function panelHtml(){return `<section class="meet195-audience" data-meet195-panel><h3>Push notification recipients</h3><p>Select one or several groups. Duplicate accounts are automatically removed.</p><label class="meet195-send"><input type="checkbox" data-meet195-send checked><span>Send a push notification when the meeting is created</span></label><div class="meet195-chips"><label class="meet195-chip"><input type="checkbox" data-meet195-all-residents><span>All residents</span></label><label class="meet195-chip"><input type="checkbox" data-meet195-all-assessors><span>All assessors</span></label>${[1,2,3,4,5].map(y=>`<label class="meet195-chip"><input type="checkbox" data-meet195-year="${y}"><span>Year ${y}</span></label>`).join('')}<label class="meet195-chip"><input type="checkbox" data-meet195-year="6"><span>Visitor residents</span></label><label class="meet195-chip"><input type="checkbox" data-meet195-year="7"><span>Fellows</span></label><label class="meet195-chip"><input type="checkbox" data-meet195-manual-toggle><span>Select manually</span></label></div><div class="meet195-manual" data-meet195-manual><input class="meet195-search" data-meet195-search placeholder="Search name, username, email or role"><div class="meet195-people" data-meet195-people></div></div><div class="meet195-summary" data-meet195-summary>Select who should receive the meeting notification.</div></section>`}

function manualSet(panel){return panel.__meet195Manual||(panel.__meet195Manual=new Set())}
function paintPeople(panel,q=''){
  const query=q.trim().toLowerCase(),chosen=manualSet(panel),box=$('[data-meet195-people]',panel);if(!box)return;
  const list=profiles.filter(p=>!query||[p.display_name,p.username,p.email,roleLabel(p)].some(v=>String(v||'').toLowerCase().includes(query)));
  box.innerHTML=list.length?list.map(p=>`<label class="meet195-person"><input type="checkbox" data-meet195-person value="${esc(p.id)}" ${chosen.has(String(p.id))?'checked':''}><span><b>${esc(p.display_name||p.username||'User')}</b><small>@${esc(p.username||'')} · ${esc(roleLabel(p))}</small></span></label>`).join(''):'<div class="meet195-person"><span>No users found</span></div>';
}

function audience(panel){
  if(!$('[data-meet195-send]',panel)?.checked)return [];
  const ids=new Set(),add=p=>ids.add(String(p.id));
  if($('[data-meet195-all-residents]',panel)?.checked)profiles.filter(p=>p.role==='resident').forEach(add);
  if($('[data-meet195-all-assessors]',panel)?.checked)profiles.filter(p=>p.role==='assessor'||p.dualAssessor).forEach(add);
  $$('[data-meet195-year]:checked',panel).forEach(el=>profiles.filter(p=>p.role==='resident'&&Number(p.residency_year)===Number(el.dataset.meet195Year)).forEach(add));
  manualSet(panel).forEach(id=>ids.add(id));
  return [...ids];
}
function summary(panel){
  const n=$('[data-meet195-summary]',panel);if(!n)return;
  if(!$('[data-meet195-send]',panel)?.checked){n.textContent='No creation push notification will be sent.';return}
  const count=audience(panel).length;n.textContent=count?`${count} unique account${count===1?'':'s'} selected for notification.`:'Select at least one recipient group or person.';
}
async function push(ids,title,body){
  if(!ids.length)return {users_reached:0,sent:0};
  const{data,error}=await sb.functions.invoke('push-notify',{body:{title,body,route:'#meetings',target:'manual',user_ids:ids}});if(error)throw error;if(data?.error)throw new Error(data.error);return data||{};
}

async function enhanceForm(form){
  if(form.dataset.meet195Enhanced)return;
  await loadProfiles();
  if(!form.isConnected||form.dataset.meet195Enhanced)return;
  form.dataset.meet195Enhanced='1';
  const submit=form.querySelector('button[type="submit"]');if(!submit)return;
  submit.insertAdjacentHTML('beforebegin',panelHtml());
  const panel=$('[data-meet195-panel]',form);paintPeople(panel);summary(panel);
  panel.addEventListener('change',e=>{
    if(e.target.matches('[data-meet195-manual-toggle]'))$('[data-meet195-manual]',panel)?.classList.toggle('show',e.target.checked);
    if(e.target.matches('[data-meet195-person]')){const s=manualSet(panel),id=String(e.target.value);e.target.checked?s.add(id):s.delete(id)}
    summary(panel);
  });
  $('[data-meet195-search]',panel)?.addEventListener('input',e=>paintPeople(panel,e.target.value));
  form.addEventListener('submit',async e=>{
    e.preventDefault();e.stopImmediatePropagation();
    const ids=audience(panel),send=$('[data-meet195-send]',panel)?.checked;
    if(send&&!ids.length){alert('Choose at least one notification recipient, or turn off push notification for this meeting.');return}
    submit.disabled=true;
    try{
      await rpc('owner_create_attendance_meeting_v194',{p_title:form.title.value,p_meeting_date:form.date.value,p_starts_at:toIso(form.starts.value),p_ends_at:toIso(form.ends.value),p_checkin_opens_at:toIso(form.opens.value),p_checkin_closes_at:toIso(form.closes.value),p_meeting_mode:form.mode.value,p_venue:form.venue.value,p_notes:form.notes.value,p_notification_user_ids:ids});
      let msg='Meeting created successfully.';
      if(send){try{const venue=String(form.venue.value||'').trim(),r=await push(ids,`New meeting: ${form.title.value.trim()}`,`${form.title.value.trim()}\n${dt(toIso(form.starts.value))}${venue?`\n${venue}`:''}`);msg+=` Push sent to ${Number(r.users_reached||0)} user${Number(r.users_reached||0)===1?'':'s'}.`}catch(pe){msg+=` The meeting was created, but push delivery reported: ${pe.message||pe}`}}
      alert(msg);location.reload();
    }catch(err){alert(err.message||err);submit.disabled=false}
  },true);
}

async function enhanceCards(list){
  if(!list||list.dataset.meet195Synced==='1')return;
  const cards=$$('.meet187-card',list).filter(c=>c.querySelector('[data-meet187-report]'));if(!cards.length)return;
  let rows;try{rows=await rpc('owner_list_attendance_meetings_v194')}catch(e){console.warn('Meeting lifecycle details could not load',e);return}
  if(!list.isConnected)return;
  const map=new Map((rows||[]).map(m=>[String(m.id),m]));
  cards.forEach(card=>{
    const ref=card.querySelector('[data-meet187-report]'),id=String(ref?.dataset.meet187Report||''),m=map.get(id);if(!m)return;
    const tools=document.createElement('div');tools.className='meet187-actions meet195-tools';tools.dataset.meet195Tools='1';
    tools.innerHTML=`<span class="meet195-notified">🔔 ${Number(m.notification_count||0)} notified</span>${m.cancelled_at?'<span class="meet195-cancelled">Cancelled</span>':`<button type="button" class="meet187-btn meet195-cancel" data-meet195-cancel="${esc(id)}">Cancel meeting</button>`}<button type="button" class="meet187-btn meet195-delete" data-meet195-delete="${esc(id)}">Delete</button>`;
    card.appendChild(tools);
    if(m.cancelled_at)card.querySelectorAll('[data-meet187-create-code],[data-meet187-show-qr],[data-meet187-new-qr]').forEach(x=>x.remove());
  });
  list.dataset.meet195Synced='1';
  if(!list.dataset.meet195Bound){list.dataset.meet195Bound='1';list.addEventListener('click',lifecycleClick,true)}
}

async function lifecycleClick(e){
  const cancel=e.target.closest?.('[data-meet195-cancel]');
  if(cancel){
    if(!confirm('Cancel this meeting? A cancellation push notification will be sent to the people originally notified.'))return;
    cancel.disabled=true;
    try{const r=await rpc('owner_cancel_attendance_meeting_v194',{p_meeting_id:cancel.dataset.meet195Cancel}),ids=Array.isArray(r?.user_ids)?r.user_ids:[];let msg='Meeting cancelled.';if(ids.length){try{const p=await push(ids,`Meeting cancelled: ${r.title}`,`The meeting scheduled for ${dt(r.starts_at)} has been cancelled.`);msg+=` Cancellation sent to ${Number(p.users_reached||0)} user${Number(p.users_reached||0)===1?'':'s'}.`}catch(pe){msg+=` Cancellation was saved, but push delivery reported: ${pe.message||pe}`}}alert(msg);location.reload()}catch(err){alert(err.message||err);cancel.disabled=false}return;
  }
  const del=e.target.closest?.('[data-meet195-delete]');
  if(del){
    if(!confirm('Permanently delete this meeting? Use this for test meetings. Attendance/check-in records for it will also be deleted. This cannot be undone.'))return;
    del.disabled=true;try{await rpc('owner_delete_attendance_meeting_v194',{p_meeting_id:del.dataset.meet195Delete});alert('Meeting deleted.');location.reload()}catch(err){alert(err.message||err);del.disabled=false}
  }
}

async function enhance(){
  const form=$('#meet187MeetingForm');if(form&&!form.dataset.meet195Enhanced)try{await enhanceForm(form)}catch(e){console.warn('Meeting notification recipients could not load',e)}
  const list=$('#meet187AdminList');if(list)await enhanceCards(list);
}
function arm(){
  if(armTimer)clearInterval(armTimer);
  let tries=0;void enhance();armTimer=setInterval(()=>{tries++;void enhance();if(tries>=20||($('#meet187MeetingForm')?.dataset.meet195Enhanced==='1'&&$('#meet187AdminList')?.dataset.meet195Synced==='1')){clearInterval(armTimer);armTimer=null}},500);
}

document.addEventListener('click',e=>{
  if(e.target.closest?.('[data-sm191-open-meetings]'))arm();
  if(e.target.closest?.('[data-meet187-create-code],[data-meet187-new-qr]'))setTimeout(arm,800);
},true);
addStyles();arm();
