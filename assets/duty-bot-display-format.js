const BOT_SELECTOR = ".duty-message-bot p";
const CARD_SELECTOR = ".duty-assignment-card";
const ARABIC_RE = /[\u0600-\u06FF]/;

const ARABIC_LABELS = {
  hospital: "المستشفى",
  service: "القسم",
  date: "التاريخ",
  time: "الوقت",
  source: "المصدر",
};

function hasArabic(text) {
  return ARABIC_RE.test(String(text || ""));
}

function isArabicContext(element) {
  if (!(element instanceof Element)) return false;
  if (hasArabic(element.textContent)) return true;

  const message = element.closest(".duty-message");
  const previous = message?.previousElementSibling;
  return Boolean(previous?.classList.contains("duty-message-user") && hasArabic(previous.textContent));
}

function applyDutyDirection(element, arabic) {
  if (!(element instanceof HTMLElement)) return;
  const dir = arabic ? "rtl" : "ltr";
  element.setAttribute("dir", dir);
  element.style.direction = dir;
  element.style.textAlign = arabic ? "right" : "left";
  element.style.unicodeBidi = "plaintext";

  const message = element.closest(".duty-message");
  if (message instanceof HTMLElement) {
    message.setAttribute("dir", dir);
    message.classList.toggle("duty-message-arabic", arabic);
    const content = message.querySelector(":scope > div");
    if (content instanceof HTMLElement) {
      content.setAttribute("dir", dir);
      content.style.direction = dir;
      content.style.textAlign = arabic ? "right" : "left";
    }
  }
}

function localizeArabicStatusText(text) {
  return String(text || "")
    .replace(/^24-hour duty$/i, "نباطشية 24 ساعة")
    .replace(/^Duty$/i, "نباطشية")
    .replace(/^Day assignment$/i, "توزيع يومي")
    .replace(/^Approved schedule$/i, "الجدول المعتمد");
}

function localizeArabicInlineText(text) {
  return String(text || "")
    .replace(/\bduties\b/gi, "النوبات")
    .replace(/\bduty\b/gi, "نباطشية")
    .replace(/\bday assignments?\b/gi, "التوزيعات اليومية")
    .replace(/\bapproved schedule\b/gi, "الجدول المعتمد");
}

function formatDutyBotDateText(text) {
  return String(text || "")
    .replace(/\b(20\d{2})-(\d{2})-(\d{2})\b/g, "$3-$2-$1")
    .replace(/\b(?:SUN|MON|TUE|WED|THU|FRI|SAT)\/(\d{2})\/(\d{2})\/(20\d{2})\b/gi, "$1-$2-$3");
}

function cleanDutyBotText(text) {
  return formatDutyBotDateText(text)
    .replace(/\s*—\s*day assignment\b/gi, "")
    .replace(/\s*—\s*توزيع يومي\b/g, "")
    .replace(/Day assignment:\s*its time is not specified in the Google Sheet\.?/gi, "")
    .replace(/التوزيع اليومي:\s*التوقيت غير مذكور في Google Sheet\.?/g, "");
}

function formatDutyBotParagraph(paragraph) {
  if (!(paragraph instanceof HTMLElement)) return;

  const arabic = isArabicContext(paragraph);
  applyDutyDirection(paragraph, arabic);

  if (arabic) {
    const exact = String(paragraph.textContent || "").trim();
    if (exact === "Checking the approved faculty schedule…") {
      paragraph.textContent = "جاري مراجعة جدول النوبات والتوزيعات المعتمد…";
    } else if (exact === "El Médico could not read the approved schedules. Please try again or contact the admin.") {
      paragraph.textContent = "تعذر على El Médico قراءة الجداول المعتمدة. حاول مرة أخرى أو تواصل مع مسؤول النظام.";
    }
  }

  const walker = document.createTreeWalker(paragraph, NodeFilter.SHOW_TEXT);
  const textNodes = [];
  let node;
  while ((node = walker.nextNode())) textNodes.push(node);

  for (const textNode of textNodes) {
    const before = textNode.nodeValue || "";
    let after = cleanDutyBotText(before);
    if (arabic) after = localizeArabicInlineText(after);
    if (after !== before) textNode.nodeValue = after;

    if (!String(textNode.nodeValue || "").trim()) {
      const previous = textNode.previousSibling;
      if (previous?.nodeName === "BR") previous.remove();
    }
  }

  while (paragraph.lastChild?.nodeName === "BR") paragraph.lastChild.remove();
}

function formatDutyAssignmentCard(card) {
  if (!(card instanceof HTMLElement)) return;

  const arabic = isArabicContext(card);
  applyDutyDirection(card, arabic);

  const type = card.querySelector(":scope > div > span");
  if (type && /^day assignment$/i.test(type.textContent?.trim() || "")) {
    type.remove();
  } else if (type && arabic) {
    const localized = localizeArabicStatusText(type.textContent?.trim() || "");
    if (localized !== type.textContent) type.textContent = localized;
    type.setAttribute("dir", "rtl");
  }

  card.querySelectorAll("dl > div").forEach((row) => {
    const dt = row.querySelector("dt");
    const value = row.querySelector("dd");
    const label = dt?.textContent?.trim().toLowerCase();
    if (!value) return;

    if (arabic && dt && ARABIC_LABELS[label]) dt.textContent = ARABIC_LABELS[label];

    if (label === "date" || dt?.textContent?.trim() === "التاريخ") {
      const formatted = formatDutyBotDateText(value.textContent || "");
      if (formatted !== value.textContent) value.textContent = formatted;
      return;
    }

    if ((label === "time" || dt?.textContent?.trim() === "الوقت") && /day assignment\s*[·-]\s*time not specified/i.test(value.textContent || "")) {
      row.remove();
      return;
    }

    if (arabic && (label === "source" || dt?.textContent?.trim() === "المصدر")) {
      const localized = localizeArabicStatusText(value.textContent || "");
      if (localized !== value.textContent) value.textContent = localized;
    }
  });
}

function formatDutyBotMessages(root = document) {
  if (root instanceof Element && root.matches(BOT_SELECTOR)) formatDutyBotParagraph(root);
  if (root instanceof Element && root.matches(CARD_SELECTOR)) formatDutyAssignmentCard(root);
  root.querySelectorAll?.(BOT_SELECTOR).forEach(formatDutyBotParagraph);
  root.querySelectorAll?.(CARD_SELECTOR).forEach(formatDutyAssignmentCard);
}

formatDutyBotMessages();

new MutationObserver((mutations) => {
  for (const mutation of mutations) {
    mutation.addedNodes.forEach((added) => {
      if (added.nodeType === Node.ELEMENT_NODE) formatDutyBotMessages(added);
    });
    if (mutation.type === "characterData") {
      const paragraph = mutation.target.parentElement?.closest(BOT_SELECTOR);
      if (paragraph) formatDutyBotParagraph(paragraph);
      const card = mutation.target.parentElement?.closest(CARD_SELECTOR);
      if (card) formatDutyAssignmentCard(card);
    }
  }
}).observe(document.documentElement, { childList: true, subtree: true, characterData: true });
