import{createClient}from'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

export const AUTH_PERSISTENCE_KEY='cardiology-keep-signed-in';

const authStorage={
  getItem(key){
    const preference=window.localStorage.getItem(AUTH_PERSISTENCE_KEY);
    if(preference==='0') return window.sessionStorage.getItem(key);
    if(preference==='1') return window.localStorage.getItem(key);
    return window.localStorage.getItem(key)??window.sessionStorage.getItem(key);
  },
  setItem(key,value){
    const preference=window.localStorage.getItem(AUTH_PERSISTENCE_KEY);
    if(preference==='0'){
      window.sessionStorage.setItem(key,value);
      window.localStorage.removeItem(key);
      return;
    }
    window.localStorage.setItem(key,value);
    window.sessionStorage.removeItem(key);
  },
  removeItem(key){
    window.localStorage.removeItem(key);
    window.sessionStorage.removeItem(key);
  }
};

// Use the project's current publishable key. This is the browser-safe key Supabase
// recommends for client apps and avoids the invalid-api-key loop seen with the old
// legacy anon JWT in some sessions.
export const sb=createClient(
  'https://dwkkhqmifmmxubtuaqbd.supabase.co',
  'sb_publishable_5RESwwz-dpHp8Sv5eZ2qqQ_73VQF4lV',
  {auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,storage:authStorage}}
);

// El Médico is deliberately available before sign-in through the public schedule engines.
// If an authenticated duty-bot call is rejected because the browser has a stale
// or revoked session token, retry against those read-only engines rather than
// exposing a raw Edge Function non-2xx error to the user.
const originalFunctionsInvoke=sb.functions.invoke.bind(sb.functions);
sb.functions.invoke=async(functionName,options={})=>{
  const primary=await originalFunctionsInvoke(functionName,options);
  if(functionName!=='duty-bot'||!primary?.error)return primary;
  for(const fallbackName of ['duty-bot-public-v2','duty-bot-public']){
    try{
      const fallback=await originalFunctionsInvoke(fallbackName,options);
      if(!fallback?.error&&fallback?.data?.answer){
        return{...fallback,data:{...fallback.data,fallback:fallbackName}};
      }
    }catch(_){}
  }
  return primary;
};

// Checked "Keep me signed in" stores the session in localStorage. Unchecked stores it in sessionStorage so it ends with the browser session.
