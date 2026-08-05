import{sb}from'./supabase.js';
const S={p:null,session:null,reasons:[]},$=s=>document.querySelector(s),C=$('#content'),M=$('#modal'),MB=$('#modalBody');
const esc=v=>String(v??'').replace(/[&<>"']/g,x=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x])),date=v=>v?new Intl.DateTimeFormat('en-GB',{dateStyle:'medium'}).format(new Date(v)):'—';
const nav={resident:[['dashboard','Dashboard'],['chapters','My chapters'],['assessments','My assessments'],['profile','My profile']],observer:[['dashboard','Write a review'],['reviews','My previous reviews'],['profile','My profile']],assessor:[['dashboard','Dashboard'],['residents','Assigned residents'],['assessments','Assessments'],['comments','Observer comments'],['profile','My profile']],owner:[['dashboard','Overview'],['users','Accounts'],['progress','Resident progress'],['assessments','Assessments'],['comments','Observer reviews'],['assignments','Assessor assignments'],['profile','My profile']]};
const role=r=>({resident:'Resident',observer:'Observer',assessor:'Assessor',owner:'Program Owner'}[r]),lead=(a,b,act='')=>`<div class="lead"><div><h2>${esc(a)}</h2><p>${esc(b)}</p></div>${act}</div>`,empty=t=>`<div class="card"><p style="color:var(--muted);text-align:center">${esc(t)}</p></div>`,metric=(a,b,c)=>`<article class="card metric"><span>${esc(a)}</span><b>${esc(b)}</b><small>${esc(c)}</small></article>`,toast=t=>{const e=$('#toast');e.textContent=t;e.style.display='block';setTimeout(()=>e.style.display='none',3500)},go=r=>location.hash=r,modal=x=>{MB.innerHTML=x;M.showModal()};
function setup(){const p=S.p;$('#userCard').innerHTML=`<strong>${esc(p.display_name||p.username)}</strong><br><small>${role(p.role)}</small>`;$('#profileChip').textContent=p.display_name||p.username;$('#nav').innerHTML=nav[p.role].map(([r,n])=>`<button data-go="${r}">${esc(n)}</button>`).join('');$('#loading').hidden=true;$('#shell').hidden=false}
async function routePage(){const [r='dashboard',id='']=location.hash.slice(1).split(':');document.querySelectorAll('[data-go]').forEach(x=>x.classList.toggle('active',x.dataset.go===r));C.innerHTML=empty('Loading…');try{await(routes[r]||dashboard)(id)}catch(e){console.error(e);C.innerHTML=empty(e.message||'Unable to load') }}
const routes={dashboard,chapters,chapter,assessments,profile,reviews,residents,candidate,comments,users,progress,assignments,password:passwordPage};
async function dashboard(){
  const p=S.p;
  $('#title').textContent='Dashboard';
  $('#crumb').textContent=role(p.role);

  if(p.role==='resident'){
    const[{data:ch},{count:logs},{count:k},{data:a}]=await Promise.all([
      sb.from('chapters').select('*').lte('year_from',p.residency_year).eq('is_active',true),
      sb.from('skill_logs').select('*',{head:true,count:'exact'}).eq('resident_id',p.id),
      sb.from('knowledge_progress').select('*',{head:true,count:'exact'}).eq('resident_id',p.id).eq('status','completed'),
      sb.from('assessments').select('*').eq('resident_id',p.id).order('assessment_date',{ascending:false}).limit(1)
    ]);

    const last=a?.[0];

    C.innerHTML=
      lead(
        `Welcome, ${p.display_name||p.username}`,
        'Track the evidence behind your clinical development.'
      )+
      `<div class="grid g4">
        ${metric('Available chapters',ch?.length||0,'Cumulative access')}
        ${metric('Skills recorded',logs||0,'Supervised performances')}
        ${metric('Knowledge complete',k||0,'Self-recorded topics')}
        ${metric(
          'Latest result',
          last?`${last.total_score}/30`:'—',
          last
            ?(last.overall_pass?'Passed':'Reassessment required')
            :'Not assessed'
        )}
      </div>`+
      (
        p.progression_status==='reassessment_required'
          ?`<div class="card warning" style="margin-top:18px">
              <b>Reassessment due ${date(p.reassessment_due)}</b>
              <p>You remain at your current year until you pass.</p>
            </div>`
          :p.progression_status==='eligible_for_upgrade'
            ?`<div class="card success" style="margin-top:18px">
                <b>Congratulations—you passed.</b>
                <p>The owner can now confirm your upgrade.</p>
              </div>`
            :''
      );

    return;
  }

  if(p.role==='observer'){
    C.innerHTML=
      lead(
        'Record a clinical observation',
        'Find a resident, then write a signed knowledge, skill or attitude comment.'
      )+
      `<section class="card">
        <div class="form-grid">
          <label>
            Search resident
            <input id="findResident" placeholder="Name or username">
          </label>

          <label>
            Residency year
            <select id="findYear">
              <option value="">All years</option>
              ${[1,2,3,4,5].map(y=>`<option>${y}</option>`).join('')}
            </select>
          </label>
        </div>

        <div id="results" style="margin-top:18px">
          ${empty('Start typing to find a resident.')}
        </div>
      </section>`;

    return;
  }

  if(p.role==='assessor'){
    const{data}=await assignmentsMine();

    C.innerHTML=
      lead(
        'Assessment workspace',
        'Review evidence and previous results before scoring.'
      )+
      assignmentTable(data||[]);

    return;
  }

  const[
    {data:ps},
    {count:a},
    {count:r}
  ]=await Promise.all([
    sb.from('profiles').select('role,progression_status'),
    sb.from('assessments').select('*',{head:true,count:'exact'}),
    sb.from('observer_reviews').select('*',{head:true,count:'exact'})
  ]);

  C.innerHTML=
    lead(
      'Training program at a glance',
      'Controlled accounts, resident evidence and formal outcomes.',
      `<button class="btn" data-create>Create account</button>`
    )+
    `<div class="grid g4">
      ${metric(
        'Residents',
        ps?.filter(x=>x.role==='resident').length||0,
        'Active curriculum users'
      )}
      ${metric(
        'All accounts',
        ps?.length||0,
        'Four protected roles'
      )}
      ${metric(
        'Assessments',
        a||0,
        'Permanent history'
      )}
      ${metric(
        'Observer reviews',
        r||0,
        'Signed comments'
      )}
    </div>`;
}async function chapters(){if(S.p.role!=='resident')return go('dashboard');$('#title').textContent='My chapters';const{data}=await sb.from('chapters').select('*').lte('year_from',S.p.residency_year).eq('is_active',true).order('year_from').order('sort_order');C.innerHTML=lead('Your cardiology curriculum','Access is cumulative: current and preceding years remain open.')+`<div class="chapters">${(data||[]).map(x=>`<article class="card chapter" data-chapter="${x.id}"><span class="tag">Year ${x.year_from}${x.year_to>x.year_from?'–'+x.year_to:''}</span><h3>${esc(x.title)}</h3><p>${esc(x.description)}</p></article>`).join('')}</div>`}
async function chapter(id){const[{data:c},{data:k},{data:sk},{data:kp},{data:sl},{data:logs}]=await Promise.all([sb.from('chapters').select('*').eq('id',id).single(),sb.from('knowledge_items').select('*').eq('chapter_id',id).order('sort_order'),sb.from('skills').select('*').eq('chapter_id',id).order('sort_order'),sb.from('knowledge_progress').select('*').eq('resident_id',S.p.id),sb.from('skill_levels').select('*').eq('resident_id',S.p.id),sb.from('skill_logs').select('skill_id').eq('resident_id',S.p.id)]);$('#title').textContent=c.title;const km=new Map(kp?.map(x=>[x.knowledge_item_id,x.status])),lm=new Map(sl?.map(x=>[x.skill_id,x.level]));C.innerHTML=lead(c.title,c.description,`<button class="btn secondary" data-go="chapters">All chapters</button>`)+`<section class="card"><h3>Five levels of independence</h3><div class="scale">${['1 Observer','2 Direct supervision','3 Limited supervision','4 Independent','5 Expert / supervisor'].map(x=>`<div>${x}</div>`).join('')}</div></section><div class="grid g2" style="margin-top:17px"><section class="card"><h3>Knowledge</h3><div class="items">${k?.map(x=>`<label class="item"><input style="width:auto" type="checkbox" data-k="${x.id}" ${km.get(x.id)==='completed'?'checked':''}> <b>${esc(x.title)}</b><p>${esc(x.description)}</p></label>`).join('')}</div></section><section class="card"><h3>Skills and logbook</h3><div class="items">${sk?.map(x=>`<article class="item"><h4>${esc(x.title)} <span class="tag">${logs?.filter(l=>l.skill_id===x.id).length||0} logs</span></h4><p>${esc(x.description)}</p><div style="display:flex;gap:8px;margin-top:10px"><select data-level="${x.id}"><option value="">Level</option>${[1,2,3,4,5].map(n=>`<option ${lm.get(x.id)===n?'selected':''}>${n}</option>`)}</select><button class="btn" data-log="${x.id}" data-name="${esc(x.title)}">Add performance</button></div></article>`).join('')}</div></section></div>`}
async function assessments(){if(S.p.role==='observer')return go('dashboard');$('#title').textContent=S.p.role==='resident'?'My assessments':'Assessments';let q=sb.from('assessments').select('*').order('assessment_date',{ascending:false});if(S.p.role==='resident')q=q.eq('resident_id',S.p.id);if(S.p.role==='assessor')q=q.eq('assessor_id',S.p.id);const{data}=await q;C.innerHTML=lead('Assessment history','Scores, justifications, outcome and reassessment remain permanent.')+`<div class="grid">${data?.map(assessmentCard).join('')||empty('No assessments recorded.')}</div>`}
function assessmentCard(a){return`<article class="card"><div class="lead"><div><h2>Year ${a.assessed_year} ${a.assessment_type}</h2><p>${date(a.assessment_date)} · Assessor: ${esc(a.assessor_signature)}</p></div><span class="tag ${a.overall_pass?'success':'danger'}">${a.overall_pass?'Passed':'Failed'}</span></div><div class="score"><div><b>${a.knowledge_score}/10</b><small>Knowledge</small></div><div><b>${a.skills_score}/10</b><small>Skills</small></div><div><b>${a.attitude_score}/10</b><small>Attitude</small></div><div><b>${a.total_score}/30</b><small>Total</small></div></div>${['knowledge','skills','attitude'].map(d=>a[d+'_justification']?`<p><b>${d}:</b> ${esc(a[d+'_justification'])}</p>`:'').join('')}${!a.overall_pass?`<p class="warning">Reassessment due ${date(a.reassessment_due)}</p>`:''}</article>`}
async function reviews(){if(S.p.role!=='observer')return go('dashboard');$('#title').textContent='My reviews';const{data}=await sb.rpc('get_my_observer_reviews');C.innerHTML=lead('Comments written by you','No observer can see another observer’s private history.')+reviewTable(data||[],true)}
function reviewTable(rows,own=false){return`<section class="card"><table class="table"><thead><tr><th>Resident</th><th>Category</th><th>Comment</th><th>Date / place</th>${own?'':'<th>Observer</th>'}</tr></thead><tbody>${rows.map(x=>`<tr><td>${esc(x.resident_name||x.resident?.display_name||'Resident')}</td><td><span class="tag">${esc(x.category)}</span></td><td>${esc(x.comment)}</td><td>${date(x.observed_on)}<br>${esc(x.place)}</td>${own?'':`<td>${esc(x.observer_signature)}</td>`}</tr>`).join('')}</tbody></table></section>`}
async function assignmentsMine(){return sb.from('assessor_assignments').select('*,resident:profiles!resident_id(id,display_name,username,residency_year,progression_status),chapter:chapters(id,title)').eq('assessor_id',S.p.id).eq('is_active',true)}
function assignmentTable(rows){return`<section class="card"><table class="table"><thead><tr><th>Resident</th><th>Scope</th><th></th></tr></thead><tbody>${rows.map(x=>`<tr><td>${esc(x.resident?.display_name||x.resident?.username)}</td><td>${esc(x.chapter?.title||'Overall')}</td><td><button class="btn" data-candidate="${x.resident_id}~${x.chapter_id||''}">Open record</button></td></tr>`).join('')}</tbody></table></section>`}
async function residents(){if(S.p.role!=='assessor')return go('dashboard');const{data}=await assignmentsMine();C.innerHTML=lead('Assigned residents','Access is limited to your owner-assigned scope.')+assignmentTable(data||[])}
async function candidate(id){const[rid,cid]=id.split('~');const[{data:p},{data:rv},{data:logs},{data:kp},{data:a}]=await Promise.all([sb.from('profiles').select('*').eq('id',rid).single(),sb.from('observer_reviews').select('*').eq('resident_id',rid),sb.from('skill_logs').select('*').eq('resident_id',rid),sb.from('knowledge_progress').select('*').eq('resident_id',rid).eq('status','completed'),sb.from('assessments').select('*').eq('resident_id',rid).order('assessment_date',{ascending:false})]);C.innerHTML=lead(p.display_name||p.username,'Review all evidence before formal scoring.',`<button class="btn" data-assess="${rid}" data-cid="${cid}" data-name="${esc(p.display_name||p.username)}">Start assessment now</button>`)+`<div class="grid g3">${metric('Knowledge complete',kp?.length||0,'topics')}${metric('Skill logs',logs?.length||0,'performances')}${metric('Previous assessments',a?.length||0,'records')}</div><div style="margin-top:17px">${reviewTable(rv||[])}</div><div class="grid" style="margin-top:17px">${a?.map(assessmentCard).join('')||empty('No previous assessments.')}</div>`}
async function comments(){if(!['owner','assessor'].includes(S.p.role))return go('dashboard');const{data}=await sb.from('observer_reviews').select('*').order('observed_on',{ascending:false});C.innerHTML=lead('Observer comments','Signed clinical observations in your permitted scope.')+reviewTable(data||[])}
async function users(){if(S.p.role!=='owner')return go('dashboard');const{data}=await sb.from('profiles').select('*').order('created_at',{ascending:false});C.innerHTML=lead('Controlled accounts','Only the owner creates or suspends access.',`<button class="btn" data-create>Create account</button>`)+`<section class="card"><table class="table"><thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Year</th><th>Access</th></tr></thead><tbody>${data.map(p=>`<tr><td>${esc(p.display_name)}<br><small>@${esc(p.username)}</small></td><td>${esc(p.email)}</td><td>${role(p.role)}</td><td>${p.residency_year||'—'}</td><td>${p.role==='owner'?'Owner':`<button class="btn ${p.is_active?'danger':'success'}" data-status="${p.id}" data-active="${!p.is_active}">${p.is_active?'Suspend':'Activate'}</button>`}</td></tr>`).join('')}</tbody></table></section>`}
async function progress(){if(S.p.role!=='owner')return go('dashboard');const{data}=await sb.rpc('owner_resident_progress');C.innerHTML=lead('Resident progress','Evidence, reassessment restrictions and eligible upgrades.')+`<section class="card"><table class="table"><thead><tr><th>Resident</th><th>Year</th><th>Knowledge</th><th>Logs</th><th>Status</th><th></th></tr></thead><tbody>${data.map(x=>`<tr><td>${esc(x.display_name)}</td><td>${x.residency_year}</td><td>${x.knowledge_completed}</td><td>${x.skill_log_count}</td><td><span class="tag ${x.progression_status==='eligible_for_upgrade'?'success':x.progression_status==='reassessment_required'?'warning':''}">${esc(x.progression_status.replaceAll('_',' '))}</span></td><td>${x.progression_status==='eligible_for_upgrade'&&x.residency_year<5?`<button class="btn" data-upgrade="${x.id}" data-name="${esc(x.display_name)}">Confirm upgrade</button>`:''}</td></tr>`).join('')}</tbody></table></section>`}
async function assignments(){if(S.p.role!=='owner')return go('dashboard');const[{data:as},{data:res},{data:ch},{data:list}]=await Promise.all([sb.from('profiles').select('id,display_name').eq('role','assessor'),sb.from('profiles').select('id,display_name,residency_year').eq('role','resident'),sb.from('chapters').select('id,title,year_from').order('year_from'),sb.from('assessor_assignments').select('*')]);C.innerHTML=lead('Assessor assignments','Assign a specific resident and optional chapter.')+`<section class="card"><form id="assignmentForm" class="form-grid"><label>Assessor<select name="assessor_id" required><option></option>${as.map(x=>`<option value="${x.id}">${esc(x.display_name)}</option>`)}</select></label><label>Resident<select name="resident_id" required><option></option>${res.map(x=>`<option value="${x.id}">${esc(x.display_name)} · Year ${x.residency_year}</option>`)}</select></label><label>Chapter (optional)<select name="chapter_id"><option value="">Overall</option>${ch.map(x=>`<option value="${x.id}">Y${x.year_from} · ${esc(x.title)}</option>`)}</select></label><button>Save assignment</button></form><p>${list.length} assignment records</p></section>`}
async function profile(){C.innerHTML=lead('My profile','Display name and WhatsApp can change; username and email remain permanent.')+`<section class="card"><form id="profileForm" class="form-grid"><label>Display name<input name="display_name" value="${esc(S.p.display_name)}" required></label><label>WhatsApp<input name="whatsapp" value="${esc(S.p.whatsapp||'')}"></label><label>Username<input value="${esc(S.p.username)}" disabled></label><label>Email<input value="${esc(S.p.email)}" disabled></label><button>Save profile</button></form></section>`}
function passwordPage(){C.innerHTML=lead('Change password','Use at least eight characters.')+`<section class="card"><form id="passwordForm"><label>New password<input type="password" name="password" minlength="8" required></label><label>Confirm password<input type="password" name="confirm" minlength="8" required></label><button>Update password</button></form></section>`}
function reviewModal(id,name){modal(`<form id="reviewForm" class="modal"><div class="modal-head"><h2>Review ${esc(name)}</h2><button type="button" data-close>×</button></div><div class="form-grid"><label>Category<select name="category"><option>knowledge</option><option>skill</option><option>attitude</option></select></label><label>Date<input type="date" name="observed_on" value="${new Date().toISOString().slice(0,10)}" required></label><label class="full">Place<input name="place" required></label><label class="full">Comment<textarea name="comment" minlength="10" required></textarea></label></div><input type="hidden" name="resident_id" value="${id}"><div class="actions"><button type="button" class="btn secondary" data-close>Cancel</button><button>Submit signed review</button></div></form>`)}
function accountModal(){modal(`<form id="accountForm" class="modal"><div class="modal-head"><h2>Create account</h2><button type="button" data-close>×</button></div><div class="form-grid"><label>Name<input name="display_name" required></label><label>Username<input name="username" pattern="[A-Za-z0-9._-]{3,40}" required></label><label class="full">Email<input type="email" name="email" required></label><label>Role<select name="role"><option>resident</option><option>observer</option><option>assessor</option></select></label><label>Year<select name="residency_year">${[1,2,3,4,5].map(x=>`<option>${x}</option>`)}</select></label><label class="full">Initial password<input type="password" name="password" minlength="8" required></label></div><div class="actions"><button>Create account</button></div></form>`)}
async function assessmentModal(id,name,cid){const{data:r}=await sb.from('assessment_deduction_reasons').select('*').eq('is_active',true);S.reasons=r;modal(`<form id="assessmentForm" class="modal"><div class="modal-head"><h2>Assess ${esc(name)}</h2><button type="button" data-close>×</button></div>${[['knowledge',6],['skills',7],['attitude',8]].map(([d,min])=>`<section class="item"><h3>${d} <small>pass ${min}/10</small></h3><input name="${d}_score" type="number" min="0" max="10" step=".5" value="10" required>${r.filter(x=>x.domain===d).map(x=>`<label><input style="width:auto" type="checkbox" name="${d}_reasons" value="${x.id}"> ${esc(x.label)}</label>`).join('')}<textarea name="${d}_justification" placeholder="Justification when marks are deducted"></textarea></section>`).join('')}<input type="hidden" name="resident_id" value="${id}"><input type="hidden" name="chapter_id" value="${cid}"><div class="actions"><button>Submit final assessment</button></div></form>`)}
async function search(){const q=$('#findResident')?.value.trim(),y=Number($('#findYear')?.value)||null;if(!q&&!y)return;const{data}=await sb.rpc('search_residents',{search_text:q||null,filter_year:y});$('#results').innerHTML=`<table class="table">${data.map(x=>`<tr><td>${esc(x.display_name)} · Year ${x.residency_year}</td><td><button class="btn" data-review="${x.id}" data-name="${esc(x.display_name)}">Write review</button></td></tr>`).join('')}</table>`}
document.addEventListener('click',async e=>{const t=e.target.closest('button,[data-chapter]');if(!t)return;if(t.dataset.go)go(t.dataset.go);if(t.dataset.chapter)go('chapter:'+t.dataset.chapter);if(t.dataset.log)modal(`<form id="logForm" class="modal"><h2>${esc(t.dataset.name)}</h2><label>Date<input type="date" name="performed_on" value="${new Date().toISOString().slice(0,10)}" required></label><label>Supervising senior<input name="supervisor_name" required></label><textarea name="notes" placeholder="Notes"></textarea><input type="hidden" name="skill_id" value="${t.dataset.log}"><button>Save performance</button></form>`);if(t.dataset.review)reviewModal(t.dataset.review,t.dataset.name);if(t.dataset.candidate)go('candidate:'+t.dataset.candidate);if(t.dataset.assess)assessmentModal(t.dataset.assess,t.dataset.name,t.dataset.cid);if(t.hasAttribute('data-create'))accountModal();if(t.hasAttribute('data-close'))M.close();if(t.dataset.status){await sb.functions.invoke('admin-users',{body:{action:'set_status',user_id:t.dataset.status,is_active:t.dataset.active==='true'}});routePage()}if(t.dataset.upgrade){if(confirm(`Upgrade ${t.dataset.name}?`)){await sb.rpc('owner_upgrade_resident',{p_resident_id:t.dataset.upgrade});routePage()}}});
document.addEventListener('change',async e=>{if(e.target.dataset.k){await sb.from('knowledge_progress').upsert({resident_id:S.p.id,knowledge_item_id:+e.target.dataset.k,status:e.target.checked?'completed':'in_progress'},{onConflict:'resident_id,knowledge_item_id'});toast('Knowledge updated')}if(e.target.dataset.level){await sb.from('skill_levels').upsert({resident_id:S.p.id,skill_id:+e.target.dataset.level,level:+e.target.value},{onConflict:'resident_id,skill_id'});toast('Level updated')}if(e.target.id==='findYear')search()});document.addEventListener('input',e=>{if(e.target.id==='findResident'){clearTimeout(window.st);window.st=setTimeout(search,250)}});
document.addEventListener('submit',async e=>{e.preventDefault();const f=e.target,fd=new FormData(f);try{if(f.id==='logForm')await sb.from('skill_logs').insert({resident_id:S.p.id,skill_id:+fd.get('skill_id'),performed_on:fd.get('performed_on'),supervisor_name:fd.get('supervisor_name'),notes:fd.get('notes')});if(f.id==='reviewForm')await sb.from('observer_reviews').insert({observer_id:S.p.id,resident_id:fd.get('resident_id'),category:fd.get('category'),observed_on:fd.get('observed_on'),place:fd.get('place'),comment:fd.get('comment'),observer_signature:S.p.display_name});if(f.id==='accountForm')await sb.functions.invoke('admin-users',{body:{action:'create_user',...Object.fromEntries(fd),residency_year:+fd.get('residency_year')}});if(f.id==='assignmentForm')await sb.from('assessor_assignments').insert({assessor_id:fd.get('assessor_id'),resident_id:fd.get('resident_id'),chapter_id:+fd.get('chapter_id')||null,created_by:S.p.id});if(f.id==='profileForm'){const{data}=await sb.from('profiles').update({display_name:fd.get('display_name'),whatsapp:fd.get('whatsapp')||null}).eq('id',S.p.id).select().single();S.p=data;setup()}if(f.id==='passwordForm'){if(fd.get('password')!==fd.get('confirm'))throw Error('Passwords do not match');await sb.auth.updateUser({password:fd.get('password')})}if(f.id==='assessmentForm'){const d=Object.fromEntries(fd);await sb.rpc('submit_assessment',{p_resident_id:d.resident_id,p_chapter_id:+d.chapter_id||null,p_assessment_type:'initial',p_knowledge_score:+d.knowledge_score,p_skills_score:+d.skills_score,p_attitude_score:+d.attitude_score,p_knowledge_reason_ids:fd.getAll('knowledge_reasons').map(Number),p_skills_reason_ids:fd.getAll('skills_reasons').map(Number),p_attitude_reason_ids:fd.getAll('attitude_reasons').map(Number),p_knowledge_justification:d.knowledge_justification||null,p_skills_justification:d.skills_justification||null,p_attitude_justification:d.attitude_justification||null,p_assessor_notes:null})}M.close();toast('Saved successfully');routePage()}catch(x){alert(x.message)}});
$('#menu').onclick=()=>{$('aside').classList.add('open');$('#backdrop').classList.add('show')};$('#backdrop').onclick=()=>{$('aside').classList.remove('open');$('#backdrop').classList.remove('show')};$('#profileChip').onclick=$('#userCard').onclick=()=>go('profile');$('#password').onclick=()=>go('password');$('#logout').onclick=async()=>{await sb.auth.signOut();location.replace('index.html')};addEventListener('hashchange',routePage);
const{data:{session}}=await sb.auth.getSession();if(!session)location.replace('index.html');else{S.session=session;const{data:p}=await sb.from('profiles').select('*').eq('id',session.user.id).single();if(!p?.is_active){await sb.auth.signOut();location.replace('index.html')}else{S.p=p;setup();routePage()}}
