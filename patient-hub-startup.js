(()=>{
async function finishBoot(){
  try{
    const {data:{session}}=await sb.auth.getSession();
    if(!session){
      document.getElementById('loginView')?.classList.remove('hidden');
      document.getElementById('appView')?.classList.add('hidden');
      document.body.classList.remove('pshBooting');
      return;
    }
    // patient-hub-state.js restores the saved page and only then makes appView visible.
    let n=0;
    const timer=setInterval(()=>{
      n++;
      const app=document.getElementById('appView');
      const ready=typeof profile!=='undefined' && profile && app && !app.classList.contains('hidden') && app.style.visibility==='visible';
      if(ready){
        clearInterval(timer);
        requestAnimationFrame(()=>requestAnimationFrame(()=>document.body.classList.remove('pshBooting')));
      }else if(n>160){
        clearInterval(timer);
        document.body.classList.remove('pshBooting');
      }
    },50);
  }catch(e){
    document.body.classList.remove('pshBooting');
  }
}
finishBoot();
})();