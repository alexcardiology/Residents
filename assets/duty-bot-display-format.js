const BOT_SELECTOR = ".duty-message-bot p";
const CARD_SELECTOR = ".duty-assignment-card";

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

  const walker = document.createTreeWalker(paragraph, NodeFilter.SHOW_TEXT);
  const textNodes = [];
  let node;
  while ((node = walker.nextNode())) textNodes.push(node);

  for (const textNode of textNodes) {
    const before = textNode.nodeValue || "";
    const after = cleanDutyBotText(before);
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

  const type = card.querySelector(":scope > div > span");
  if (type && /^day assignment$/i.test(type.textContent?.trim() || "")) type.remove();

  card.querySelectorAll("dl > div").forEach((row) => {
    const label = row.querySelector("dt")?.textContent?.trim().toLowerCase();
    const value = row.querySelector("dd");
    if (!value) return;

    if (label === "date") {
      value.textContent = formatDutyBotDateText(value.textContent || "");
      return;
    }

    if (label === "time" && /day assignment\s*[·-]\s*time not specified/i.test(value.textContent || "")) {
      row.remove();
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
