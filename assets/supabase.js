import{createClient}from'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
export const sb=createClient('https://dwkkhqmifmmxubtuaqbd.supabase.co','sb_publishable_5RESwwz-dpHp8Sv5eZ2qqQ_73VQF4lV',{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
// The publishable key is safe in a browser when Row Level Security is enabled. Never add a secret/service_role key here.
