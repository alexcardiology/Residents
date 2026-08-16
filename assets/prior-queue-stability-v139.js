/* v1.0.139 · stop competing Prior Experience subtitle renderers from oscillating */
const COPY = "Two senior verifiers act first. Then each submitted manual needs 2 first-level faculty approvals; only completed fields move to the professor audit level.";
let timer = 0;

function stabilizePriorQueue() {
  const title = String(document.querySelector("#title")?.textContent || "").trim().toLowerCase();
  if (title !== "logbook requests") return;

  const section = document.querySelector(".prior-review-queue");
  if (!section) return;

  const oldCopy = section.querySelector(".section-head p");
  if (oldCopy) {
    const replacement = document.createElement("div");
    replacement.className = "prior-review-static-copy-v139";
    replacement.textContent = COPY;
    oldCopy.replaceWith(replacement);
  }

  const existing = section.querySelector(".prior-review-static-copy-v139");
  if (existing && existing.textContent !== COPY) existing.textContent = COPY;

  requestAnimationFrame(() => requestAnimationFrame(() => {
    if (section.isConnected) section.classList.add("prior-review-queue-stable-v139");
  }));
}

function schedule() {
  clearTimeout(timer);
  timer = setTimeout(stabilizePriorQueue, 30);
}

const content = document.querySelector("#content");
if (content) new MutationObserver(schedule).observe(content, { childList: true, subtree: true });
window.addEventListener("hashchange", schedule);
setTimeout(stabilizePriorQueue, 0);
setTimeout(stabilizePriorQueue, 120);
