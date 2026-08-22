import{createClient}from'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

export const AUTH_PERSISTENCE_KEY='cardiology-keep-signed-in';
export const SUPABASE_URL='https://dwkkhqmifmmxubtuaqbd.supabase.co';
export const SUPABASE_PUBLISHABLE_KEY='sb_publishable_5RESwwz-dpHp8Sv5eZ2qqQ_73VQF4lV';
export const SUPABASE_LEGACY_ANON_KEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR3a2hxbWlmbW14dWJ0dWFxYmQiLCJyb2xlIjoiYW5vbiIsImlhdCI6MTc4NTkyMzU0MSwiZXhwIjoyMTAxNDk5NTQxfQ.6_aryJx9eA_tKwqm6GjMbM4i9LG_z99qL-uDZaHlRJg';
export const SUPABASE_BROWSER_KEY=SUPABASE_LEGACY_ANON_KEY;

const nativeFetch=globalThis.fetch.bind(globalThis);
const supabaseOrigin=new URL(SUPABASE_URL).origin;
const staleGatewayKeys=new Set([SUPABASE_PUBLISHABLE_KEY,SUPABASE_LEGACY_ANON_KEY,SUPABASE_BROWSER_KEY]);
const copiedHeaders=['content-type','accept','prefer','range','content-profile','accept-profile','x-client-info'];

async function portalFetch(input,init={}){
  const request=input instanceof Request?input:null;
  const rawUrl=typeof input==='string'?input:input instanceof URL?input.toString():request?.url;
  if(!rawUrl)return nativeFetch(input,init);
  const url=new URL(rawUrl,location.href);
  if(url.origin!==supabaseOrigin||url.pathname.startsWith('/functions/v1/portal-api-proxy'))return nativeFetch(input,init);

  const sourceHeaders=new Headers(request?.headers||undefined);
  if(init.headers)new Headers(init.headers).forEach((value,key)=>sourceHeaders.set(key,value));
  const proxyHeaders=new Headers();
  for(const name of copiedHeaders){
    const value=sourceHeaders.get(name);
    if(value)proxyHeaders.set(name,value);
  }

  const authorization=String(sourceHeaders.get('authorization')||'').trim();
  const token=authorization.replace(/^Bearer\s+/i,'').trim();
  if(authorization&&token&&!staleGatewayKeys.has(token))proxyHeaders.set('x-portal-user-authorization',authorization);

  const method=String(init.method||request?.method||'GET').toUpperCase();
  let body;
  if(!['GET','HEAD'].includes(method)){
    if(Object.prototype.hasOwnProperty.call(init,'body'))body=init.body;
    else if(request)body=await request.clone().arrayBuffer();
  }

  const target=`${url.pathname}${url.search}`;
  const proxyUrl=`${SUPABASE_URL}/functions/v1/portal-api-proxy?target=${encodeURIComponent(target)}`;
  return nativeFetch(proxyUrl,{
    method,
    headers:proxyHeaders,
    body,
    signal:init.signal||request?.signal,
    cache:'no-store',
    credentials:'omit',
  });
}

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

const options={
  auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,storage:authStorage},
  global:{fetch:portalFetch},
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
