import { sb } from "./supabase.js";

const ROOT_CLASS = "admin-red-theme";
const ADMIN_THEME_COLOR = "#430812";
const DEFAULT_THEME_COLOR = "#081c35";
const themeMeta = document.querySelector('meta[name="theme-color"]');

function applyRoleTheme(role) {
  const isAdmin = String(role || "").toLowerCase() === "owner";
  document.documentElement.classList.toggle(ROOT_CLASS, isAdmin);
  document.body?.classList.toggle(ROOT_CLASS, isAdmin);
  if (themeMeta) themeMeta.setAttribute("content", isAdmin ? ADMIN_THEME_COLOR : DEFAULT_THEME_COLOR);
}

async function resolveAndApplyTheme() {
  try {
    const { data: sessionData } = await sb.auth.getSession();
    const userId = sessionData?.session?.user?.id;
    if (!userId) {
      applyRoleTheme("");
      return;
    }

    const { data: profile, error } = await sb
      .from("profiles")
      .select("role")
      .eq("id", userId)
      .maybeSingle();

    if (error) throw error;
    applyRoleTheme(profile?.role);
  } catch (error) {
    console.warn("Admin theme could not resolve the signed-in role", error);
    applyRoleTheme("");
  }
}

await resolveAndApplyTheme();

sb.auth.onAuthStateChange((event) => {
  if (event === "SIGNED_OUT") {
    applyRoleTheme("");
    return;
  }
  if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED" || event === "USER_UPDATED") {
    void resolveAndApplyTheme();
  }
});

if (!document.querySelector('link[data-audit-hierarchy-style]')) {
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = "assets/audit-hierarchy.css?v=1.0.116";
  link.dataset.auditHierarchyStyle = "1";
  document.head.appendChild(link);
}

void import("./audit-hierarchy.js?v=1.0.116").catch((error) => {
  console.warn("Audit hierarchy tools could not load", error);
});

void import("./logbook-48h-limit-v158.js?v=1.0.159").catch((error) => {
  console.warn("48-hour logbook date rule could not load", error);
});
