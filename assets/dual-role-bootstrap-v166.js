// Deterministic dual-role bootstrap.
// Runs before the portal app and makes the signed-in dual-role Year-4 resident
// look like a native assessor ONLY to the portal's own self-profile request.
// The database profile remains resident; server permissions are capability-based.
(() => {
  const MODE_KEY = "cardiology-dual-role-mode";
  if (localStorage.getItem(MODE_KEY) !== "assessor") return;

  const allowedUsernames = new Set(["minawafik", "hossamashmawy", "anharzokailah"]);
  const originalFetch = window.fetch.bind(window);

  const jwtSub = (headers) => {
    try {
      let auth = "";
      if (headers instanceof Headers) auth = headers.get("authorization") || "";
      else if (Array.isArray(headers)) auth = String(headers.find(([k]) => String(k).toLowerCase() === "authorization")?.[1] || "");
      else if (headers && typeof headers === "object") auth = String(headers.authorization || headers.Authorization || "");
      const token = auth.replace(/^Bearer\s+/i, "");
      if (!token || token.split(".").length < 2) return "";
      const payload = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
      const json = decodeURIComponent(atob(payload.padEnd(Math.ceil(payload.length / 4) * 4, "=")).split("").map(c => `%${("00" + c.charCodeAt(0).toString(16)).slice(-2)}`).join(""));
      return String(JSON.parse(json)?.sub || "");
    } catch (_) {
      return "";
    }
  };

  const adapt = (value, userId) => {
    if (!value || !userId) return value;
    const patch = (row) => {
      if (!row || typeof row !== "object") return row;
      const username = String(row.username || "").trim().toLowerCase();
      if (String(row.id || "") !== userId) return row;
      if (!allowedUsernames.has(username)) return row;
      if (String(row.role || "").toLowerCase() !== "resident" || Number(row.residency_year) !== 4) return row;
      return { ...row, role: "assessor", __primary_role: "resident", __dual_role_assessor: true };
    };
    return Array.isArray(value) ? value.map(patch) : patch(value);
  };

  window.fetch = async function dualRoleFetch(input, init = {}) {
    const request = input instanceof Request ? input : null;
    const url = String(request?.url || input || "");
    const method = String(init.method || request?.method || "GET").toUpperCase();
    const headers = init.headers || request?.headers;
    const response = await originalFetch(input, init);

    if (method !== "GET" || !url.includes("/rest/v1/profiles")) return response;

    const userId = jwtSub(headers);
    if (!userId || !response.ok) return response;

    try {
      const clone = response.clone();
      const data = await clone.json();
      const adapted = adapt(data, userId);
      const before = JSON.stringify(data);
      const after = JSON.stringify(adapted);
      if (before === after) return response;

      const newHeaders = new Headers(response.headers);
      newHeaders.delete("content-length");
      return new Response(after, {
        status: response.status,
        statusText: response.statusText,
        headers: newHeaders,
      });
    } catch (_) {
      return response;
    }
  };
})();
