(()=>{
document.addEventListener('keydown',e=>{
 if(e.key!=='Escape')return;
 const resident=document.getElementById('cathResidentNameModal');
 if(resident){resident.remove();return}
 const extra=document.getElementById('cathExtraCaseModal');
 if(extra){extra.remove();return}
 const host=document.getElementById('modalHost');
 if(host&&host.innerHTML.trim()){if(typeof closeModal==='function')closeModal();else host.innerHTML='';return}
});
})();