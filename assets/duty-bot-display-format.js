const BOT_SELECTOR = ".duty-message-bot p";

function formatDutyBotDateText(text) {
  return String(text || "").replace(/\b(20\d{2})-(\d{2})-(\d{2})\b/g, "$3-$2-$1");
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

  // Remove any empty line breaks left by the deleted daytime timing note.
  while (paragraph.lastChild?.nodeName === "BR") paragraph.lastChild.remove();
}

function formatDutyBotMessages(root = document) {
  if (root instanceof Element && root.matches(BOT_SELECTOR)) formatDutyBotParagraph(root);
  root.querySelectorAll?.(BOT_SELECTOR).forEach(formatDutyBotParagraph);
}

formatDutyBotMessages();

new MutationObserver((mutations) => {
  for (const mutation of mutations) {
    mutation.addedNodes.forEach((added) => {
      if (added.nodeType === Node.ELEMENT_NODE) formatDutyBotMessages(added);
    });
    if (mutation.type === "characterData" && mutation.target.parentElement?.closest(BOT_SELECTOR)) {
      formatDutyBotParagraph(mutation.target.parentElement.closest(BOT_SELECTOR));
    }
  }
}).observe(document.documentElement, { childList: true, subtree: true, characterData: true });
