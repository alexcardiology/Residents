(()=>{
const TOKEN_KEY='psh_cath_portal_token_v1';
const q=id=>document.getElementById(id);
function token(){try{return localStorage.getItem(TOKEN_KEY)||''}catch{return''}}
function currentCode(){const h=q('cathResidentPortal');if(!h||h.style.display==='none')return'';const title=[...h.querySelectorAll('h1')].find(x=>/قسطرة (الميري|سموحة)/.test(x.textContent||''));if(!title)return'';return (title.textContent||'').includes('الميري')?'cath_miri':'cath_smouha'}
function esc(v=''){return String(v??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}
async function annotate(){const code=currentCode(),t=token();if(!code||!t)return;const {data,error}=await sb.rpc('psh_cath_portal_first_claims_today',{p_token:t,p_service_code:code});if(error)return;for(const r of (data||[])){const input=q('rid_'+r.item_id);const tr=input?.closest('tr');if(!tr)continue;const cells=tr.querySelectorAll('td');if(cells.length<8)continue;const nameCell=cells[6];let note=nameCell.querySelector('.first-claim-note');if(!note){note=document.createElement('div');note.className='first-claim-note';note.style.cssText='font-size:11px;color:#8a624f;margin-top:5px;font-weight:600';nameCell.appendChild(note)}note.innerHTML=`أول من استلم الحالة: <strong>${esc(r.first_claimed_by)}</strong>`;}}
new MutationObserver(()=>setTimeout(annotate,100)).observe(document.documentElement,{subtree:true,childList:true});
setInterval(annotate,3000);
})();