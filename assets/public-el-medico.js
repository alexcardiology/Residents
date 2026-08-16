import { sb } from "./supabase.js?v=1.0.92";

const form = document.querySelector("#publicElMedicoForm");
const input = document.querySelector("#publicElMedicoQuestion");
const transcript = document.querySelector("#publicElMedicoTranscript");
const errorBox = document.querySelector("[data-el-medico-error]");

function addMessage(kind, text, extraClass = "") {
  if (!transcript) return null;
  const message = document.createElement("div");
  message.className = `public-el-medico-message ${kind} ${extraClass}`.trim();
  message.textContent = text;
  transcript.appendChild(message);
  transcript.scrollTop = transcript.scrollHeight;
  return message;
}

async function askElMedico(question) {
  const cleanQuestion = String(question || "").trim();
  if (cleanQuestion.length < 2) return;

  if (errorBox) errorBox.textContent = "";
  addMessage("user", cleanQuestion);
  const loading = addMessage("bot", "Checking the approved schedule…", "loading");
  const submit = form?.querySelector('button[type="submit"]');
  if (submit) submit.disabled = true;
  if (input) input.disabled = true;

  try {
    const { data, error } = await sb.functions.invoke("duty-bot-public-v2", {
      body: { question: cleanQuestion },
    });
    if (error) throw error;
    if (data?.error) throw new Error(data.error);

    loading?.remove();
    addMessage("bot", data?.answer || "No matching approved assignment was found.");
  } catch (error) {
    loading?.remove();
    const message = error?.message || "El Médico is temporarily unavailable. Please try again.";
    addMessage("bot", message);
    if (errorBox) errorBox.textContent = "Could not load the schedule right now.";
  } finally {
    if (submit) submit.disabled = false;
    if (input) {
      input.disabled = false;
      input.value = "";
      input.focus();
    }
  }
}

form?.addEventListener("submit", (event) => {
  event.preventDefault();
  askElMedico(input?.value);
});

document.querySelectorAll("[data-el-medico-prompt]").forEach((button) => {
  button.addEventListener("click", () => {
    const prompt = button.getAttribute("data-el-medico-prompt") || "";
    if (input) input.value = prompt;
    askElMedico(prompt);
  });
});
