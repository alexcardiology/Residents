const QUICK_QUESTIONS = [
  "Who is in Miri CCU today?",
  "Who is in Miri ER today?",
  "Who is on duty in Smouha today?",
  "Who are in Cath Lab today?",
  "Who are in Echo today?",
  "Who are in clinics today?",
  "Who is assigned for male ward?",
  "Who is assigned for female ward?",
];

function escapeAttr(value) {
  return String(value).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function enhanceQuickQuestions() {
  document.querySelectorAll(".el-medico-quick-card .duty-quick-prompts").forEach((container) => {
    if (container.dataset.quickPromptsVersion === "8") return;
    container.dataset.quickPromptsVersion = "8";
    container.innerHTML = QUICK_QUESTIONS.map((question) => `
      <button type="button" data-duty-question="${escapeAttr(question)}">
        <span>${escapeAttr(question)}</span>
        <b aria-hidden="true">›</b>
      </button>
    `).join("");
  });
}

const observer = new MutationObserver(enhanceQuickQuestions);
observer.observe(document.documentElement, { childList: true, subtree: true });
enhanceQuickQuestions();
