import { sb } from "./supabase.js";

const NOTE_CLASS = "logbook-48h-note";
const INVALID_CLASS = "logbook-48h-invalid";
const DISPLAY_CLASS = "logbook-date-display";

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

function isoToDisplay(value) {
  const match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : "";
}

function displayToIso(value) {
  const match = String(value || "").trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return "";
  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  const probe = new Date(Date.UTC(year, month - 1, day));
  if (probe.getUTCFullYear() !== year || probe.getUTCMonth() !== month - 1 || probe.getUTCDate() !== day) return "";
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function formatTypedDate(value) {
  const digits = String(value || "").replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
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

function validateDate(input, minDate, maxDate, displayInput = null) {
  const target = displayInput || input;
  if (!input.value) {
    target.setCustomValidity(displayInput?.value ? "Enter a valid date as DD/MM/YYYY." : "");
    target.classList.toggle(INVALID_CLASS, Boolean(displayInput?.value));
    return;
  }
  if (input.value < minDate) {
    target.setCustomValidity("This activity is older than 48 hours and cannot be recorded in the new activity logbook.");
    target.classList.add(INVALID_CLASS);
    return;
  }
  if (input.value > maxDate) {
    target.setCustomValidity("Activity date cannot be in the future.");
    target.classList.add(INVALID_CLASS);
    return;
  }
  target.setCustomValidity("");
  target.classList.remove(INVALID_CLASS);
}

function installDdMmYyyyControl(input) {
  if (input.dataset.ddmmyyyyControl === "1") return null;
  input.dataset.ddmmyyyyControl = "1";

  const wrapper = document.createElement("span");
  wrapper.className = "logbook-date-ddmmyyyy-wrap";

  const display = document.createElement("input");
  display.type = "text";
  display.className = DISPLAY_CLASS;
  display.inputMode = "numeric";
  display.autocomplete = "off";
  display.placeholder = "DD/MM/YYYY";
  display.setAttribute("aria-label", "Activity date in DD/MM/YYYY format");
  if (input.required) display.required = true;
  display.value = isoToDisplay(input.value);

  const pickerButton = document.createElement("button");
  pickerButton.type = "button";
  pickerButton.className = "logbook-date-picker-button";
  pickerButton.setAttribute("aria-label", "Choose activity date");
  pickerButton.setAttribute("title", "Choose date");
  pickerButton.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M7 3v4M17 3v4M3 9h18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';

  input.classList.add("logbook-native-date-picker");
  input.insertAdjacentElement("beforebegin", wrapper);
  wrapper.append(display, pickerButton, input);

  const syncFromDisplay = () => {
    const iso = displayToIso(display.value);
    input.value = iso;
    validateDate(input, cairoDateString(-2), cairoDateString(0), display);
  };

  display.addEventListener("input", () => {
    const caretAtEnd = display.selectionStart === display.value.length;
    display.value = formatTypedDate(display.value);
    if (caretAtEnd) display.setSelectionRange(display.value.length, display.value.length);
    syncFromDisplay();
  });
  display.addEventListener("change", syncFromDisplay);
  display.addEventListener("blur", syncFromDisplay);

  input.addEventListener("change", () => {
    display.value = isoToDisplay(input.value);
    validateDate(input, cairoDateString(-2), cairoDateString(0), display);
  });

  pickerButton.addEventListener("click", () => {
    try {
      if (typeof input.showPicker === "function") input.showPicker();
      else input.click();
    } catch (_) {
      input.click();
    }
  });

  return display;
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

  const displayInput = installDdMmYyyyControl(input);

  const note = document.createElement("small");
  note.className = NOTE_CLASS;
  note.textContent = "New activity rule: record within 48 hours. Activities older than 48 hours cannot be entered.";
  note.style.cssText = "display:block;margin-top:6px;color:#9f1239;font-size:.72rem;font-weight:750;line-height:1.35";
  (displayInput?.closest(".logbook-date-ddmmyyyy-wrap") || input).insertAdjacentElement("afterend", note);

  const check = () => {
    if (displayInput) {
      input.value = displayToIso(displayInput.value);
      validateDate(input, cairoDateString(-2), cairoDateString(0), displayInput);
    } else validateDate(input, cairoDateString(-2), cairoDateString(0));
  };

  form.addEventListener("submit", (event) => {
    check();
    const validityTarget = displayInput || input;
    if (!validityTarget.checkValidity()) {
      event.preventDefault();
      event.stopImmediatePropagation();
      validityTarget.reportValidity();
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
    style.textContent = `
      .${INVALID_CLASS}{border-color:#be123c!important;box-shadow:0 0 0 3px rgba(190,18,60,.10)!important}
      .logbook-date-ddmmyyyy-wrap{position:relative;display:flex;align-items:center;width:100%}
      .${DISPLAY_CLASS}{width:100%;padding-right:48px!important;font-variant-numeric:tabular-nums}
      .logbook-date-picker-button{position:absolute;right:8px;top:50%;transform:translateY(-50%);width:36px;height:36px;display:grid;place-items:center;border:0;background:transparent;color:inherit;cursor:pointer;padding:7px;border-radius:9px;z-index:2}
      .logbook-date-picker-button:hover{background:rgba(15,23,42,.06)}
      .logbook-date-picker-button svg{width:20px;height:20px;display:block}
      .logbook-native-date-picker{position:absolute!important;right:10px!important;top:50%!important;width:1px!important;height:1px!important;opacity:0!important;pointer-events:none!important;padding:0!important;border:0!important;transform:translateY(-50%)!important}
    `;
    document.head.appendChild(style);

    scan();
    new MutationObserver(scan).observe(document.body, { childList: true, subtree: true });
  } catch (error) {
    console.warn("48-hour logbook date rule could not initialize", error);
  }
}

void init();
