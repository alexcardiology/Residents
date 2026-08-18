(()=>{
const REF='dwkkhqmifmmxubtuaqbd';
const DEFAULT_KEY=`sb-${REF}-auth-token`;
const TEMP_KEY='psh-auth';
try{
  const oldToken=localStorage.getItem(TEMP_KEY);
  const defaultToken=localStorage.getItem(DEFAULT_KEY);
  if(oldToken&&!defaultToken)localStorage.setItem(DEFAULT_KEY,oldToken);
}catch(e){console.warn('PSH session migration skipped',e)}

// patient-hub.js runs before the booking module creates #rDate.
// Provide a temporary element so the core script cannot crash during boot.
const newHost=document.getElementById('new');
if(newHost&&!document.getElementById('rDate')){
  const tmp=document.createElement('input');
  tmp.id='rDate';
  tmp.type='hidden';
  tmp.setAttribute('data-boot-placeholder','1');
  newHost.appendChild(tmp);
}

if(!window.supabase?.createClient)return;
const originalCreate=window.supabase.createClient.bind(window.supabase);
window.supabase.createClient=function(url,key,options={}){
  const merged={...options,auth:{...(options.auth||{}),persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,storage:window.localStorage,storageKey:DEFAULT_KEY}};
  const client=originalCreate(url,key,merged);
  const realSignOut=client.auth.signOut.bind(client.auth);
  client.auth.signOut=async function(opts){
    if(window.__pshExplicitLogout===true){window.__pshExplicitLogout=false;return realSignOut(opts)}
    console.warn('PSH blocked non-explicit signOut');
    return {error:null};
  };
  return client;
};

document.addEventListener('click',e=>{if(e.target?.closest?.('#logoutBtn'))window.__pshExplicitLogout=true},true);

// Visibility is controlled here only. Never leave the page permanently hidden.
const login=document.getElementById('loginView');
const app=document.getElementById('appView');
function syncVisibility(){
  if(app&&!app.classList.contains('hidden')){
    app.style.visibility='visible';
    if(login)login.style.visibility='hidden';
    return true;
  }
  return false;
}

const observer=new MutationObserver(()=>syncVisibility());
if(app)observer.observe(app,{attributes:true,attributeFilter:['class']});

let elapsed=0;
const bootWatch=setInterval(()=>{
  elapsed+=50;
  if(syncVisibility()){
    clearInterval(bootWatch);
    observer.disconnect();
    return;
  }
  if(elapsed>=1800){
    clearInterval(bootWatch);
    if(login)login.style.visibility='visible';
    if(app)app.style.visibility='hidden';
  }
},50);
})();