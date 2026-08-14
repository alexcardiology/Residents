import{createClient}from'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
export const sb=createClient('https://dwkkhqmifmmxubtuaqbd.supabase.co','eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR3a2tocW1pZm1teHVidHVhcWJkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU5MjM1NDEsImV4cCI6MjEwMTQ5OTU0MX0.6_aryJx9eA_tKwqm6GjMbM4i9LG_z99qL-uDZaHlRJg',{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,storage:window.localStorage}});
// Session is stored in localStorage and refreshed automatically, so users stay signed in across refreshes/browser restarts until sign-out (unless access is revoked server-side).
// The publishable key is safe in a browser when Row Level Security is enabled. Never add a secret/service_role key here.
