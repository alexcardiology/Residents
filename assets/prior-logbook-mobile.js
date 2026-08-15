/* v1.0.122 — scope compact styling only to the Whole Prior Logbook dialog. */
(() => {
  const dialog = document.querySelector("#modal");
  const body = document.querySelector("#modalBody");
  if (!dialog || !body) return;

  const classify = () => {
    const heading = body.querySelector("h1,h2,.modal-head h2")?.textContent || "";
    const sample = `${heading} ${body.textContent || ""}`.slice(0, 500);
    const isPriorLogbook = /whole\s+prior\s+logbook/i.test(sample);
    dialog.classList.toggle("prior-logbook-compact", isPriorLogbook);
  };

  new MutationObserver(classify).observe(body, {
    childList: true,
    subtree: true,
    characterData: true,
  });

  dialog.addEventListener("close", () => dialog.classList.remove("prior-logbook-compact"));
  classify();
})();
