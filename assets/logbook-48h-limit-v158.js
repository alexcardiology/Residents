import { sb } from "./supabase.js";

const NOTE_CLASS = "logbook-48h-note";
const INVALID_CLASS = "logbook-48h-invalid";

function cairoDateString(offsetDays = 0) {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Cairo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const anchor = new Date(Date.UTC(Number(map.year), Number(map.month) - 1, Number(map.day), 12, 0, 0));
  anchor.setUTCDate(anchor.getUTCDate() + offsetDays);
  return anchor.toISOString().slice(0, 10);
}

function isNewLogbookForm(form) {
  if (!form) return false;
  return Boolean(
    form.querySelector('[name="activity_category"]') ||
    form.querySelector('[name="procedure_name"]') ||
    form.querySelector('[name="conference_participation"]') ||
    /logbook/i.test(form.id || "") && form.querySelector('input[type="date"]')
  );
}

function validateDate(input, minDate, maxDate) {
  if (!input.value) {
    input.setCustomValidity("");
    input.classList.remove(INVALID_CLASS);
    return;
  }
  if (input.value < minDate) {
    input.setCustomValidity("This activity is older than 48 hours and cannot be recorded in the new activity logbook.");
    input.classList.add(INVALID_CLASS);
    return;
  }
  if (input.value > maxDate) {
    input.setCustomValidity("Activity date cannot be in the future.");
    input.classList.add(INVALID_CLASS);
    return;
  }
  input.setCustomValidity("");
  input.classList.remove(INVALID_CLASS);
}

function enhanceForm(form) {
  if (!isNewLogbookForm(form)) return;
  const input = form.querySelector('input[type="date"][name="activity_date"], input[type="date"][name="activityDate"], input[type="date"]');
  if (!input || input.dataset.logbook48hLimit === "1") return;

  const minDate = cairoDateString(-2);
  const maxDate = cairoDateString(0);
  input.min = minDate;
  input.max = maxDate;
  input.dataset.logbook48hLimit = "1";

  const note = document.createElement("small");
  note.className = NOTE_CLASS;
  note.textContent = "New activity rule: record within 48 hours. Activities older than 48 hours cannot be entered.";
  note.style.cssText = "display:block;margin-top:6px;color:#9f1239;font-size:.72rem;font-weight:750;line-height:1.35";
  input.insertAdjacentElement("afterend", note);

  const check = () => validateDate(input, cairoDateString(-2), cairoDateString(0));
  input.addEventListener("input", check);
  input.addEventListener("change", check);
  form.addEventListener("submit", (event) => {
    check();
    if (!input.checkValidity()) {
      event.preventDefault();
      event.stopImmediatePropagation();
      input.reportValidity();
    }
  }, true);

  check();
}

function scan() {
  document.querySelectorAll("form").forEach(enhanceForm);
}

async function init() {
  try {
    const { data: sessionData } = await sb.auth.getSession();
    const userId = sessionData?.session?.user?.id;
    if (!userId) return;
    const { data: profile, error } = await sb.from("profiles").select("role,is_active").eq("id", userId).maybeSingle();
    if (error) throw error;
    if (profile?.role !== "resident" || profile?.is_active === false) return;

    const style = document.createElement("style");
    style.textContent = `.${INVALID_CLASS}{border-color:#be123c!important;box-shadow:0 0 0 3px rgba(190,18,60,.10)!important}`;
    document.head.appendChild(style);

    scan();
    new MutationObserver(scan).observe(document.body, { childList: true, subtree: true });
  } catch (error) {
    console.warn("48-hour logbook date rule could not initialize", error);
  }
}

void init();
