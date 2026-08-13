import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization,x-client-info,apikey,content-type",
};

const json = (payload: unknown, status = 200) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const TIME_ZONE = "Africa/Cairo";
const AIRTABLE_BASE_ID =
  Deno.env.get("AIRTABLE_BASE_ID") || "appSmzqYTynjlWK9B";
const ASSIGNMENTS_TABLE = "Bot_Assignments";
const RESIDENTS_TABLE = "Residents";
const CACHE_TTL_MS = 60_000;

type AirtableRecord = {
  id: string;
  fields: Record<string, unknown>;
};

type Assignment = {
  id: string;
  date: string;
  day: string;
  hospital: string;
  unit: string;
  role: string;
  resident: string;
  status: string;
};

type ResidentAlias = {
  scheduleName: string;
  fullName: string;
  aliases: string[];
};

let cache:
  | {
      expiresAt: number;
      assignments: Assignment[];
      residents: ResidentAlias[];
    }
  | null = null;

const normalize = (value: unknown) =>
  String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[أإآ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/[^a-z0-9\u0600-\u06ff/\-\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const selectName = (value: unknown) => {
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && "name" in value) {
    return String((value as { name?: unknown }).name || "");
  }
  return "";
};

const splitAliases = (value: unknown) =>
  String(value || "")
    .split(/[,;|\n]+/)
    .map((item) => item.trim())
    .filter(Boolean);

async function airtableRecords(table: string) {
  const token = Deno.env.get("AIRTABLE_TOKEN");
  if (!token) throw new Error("AIRTABLE_TOKEN is not configured");

  const records: AirtableRecord[] = [];
  let offset = "";
  do {
    const url = new URL(
      `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(table)}`,
    );
    url.searchParams.set("pageSize", "100");
    if (offset) url.searchParams.set("offset", offset);

    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) {
      const detail = await response.text();
      throw new Error(`Airtable request failed (${response.status}): ${detail}`);
    }
    const page = await response.json();
    records.push(...(page.records || []));
    offset = String(page.offset || "");
  } while (offset);
  return records;
}

async function scheduleData() {
  if (cache && cache.expiresAt > Date.now()) return cache;

  const [assignmentRecords, residentRecords] = await Promise.all([
    airtableRecords(ASSIGNMENTS_TABLE),
    airtableRecords(RESIDENTS_TABLE),
  ]);

  const assignments = assignmentRecords
    .map((record): Assignment => ({
      id: record.id,
      date: String(record.fields.Date || ""),
      day: selectName(record.fields.Day),
      hospital: selectName(record.fields.Hospital),
      unit: selectName(record.fields.Unit),
      role: selectName(record.fields["Role / Group"]),
      resident: selectName(record.fields["Resident schedule name"]),
      status: selectName(record.fields.Status),
    }))
    .filter((item) => item.date && item.resident && item.status === "Approved");

  const residents = residentRecords
    .map((record): ResidentAlias => {
      const scheduleName = String(record.fields["Schedule name"] || "").trim();
      const fullName = String(record.fields["Full resident name"] || "").trim();
      return {
        scheduleName,
        fullName,
        aliases: [
          scheduleName,
          fullName,
          ...splitAliases(record.fields["Other aliases / nicknames"]),
        ].filter(Boolean),
      };
    })
    .filter((item) => item.scheduleName);

  cache = { expiresAt: Date.now() + CACHE_TTL_MS, assignments, residents };
  return cache;
}

function cairoParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return {
    date: `${values.year}-${values.month}-${values.day}`,
    hour: Number(values.hour),
  };
}

function addDays(isoDate: string, amount: number) {
  const date = new Date(`${isoDate}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
}

function explicitDate(question: string) {
  const iso = question.match(/\b(20\d{2})[-/](\d{1,2})[-/](\d{1,2})\b/);
  if (iso) {
    return `${iso[1]}-${iso[2].padStart(2, "0")}-${iso[3].padStart(2, "0")}`;
  }
  const dayFirst = question.match(/\b(\d{1,2})[/-](\d{1,2})(?:[/-](20\d{2}))?\b/);
  if (dayFirst) {
    const year = dayFirst[3] || cairoParts().date.slice(0, 4);
    return `${year}-${dayFirst[2].padStart(2, "0")}-${dayFirst[1].padStart(2, "0")}`;
  }
  return "";
}

function targetDate(normalizedQuestion: string) {
  const current = cairoParts();
  const stated = explicitDate(normalizedQuestion);
  if (stated) return stated;
  if (/\b(tomorrow|tmr)\b|بكره|غدا/.test(normalizedQuestion)) {
    return addDays(current.date, 1);
  }
  if (/\byesterday\b|امس/.test(normalizedQuestion)) {
    return addDays(current.date, -1);
  }
  // A duty labelled with a date runs 08:00 that date until 08:00 next day.
  return current.hour < 8 ? addDays(current.date, -1) : current.date;
}

const includesAny = (question: string, values: string[]) =>
  values.some((value) => question.includes(normalize(value)));

function findResident(question: string, residents: ResidentAlias[]) {
  const candidates = residents.flatMap((resident) =>
    resident.aliases.map((alias) => ({
      resident,
      alias: normalize(alias),
    })),
  ).filter((item) => item.alias.length >= 2)
    .sort((a, b) => b.alias.length - a.alias.length);

  return candidates.find(({ alias }) => {
    if (alias.length > 3) return question.includes(alias);
    return (` ${question} `).includes(` ${alias} `);
  })?.resident || null;
}

function requestedHospital(question: string) {
  if (includesAny(question, ["miri", "el miri", "الميري", "ميري", "ميرى"])) {
    return "Miri";
  }
  if (includesAny(question, ["smouha", "سموحة", "سموحه"])) return "Smouha";
  return "";
}

function requestedUnit(question: string) {
  if (/\ber\b/.test(question) || includesAny(question, ["emergency", "طوارئ", "الطوارئ"])) return "ER";
  if (includesAny(question, ["angina", "ذبحة", "الذبحة"])) return "Angina Unit";
  if (includesAny(question, ["senior", "سينيور", "الكبير"])) return "Senior";
  if (includesAny(question, ["ccu", "عناية", "العناية"])) return "CCU";
  return "";
}

function requestedRole(question: string) {
  const parts: string[] = [];
  if (includesAny(question, ["4th", "fourth", "رابعه", "الرابعه"])) parts.push("4th");
  if (includesAny(question, ["5th", "fifth", "خامسه", "الخامسه"])) parts.push("5th");
  for (const year of ["2021", "2022", "2023"]) {
    if (question.includes(year)) parts.push(year);
  }
  return parts;
}

function arabicPlace(item: Assignment) {
  const hospital = item.hospital === "Miri" ? "الميري" : item.hospital === "Smouha" ? "سموحة" : item.hospital;
  const unit = item.unit === "CCU" ? "العناية" : item.unit === "ER" ? "الطوارئ" : item.unit === "Angina Unit" ? "وحدة الذبحة" : item.unit === "Senior" ? "السينيور" : item.unit;
  const subgroup = item.role && !["CCU duty", "ER duty", "Angina Unit duty", "Senior coverage"].includes(item.role)
    ? ` · ${item.role}`
    : "";
  return `${unit} – ${hospital}${subgroup}`;
}

function englishPlace(item: Assignment) {
  const subgroup = item.role && !["CCU duty", "ER duty", "Angina Unit duty", "Senior coverage"].includes(item.role)
    ? ` · ${item.role}`
    : "";
  return `${item.hospital} ${item.unit}${subgroup}`;
}

function buildAnswer(
  question: string,
  rows: Assignment[],
  resident: ResidentAlias | null,
  date: string,
) {
  const isArabic = /[\u0600-\u06ff]/.test(question);
  if (!rows.length) {
    return isArabic
      ? `لا توجد نوبتجية معتمدة مطابقة للسؤال بتاريخ ${date}.`
      : `No approved duty assignment matched your question for ${date}.`;
  }

  if (resident) {
    const displayName = resident.fullName || resident.scheduleName;
    if (isArabic) {
      return `نوبتجية د. ${displayName} بتاريخ ${date}:\n${rows.map((row) => `• ${arabicPlace(row)}`).join("\n")}\nمن 8 صباحًا حتى 8 صباحًا في اليوم التالي.`;
    }
    return `Dr ${displayName} on ${date}:\n${rows.map((row) => `• ${englishPlace(row)}`).join("\n")}\nDuty runs from 8:00 AM until 8:00 AM the following day.`;
  }

  if (isArabic) {
    return `نوبتجية ${date}:\n${rows.map((row) => `• د. ${row.resident} — ${arabicPlace(row)}`).join("\n")}\nمن 8 صباحًا حتى 8 صباحًا في اليوم التالي.`;
  }
  return `Duty schedule for ${date}:\n${rows.map((row) => `• Dr ${row.resident} — ${englishPlace(row)}`).join("\n")}\nDuty runs from 8:00 AM until 8:00 AM the following day.`;
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "POST requests only" }, 405);

  try {
    const authorization = request.headers.get("Authorization");
    if (!authorization) return json({ error: "Authentication required" }, 401);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authorization } } },
    );
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return json({ error: "Authentication required" }, 401);

    const { data: profile } = await supabase
      .from("profiles")
      .select("role,is_active")
      .eq("id", user.id)
      .maybeSingle();
    if (!profile?.is_active) return json({ error: "Active portal account required" }, 403);

    const body = await request.json();
    const question = String(body.question || "").trim();
    if (question.length < 2 || question.length > 300) {
      return json({ error: "Enter a question between 2 and 300 characters" }, 400);
    }

    const normalizedQuestion = normalize(question);
    const data = await scheduleData();
    const resident = findResident(normalizedQuestion, data.residents);
    const date = targetDate(normalizedQuestion);
    const hospital = requestedHospital(normalizedQuestion);
    const unit = requestedUnit(` ${normalizedQuestion} `);
    const roleParts = requestedRole(normalizedQuestion);
    const asksNext = includesAny(normalizedQuestion, ["next duty", "next shift", "النوبتجيه الجايه", "النوبتجية الجاية", "اقرب نوبتجيه", "أقرب نوبتجية"]);
    const asksWeek = includesAny(normalizedQuestion, ["this week", "next 7 days", "الاسبوع", "أسبوع"]);

    let rows = data.assignments.filter((item) => {
      if (resident && normalize(item.resident) !== normalize(resident.scheduleName)) return false;
      if (hospital && item.hospital !== hospital) return false;
      if (unit && item.unit !== unit) return false;
      if (roleParts.length && !roleParts.every((part) => normalize(item.role).includes(normalize(part)))) return false;
      return true;
    });

    if (resident && asksNext) {
      rows = rows.filter((item) => item.date >= date).sort((a, b) => a.date.localeCompare(b.date));
      const nextDate = rows[0]?.date || date;
      rows = rows.filter((item) => item.date === nextDate);
      return json({ answer: buildAnswer(question, rows, resident, nextDate), assignments: rows, date: nextDate });
    }

    if (resident && asksWeek) {
      const endDate = addDays(date, 6);
      rows = rows.filter((item) => item.date >= date && item.date <= endDate)
        .sort((a, b) => a.date.localeCompare(b.date));
      return json({ answer: buildAnswer(question, rows, resident, `${date} → ${endDate}`), assignments: rows, date });
    }

    rows = rows.filter((item) => item.date === date)
      .sort((a, b) => `${a.hospital}-${a.unit}-${a.role}`.localeCompare(`${b.hospital}-${b.unit}-${b.role}`));

    return json({ answer: buildAnswer(question, rows, resident, date), assignments: rows, date });
  } catch (error) {
    console.error(error);
    return json(
      { error: error instanceof Error ? error.message : "Unable to read duty schedule" },
      500,
    );
  }
});
