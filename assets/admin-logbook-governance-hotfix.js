// v1.0.119a — ensure the unified Audit hierarchy card uses the existing hierarchy launcher.
document.addEventListener("click", (event) => {
  const card = event.target.closest(".admin-logbook-tool.hierarchy");
  if (card) card.classList.add("audit-hierarchy-tile");
}, true);

const observer = new MutationObserver(() => {
  document.querySelectorAll(".admin-logbook-tool.hierarchy").forEach((card) => card.classList.add("audit-hierarchy-tile"));
});
observer.observe(document.documentElement, { childList: true, subtree: true });
