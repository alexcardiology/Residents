import { sb } from "./supabase.js";

const submissionCache = new Map();
let selectedReviewKey = "";
let enhancing = false;

const esc = (value) => String(value ?? "").replace(/[&<>'"]/g, (char) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;",
})[char]);

const unwrap = (result) => {
  if (result?.error) throw result.error;
  return result?.data;
};

async function loadSubmission(logbookId) {
  const key = String(logbookId || "");
  if (!key) return null;
  if (!submissionCache.has(key)) {
    submissionCache.set(key, (async () => {
      try {
        return unwrap(await sb.rpc("get_prior_experience_submission_v1069", { p_logbook_id: Number(logbookId) }));
      } catch (error) {
        console.warn("Could not load Prior Experience senior verification summary", error);
        return null;
      }
    })());
  }
  return submissionCache.get(key);
}

function seniorReviews(data) {
  return Array.isArray(data?.senior_reviews) ? data.senior_reviews : [];
}

function approvedSeniorNames(data) {
  return seniorReviews(data)
    .filter((row) => String(row.status) === "approved")
    .map((row) => String(row.senior_name || "Senior resident").trim())
    .filter(Boolean);
}

function seniorStatusHtml(data) {
  const reviews = seniorReviews(data);
  if (!reviews.length) return '<span class="prior-request-senior-empty">Senior verifiers not available</span>';
  return `<div class="prior-request-senior-chips">${reviews.map((review) => {
    const status = String(review.status || "pending");
    const cls = status === "approved" ? "approved" : status === "rejected" ? "rejected" : "pending";
    const icon = status === "approved" ? "✓" : status === "rejected" ? "×" : "…";
    return `<span class="prior-request-senior-chip ${cls}"><b>${icon}</b>${esc(review.senior_name || "Senior resident")}</span>`;
  }).join("")}</div>`;
}

function stageLabel(row) {
  if (row?.review_kind === "senior") return {
    kicker: "Stage 1",
    title: "Senior verification",
    detail: "Whole Prior Experience logbook",
  };
  if (row?.assessor_level === "professor") return {
    kicker: "Stage 3",
    title: "Professor field audit",
    detail: row.scope_name || "Field audit",
  };
  return {
    kicker: "Stage 2",
    title: "First-level manual audit",
    detail: row?.scope_name || "Manual audit",
  };
}

async function enhanceQueueRow(tr, row) {
  if (!tr || !row || tr.dataset.priorRoutingEnhanced === "1") return;
  tr.dataset.priorRoutingEnhanced = "1";
  const cells = tr.cells;
  if (!cells || cells.length < 3) return;

  const stage = stageLabel(row);
  cells[1].innerHTML = `<div class="prior-request-stage"><span>${esc(stage.kicker)}</span><b>${esc(stage.title)}</b><small>${esc(stage.detail)}</small></div>`;

  const data = await loadSubmission(row.logbook_id);
  if (!data) return;

  const seniorBlock = document.createElement("div");
  seniorBlock.className = "prior-request-senior-summary";
  if (row.review_kind === "senior") {
    seniorBlock.innerHTML = `<span>Two senior verifiers</span>${seniorStatusHtml(data)}`;
  } else {
    const approved = approvedSeniorNames(data);
    seniorBlock.innerHTML = `<span>Senior-verified by</span>${approved.length
      ? `<div class="prior-request-senior-chips">${approved.map((name) => `<span class="prior-request-senior-chip approved"><b>✓</b>${esc(name)}</span>`).join("")}</div>`
      : seniorStatusHtml(data)}`;
  }
  cells[1].appendChild(seniorBlock);
}

async function enhanceLogbookRequests() {
  if (enhancing) return;
  const title = String(document.querySelector("#title")?.textContent || "").trim().toLowerCase();
  if (title !== "logbook requests") return;
  const section = document.querySelector(".prior-review-queue");
  if (!section) return;

  enhancing = true;
  try {
    const heading = section.querySelector(".section-head h3");
    const copy = section.querySelector(".section-head p");
    if (heading) heading.textContent = "Prior Experience audit requests";
    if (copy) copy.textContent = "All Prior Experience approvals are handled here: 2 senior verifiers → first-level faculty audit → professor field audit. These requests do not belong in Inbox.";
    section.classList.add("prior-review-logbook-only");

    const buttons = [...section.querySelectorAll("[data-prior-review-open]")];
    await Promise.all(buttons.map(async (button) => {
      const key = String(button.dataset.priorReviewOpen || "");
      const row = window.priorExperienceReviewRows?.get(key);
      if (!row) return;
      await enhanceQueueRow(button.closest("tr"), row);
    }));
  } finally {
    enhancing = false;
  }
}

async function enhanceReviewerModal() {
  const modal = document.querySelector("#modalBody .prior-review-modal");
  if (!modal || modal.dataset.priorSeniorSummary === "1") return;
  const row = window.priorExperienceReviewRows?.get(String(selectedReviewKey || ""));
  if (!row) return;

  modal.dataset.priorSeniorSummary = "1";
  const data = await loadSubmission(row.logbook_id);
  if (!data) return;

  const block = document.createElement("section");
  block.className = "prior-review-senior-verification-strip";
  const approved = approvedSeniorNames(data);
  if (row.review_kind === "senior") {
    block.innerHTML = `<div><span>Stage 1 · Senior verification</span><b>Two senior residents must verify this record</b></div>${seniorStatusHtml(data)}`;
  } else {
    block.innerHTML = `<div><span>Senior verification completed</span><b>Verified before this ${row.assessor_level === "professor" ? "professor audit" : "faculty audit"}</b></div>${approved.length
      ? `<div class="prior-request-senior-chips">${approved.map((name) => `<span class="prior-request-senior-chip approved"><b>✓</b>${esc(name)}</span>`).join("")}</div>`
      : seniorStatusHtml(data)}`;
  }
  modal.querySelector(".modal-head")?.after(block);
}

function removeAnyStalePriorRequestsFromInbox() {
  const title = String(document.querySelector("#title")?.textContent || "").trim().toLowerCase();
  if (title !== "inbox") return;
  const requestSubjects = [
    "prior experience senior verification",
    "prior experience · first-level manual audit",
    "prior experience · professor field audit",
  ];
  document.querySelectorAll(".mail-thread,.message-row,.mail-row,.inbox-row,article,tr").forEach((node) => {
    const text = String(node.textContent || "").toLowerCase();
    if (requestSubjects.some((subject) => text.includes(subject))) node.remove();
  });
}

function enhance() {
  void enhanceLogbookRequests();
  void enhanceReviewerModal();
  removeAnyStalePriorRequestsFromInbox();
}

document.addEventListener("click", (event) => {
  const button = event.target.closest("[data-prior-review-open]");
  if (!button) return;
  selectedReviewKey = String(button.dataset.priorReviewOpen || "");
  setTimeout(() => void enhanceReviewerModal(), 80);
}, true);

new MutationObserver(enhance).observe(document.documentElement, { childList: true, subtree: true });
window.addEventListener("hashchange", () => setTimeout(enhance, 50));
setInterval(enhance, 900);
enhance();
