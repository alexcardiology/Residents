import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const BOT_VERSION = "public-1";
const TIME_ZONE = "Africa/Cairo";
const AIRTABLE_BASE_ID = "appSmzqYTynjlWK9B";
const ASSIGNMENTS_TABLE = "Bot_Assignments";
const RESIDENTS_TABLE = "Residents";
const GOOGLE_SHEET_ID = Deno.env.get("GOOGLE_DUTY_SHEET_ID") || "185wfhkbv3s7M5gj7J04-zb_6UhCgK1pA1qjN7O9dLBY";
const GOOGLE_SHEET_GID = Deno.env.get("GOOGLE_DUTY_SHEET_GID") || "569773954";
const GOOGLE_SHEET_FALLBACK_YEAR = Number(Deno.env.get("GOOGLE_DUTY_SHEET_YEAR") || "2026");
const CACHE_TTL_MS = 60_000;

const ASSIGNMENT_FIELDS = {
  date: "fldsFcDWIndwQT3K7",
  day: "fld6ANwcExjbSb9Gw",
  hospital: "fldf6vANi872nnW67",
  unit: "fldN25AS27vsEWxlc",
  role: "fldIWLIHk992PgDPo",
  resident: "fldzhlyO2BfDmNzTR",
  status: "fld3RwwBVIouuer72",
  source: "fldazKpMhJppT0wYR",
} as const;

const RESIDENT_FIELDS = {
  scheduleName: "fldK0N06gZTn5p89V",
  fullName: "fldNVMdQpXsm9POV9",
  aliases: "fldxBP7Z38Kpzb7wf",
} as const;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization,x-client-info,apikey,content-type",
};

const json = (payload: unknown, status = 200) =>
  new Response(JSON.stringify(payload && typeof payload === "object" ? { ...(payload as Record<string, unknown>), version: BOT_VERSION } : payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

type AirtableRecord = { id: string; fields: Record<string, unknown> };
type Assignment = {
  id: string;
  date: string;
  day: string;
  hospital: string;
  unit: string;
  role: string;
  service: string;
  resident: string;
  status: string;
  source: string;
  scheduleType: "on_call" | "daytime";
};
type ResidentAlias = { scheduleName: string; fullName: string; aliases: string[] };

type CacheData = {
  expiresAt: number;
  assignments: Assignment[];
  residents: ResidentAlias[];
  warnings: string[];
};

let cache: CacheData | null = null;

const westernDigits = (value: string) => String(value || "")
  .replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)))
  .replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)));

const normalize = (value: unknown) => westernDigits(String(value || ""))
  .toLowerCase()
  .normalize("NFD")
  .replace(/[\u0300-\u036f\u064b-\u065f\u0670]/g, "")
  .replace(/[أإآ]/g, "ا")
  .replace(/ى/g, "ي")
  .replace(/ة/g, "ه")
  .replace(/ؤ/g, "و")
  .replace(/ئ/g, "ي")
  .replace(/[؟،؛]/g, " ")
  .replace(/[^a-z0-9\u0600-\u06ff/\-\s]/g, " ")
  .replace(/\s+/g, " ")
  .trim();

const words = (value: string) => normalize(value).split(/\s+/).filter(Boolean);

function editDistance(left: string, right: string) {
  const a = Array.from(left);
  const b = Array.from(right);
  const previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let row = 1; row <= a.length; row += 1) {
    const current = [row];
    for (let column = 1; column <= b.length; column += 1) {
      current[column] = Math.min(
        current[column - 1] + 1,
        previous[column] + 1,
        previous[column - 1] + (a[row - 1] === b[column - 1] ? 0 : 1),
      );
    }
    previous.splice(0, previous.length, ...current);
  }
  return previous[b.length];
}

function typoBudget(value: string) {
  const length = Array.from(value).length;
  if (length <= 2) return 0;
  if (length <= 5) return 1;
  return 2;
}

function typoTokenMatches(input: string, expected: string) {
  if (input === expected) return true;
  const inputArabic = /[\u0600-\u06ff]/.test(input);
  const expectedArabic = /[\u0600-\u06ff]/.test(expected);
  if (inputArabic !== expectedArabic) return false;
  return editDistance(input, expected) <= typoBudget(expected);
}

function phraseMatches(question: string, value: string) {
  const expected = normalize(value);
  if (!expected) return false;
  if ((` ${question} `).includes(` ${expected} `)) return true;
  const qWords = words(question);
  const eWords = words(expected);
  if (!eWords.length || eWords.length > qWords.length) return false;
  for (let index = 0; index <= qWords.length - eWords.length; index += 1) {
    if (eWords.every((token, offset) => typoTokenMatches(qWords[index + offset], token))) return true;
  }
  return false;
}

const includesAny = (question: string, values: string[]) => values.some((value) => phraseMatches(question, value));

const selectName = (value: unknown): string => {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return selectName(value[0]);
  if (value && typeof value === "object" && "name" in value) return String((value as { name?: unknown }).name || "");
  return "";
};

const splitAliases = (value: unknown) => String(value || "")
  .split(/[,;|\n]+/)
  .map((item) => item.trim())
  .filter(Boolean);

const recordField = (record: AirtableRecord, name: string, fieldId: string) => record.fields[fieldId] ?? record.fields[name];

function canonicalHospital(value: unknown) {
  const raw = selectName(value).trim();
  const name = normalize(raw);
  if (includesAny(name, ["miri", "mery", "el miri", "الميري", "ميري", "ميرى"])) return "Miri";
  if (includesAny(name, ["smouha", "سموحه", "سموحة"])) return "Smouha";
  if (includesAny(name, ["nariman", "ناريمان"])) return "Nariman";
  if (includesAny(name, ["borg el arab", "borg elarab", "برج العرب"])) return "Borg El Arab";
  return raw;
}

function canonicalUnit(value: unknown) {
  const raw = selectName(value).trim();
  const name = normalize(raw);
  if (name === "er" || includesAny(name, ["emergency", "طوارئ", "طواري"])) return "ER";
  if (name === "ccu" || includesAny(name, ["عنايه", "عناية"])) return "CCU";
  if (includesAny(name, ["angina", "ذبحه", "ذبحة"])) return "Angina Unit";
  if (includesAny(name, ["senior", "سينيور"])) return "Senior";
  return raw;
}

async function airtableRecords(table: string) {
  const token = Deno.env.get("AIRTABLE_TOKEN");
  if (!token) throw new Error("AIRTABLE_TOKEN is not configured");
  const records: AirtableRecord[] = [];
  let offset = "";
  do {
    const url = new URL(`https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(table)}`);
    url.searchParams.set("pageSize", "100");
    url.searchParams.set("returnFieldsByFieldId", "true");
    if (offset) url.searchParams.set("offset", offset);
    const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!response.ok) throw new Error(`Airtable request failed (${response.status})`);
    const page = await response.json();
    records.push(...(page.records || []));
    offset = String(page.offset || "");
  } while (offset);
  return records;
}

function airtableAssignments(records: AirtableRecord[]) {
  return records.map((record): Assignment => {
    const hospital = canonicalHospital(recordField(record, "Hospital", ASSIGNMENT_FIELDS.hospital));
    const unit = canonicalUnit(recordField(record, "Unit", ASSIGNMENT_FIELDS.unit));
    const role = selectName(recordField(record, "Role / Group", ASSIGNMENT_FIELDS.role));
    return {
      id: record.id,
      date: String(recordField(record, "Date", ASSIGNMENT_FIELDS.date) || "").slice(0, 10),
      day: selectName(recordField(record, "Day", ASSIGNMENT_FIELDS.day)),
      hospital,
      unit,
      role,
      service: [hospital, unit, role].filter(Boolean).join(" · "),
      resident: selectName(recordField(record, "Resident schedule name", ASSIGNMENT_FIELDS.resident)),
      status: selectName(recordField(record, "Status", ASSIGNMENT_FIELDS.status)),
      source: selectName(recordField(record, "Source", ASSIGNMENT_FIELDS.source)) || "Approved 24-hour duty schedule",
      scheduleType: "on_call",
    };
  }).filter((item) => item.date && item.resident && normalize(item.status) === "approved");
}

function airtableResidents(records: AirtableRecord[]) {
  return records.map((record): ResidentAlias => {
    const scheduleName = String(recordField(record, "Schedule name", RESIDENT_FIELDS.scheduleName) || "").trim();
    const fullName = String(recordField(record, "Full resident name", RESIDENT_FIELDS.fullName) || "").trim();
    return {
      scheduleName,
      fullName,
      aliases: [scheduleName, fullName, ...splitAliases(recordField(record, "Other aliases / nicknames", RESIDENT_FIELDS.aliases))].filter(Boolean),
    };
  }).filter((item) => item.scheduleName);
}

function parseCsv(text: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (quoted) {
      if (character === '"' && text[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else if (character === '"') quoted = false;
      else cell += character;
      continue;
    }
    if (character === '"') quoted = true;
    else if (character === ",") {
      row.push(cell);
      cell = "";
    } else if (character === "\n") {
      row.push(cell.replace(/\r$/, ""));
      rows.push(row);
      row = [];
      cell = "";
    } else cell += character;
  }
  if (cell || row.length) {
    row.push(cell.replace(/\r$/, ""));
    rows.push(row);
  }
  return rows;
}

const MONTHS: Record<string, number> = {
  jan: 1, january: 1, يناير: 1,
  feb: 2, february: 2, فبراير: 2,
  mar: 3, march: 3, مارس: 3,
  apr: 4, april: 4, ابريل: 4,
  may: 5, مايو: 5,
  jun: 6, june: 6, يونيو: 6,
  jul: 7, july: 7, يوليو: 7,
  aug: 8, august: 8, اغسطس: 8,
  sep: 9, sept: 9, september: 9, سبتمبر: 9,
  oct: 10, october: 10, اكتوبر: 10,
  nov: 11, november: 11, نوفمبر: 11,
  dec: 12, december: 12, ديسمبر: 12,
};

function isoDate(year: number, month: number, day: number) {
  const date = new Date(Date.UTC(year, month - 1, day, 12));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return "";
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function parseSheetDate(value: string, year: number) {
  const match = normalize(value).match(/^(\d{1,2})\s+([a-z\u0600-\u06ff]+)(?:\s+(20\d{2}))?$/);
  if (!match) return "";
  const month = MONTHS[match[2]];
  return month ? isoDate(Number(match[3] || year), month, Number(match[1])) : "";
}

function cleanServiceName(primary: string, secondary: string) {
  return String(primary || secondary || "").trim()
    .replace(/^Mery\b/i, "Miri")
    .replace(/^Dep\.\s*/i, "Department ")
    .replace(/\bholter\b/i, "Holter")
    .replace(/\s+/g, " ");
}

function inferSheetHospital(service: string) {
  const value = normalize(service);
  if (value.includes("miri") || value.includes("mery")) return "Miri";
  if (value.includes("smouha")) return "Smouha";
  if (value.includes("nariman")) return "Nariman";
  if (value.includes("borg")) return "Borg El Arab";
  return "Cardiology Department";
}

function inferSheetUnit(service: string) {
  const value = normalize(service);
  if (value.includes("ward")) return "Ward";
  if (value.includes("cath")) return "Cath Lab";
  if (value.includes("echo") && value.includes("clinic")) return "Echo / Clinic";
  if (value.includes("echo")) return "Echo";
  if (value.includes("clinic")) return "Clinic";
  if (/\bep\b/.test(value)) return "EP";
  if (value.includes("stress") || value.includes("holter")) return "Diagnostics";
  return "Day service";
}

async function googleSheetAssignments() {
  const url = new URL(`https://docs.google.com/spreadsheets/d/${GOOGLE_SHEET_ID}/export`);
  url.searchParams.set("format", "csv");
  url.searchParams.set("gid", GOOGLE_SHEET_GID);
  const response = await fetch(url, { headers: { Accept: "text/csv" } });
  if (!response.ok) throw new Error(`Google Sheet request failed (${response.status})`);
  const disposition = response.headers.get("content-disposition") || "";
  const year = Number(disposition.match(/20\d{2}/)?.[0]) || GOOGLE_SHEET_FALLBACK_YEAR;
  const rows = parseCsv(await response.text());
  if (rows.length < 3) throw new Error("Google Sheet does not contain schedule rows");
  const primaryHeaders = rows[0] || [];
  const secondaryHeaders = rows[1] || [];
  const assignments: Assignment[] = [];

  rows.slice(2).forEach((row, rowIndex) => {
    const date = parseSheetDate(row[0] || "", year);
    if (!date) return;
    const day = String(row[1] || "").trim();
    for (let column = 2; column < row.length; column += 1) {
      const residentCell = String(row[column] || "").trim();
      const service = cleanServiceName(primaryHeaders[column] || "", secondaryHeaders[column] || "");
      if (!residentCell || !service || /^Column\s+\d+$/i.test(service)) continue;
      residentCell.split(/[\n,;&]+/).map((name) => name.trim()).filter(Boolean).forEach((resident, residentIndex) => {
        assignments.push({
          id: `google:${date}:${rowIndex}:${column}:${residentIndex}`,
          date,
          day,
          hospital: inferSheetHospital(service),
          unit: inferSheetUnit(service),
          role: service,
          service,
          resident,
          status: "Approved",
          source: "Approved daytime schedule",
          scheduleType: "daytime",
        });
      });
    }
  });
  return assignments;
}

async function scheduleData(): Promise<CacheData> {
  if (cache && cache.expiresAt > Date.now()) return cache;
  const [assignmentResult, residentResult, daytimeResult] = await Promise.allSettled([
    airtableRecords(ASSIGNMENTS_TABLE),
    airtableRecords(RESIDENTS_TABLE),
    googleSheetAssignments(),
  ]);

  const warnings: string[] = [];
  const onCall = assignmentResult.status === "fulfilled" ? airtableAssignments(assignmentResult.value) : [];
  const daytime = daytimeResult.status === "fulfilled" ? daytimeResult.value : [];
  if (!onCall.length) warnings.push("The 24-hour duty schedule could not be loaded.");
  if (!daytime.length) warnings.push("The daytime schedule could not be loaded.");
  if (!onCall.length && !daytime.length) throw new Error("No approved schedule source is currently available");

  const residents = residentResult.status === "fulfilled" ? airtableResidents(residentResult.value) : [];
  const known = new Set(residents.map((resident) => normalize(resident.scheduleName)));
  [...onCall, ...daytime].forEach((assignment) => {
    const key = normalize(assignment.resident);
    if (!key || known.has(key)) return;
    known.add(key);
    residents.push({ scheduleName: assignment.resident, fullName: "", aliases: [assignment.resident] });
  });

  cache = { expiresAt: Date.now() + CACHE_TTL_MS, assignments: [...onCall, ...daytime], residents, warnings };
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
  return { date: `${values.year}-${values.month}-${values.day}`, hour: Number(values.hour) };
}

function addDays(dateValue: string, amount: number) {
  const date = new Date(`${dateValue}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
}

const WEEKDAYS: Array<{ day: number; aliases: string[] }> = [
  { day: 0, aliases: ["sunday", "sun", "الاحد"] },
  { day: 1, aliases: ["monday", "mon", "الاثنين"] },
  { day: 2, aliases: ["tuesday", "tue", "الثلاثاء"] },
  { day: 3, aliases: ["wednesday", "wed", "الاربعاء"] },
  { day: 4, aliases: ["thursday", "thu", "الخميس"] },
  { day: 5, aliases: ["friday", "fri", "الجمعه", "الجمعة"] },
  { day: 6, aliases: ["saturday", "sat", "السبت"] },
];

function explicitDate(question: string, currentDate: string) {
  const iso = question.match(/\b(20\d{2})[-/](\d{1,2})[-/](\d{1,2})\b/);
  if (iso) return isoDate(Number(iso[1]), Number(iso[2]), Number(iso[3]));
  const dayFirst = question.match(/\b(\d{1,2})[/-](\d{1,2})(?:[/-](20\d{2}))?\b/);
  if (dayFirst) return isoDate(Number(dayFirst[3] || currentDate.slice(0, 4)), Number(dayFirst[2]), Number(dayFirst[1]));
  const currentMonthDay = question.match(/(?:^|\s)(?:يوم|day)\s+(\d{1,2})(?=$|\s)/);
  if (currentMonthDay) {
    const [year, month] = currentDate.split("-").map(Number);
    return isoDate(year, month, Number(currentMonthDay[1]));
  }
  return "";
}

function weekdayDate(question: string, currentDate: string) {
  const weekday = WEEKDAYS.find((item) => item.aliases.some((alias) => phraseMatches(question, alias)));
  if (!weekday) return "";
  const currentDay = new Date(`${currentDate}T12:00:00Z`).getUTCDay();
  const isPrevious = includesAny(question, ["last", "previous", "الماضي", "السابق", "اللي فات"]);
  const isNext = includesAny(question, ["next", "coming", "الجاي", "القادم"]);
  if (isPrevious) return addDays(currentDate, -(((currentDay - weekday.day + 7) % 7) || 7));
  let distance = (weekday.day - currentDay + 7) % 7;
  if (isNext && distance === 0) distance = 7;
  return addDays(currentDate, distance);
}

function targetDate(question: string, preferActiveDuty = false) {
  const current = cairoParts();
  const stated = explicitDate(question, current.date);
  if (stated) return stated;
  if (includesAny(question, ["tomorrow", "tmr", "بكره", "بكرة", "غدا"])) return addDays(current.date, 1);
  if (includesAny(question, ["yesterday", "امس", "أمس", "امبارح"])) return addDays(current.date, -1);
  const weekday = weekdayDate(question, current.date);
  if (weekday) return weekday;
  return preferActiveDuty && current.hour < 8 ? addDays(current.date, -1) : current.date;
}

function endOfMonthRange(question: string) {
  if (!includesAny(question, ["until end of month", "through end of month", "rest of this month", "لنهايه الشهر", "لنهاية الشهر", "لحد نهايه الشهر", "لحد نهاية الشهر", "باقي الشهر", "لاخر الشهر", "لآخر الشهر"])) return null;
  const currentDate = cairoParts().date;
  const [year, month] = currentDate.split("-").map(Number);
  const last = new Date(Date.UTC(year, month, 0, 12)).toISOString().slice(0, 10);
  return { start: currentDate, end: last };
}

const ON_CALL_TERMS = [
  "on call", "duty", "night duty", "نوبتجيه", "نوبتجية", "نوباتجي", "نوباتجى", "مناوبه", "مناوبة", "نبطشي", "نوبتشي", "نباطشي", "نباطشى",
];
const DAYTIME_TERMS = ["daytime", "rotation", "morning assignment", "توزيع", "العمل الصباحي"];

function requestedHospital(question: string) {
  if (includesAny(question, ["miri", "mery", "el miri", "الميري", "ميري", "ميرى"])) return "Miri";
  if (includesAny(question, ["smouha", "سموحة", "سموحه"])) return "Smouha";
  if (includesAny(question, ["nariman", "ناريمان"])) return "Nariman";
  if (includesAny(question, ["borg el arab", "borg elarab", "برج العرب"])) return "Borg El Arab";
  return "";
}

function requestedUnit(question: string) {
  if (/\ber\b/.test(question) || includesAny(question, ["emergency", "طوارئ", "الطوارئ"])) return "ER";
  if (includesAny(question, ["ccu", "عناية", "عنايه", "العناية"])) return "CCU";
  if (includesAny(question, ["angina", "ذبحة", "ذبحه", "الذبحة"])) return "Angina Unit";
  if (includesAny(question, ["senior", "سينيور"])) return "Senior";
  if (includesAny(question, ["cath", "catheter", "قسطرة", "القسطرة"])) return "Cath Lab";
  if (includesAny(question, ["ward", "round", "عنبر", "مرور"])) return "Ward";
  if (includesAny(question, ["echo", "ايكو", "إيكو", "الايكو"])) return "Echo";
  if (includesAny(question, ["clinic", "عيادة", "عياده", "العيادة"])) return "Clinic";
  if (/\bep\b/.test(question) || includesAny(question, ["electrophysiology", "كهرباء القلب"])) return "EP";
  if (includesAny(question, ["stress", "holter", "هولتر", "مجهود"])) return "Diagnostics";
  return "";
}

function requestedRoleParts(question: string, unit: string) {
  const parts: string[] = [];
  const serviceNumber = question.match(/(?:cath|echo|clinic|ward|قسطرة|ايكو|عياده|عيادة|عنبر)\s*(?:lab\s*)?([1-5])\b/);
  if (serviceNumber && ["Cath Lab", "Echo", "Clinic", "Ward"].includes(unit)) parts.push(serviceNumber[1]);
  if (includesAny(question, ["male", "men", "رجال", "ذكور"])) parts.push("male");
  if (includesAny(question, ["female", "women", "حريم", "سيدات", "اناث", "إناث"])) parts.push("female");
  if (includesAny(question, ["pregnancy", "حمل", "الحوامل"])) parts.push("pregnancy");
  return parts;
}

function matchesUnit(item: Assignment, unit: string) {
  if (!unit || item.unit === unit) return true;
  const service = normalize(`${item.unit} ${item.service}`);
  const tokens: Record<string, string[]> = {
    "Cath Lab": ["cath", "قسطرة"],
    Ward: ["ward", "عنبر"],
    Echo: ["echo", "ايكو"],
    Clinic: ["clinic", "عياده", "عيادة"],
    EP: ["ep"],
    Diagnostics: ["stress", "holter"],
  };
  return (tokens[unit] || [unit]).some((token) => service.includes(normalize(token)));
}

function matchesRole(item: Assignment, parts: string[]) {
  if (!parts.length) return true;
  const service = normalize(`${item.role} ${item.service}`);
  const translated: Record<string, string[]> = {
    male: ["male", "رجال"],
    female: ["female", "سيدات", "حريم", "اناث"],
    pregnancy: ["pregnancy", "حمل"],
  };
  return parts.every((part) => (translated[part] || [part]).some((candidate) => service.includes(normalize(candidate))));
}

function findResident(question: string, residents: ResidentAlias[]) {
  const candidates = residents.flatMap((resident) => resident.aliases.map((alias) => ({ resident, alias: normalize(alias) })))
    .filter((item) => item.alias.length >= 2)
    .sort((a, b) => b.alias.length - a.alias.length);

  const exact = candidates.find(({ alias }) => alias.length > 3 ? question.includes(alias) : (` ${question} `).includes(` ${alias} `))?.resident;
  if (exact) return exact;

  const qWords = words(question);
  const matches: Array<{ resident: ResidentAlias; score: number }> = [];
  candidates.forEach(({ resident, alias }) => {
    const aWords = words(alias);
    if (!aWords.length || aWords.length > qWords.length) return;
    for (let index = 0; index <= qWords.length - aWords.length; index += 1) {
      const distances = aWords.map((expected, offset) => editDistance(qWords[index + offset], expected));
      if (!distances.every((distance, offset) => distance <= typoBudget(aWords[offset]))) continue;
      matches.push({ resident, score: distances.reduce((sum, distance) => sum + distance, 0) });
    }
  });
  matches.sort((a, b) => a.score - b.score);
  if (!matches.length) return null;
  const best = matches[0];
  const tied = matches.some((item, index) => index > 0 && item.score === best.score && item.resident.scheduleName !== best.resident.scheduleName);
  return tied ? null : best.resident;
}

function looksLikeResidentLookup(question: string) {
  return includesAny(question, ["where is", "schedule for", "schedule of", "duty for", "assignment for", "فين", "اين", "مكان", "جدول", "توزيع"]);
}

function formatDate(date: string) {
  const match = String(date || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return match ? `${match[3]}-${match[2]}-${match[1]}` : date;
}

function arabicPlace(item: Assignment) {
  if (item.scheduleType === "daytime") return item.service;
  const hospital = item.hospital === "Miri" ? "الميري" : item.hospital === "Smouha" ? "سموحة" : item.hospital;
  const unit = item.unit === "CCU" ? "العناية" : item.unit === "ER" ? "الطوارئ" : item.unit === "Angina Unit" ? "وحدة الذبحة" : item.unit === "Senior" ? "السينيور" : item.unit;
  const subgroup = item.role && !["CCU duty", "ER duty", "Angina Unit duty", "Senior coverage"].includes(item.role) ? ` · ${item.role}` : "";
  return `${unit} – ${hospital}${subgroup}`;
}

function englishPlace(item: Assignment) {
  if (item.scheduleType === "daytime") return item.service;
  const subgroup = item.role && !["CCU duty", "ER duty", "Angina Unit duty", "Senior coverage"].includes(item.role) ? ` · ${item.role}` : "";
  return `${item.hospital} ${item.unit}${subgroup}`;
}

function buildAnswer(question: string, rows: Assignment[], resident: ResidentAlias | null, dateLabel: string) {
  const isArabic = /[\u0600-\u06ff]/.test(question);
  if (!rows.length) {
    return isArabic
      ? `لا يوجد توزيع أو نوبتجية معتمدة مطابقة للسؤال بتاريخ ${dateLabel}.`
      : `No approved assignment or duty matched your question for ${dateLabel}.`;
  }

  const multipleDates = rows.some((item) => item.date !== rows[0].date);
  const suffix = (row: Assignment) => `${row.scheduleType === "on_call" ? (isArabic ? " — نوبتجية 24 ساعة" : " — 24-hour duty") : ""}${multipleDates ? ` · ${formatDate(row.date)}` : ""}`;
  let answer = "";

  if (resident) {
    const displayName = resident.fullName || resident.scheduleName;
    const lines = rows.map((row) => `• ${isArabic ? arabicPlace(row) : englishPlace(row)}${suffix(row)}`).join("\n");
    answer = isArabic
      ? `جدول د. ${displayName} بتاريخ ${dateLabel}:\n${lines}`
      : `Dr ${displayName} on ${dateLabel}:\n${lines}`;
  } else {
    const lines = rows.map((row) => `• ${isArabic ? "د. " : "Dr "}${row.resident} — ${isArabic ? arabicPlace(row) : englishPlace(row)}${suffix(row)}`).join("\n");
    answer = isArabic
      ? `الجدول بتاريخ ${dateLabel}:\n${lines}`
      : `Schedule for ${dateLabel}:\n${lines}`;
  }

  if (rows.some((item) => item.scheduleType === "on_call")) {
    answer += isArabic
      ? "\nالنوبتجية 24 ساعة: من 8 صباحًا حتى 8 صباحًا في اليوم التالي."
      : "\n24-hour duty: 8:00 AM until 8:00 AM the following day.";
  }
  return answer;
}

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "POST requests only" }, 405);

  try {
    const body = await request.json();
    const question = String(body?.question || "").trim();
    if (question.length < 2 || question.length > 300) return json({ error: "Enter a question between 2 and 300 characters" }, 400);

    const normalizedQuestion = normalize(question);
    const data = await scheduleData();
    const hospital = requestedHospital(normalizedQuestion);
    const unit = requestedUnit(normalizedQuestion);
    const serviceLookup = includesAny(normalizedQuestion, ["who", "مين"]) && Boolean(hospital || unit);
    const resident = serviceLookup ? null : findResident(normalizedQuestion, data.residents);
    const asksOnCall = includesAny(normalizedQuestion, ON_CALL_TERMS) || ["CCU", "ER", "Angina Unit", "Senior"].includes(unit);
    const asksDaytime = includesAny(normalizedQuestion, DAYTIME_TERMS) || ["Cath Lab", "Ward", "Echo", "Clinic", "EP", "Diagnostics"].includes(unit);
    const range = endOfMonthRange(normalizedQuestion);
    const date = range?.start || targetDate(normalizedQuestion, asksOnCall);
    const roleParts = requestedRoleParts(normalizedQuestion, unit);

    if (!resident && !serviceLookup && looksLikeResidentLookup(normalizedQuestion) && !hospital && !unit && !includesAny(normalizedQuestion, ["today", "tomorrow", "yesterday", "النهارده", "اليوم", "بكره", "امبارح"])) {
      const isArabic = /[\u0600-\u06ff]/.test(question);
      return json({
        answer: isArabic
          ? "تأكد من اسم الطبيب المقيم ثم حاول مرة أخرى."
          : "Please check the resident name and try again.",
        assignments: [],
        date,
      });
    }

    let rows = data.assignments.filter((item) => {
      if (resident && normalize(item.resident) !== normalize(resident.scheduleName)) return false;
      if (hospital && normalize(item.hospital) !== normalize(hospital)) return false;
      if (!matchesUnit(item, unit) || !matchesRole(item, roleParts)) return false;
      if (asksOnCall && !asksDaytime && item.scheduleType !== "on_call") return false;
      if (asksDaytime && !asksOnCall && item.scheduleType !== "daytime") return false;
      return true;
    });

    if (range) {
      rows = rows.filter((item) => item.date >= range.start && item.date <= range.end)
        .sort((a, b) => `${a.date}-${a.scheduleType}-${a.service}`.localeCompare(`${b.date}-${b.scheduleType}-${b.service}`));
      const dateLabel = `${formatDate(range.start)} → ${formatDate(range.end)}`;
      return json({ answer: buildAnswer(question, rows, resident, dateLabel), assignments: rows, date: range.start, period: range, warnings: data.warnings });
    }

    rows = rows.filter((item) => item.date === date)
      .sort((a, b) => `${a.scheduleType}-${a.hospital}-${a.unit}-${a.role}`.localeCompare(`${b.scheduleType}-${b.hospital}-${b.unit}-${b.role}`));

    return json({
      answer: buildAnswer(question, rows, resident, formatDate(date)),
      assignments: rows,
      date,
      warnings: data.warnings,
    });
  } catch (error) {
    console.error(error);
    return json({ error: error instanceof Error ? error.message : "Unable to read duty schedule" }, 500);
  }
});
