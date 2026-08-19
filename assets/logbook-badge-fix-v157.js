import "./logbook-suspension-popup-v229.js?v=229";
import { sb } from "./supabase.js";

let busy = false;
let refreshTimer = null;

function actionablePriorExperience(rows = []) {
  return rows.filter((row) => {
    const status = String(row?.review_status || "").toLowerCase();
    const reconsideration = String(row?.reconsideration_status || "").toLowerCase();
    return status === "pending" || reconsideration === "requested";
  }).length;
}

async function refreshLogbookBadge() {
  if (busy) return;
  busy = true;
  try {
    const { data: { session } } = await sb.auth.getSession();
    const userId = session?.user?.id;
    if (!userId) return;

    const { data: profile, error: profileError } = await sb
      .from("profiles")
      .select("id,role,residency_year")
      .eq("id", userId)
      .maybeSingle();
    if (profileError || !profile) return;

    const juniorResident = profile.role === "resident" && Number(profile.residency_year) <= 2;
    const [logbookResult, reconsiderationResult, priorResult, minimumResult] = await Promise.all([
      sb.rpc("get_logbook_messages", { p_view: juniorResident ? "updates" : "received" }),
      sb.rpc("get_my_logbook_reconsiderations_v1044"),
      sb.rpc("get_prior_experience_review_queue_v1069"),
      profile.role === "assessor"
        ? sb.rpc("get_my_logbook_requirement_review_queue_v1084")
        : Promise.resolve({ data: [], error: null }),
    ]);

    const messageCount = (logbookResult.data || []).filter((message) =>
      juniorResident ? !message.is_read : !message.logbook_action_taken,
    ).length;
    const reconsiderationCount = (reconsiderationResult.data || []).filter((row) =>
      String(row.reviewer_id) === String(profile.id) && String(row.status) === "requested",
    ).length;
    const priorExperienceCount = actionablePriorExperience(priorResult.data || []);
    const minimumRequirementCount = (minimumResult.data || []).length;
    const total = messageCount + reconsiderationCount + priorExperienceCount + minimumRequirementCount;

    document.querySelectorAll("[data-logbook-badge]").forEach((badge) => {
      badge.textContent = String(total);
      badge.hidden = total === 0;
    });
  } catch (error) {
    console.debug("Logbook badge refresh unavailable", error);
  } finally {
    busy = false;
  }
}

function scheduleRefresh(delay = 120) {
  window.clearTimeout(refreshTimer);
  refreshTimer = window.setTimeout(() => void refreshLogbookBadge(), delay);
}

const nav = document.querySelector("#nav");
if (nav) {
  new MutationObserver(() => scheduleRefresh()).observe(nav, { childList: true, subtree: true });
}
window.addEventListener("hashchange", () => scheduleRefresh(250));
window.addEventListener("focus", () => scheduleRefresh(150));
window.setInterval(() => void refreshLogbookBadge(), 20000);
scheduleRefresh(500);
