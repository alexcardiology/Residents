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

const westernDigits = (value: string) => String(value || "")
  .replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)))
  .replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)));

const normalizeName = (value: unknown) => westernDigits(String(value || ""))
  .normalize("NFKC")
  .toLowerCase()
  .replace(/أ|إ|آ/g, "ا")
  .replace(/ى/g, "ي")
  .replace(/ة/g, "ه")
  .replace(/ؤ/g, "و")
  .replace(/ئ/g, "ي")
  .replace(/\b(?:dr|doctor|prof|professor)\.?\b/gi, " ")
  .replace(/[\u064B-\u065F\u0670]/g, "")
  .replace(/[^a-z0-9\u0600-\u06ff]+/g, " ")
  .replace(/\s+/g, " ")
  .trim();

const aliases = (value: unknown) => String(value || "")
  .split(/[;,|/\n]+/)
  .map((item) => normalizeName(item))
  .filter(Boolean);

const normalizeWhatsapp = (value: unknown) => {
  let digits = westernDigits(String(value || "")).replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("0020")) digits = digits.slice(2);
  if (digits.startsWith("20") && digits.length >= 12) return `+${digits}`;
  if (digits.startsWith("0") && digits.length === 11) return `+20${digits.slice(1)}`;
  if (digits.length === 10 && digits.startsWith("1")) return `+20${digits}`;
  return digits.startsWith("+") ? digits : `+${digits}`;
};

type ProfileContact = {
  display_name?: string | null;
  username?: string | null;
  whatsapp?: string | null;
  faculty_schedule_name?: string | null;
};

function findContact(resident: string, profiles: ProfileContact[]) {
  const wanted = normalizeName(resident);
  if (!wanted) return null;

  let best: ProfileContact | null = null;
  let bestScore = 0;
  for (const profile of profiles) {
    const scheduleAliases = aliases(profile.faculty_schedule_name);
    const display = normalizeName(profile.display_name);
    const username = normalizeName(profile.username);
    let score = 0;

    if (scheduleAliases.includes(wanted)) score = 100;
    else if (display === wanted) score = 90;
    else if (username === wanted) score = 80;
    else if (scheduleAliases.some((alias) => alias && (alias.includes(wanted) || wanted.includes(alias)))) score = 70;
    else if (display && (display.includes(wanted) || wanted.includes(display))) score = 60;

    if (score > bestScore) {
      best = profile;
      bestScore = score;
    }
  }
  return bestScore >= 60 ? best : null;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "POST requests only" }, 405);

  try {
    const authorization = req.headers.get("Authorization");
    if (!authorization) return json({ error: "Authentication required" }, 401);

    const body = await req.json();
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !anonKey) return json({ error: "Supabase environment is not configured" }, 500);

    const headers = {
      Authorization: authorization,
      apikey: anonKey,
      "Content-Type": "application/json",
    };

    const dutyResponse = await fetch(`${supabaseUrl}/functions/v1/duty-bot`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });

    const dutyData = await dutyResponse.json().catch(() => ({}));
    if (!dutyResponse.ok) return json(dutyData, dutyResponse.status);

    const assignments = Array.isArray(dutyData?.assignments) ? dutyData.assignments : [];
    if (!assignments.length || !serviceKey) return json(dutyData);

    // Resolve the resident phone directly from the local profiles table before the answer is returned.
    // This removes the previous second Edge Function/Airtable lookup that made WhatsApp/Call buttons appear later.
    try {
      const profileResponse = await fetch(
        `${supabaseUrl}/rest/v1/profiles?select=display_name,username,whatsapp,faculty_schedule_name&is_active=eq.true&role=eq.resident`,
        {
          headers: {
            Authorization: `Bearer ${serviceKey}`,
            apikey: serviceKey,
            Accept: "application/json",
          },
        },
      );
      if (!profileResponse.ok) return json(dutyData);

      const profiles = await profileResponse.json().catch(() => []);
      if (!Array.isArray(profiles)) return json(dutyData);

      const enrichedAssignments = assignments.map((assignment: any) => {
        const resident = String(assignment?.resident || "").trim();
        const contact = findContact(resident, profiles as ProfileContact[]);
        const whatsapp = normalizeWhatsapp(contact?.whatsapp);
        if (!contact || !whatsapp) return assignment;
        return {
          ...assignment,
          contactDisplayName: String(contact?.display_name || "").trim() || resident,
          whatsapp,
        };
      });

      return json({ ...dutyData, assignments: enrichedAssignments });
    } catch (contactError) {
      console.warn("Direct contact enrichment failed; returning duty result", contactError);
      return json(dutyData);
    }
  } catch (error) {
    console.error(error);
    return json({ error: error instanceof Error ? error.message : "Unable to load El Médico" }, 500);
  }
});
