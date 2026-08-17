import { sb } from './supabase.js';

const $=(s,r=document)=>r.querySelector(s);
const $$=(s,r=document)=>[...r.querySelectorAll(s)];
const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const CAIRO='Africa/Cairo';
const dt=v=>v?new Intl.DateTimeFormat('en-GB',{timeZone:CAIRO,day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}).format(new Date(v)):'—';
const toIso=v=>v?new Date(`${v}:00+03:00`).toISOString():null;
const rpc=async(name,args={})=>{const{data,error}=await sb.rpc(name,args);if(error)throw error;return data};

let profilesCache=[];
let profilesPromise=null;
let listObserver=null;
let syncTimer=null;

function styles(){
  if($('#meet194Styles'))return;
  const s=document.createElement('style');s.id='meet194Styles';s.textContent=`
  .meet187-card .meet187-meta>span:first-child{font-size:1.12rem!important;font-weight:950!important;color:#0b1f37!important;line-height:1.25;margin:2px 0 4px}
  .meet194-audience{grid-column:1/-1;border:1px solid #dccbd0;border-radius:16px;padding:14px;background:#fffafb}.meet194-audience h3{margin:0 0 5px;font-size:1rem}.meet194-audience>p{margin:0 0 12px;color:#76636a;font-size:.78rem}.meet194-sendtoggle{display:flex!important;grid-template-columns:auto 1fr!important;align-items:center;gap:9px;font-size:.88rem!important;margin-bottom:11px}.meet194-sendtoggle input{width:auto!important;accent-color:#a61f33}.meet194-targets{display:flex;flex-wrap:wrap;gap:8px}.meet194-target{display:flex!important;grid-template-columns:auto 1fr!important;align-items:center;gap:7px;border:1px solid #e1d1d6;border-radius:10px;padding:8px 10px;background:#fff;font-size:.78rem!important;cursor:pointer}.meet194-target input{width:auto!important;accent-color:#a61f33}.meet194-target:has(input:checked){border-color:#b4233c;background:#fff1f4}.meet194-manual{display:none;margin-top:12px}.meet194-manual.show{display:block}.meet194-search{width:100%;box-sizing:border-box;border:1px solid #dccbd0;border-radius:10px;padding:9px 10px;font:inherit}.meet194-people{margin-top:8px;max-height:230px;overflow:auto;border:1px solid #eadde1;border-radius:11px;background:#fff}.meet194-person{display:flex!important;grid-template-columns:auto 1fr!important;gap:9px;align-items:center;padding:9px 10px;border-bottom:1px solid #f2e8eb;font-size:.78rem!important}.meet194-person:last-child{border-bottom:0}.meet194-person input{width:auto!important}.meet194-person b{display:block}.meet194-person small{color:#74656a}.meet194-summary{margin-top:9px;color:#754a56;font-size:.76rem;font-weight:800}.meet194-cancel{background:#c97a13!important;color:#fff!important;-webkit-text-fill-color:#fff!important}.meet194-delete{background:#fff0f2!important;color:#a1162d!important;-webkit-text-fill-color:#a1162d!important;border:1px solid #efb9c3!important}.meet194-cancelled{display:inline-flex;margin-left:7px;padding:5px 9px;border-radius:999px;background:#fde7ea;color:#a1162d;font-size:.72rem;font-weight:950}.meet194-notified{font-size:.75rem;color:#765f67;font-weight:800}
  @media(max-width:720px){.meet187-card .meet187-meta>span:first-child{font-size:1.05rem!important}.meet194-audience{padding:12px}}
  `;document.head.appendChild(s);
}

async function loadProfiles(){
  if(profilesCache.length)return profilesCache;
  if(profilesPromise)return profilesPromise;
  profilesPromise=(async()=>{
    const [{data:profiles,error},{data:caps}]=await Promise.all([
      sb.from('profiles').select('id,display_name,username,email,role,residency_year,is_active').eq('is_active',true).order('display_name'),
      sb.from('profile_role_capabilities').select('profile_id,capability,is_active').eq('capability','assessor').eq('is_active',true)
    ]);
    if(error)throw error;
    const assessorCap=new Set((caps||[]).map(r=>String(r.profile_id)));
    profilesCache=(profiles||[]).map(p=>({...p,dualAssessor:assessorCap.has(String(p.id))}));
    return profilesCache;
  })();
  try{return await profilesPromise}finally{profilesPromise=null}
}

function personRole(p){
  const base=p.role==='resident'?(p.residency_year?`Resident · Year ${p.residency_year}`:'Resident'):p.role==='assessor'?'Assessor':p.role==='owner'?'Admin':String(p.role||'');
  return p.dualAssessor?`${base} + Assessor`:base;
}

function audienceMarkup(){return `<section class="meet194-audience" data-meet194-audience><h3>Push notification recipients</h3><p>Choose one or several groups. Duplicate people are automatically counted once.</p><label class="meet194-sendtoggle"><input type="checkbox" data-meet194-send checked><span>Send a push notification when this meeting is created</span></label><div class="meet194-targets"><label class="meet194-target"><input type="checkbox" data-meet194-group="all_residents"><span>All residents</span></label><label class="meet194-target"><input type="checkbox" data-meet194-group="all_assessors"><span>All assessors</span></label>${[1,2,3,4,5].map(y=>`<label class="meet194-target"><input type="checkbox" data-meet194-year="${y}"><span>Year ${y}</span></label>`).join('')}<label class="meet194-target"><input type="checkbox" data-meet194-year="6"><span>Visitor residents</span></label><label class="meet194-target"><input type="checkbox" data-meet194-year="7"><span>Fellows</span></label><label class="meet194-target"><input type="checkbox" data-meet194-manual-toggle><span>Select manually</span></label></div><div class="meet194-manual" data-meet194-manual><input class="meet194-search" data-meet194-search placeholder="Search name, username, email or role"><div class="meet194-people" data-meet194-people></div></div><div class="meet194-summary" data-meet194-summary>Select who should receive the meeting notification.</div></section>`}

function paintPeople(panel,query=''){
  const q=query.trim().toLowerCase();
  const box=$('[data-meet194-people]',panel);if(!box)return;
  const selected=new Set($$('[data-meet194-person]:checked',panel).map(x=>x.value));
  const people=profilesCache.filter(p=>!q||[p.display_name,p.username,p.email,personRole(p)].some(v=>String(v||'').toLowerCase().includes(q)));
  box.innerHTML=people.length?people.map(p=>`<label class="meet194-person"><input type="checkbox" data-meet194-person value="${esc(p.id)}" ${selected.has(String(p.id))?'checked':''}><span><b>${esc(p.display_name||p.username||'User')}</b><small>@${esc(p.username||'')} · ${esc(personRole(p))}</small></span></label>`).join(''):'<div class="meet194-person"><span>No users found</span></div>';
}

function resolveAudience(panel){
  if(!$('[data-meet194-send]',panel)?.checked)return [];
  const ids=new Set();
  const add=p=>ids.add(String(p.id));
  if($('[data-meet194-group="all_residents"]',panel)?.checked)profilesCache.filter(p=>p.role==='resident').forEach(add);
  if($('[data-meet194-group="all_assessors"]',panel)?.checked)profilesCache.filter(p=>p.role==='assessor'||p.dualAssessor).forEach(add);
  $$('[data-meet194-year]:checked',panel).forEach(el=>profilesCache.filter(p=>p.role==='resident'&&Number(p.residency_year)===Number(el.dataset.meet194Year)).forEach(add));
  $$('[data-meet194-person]:checked',panel).forEach(el=>ids.add(String(el.value)));
  return [...ids];
}

function updateSummary(panel){
  const send=$('[data-meet194-send]',panel)?.checked;
  const node=$('[data-meet194-summary]',panel);if(!node)return;
  if(!send){node.textContent='No creation push notification will be sent.';return}
  const n=resolveAudience(panel).length;
  node.textContent=n?`${n} unique account${n===1?'':'s'} selected for notification.`:'Select at least one recipient group or person.';
}

async function sendPush(userIds,title,body){
  if(!userIds.length)return {skipped:true};
  const{data,error}=await sb.functions.invoke('push-notify',{body:{title,body,route:'#meetings',target:'manual',user_ids:userIds}});
  if(error)throw error;if(data?.error)throw new Error(data.error);return data||{};
}

function notificationBody(form){
  const when=dt(toIso(form.starts.value));
  const venue=String(form.venue.value||'').trim();
  return `${form.title.value.trim()}\n${when}${venue?`\n${venue}`:''}`;
}

async function installForm(form){
  if(form.dataset.meet194Enhanced)return;
  form.dataset.meet194Enhanced='1';styles();
  await loadProfiles();
  const submit=form.querySelector('button[type="submit"]');
  submit.insertAdjacentHTML('beforebegin',audienceMarkup());
  const panel=$('[data-meet194-audience]',form);paintPeople(panel);updateSummary(panel);
  panel.addEventListener('change',e=>{if(e.target.matches('[data-meet194-manual-toggle]'))$('[data-meet194-manual]',panel)?.classList.toggle('show',e.target.checked);updateSummary(panel)});
  $('[data-meet194-search]',panel)?.addEventListener('input',e=>{paintPeople(panel,e.target.value);updateSummary(panel)});

  form.addEventListener('submit',async e=>{
    e.preventDefault();e.stopImmediatePropagation();
    const userIds=resolveAudience(panel),send=$('[data-meet194-send]',panel)?.checked;
    if(send&&!userIds.length){alert('Choose at least one push notification recipient, or turn off the notification option.');return}
    submit.disabled=true;
    try{
      await rpc('owner_create_attendance_meeting_v194',{
        p_title:form.title.value,p_meeting_date:form.date.value,p_starts_at:toIso(form.starts.value),p_ends_at:toIso(form.ends.value),
        p_checkin_opens_at:toIso(form.opens.value),p_checkin_closes_at:toIso(form.closes.value),p_meeting_mode:form.mode.value,p_venue:form.venue.value,p_notes:form.notes.value,
        p_notification_user_ids:userIds
      });
      let pushText='Meeting created successfully.';
      if(send){try{const r=await sendPush(userIds,`New meeting: ${form.title.value.trim()}`,notificationBody(form));pushText+=` Push sent to ${Number(r.users_reached||0)} user${Number(r.users_reached||0)===1?'':'s'}.`}catch(pushErr){pushText+=` The meeting was created, but push delivery reported: ${pushErr.message||pushErr}`}}
      alert(pushText);location.reload();
    }catch(err){alert(err.message||err);submit.disabled=false}
  },true);
}

async function syncCards(list){
  if(!list?.isConnected)return;
  let rows;try{rows=await rpc('owner_list_attendance_meetings_v194')}catch(e){console.warn('Meeting admin status could not load',e);return}
  const map=new Map((rows||[]).map(m=>[String(m.id),m]));
  $$('.meet187-card',list).forEach(card=>{
    const ref=card.querySelector('[data-meet187-report]');if(!ref)return;
    const id=String(ref.dataset.meet187Report||''),m=map.get(id);if(!m)return;
    let tools=$('[data-meet194-tools]',card);
    if(!tools){tools=document.createElement('div');tools.className='meet187-actions';tools.dataset.meet194Tools='1';card.appendChild(tools)}
    tools.innerHTML=`<span class="meet194-notified">🔔 ${Number(m.notification_count||0)} notified</span>${m.cancelled_at?`<span class="meet194-cancelled">Cancelled</span>`:`<button type="button" class="meet187-btn meet194-cancel" data-meet194-cancel="${esc(id)}">Cancel meeting</button>`}<button type="button" class="meet187-btn meet194-delete" data-meet194-delete="${esc(id)}">Delete</button>`;
    if(m.cancelled_at){card.querySelectorAll('[data-meet187-create-code],[data-meet187-show-qr],[data-meet187-new-qr]').forEach(x=>{x.disabled=true;x.style.display='none'})}
  });
}

function watchList(list){
  if(list.dataset.meet194Watched)return;list.dataset.meet194Watched='1';
  if(listObserver)listObserver.disconnect();
  listObserver=new MutationObserver(()=>{clearTimeout(syncTimer);syncTimer=setTimeout(()=>syncCards(list),60)});
  listObserver.observe(list,{childList:true,subtree:true});
  void syncCards(list);
  list.addEventListener('click',async e=>{
    const cancel=e.target.closest?.('[data-meet194-cancel]');
    if(cancel){
      const id=cancel.dataset.meet194Cancel;if(!confirm('Cancel this meeting? A cancellation push notification will be sent to the people originally notified.'))return;
      cancel.disabled=true;
      try{const r=await rpc('owner_cancel_attendance_meeting_v194',{p_meeting_id:id});const ids=Array.isArray(r?.user_ids)?r.user_ids:[];let msg='Meeting cancelled.';if(ids.length){try{const p=await sendPush(ids,`Meeting cancelled: ${r.title}`,`The meeting scheduled for ${dt(r.starts_at)} has been cancelled.`);msg+=` Cancellation sent to ${Number(p.users_reached||0)} user${Number(p.users_reached||0)===1?'':'s'}.`}catch(pe){msg+=` Cancellation was saved, but push delivery reported: ${pe.message||pe}`}}alert(msg);location.reload()}catch(err){alert(err.message||err);cancel.disabled=false}return;
    }
    const del=e.target.closest?.('[data-meet194-delete]');
    if(del){
      const id=del.dataset.meet194Delete;if(!confirm('Permanently delete this meeting? Use this for test meetings. Any attendance/check-in records for it will also be deleted. This cannot be undone.'))return;
      del.disabled=true;try{await rpc('owner_delete_attendance_meeting_v194',{p_meeting_id:id});alert('Meeting deleted.');location.reload()}catch(err){alert(err.message||err);del.disabled=false}
    }
  },true);
}

async function enhance(){
  const form=$('#meet187MeetingForm');if(form&&!form.dataset.meet194Enhanced){try{await installForm(form)}catch(e){console.warn('Meeting notification controls could not load',e)}}
  const list=$('#meet187AdminList');if(list)watchList(list);
}

function arm(){[0,200,500,900,1500,2600,4200,7000].forEach(ms=>setTimeout(enhance,ms))}
document.addEventListener('click',e=>{if(e.target.closest?.('[data-sm191-open-meetings]'))arm()},true);
styles();arm();
