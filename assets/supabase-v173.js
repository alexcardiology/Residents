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

// Browser auth client pinned to the project's active legacy anon key.
// Use one shared client even if a browser resolves this module by more than one URL.
export const sb=window.__CARDIOLOGY_SUPABASE_CLIENT__||(window.__CARDIOLOGY_SUPABASE_CLIENT__=createClient(
  'https://dwkkhqmifmmxubtuaqbd.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR3a2hxbWlmbW14dWJ0dWFxYmQiLCJyb2xlIjoiYW5vbiIsImlhdCI6MTc4NTkyMzU0MSwiZXhwIjoyMTAxNDk5NTQxfQ.6_aryJx9eA_tKwqm6GjMbM4i9LG_z99qL-uDZaHlRJg',
  {auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,storage:authStorage}}
));

if(!sb.__cardiologyDutyFallbackInstalled){
  sb.__cardiologyDutyFallbackInstalled=true;
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
}
