const QUICK_QUESTIONS = [
  "مين في عناية الميري النهاردة؟",
  "مين في طوارئ الميري النهاردة؟",
  "مين نباطشي سموحة النهاردة؟",
  "مين في القسطرة النهاردة؟",
  "مين في الإيكو النهاردة؟",
  "مين في العيادات النهاردة؟",
  "مين متوزع على عنبر الرجال؟",
  "مين متوزع على عنبر السيدات؟",
];

function escapeAttr(value) {
  return String(value).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function enhanceQuickQuestions() {
  document.querySelectorAll(".el-medico-quick-card .duty-quick-prompts").forEach((container) => {
    if (container.dataset.quickPromptsVersion === "9") return;
    container.dataset.quickPromptsVersion = "9";
    container.setAttribute("dir", "rtl");
    container.innerHTML = QUICK_QUESTIONS.map((question) => `
      <button type="button" dir="rtl" data-duty-question="${escapeAttr(question)}">
        <span>${escapeAttr(question)}</span>
        <b aria-hidden="true">‹</b>
      </button>
    `).join("");
  });
}

function findComposer() {
  return document.querySelector(
    "#dutyQuestion, #dutyBotQuestion, #dutyBotInput, .duty-chat-compose input, .duty-chat-compose textarea, .duty-chat-composer input, .duty-chat-composer textarea, .el-medico-chat-panel form input[type='text'], .el-medico-chat-panel form textarea, .el-medico-chat-panel input[type='text'], .el-medico-chat-panel textarea"
  );
}

function clearQuickQuestionFromComposer(question) {
  const composer = findComposer();
  if (!composer) return;
  if (String(composer.value || "").trim() !== String(question || "").trim()) return;
  composer.value = "";
  composer.dispatchEvent(new Event("input", { bubbles: true }));
  composer.focus({ preventScroll: true });
}

// The main app handles the actual question submission. After it has read the
// selected quick question, clear only that exact text from the composer so the
// user can type a new question immediately. Never clear newly typed text.
document.addEventListener("click", (event) => {
  const button = event.target.closest(".el-medico-quick-card [data-duty-question]");
  if (!button) return;
  const question = button.dataset.dutyQuestion || "";
  setTimeout(() => clearQuickQuestionFromComposer(question), 0);
  setTimeout(() => clearQuickQuestionFromComposer(question), 120);
  setTimeout(() => clearQuickQuestionFromComposer(question), 350);
}, true);

const observer = new MutationObserver(enhanceQuickQuestions);
observer.observe(document.documentElement, { childList: true, subtree: true });
enhanceQuickQuestions();
