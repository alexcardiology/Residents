import { sb } from "./supabase.js";

const normalizePhone = (value) => {
  const raw = String(value || "").trim();
  if (!raw) return null;
  let digits = raw.replace(/\D/g, "");
  if (!digits) return null;
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.startsWith("0")) digits = `20${digits.slice(1)}`;
  return {
    whatsapp: digits,
    tel: `+${digits}`,
  };
};

const whatsappIcon = `
  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path d="M20.5 11.7a8.5 8.5 0 0 1-12.6 7.4L3.5 20.5l1.4-4.3A8.5 8.5 0 1 1 20.5 11.7Zm-8.4-6.3a6.3 6.3 0 0 0-5.4 9.5l.2.4-.8 2.4 2.5-.8.4.2a6.3 6.3 0 1 0 3.1-11.7Zm3.5 8.7c-.2-.1-1.2-.6-1.4-.7-.2-.1-.4-.1-.5.1l-.6.8c-.1.2-.3.2-.5.1a5.2 5.2 0 0 1-2.6-2.3c-.2-.3.2-.5.5-.9.1-.1.1-.3 0-.5l-.6-1.4c-.1-.3-.3-.3-.5-.3h-.4c-.2 0-.4.1-.6.3-.2.2-.8.8-.8 2 0 1.2.9 2.4 1 2.5.1.2 1.8 2.8 4.4 3.9.6.3 1.1.4 1.5.5.6.2 1.2.2 1.7.1.5-.1 1.5-.6 1.8-1.2.2-.6.2-1.1.2-1.2-.1-.1-.2-.2-.4-.3Z"/>
  </svg>`;

const phoneIcon = `
  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path d="M7.2 2.8 10 7.1c.3.5.2 1.1-.2 1.5L8.4 10a14.4 14.4 0 0 0 5.6 5.6l1.4-1.4c.4-.4 1-.5 1.5-.2l4.3 2.8c.5.3.7.9.5 1.4l-.9 2.6c-.2.6-.8 1-1.4 1C9.9 21.8 2.2 14.1 2.2 4.6c0-.6.4-1.2 1-1.4l2.6-.9c.5-.2 1.1 0 1.4.5Z"/>
  </svg>`;

const escapeHtml = (value) =>
  String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[char]);

const contactActions = (contact) => {
  const phone = normalizePhone(contact?.whatsapp);
  if (!phone) return "";
  const name = escapeHtml(contact?.displayName || contact?.scheduleName || "resident");
  return `
    <span class="duty-contact-actions" aria-label="Contact ${name}">
      <a class="duty-contact-btn duty-contact-whatsapp"
         href="https://wa.me/${escapeHtml(phone.whatsapp)}"
         target="_blank" rel="noopener noreferrer"
         title="WhatsApp" aria-label="Send WhatsApp to ${name}">${whatsappIcon}</a>
      <a class="duty-contact-btn duty-contact-call"
         href="tel:${escapeHtml(phone.tel)}"
         title="Call" aria-label="Call ${name}">${phoneIcon}</a>
    </span>`;
};

const inlineContacts = new Map();
const cacheContact = (scheduleName, contact) => {
  const key = String(scheduleName || "").trim();
  if (!key || !contact?.whatsapp) return;
  inlineContacts.set(key, {
    scheduleName: key,
    displayName: String(contact.displayName || contact.contactDisplayName || key).trim(),
    whatsapp: String(contact.whatsapp || "").trim(),
  });
};

/*
 * Route El Médico through the combined function. It resolves duty + contact
 * details before returning, so the contact details are available before the
 * reply bubble is constructed.
 */
const originalInvoke = sb.functions.invoke.bind(sb.functions);
sb.functions.invoke = async (functionName, options) => {
  if (functionName !== "duty-bot") return originalInvoke(functionName, options);

  let result = await originalInvoke("duty-bot-fast", options);
  if (result?.error) {
    console.warn("Fast El Médico endpoint unavailable; using standard duty lookup", result.error);
    result = await originalInvoke("duty-bot", options);
  }

  if (!result?.error && Array.isArray(result?.data?.assignments)) {
    result.data.assignments.forEach((assignment) => {
      cacheContact(assignment?.resident, {
        contactDisplayName: assignment?.contactDisplayName,
        whatsapp: assignment?.whatsapp,
      });
    });
  }
  return result;
};

let lookupInProgress = false;

const insertActions = (card, nameNode, name, contact) => {
  if (!contact?.whatsapp) return false;
  if (contact.displayName && nameNode) nameNode.textContent = contact.displayName;
  const topRow = card.querySelector(":scope > div") || card.querySelector(":scope > header");
  if (!topRow || topRow.querySelector(".duty-contact-actions")) return true;
  topRow.classList.add("duty-assignment-contact-head");
  topRow.insertAdjacentHTML("beforeend", contactActions(contact));
  return true;
};

const enrichCardFromInlineCache = (card) => {
  if (!card || card.dataset.elMedicoContactChecked === "1") return false;
  const nameNode = card.querySelector(":scope > div > strong, :scope > header strong, strong");
  const name = String(nameNode?.textContent || "").trim();
  if (!name) return false;
  const contact = inlineContacts.get(name);
  if (!contact || !insertActions(card, nameNode, name, contact)) return false;
  card.dataset.elMedicoContactChecked = "1";
  return true;
};

/*
 * Critical zero-lag path:
 * app.js builds each El Médico reply in a detached element and then calls
 * dutyBotTranscript.appendChild(reply). Enrich that detached reply BEFORE the
 * native appendChild runs. Therefore the browser's very first paint already
 * contains the WhatsApp and call buttons; no MutationObserver repaint is
 * needed for normal enriched responses.
 */
const enrichDetachedDutyReply = (node) => {
  if (!node || node.nodeType !== 1) return;
  const cards = node.matches?.(".duty-assignment-card")
    ? [node]
    : [...(node.querySelectorAll?.(".duty-assignment-card") || [])];
  cards.forEach(enrichCardFromInlineCache);
};

const nativeAppendChild = Node.prototype.appendChild;
Node.prototype.appendChild = function patchedElMedicoAppendChild(node) {
  try {
    if (this?.nodeType === 1 && this.id === "dutyBotTranscript") {
      enrichDetachedDutyReply(node);
    }
  } catch (error) {
    console.warn("El Médico pre-paint contact enrichment skipped", error);
  }
  return nativeAppendChild.call(this, node);
};

async function enrichVisibleDutyCards() {
  if (lookupInProgress) return;
  const cards = [...document.querySelectorAll(".duty-assignment-card:not([data-el-medico-contact-checked])")];
  if (!cards.length) return;

  const cardRows = cards.map((card) => {
    const nameNode = card.querySelector(":scope > div > strong, :scope > header strong, strong");
    return { card, nameNode, name: String(nameNode?.textContent || "").trim() };
  }).filter((row) => row.name);

  if (!cardRows.length) {
    cards.forEach((card) => { card.dataset.elMedicoContactChecked = "1"; });
    return;
  }

  /* Fast path for any card that did not travel through appendChild above. */
  const unresolved = [];
  cardRows.forEach((row) => {
    const contact = inlineContacts.get(row.name);
    if (contact && insertActions(row.card, row.nameNode, row.name, contact)) {
      row.card.dataset.elMedicoContactChecked = "1";
    } else {
      unresolved.push(row);
    }
  });
  if (!unresolved.length) return;

  /* Backward-compatible fallback for an old/non-enriched response only. */
  const names = [...new Set(unresolved.map((row) => row.name))];
  lookupInProgress = true;
  try {
    const { data, error } = await originalInvoke("duty-contact", { body: { names } });
    if (error) throw error;

    const contacts = new Map(
      (data?.contacts || []).map((item) => [String(item?.scheduleName || "").trim(), item]),
    );

    unresolved.forEach(({ card, nameNode, name }) => {
      const contact = contacts.get(name);
      card.dataset.elMedicoContactChecked = "1";
      if (!contact?.whatsapp) return;
      cacheContact(name, contact);
      insertActions(card, nameNode, name, contact);
    });
  } catch (error) {
    console.warn("El Médico contact actions are temporarily unavailable", error);
  } finally {
    lookupInProgress = false;
  }
}

/* Fallback only: normal new replies are enriched before their first paint. */
const content = document.querySelector("#content") || document.body;
new MutationObserver(enrichVisibleDutyCards).observe(content, { childList: true, subtree: true });
enrichVisibleDutyCards();
