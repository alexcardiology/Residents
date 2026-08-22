import{createClient}from'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

export const AUTH_PERSISTENCE_KEY='cardiology-keep-signed-in';
export const SUPABASE_URL='https://dwkkhqmifmmxubtuaqbd.supabase.co';
export const SUPABASE_PUBLISHABLE_KEY='sb_publishable_5RESwwz-dpHp8Sv5eZ2qqQ_73VQF4lV';
export const SUPABASE_LEGACY_ANON_KEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR3a2hxbWlmbW14dWJ0dWFxYmQiLCJyb2xlIjoiYW5vbiIsImlhdCI6MTc4NTkyMzU0MSwiZXhwIjoyMTAxNDk5NTQxfQ.6_aryJx9eA_tKwqm6GjMbM4i9LG_z99qL-uDZaHlRJg';
export const SUPABASE_BROWSER_KEY=SUPABASE_LEGACY_ANON_KEY;

const authStorage={
  getItem(key){
    const preference=window.localStorage.getItem(AUTH_PERSISTENCE_KEY);
    if(preference==='0')return window.sessionStorage.getItem(key);
    if(preference==='1')return window.localStorage.getItem(key);
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

// Normal REST/Auth/Realtime/Storage traffic goes directly to Supabase.
// Do NOT install a global Edge proxy here: it turns ordinary database traffic
// into Edge Function invocations.
const options={
  auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,storage:authStorage},
};

export const sb=window.__CARDIOLOGY_SUPABASE_CLIENT_V175__||(window.__CARDIOLOGY_SUPABASE_CLIENT_V175__=createClient(SUPABASE_URL,SUPABASE_BROWSER_KEY,options));

export function createLegacyFallbackClient(){return createClient(SUPABASE_URL,SUPABASE_BROWSER_KEY,options);}

if(!sb.__cardiologyDutyFallbackInstalled){
  sb.__cardiologyDutyFallbackInstalled=true;
  const originalFunctionsInvoke=sb.functions.invoke.bind(sb.functions);
  sb.functions.invoke=async(functionName,invokeOptions={})=>{
    const primary=await originalFunctionsInvoke(functionName,invokeOptions);
    if(functionName!=='duty-bot'||!primary?.error)return primary;
    for(const fallbackName of ['duty-bot-public-v2','duty-bot-public']){
      try{
        const fallback=await originalFunctionsInvoke(fallbackName,invokeOptions);
        if(!fallback?.error&&fallback?.data?.answer)return{...fallback,data:{...fallback.data,fallback:fallbackName}};
      }catch(_){}
    }
    return primary;
  };
}
