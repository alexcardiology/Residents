import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization,x-client-info,apikey,content-type",
};

const json = (payload: unknown, status = 200) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const normalize = (value: unknown) => String(value || "")
  .toLowerCase()
  .normalize("NFD")
  .replace(/[\u0300-\u036f\u064b-\u065f\u0670]/g, "")
  .replace(/[أإآ]/g, "ا")
  .replace(/ى/g, "ي")
  .replace(/ة/g, "ه")
  .replace(/ؤ/g, "و")
  .replace(/ئ/g, "ي")
  .replace(/\s+/g, " ")
  .trim();

function isCcuOrErQuestion(question: string) {
  const q = normalize(question);
  return /(^|\s)(ccu|er|emergency|coronary care)(\s|$)/.test(q)
    || q.includes("عنايه")
    || q.includes("العنايه")
    || q.includes("طوارئ")
    || q.includes("الطوارئ");
}

function seniorQuestion(question: string) {
  const isArabic = /[\u0600-\u06ff]/.test(question);
  let q = question;
  q = q.replace(/\bCCU\b/gi, "senior")
    .replace(/\bER\b/gi, "senior")
    .replace(/\bemergency\b/gi, "senior")
    .replace(/\bcoronary\s+care\b/gi, "senior")
    .replace(/العناية|العنايه|عناية|عنايه|الطوارئ|طوارئ/g, isArabic ? "السينيور" : "senior");
  if (q === question) q = `${question} ${isArabic ? "السينيور" : "senior"}`;
  return q;
}

function assignmentKey(item: any) {
  return [item?.date, item?.hospital, item?.unit, item?.role, item?.resident]
    .map((value) => normalize(value))
    .join("|");
}

function insertSeniorLines(answer: string, seniorAnswer: string) {
  const extraLines = String(seniorAnswer || "")
    .split("\n")
    .filter((line) => line.trim().startsWith("•"));
  if (!extraLines.length) return answer;

  const current = String(answer || "");
  const uniqueLines = extraLines.filter((line) => !current.includes(line));
  if (!uniqueLines.length) return current;

  for (const marker of ["\nالنوبتجية 24 ساعة:", "\n24-hour duty:"]) {
    const index = current.indexOf(marker);
    if (index >= 0) return `${current.slice(0, index)}\n${uniqueLines.join("\n")}${current.slice(index)}`;
  }
  return `${current}\n${uniqueLines.join("\n")}`;
}

async function callBase(question: string) {
  const url = `${Deno.env.get("SUPABASE_URL")}/functions/v1/duty-bot-public`;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
  const response = await fetch(url, {
    method: "POST",
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ question }),
  });
  const data = await response.json().catch(() => ({}));
  return { response, data };
}

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "POST requests only" }, 405);

  try {
    const body = await request.json();
    const question = String(body?.question || "").trim();
    if (question.length < 2 || question.length > 300) return json({ error: "Enter a question between 2 and 300 characters" }, 400);

    const primary = await callBase(question);
    if (!primary.response.ok) return json(primary.data, primary.response.status);
    if (!isCcuOrErQuestion(question)) return json({ ...primary.data, version: "public-2" });

    const senior = await callBase(seniorQuestion(question));
    if (!senior.response.ok || !Array.isArray(senior.data?.assignments)) return json({ ...primary.data, version: "public-2" });

    const primaryAssignments = Array.isArray(primary.data?.assignments) ? primary.data.assignments : [];
    const existing = new Set(primaryAssignments.map(assignmentKey));
    const seniorAssignments = senior.data.assignments.filter((item: any) => normalize(item?.unit) === "senior");
    const additions = seniorAssignments.filter((item: any) => !existing.has(assignmentKey(item)));

    if (!additions.length) return json({ ...primary.data, version: "public-2" });

    return json({
      ...primary.data,
      answer: insertSeniorLines(String(primary.data?.answer || ""), String(senior.data?.answer || "")),
      assignments: [...primaryAssignments, ...additions],
      seniorIncluded: true,
      version: "public-2",
    });
  } catch (error) {
    console.error(error);
    return json({ error: error instanceof Error ? error.message : "Unable to read duty schedule" }, 500);
  }
});
