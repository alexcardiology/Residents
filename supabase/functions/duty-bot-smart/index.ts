import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization,x-client-info,apikey,content-type",
};
const json = (payload: unknown, status = 200) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const westernDigits = (value: string) =>
  value.replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)));
const normalize = (value: unknown) =>
  westernDigits(String(value || ""))
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f\u064b-\u065f\u0670]/g, "")
    .replace(/[أإآ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/[؟،؛]/g, " ")
    .replace(/[^a-z0-9\u0600-\u06ff\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
const splitScheduleAliases = (value: unknown) =>
  [...new Set(String(value || "")
    .split(/[\/,;|\n]+/)
    .map((item) => item.trim())
    .filter(Boolean))];

async function callDutyBot(url: string, anonKey: string, authorization: string, question: string) {
  const response = await fetch(`${url}/functions/v1/duty-bot`, {
    method: "POST",
    headers: {
      Authorization: authorization,
      apikey: anonKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ question }),
  });
  const text = await response.text();
  let parsed: Record<string, unknown> | null = null;
  try { parsed = JSON.parse(text); } catch (_) {}
  return { response, text, parsed };
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "POST requests only" }, 405);
  try {
    const authorization = request.headers.get("Authorization");
    if (!authorization) return json({ error: "Authentication required" }, 401);

    const url = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const userClient = createClient(url, anonKey, { global: { headers: { Authorization: authorization } } });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: "Authentication required" }, 401);
    const { data: viewer } = await userClient.from("profiles").select("is_active").eq("id", user.id).maybeSingle();
    if (!viewer?.is_active) return json({ error: "Active portal account required" }, 403);

    const body = await request.json();
    const question = String(body?.question || "").trim();
    if (question.length < 2 || question.length > 300) return json({ error: "Enter a question between 2 and 300 characters" }, 400);

    const service = createClient(url, serviceKey);
    const { data: profiles, error } = await service
      .from("profiles")
      .select("display_name,username,faculty_schedule_name")
      .eq("role", "resident")
      .eq("is_active", true)
      .not("faculty_schedule_name", "is", null);
    if (error) throw error;

    const normalizedQuestion = ` ${normalize(question)} `;
    const candidates = (profiles || [])
      .map((row) => {
        const aliases = splitScheduleAliases(row.faculty_schedule_name);
        const normalizedAliases = aliases.map((alias) => normalize(alias)).filter(Boolean);
        const display = normalize(row.display_name);
        const username = normalize(row.username);
        const matchedAliasIndex = normalizedAliases.findIndex((alias) => normalizedQuestion.includes(` ${alias} `));
        const displayMatched = Boolean(display && normalizedQuestion.includes(` ${display} `));
        const usernameMatched = Boolean(username && normalizedQuestion.includes(` ${username} `));
        const aliasMatched = matchedAliasIndex >= 0;
        const matchLength = Math.max(
          displayMatched ? display.length : 0,
          usernameMatched ? username.length : 0,
          aliasMatched ? normalizedAliases[matchedAliasIndex].length : 0,
        );
        return { row, aliases, matchLength };
      })
      .filter((item) => item.matchLength > 0)
      .sort((a, b) => b.matchLength - a.matchLength);

    const matched = candidates[0];
    const attempts: string[] = [question];
    if (matched?.aliases?.length) {
      for (const alias of matched.aliases) attempts.push(`${question} ${alias}`.trim());
    }

    const uniqueAttempts = [...new Set(attempts)];
    let fallback: Awaited<ReturnType<typeof callDutyBot>> | null = null;
    for (const enhancedQuestion of uniqueAttempts) {
      const result = await callDutyBot(url, anonKey, authorization, enhancedQuestion);
      fallback = result;
      if (!result.response.ok) continue;
      if (result.parsed?.unknownResident !== true) {
        return new Response(result.text, {
          status: result.response.status,
          headers: { ...corsHeaders, "Content-Type": result.response.headers.get("Content-Type") || "application/json" },
        });
      }
    }

    if (fallback) {
      return new Response(fallback.text, {
        status: fallback.response.status,
        headers: { ...corsHeaders, "Content-Type": fallback.response.headers.get("Content-Type") || "application/json" },
      });
    }
    return json({ error: "Unable to query El Médico" }, 500);
  } catch (error) {
    console.error(error);
    return json({ error: error instanceof Error ? error.message : "Unable to query El Médico" }, 500);
  }
});
