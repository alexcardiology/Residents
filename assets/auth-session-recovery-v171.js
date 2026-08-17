import { sb } from "./supabase.js";

// Recover stale local sessions before the portal starts. A stale access token can
// make the app think the user is signed in while every profile/RPC call returns 401.
try {
  const { data: sessionData } = await sb.auth.getSession();
  const session = sessionData?.session;
  if (session) {
    const { error: userError } = await sb.auth.getUser();
    if (userError) {
      const { data: refreshed, error: refreshError } = await sb.auth.refreshSession();
      if (refreshError || !refreshed?.session) {
        try { await sb.auth.signOut({ scope: "local" }); } catch (_) {}
        localStorage.removeItem("cardiology-dual-role-mode");
        sessionStorage.clear();
        location.replace("index.html?session=expired");
        await new Promise(() => {});
      }
    }
  }
} catch (error) {
  console.warn("Session recovery check failed", error);
}
