// v186 — one authoritative drawer-close rule for every navigation item.
function closeDrawerNow(){
  document.body.classList.remove('drawer-open','nav-open','menu-open');
  document.documentElement.classList.remove('drawer-open','nav-open','menu-open');
  document.querySelector('#shell')?.classList.remove('drawer-open','nav-open','menu-open','open');
  document.querySelector('.shell > aside')?.classList.remove('open','active','show');
  document.querySelector('#backdrop')?.classList.remove('show','active','open');
}

document.addEventListener('click',(event)=>{
  const item=event.target.closest?.('#nav button,#nav a');
  if(!item)return;
  closeDrawerNow();
  requestAnimationFrame(closeDrawerNow);
  setTimeout(closeDrawerNow,80);
},true);

window.addEventListener('hashchange',()=>setTimeout(closeDrawerNow,0));
