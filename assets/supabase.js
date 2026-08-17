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

export const sb=createClient('https://dwkkhqmifmmxubtuaqbd.supabase.co','eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR3a2tocW1pZm1teHVidHVhcWJkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU5MjM1NDEsImV4cCI6MjEwMTQ5OTU0MX0.6_aryJx9eA_tKwqm6GjMbM4i9LG_z99qL-uDZaHlRJg',{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,storage:authStorage}});

// El Médico is deliberately available before sign-in through duty-bot-public-v2.
// If an authenticated duty-bot call is rejected because the browser has a stale
// or revoked session token, retry against that read-only public schedule engine
// rather than exposing a raw Edge Function non-2xx error to the user.
const originalFunctionsInvoke=sb.functions.invoke.bind(sb.functions);
sb.functions.invoke=async(functionName,options={})=>{
  const primary=await originalFunctionsInvoke(functionName,options);
  if(functionName!=='duty-bot'||!primary?.error)return primary;
  try{
    const fallback=await originalFunctionsInvoke('duty-bot-public-v2',options);
    if(!fallback?.error&&fallback?.data?.answer){
      return{...fallback,data:{...fallback.data,fallback:'public-duty-engine'}};
    }
  }catch(_){}
  return primary;
};

// Checked "Keep me signed in" stores the session in localStorage. Unchecked stores it in sessionStorage so it ends with the browser session.
// The publishable key is safe in a browser when Row Level Security is enabled. Never add a secret/service_role key here.
