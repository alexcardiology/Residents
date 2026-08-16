/* Global keyboard navigation for the training portal.
   Escape closes the top-most popup/drawer.
   Backspace behaves like Back, except while the user is typing/editing. */

function isEditableTarget(target) {
  if (!(target instanceof Element)) return false;
  return Boolean(target.closest('input, textarea, select, [contenteditable=""], [contenteditable="true"], [contenteditable="plaintext-only"]'));
}

function isVisible(element) {
  if (!(element instanceof HTMLElement)) return false;
  if (element.hidden) return false;
  const style = getComputedStyle(element);
  if (style.display === "none" || style.visibility === "hidden") return false;
  const rect = element.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

function closeTopUiLayer() {
  const dialogs = [...document.querySelectorAll("dialog[open]")].filter(isVisible);
  if (dialogs.length) {
    const top = dialogs[dialogs.length - 1];
    try { top.close(); } catch (_) { top.removeAttribute("open"); }
    return true;
  }

  const popovers = [...document.querySelectorAll("[popover]")].filter((node) => {
    try { return node.matches(":popover-open"); } catch (_) { return false; }
  });
  if (popovers.length) {
    const top = popovers[popovers.length - 1];
    try { top.hidePopover(); } catch (_) {}
    return true;
  }

  const drawer = document.querySelector(".shell > aside.open");
  const backdrop = document.querySelector("#backdrop.show");
  if (drawer || backdrop) {
    drawer?.classList.remove("open");
    backdrop?.classList.remove("show");
    return true;
  }

  const modalLike = [...document.querySelectorAll('[role="dialog"][aria-modal="true"]')].filter(isVisible);
  if (modalLike.length) {
    const top = modalLike[modalLike.length - 1];
    const close = top.querySelector('[data-close], [data-dismiss], .modal-close, .dialog-close, .popup-close, .account-switch-close, [aria-label="Close"]');
    if (close instanceof HTMLElement) close.click();
    else top.setAttribute("hidden", "");
    return true;
  }

  return false;
}

function visibleBackControl() {
  const explicit = document.querySelector("[data-admin-global-back]");
  if (explicit && isVisible(explicit)) return explicit;

  const controls = [...document.querySelectorAll("button, a[href], [role='button']")].filter(isVisible);
  return controls.find((control) => {
    const text = String(control.textContent || "").replace(/\s+/g, " ").trim();
    return /^(?:←|‹|↩|⬅)?\s*back(?:\s+to\b.*)?$/i.test(text);
  }) || null;
}

function goBack() {
  const control = visibleBackControl();
  if (control instanceof HTMLElement) {
    control.click();
    return;
  }

  // Use the browser/app history when the current screen has no explicit Back control.
  // Hash-routing used by the portal makes this behave like the browser Back button.
  history.back();
}

document.addEventListener("keydown", (event) => {
  if (event.defaultPrevented) return;

  if (event.key === "Escape") {
    if (closeTopUiLayer()) {
      event.preventDefault();
      event.stopPropagation();
    }
    return;
  }

  if (event.key !== "Backspace") return;
  if (event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return;
  if (isEditableTarget(event.target)) return;
  if (event.repeat) return;

  event.preventDefault();
  event.stopPropagation();

  // Back closes an open UI layer first; otherwise it navigates to the previous page.
  if (!closeTopUiLayer()) goBack();
}, true);
