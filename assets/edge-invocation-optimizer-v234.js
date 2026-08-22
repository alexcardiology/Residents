import { sb } from "./supabase.js";

/*
 * Residents Edge Invocation Optimizer
 *
 * Scope is deliberately narrow:
 * - ONLY read-only El Médico / contact lookup functions are cached or de-duplicated.
 * - admin-users, push-notify, AI curriculum generation, attendance writes, etc.
 *   are never cached or suppressed.
 *
 * This preserves workflow correctness while reducing duplicate Edge invocations.
 */

if (!sb.functions.__residentsEdgeOptimizerInstalled) {
  const nativeInvoke = sb.functions.invoke.bind(sb.functions);

  const CACHE_PREFIX = "residents-edge-cache-v1:";
  const memory = new Map();
  const inFlight = new Map();

  // Current authenticated UI already uses duty-bot-v17 successfully.
  // Older compatibility wrappers can otherwise fan a single question through
  // duty-bot-fast / duty-bot-smart / duty-bot and create multiple invocations.
  const authenticatedDutyAliases = new Set([
    "duty-bot",
    "duty-bot-fast",
    "duty-bot-smart",
    "duty-bot-v15",
  ]);

  function canonicalName(name) {
    if (authenticatedDutyAliases.has(name)) return "duty-bot-v17";
    return name;
  }

  function stableBody(options = {}) {
    try {
      const body = options?.body ?? null;
      if (!body || typeof body !== "object") return JSON.stringify(body);
      const sorted = {};
      Object.keys(body).sort().forEach((key) => { sorted[key] = body[key]; });
      return JSON.stringify(sorted);
    } catch (_) {
      return "";
    }
  }

  function normalizedQuestion(options = {}) {
    return String(options?.body?.question || "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, " ");
  }

  function ttlFor(name) {
    // Schedules are not expected to change second-by-second.
    // 5 min dramatically reduces repeated prompts/refreshes while staying fresh.
    if (name === "duty-bot-v17") return 5 * 60 * 1000;
    if (name === "duty-bot-public-v2") return 5 * 60 * 1000;

    // Contact data changes infrequently.
    if (name === "duty-contact") return 30 * 60 * 1000;

    return 0;
  }

  function isSafeRead(name) {
    return name === "duty-bot-v17"
      || name === "duty-bot-public-v2"
      || name === "duty-contact";
  }

  function cacheKey(name, options) {
    const q = normalizedQuestion(options);
    const body = q ? `q:${q}` : stableBody(options);
    return `${name}|${body}`;
  }

  function readCache(key, ttl) {
    const now = Date.now();

    const mem = memory.get(key);
    if (mem && now - mem.at < ttl) return mem.value;

    try {
      const raw = sessionStorage.getItem(CACHE_PREFIX + key);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || now - Number(parsed.at || 0) >= ttl) {
        sessionStorage.removeItem(CACHE_PREFIX + key);
        return null;
      }
      memory.set(key, { at: Number(parsed.at), value: parsed.value });
      return parsed.value;
    } catch (_) {
      return null;
    }
  }

  function writeCache(key, value) {
    const item = { at: Date.now(), value };
    memory.set(key, item);
    try {
      sessionStorage.setItem(CACHE_PREFIX + key, JSON.stringify(item));
    } catch (_) {}
  }

  sb.functions.invoke = async (requestedName, options = {}) => {
    const name = canonicalName(String(requestedName || ""));

    // Everything except the explicitly listed read-only functions is passed
    // through untouched.
    if (!isSafeRead(name)) {
      return nativeInvoke(requestedName, options);
    }

    const ttl = ttlFor(name);
    const key = cacheKey(name, options);

    const cached = readCache(key, ttl);
    if (cached) return cached;

    // Prevent double-clicks, duplicate listeners, and compatibility wrappers
    // from launching the same request concurrently.
    if (inFlight.has(key)) return inFlight.get(key);

    const request = nativeInvoke(name, options)
      .then((result) => {
        // Cache only successful responses.
        if (!result?.error && !result?.data?.error) writeCache(key, result);
        return result;
      })
      .finally(() => {
        inFlight.delete(key);
      });

    inFlight.set(key, request);
    return request;
  };

  sb.functions.__residentsEdgeOptimizerInstalled = true;
  window.__residentsEdgeOptimizer = {
    clear() {
      memory.clear();
      try {
        Object.keys(sessionStorage)
          .filter((key) => key.startsWith(CACHE_PREFIX))
          .forEach((key) => sessionStorage.removeItem(key));
      } catch (_) {}
    },
  };
}
