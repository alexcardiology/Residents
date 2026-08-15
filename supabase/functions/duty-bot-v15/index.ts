import { createClient } from "npm:@supabase/supabase-js@2";

const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization,x-client-info,apikey,content-type"};
const normalize=(value:unknown)=>String(value||"").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f\u064b-\u065f\u0670]/g,"").replace(/[أإآ]/g,"ا").replace(/ى/g,"ي").replace(/ة/g,"ه").replace(/ؤ/g,"و").replace(/ئ/g,"ي").replace(/[^a-z0-9\u0600-\u06ff\s]/g," ").replace(/\s+/g," ").trim();
const json=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:{...cors,"Content-Type":"application/json"}});
const matchName=(value:string,...names:string[])=>names.filter(Boolean).some(name=>{const a=normalize(value),b=normalize(name);return a===b||a.includes(b)||b.includes(a)});

Deno.serve(async(req:Request)=>{
  if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
  if(req.method!=="POST")return json({error:"POST requests only"},405);
  const authorization=req.headers.get("Authorization");
  if(!authorization)return json({error:"Authentication required"},401);
  try{
    const body=await req.json();
    const question=String(body?.question||"").trim();
    const core=await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/duty-bot`,{method:"POST",headers:{Authorization:authorization,apikey:Deno.env.get("SUPABASE_ANON_KEY")||"","Content-Type":"application/json"},body:JSON.stringify({question})});
    const result=await core.json();
    if(!core.ok)return json(result,core.status);
    const client=createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_ANON_KEY")!,{global:{headers:{Authorization:authorization}}});
    const{data:overrides,error}=await client.rpc("get_el_medico_schedule_overrides_v131");
    if(error||!Array.isArray(overrides)||!overrides.length||!Array.isArray(result.assignments))return json({...result,version:"15"});
    let applied=0;const appliedChanges:string[]=[];
    const assignments=result.assignments.map((assignment:any)=>{
      let current={...assignment};
      for(const change of overrides){
        const typeMatches=(change.request_type==="duty"&&current.scheduleType==="on_call")||(change.request_type==="shift"&&current.scheduleType==="daytime");
        if(!typeMatches||String(current.date)!==String(change.scheduled_date))continue;
        if(!matchName(String(current.resident||""),String(change.requester_schedule_name||""),String(change.requester_name||"")))continue;
        const replacement=String(change.substitute_schedule_name||change.substitute_name||"").trim();if(!replacement)continue;
        const from=String(current.resident||change.requester_name||"");
        current={...current,resident:replacement,source:`${current.source||"Approved schedule"} · approved substitution`};
        applied+=1;appliedChanges.push(`${from} → ${replacement}`);
      }
      return current;
    });
    let answer=String(result.answer||"");
    if(applied){
      for(const change of overrides){const replacement=String(change.substitute_schedule_name||change.substitute_name||"").trim();if(!replacement)continue;for(const oldName of [change.requester_schedule_name,change.requester_name].filter(Boolean))answer=answer.split(String(oldName)).join(replacement)}
      const isArabic=/[\u0600-\u06ff]/.test(question),unique=[...new Set(appliedChanges)];
      answer+=isArabic?`\n✓ تم تطبيق التبديل المعتمد: ${unique.join("، ")}`:`\n✓ Approved substitution applied: ${unique.join(", ")}`;
    }
    return json({...result,answer,assignments,substitutionOverrideApplied:applied>0,version:"15"});
  }catch(error){console.error(error);return json({error:error instanceof Error?error.message:"Unable to read schedule"},500)}
});
