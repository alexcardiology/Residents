(()=>{
const REF='dwkkhqmifmmxubtuaqbd';
const DEFAULT_KEY=`sb-${REF}-auth-token`;
const TEMP_KEY='psh-auth';
try{
  const oldToken=localStorage.getItem(TEMP_KEY);
  const defaultToken=localStorage.getItem(DEFAULT_KEY);
  if(oldToken&&!defaultToken)localStorage.setItem(DEFAULT_KEY,oldToken);
}catch(e){console.warn('PSH session migration skipped',e)}
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
})();