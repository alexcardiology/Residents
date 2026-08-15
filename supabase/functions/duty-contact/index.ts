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

const AIRTABLE_BASE_ID = "appSmzqYTynjlWK9B";
const RESIDENTS_TABLE = "Residents";
const RESIDENT_FIELDS = {
  scheduleName: "fldK0N06gZTn5p89V",
  fullName: "fldNVMdQpXsm9POV9",
  aliases: "fldxBP7Z38Kpzb7wf",
} as const;

type AirtableRecord = { id: string; fields: Record<string, unknown> };
type ResidentRow = { scheduleName: string; fullName: string; aliases: string[] };

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
const normalizePerson = (value: unknown) =>
  normalize(value).replace(/^(?:(?:professor|prof|doctor|dr)\s+)+/i, "").trim();
const splitAliases = (value: unknown) =>
  String(value || "").split(/[,;|\n]+/).map((item) => item.trim()).filter(Boolean);
const recordField = (record: AirtableRecord, name: string, fieldId: string) =>
  record.fields[fieldId] ?? record.fields[name];

async function airtableResidents(): Promise<ResidentRow[]> {
  const token = Deno.env.get("AIRTABLE_TOKEN");
  if (!token) return [];
  const records: AirtableRecord[] = [];
  let offset = "";
  do {
    const url = new URL(`https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(RESIDENTS_TABLE)}`);
    url.searchParams.set("pageSize", "100");
    url.searchParams.set("returnFieldsByFieldId", "true");
    if (offset) url.searchParams.set("offset", offset);
    const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!response.ok) throw new Error(`Airtable resident lookup failed (${response.status})`);
    const page = await response.json();
    records.push(...(page.records || []));
    offset = String(page.offset || "");
  } while (offset);
  return records.map((record) => {
    const scheduleName = String(recordField(record, "Schedule name", RESIDENT_FIELDS.scheduleName) || "").trim();
    const fullName = String(recordField(record, "Full resident name", RESIDENT_FIELDS.fullName) || "").trim();
    return {
      scheduleName,
      fullName,
      aliases: [scheduleName, fullName, ...splitAliases(recordField(record, "Other aliases / nicknames", RESIDENT_FIELDS.aliases))].filter(Boolean),
    };
  }).filter((row) => row.scheduleName);
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
    const names = [...new Set((Array.isArray(body?.names) ? body.names : [])
      .map((name: unknown) => String(name || "").trim())
      .filter(Boolean))].slice(0, 40);
    if (!names.length) return json({ contacts: [] });

    const service = createClient(url, serviceKey);
    const [{ data: profiles, error: profileError }, residents] = await Promise.all([
      service.from("profiles")
        .select("display_name,username,whatsapp,is_active")
        .eq("is_active", true)
        .not("whatsapp", "is", null),
      airtableResidents().catch(() => []),
    ]);
    if (profileError) throw profileError;

    const profileRows = (profiles || []).filter((row) => String(row.whatsapp || "").trim());
    const contacts = names.map((scheduleName) => {
      const key = normalizePerson(scheduleName);
      const resident = residents.find((row) => row.aliases.some((alias) => normalizePerson(alias) === key));
      const candidateNames = [scheduleName, resident?.scheduleName, resident?.fullName, ...(resident?.aliases || [])]
        .filter(Boolean)
        .map(normalizePerson);
      const profile = profileRows.find((row) => {
        const display = normalizePerson(row.display_name);
        const username = normalizePerson(row.username);
        return candidateNames.includes(display) || candidateNames.includes(username);
      });
      if (!profile) return null;
      return {
        scheduleName,
        displayName: String(profile.display_name || resident?.fullName || scheduleName),
        whatsapp: String(profile.whatsapp || "").trim(),
      };
    }).filter(Boolean);

    return json({ contacts });
  } catch (error) {
    console.error(error);
    return json({ error: error instanceof Error ? error.message : "Unable to load contacts" }, 500);
  }
});
