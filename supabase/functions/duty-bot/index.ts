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

const TIME_ZONE = "Africa/Cairo";
const AIRTABLE_BASE_ID = Deno.env.get("AIRTABLE_BASE_ID") || "appSmzqYTynjlWK9B";
const ASSIGNMENTS_TABLE = "Bot_Assignments";
const RESIDENTS_TABLE = "Residents";
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
const GOOGLE_SHEET_ID = Deno.env.get("GOOGLE_DUTY_SHEET_ID") || "185wfhkbv3s7M5gj7J04-zb_6UhCgK1pA1qjN7O9dLBY";
const GOOGLE_SHEET_GID = Deno.env.get("GOOGLE_DUTY_SHEET_GID") || "569773954";
const GOOGLE_SHEET_FALLBACK_YEAR = Number(Deno.env.get("GOOGLE_DUTY_SHEET_YEAR") || "2026");
const CACHE_TTL_MS = 60_000;

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
  shift: string;
};
type ResidentAlias = { scheduleName: string; fullName: string; aliases: string[] };

let cache: {
  expiresAt: number;
  assignments: Assignment[];
  residents: ResidentAlias[];
  warnings: string[];
  onCallAvailable: boolean;
  daytimeAvailable: boolean;
} | null = null;

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
function typoBudget(value: string, allowShort = true) {
  const length = Array.from(value).length;
  if (length <= 2) return 0;
  if (length === 3) return allowShort ? 1 : 0;
  return length >= 7 ? 2 : 1;
}
function sameWritingSystem(left: string, right: string) {
  return /[\u0600-\u06ff]/.test(left) === /[\u0600-\u06ff]/.test(right);
}
function typoTokenMatches(input: string, expected: string, allowShort = true) {
  if (input === expected) return true;
  if (!sameWritingSystem(input, expected)) return false;
  return editDistance(input, expected) <= typoBudget(expected, allowShort);
}
function phraseMatches(question: string, value: string) {
  const normalizedValue = normalize(value);
  if (!normalizedValue) return false;
  if ((` ${question} `).includes(` ${normalizedValue} `)) return true;
  const questionWords = words(question);
  const valueWords = words(normalizedValue);
  if (!valueWords.length || valueWords.length > questionWords.length) return false;
  for (let index = 0; index <= questionWords.length - valueWords.length; index += 1) {
    if (valueWords.every((expected, offset) => typoTokenMatches(questionWords[index + offset], expected))) return true;
  }
  return false;
}
const selectName = (value: unknown) => {
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && "name" in value) {
    return String((value as { name?: unknown }).name || "");
  }
  return "";
};
const splitAliases = (value: unknown) =>
  String(value || "").split(/[,;|\n]+/).map((item) => item.trim()).filter(Boolean);
const recordField = (record: AirtableRecord, name: string, fieldId: string) =>
  record.fields[fieldId] ?? record.fields[name];

const pause = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds));
async function airtablePage(url: URL, token: string) {
  let lastError: Error | null = null;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (response.ok) return response.json();
      const message = `Airtable request failed (${response.status}): ${await response.text()}`;
      if (attempt === 0 && (response.status === 429 || response.status >= 500)) {
        lastError = new Error(message);
        await pause(200);
        continue;
      }
      throw new Error(message);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (attempt === 0) {
        await pause(200);
        continue;
      }
    }
  }
  throw lastError || new Error("Airtable request failed");
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
    const page = await airtablePage(url, token);
    records.push(...(page.records || []));
    offset = String(page.offset || "");
  } while (offset);
  return records;
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
          source: "Google Sheet · daytime schedule",
          scheduleType: "daytime",
          shift: "Day assignment · time not specified",
        });
      });
    }
  });
  return assignments;
}

function airtableAssignments(records: AirtableRecord[]) {
  return records.map((record): Assignment => {
    const hospital = selectName(recordField(record, "Hospital", ASSIGNMENT_FIELDS.hospital));
    const unit = selectName(recordField(record, "Unit", ASSIGNMENT_FIELDS.unit));
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
      source: selectName(recordField(record, "Source", ASSIGNMENT_FIELDS.source)) || "Airtable · 24-hour duty",
      scheduleType: "on_call",
      shift: "08:00 → 08:00 next day",
    };
  }).filter((item) => item.date && item.resident && item.status === "Approved");
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
async function scheduleData() {
  if (cache && cache.expiresAt > Date.now()) return cache;
  const [assignmentResult, residentResult, googleResult] = await Promise.allSettled([
    airtableRecords(ASSIGNMENTS_TABLE),
    airtableRecords(RESIDENTS_TABLE),
    googleSheetAssignments(),
  ]);
  const warnings: string[] = [];
  const onCallAssignments = assignmentResult.status === "fulfilled" ? airtableAssignments(assignmentResult.value) : [];
  const daytimeAssignments = googleResult.status === "fulfilled" ? googleResult.value : [];
  const onCallAvailable = assignmentResult.status === "fulfilled" && onCallAssignments.length > 0;
  const daytimeAvailable = googleResult.status === "fulfilled" && daytimeAssignments.length > 0;
  const assignments = [
    ...onCallAssignments,
    ...daytimeAssignments,
  ];
  if (!onCallAvailable) warnings.push("The 24-hour duty schedule could not be loaded.");
  if (!daytimeAvailable) warnings.push("The daytime Google schedule could not be loaded.");
  if (!assignments.length) throw new Error("No schedule source is currently available");
  const residents = residentResult.status === "fulfilled" ? airtableResidents(residentResult.value) : [];
  const knownNames = new Set(residents.map((item) => normalize(item.scheduleName)));
  assignments.forEach((assignment) => {
    const name = assignment.resident.trim();
    if (!name || knownNames.has(normalize(name))) return;
    knownNames.add(normalize(name));
    residents.push({ scheduleName: name, fullName: "", aliases: [name] });
  });
  cache = { expiresAt: Date.now() + CACHE_TTL_MS, assignments, residents, warnings, onCallAvailable, daytimeAvailable };
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
const MONTH_PATTERN = Object.keys(MONTHS).sort((a, b) => b.length - a.length).join("|");
function explicitDate(question: string) {
  const iso = question.match(/\b(20\d{2})[-/](\d{1,2})[-/](\d{1,2})\b/);
  if (iso) return isoDate(Number(iso[1]), Number(iso[2]), Number(iso[3]));
  const dayFirst = question.match(/\b(\d{1,2})[/-](\d{1,2})(?:[/-](20\d{2}))?\b/);
  if (dayFirst) return isoDate(Number(dayFirst[3] || cairoParts().date.slice(0, 4)), Number(dayFirst[2]), Number(dayFirst[1]));
  const dayMonth = question.match(new RegExp(`(?:^|\\s)(\\d{1,2})\\s+(${MONTH_PATTERN})(?:\\s+(20\\d{2}))?(?:$|\\s)`));
  if (dayMonth) return isoDate(Number(dayMonth[3] || cairoParts().date.slice(0, 4)), MONTHS[dayMonth[2]], Number(dayMonth[1]));
  const monthDay = question.match(new RegExp(`(?:^|\\s)(${MONTH_PATTERN})\\s+(\\d{1,2})(?:\\s+(20\\d{2}))?(?:$|\\s)`));
  if (monthDay) return isoDate(Number(monthDay[3] || cairoParts().date.slice(0, 4)), MONTHS[monthDay[1]], Number(monthDay[2]));
  const questionWords = words(question);
  for (let index = 0; index < questionWords.length; index += 1) {
    const possibleMonths = [...new Set(Object.entries(MONTHS)
      .filter(([alias]) => typoTokenMatches(questionWords[index], normalize(alias), false))
      .map(([, month]) => month))];
    if (possibleMonths.length !== 1) continue;
    const nearby = [questionWords[index - 1], questionWords[index + 1]].filter((item) => /^\d{1,2}$/.test(item || ""));
    const day = Number(nearby[0] || 0);
    if (!day) continue;
    const year = Number(questionWords.find((item) => /^20\d{2}$/.test(item)) || cairoParts().date.slice(0, 4));
    return isoDate(year, possibleMonths[0], day);
  }
  return "";
}
function currentMonthDate(question: string, currentDate: string) {
  const patterns = [
    /(?:^|\s)يوم\s+(\d{1,2})(?=$|\s)/,
    /(?:^|\s)(\d{1,2})\s+الشهر\s+(?:ده|دا|الحالي)(?=$|\s)/,
    /\bday\s+(\d{1,2})\s+(?:of\s+)?this\s+month\b/,
    /\b(\d{1,2})\s+this\s+month\b/,
  ];
  for (const pattern of patterns) {
    const match = question.match(pattern);
    if (!match) continue;
    const [year, month] = currentDate.split("-").map(Number);
    return isoDate(year, month, Number(match[1]));
  }
  const questionWords = words(question);
  for (let index = 0; index < questionWords.length; index += 1) {
    if (!/^\d{1,2}$/.test(questionWords[index])) continue;
    const precededByDay = ["يوم", "day"].some((value) => typoTokenMatches(questionWords[index - 1] || "", normalize(value)));
    const followedByCurrentMonth = typoTokenMatches(questionWords[index + 1] || "", normalize("الشهر"))
      && ["ده", "دا", "الحالي"].some((value) => typoTokenMatches(questionWords[index + 2] || "", normalize(value)));
    if (!precededByDay && !followedByCurrentMonth) continue;
    const [year, month] = currentDate.split("-").map(Number);
    return isoDate(year, month, Number(questionWords[index]));
  }
  return "";
}
const WEEKDAYS: Array<{ day: number; aliases: string[] }> = [
  { day: 0, aliases: ["sunday", "sun", "الاحد"] },
  { day: 1, aliases: ["monday", "mon", "الاثنين"] },
  { day: 2, aliases: ["tuesday", "tue", "الثلاثاء"] },
  { day: 3, aliases: ["wednesday", "wed", "الاربعاء"] },
  { day: 4, aliases: ["thursday", "thu", "الخميس"] },
  { day: 5, aliases: ["friday", "fri", "الجمعه"] },
  { day: 6, aliases: ["saturday", "sat", "السبت"] },
];
function weekdayDate(question: string, currentDate: string) {
  const weekday = WEEKDAYS.find((item) => item.aliases.some((alias) => phraseMatches(question, alias)));
  if (!weekday) return "";
  const currentDay = new Date(`${currentDate}T12:00:00Z`).getUTCDay();
  const previous = /\b(last|previous)\b|اللي فات|الماضي|السابق/.test(question);
  const coming = /\b(next|coming)\b|الجاي|القادم/.test(question);
  if (previous) return addDays(currentDate, -(((currentDay - weekday.day + 7) % 7) || 7));
  let distance = (weekday.day - currentDay + 7) % 7;
  if (coming && distance === 0) distance = 7;
  return addDays(currentDate, distance);
}
function relativeDayOffset(question: string) {
  if (includesAny(question, ["day after tomorrow", "بعد بكره", "بعد بكرة"])) return 2;
  if (includesAny(question, ["day before yesterday", "اول امبارح", "أول امبارح", "اول امس", "أول أمس"])) return -2;
  if (includesAny(question, ["بعد يومين", "كمان يومين", "in two days"])) return 2;
  if (includesAny(question, ["من يومين", "قبل يومين", "two days ago"])) return -2;

  const futurePatterns = [
    /(?:بعد|كمان)\s+(\d{1,3})\s+(?:يوم|ايام)/,
    /\b(?:in|after)\s+(\d{1,3})\s+days?\b/,
    /\b(\d{1,3})\s+days?\s+(?:from now|later)\b/,
  ];
  for (const pattern of futurePatterns) {
    const match = question.match(pattern);
    if (match) return Math.min(Number(match[1]), 366);
  }

  const pastPatterns = [
    /(?:من|قبل)\s+(\d{1,3})\s+(?:يوم|ايام)/,
    /\b(\d{1,3})\s+days?\s+ago\b/,
    /\bbefore\s+(\d{1,3})\s+days?\b/,
  ];
  for (const pattern of pastPatterns) {
    const match = question.match(pattern);
    if (match) return -Math.min(Number(match[1]), 366);
  }
  const questionWords = words(question);
  for (let index = 0; index < questionWords.length; index += 1) {
    if (!/^\d{1,3}$/.test(questionWords[index])) continue;
    const amount = Math.min(Number(questionWords[index]), 366);
    const direction = questionWords[index - 1] || "";
    const period = questionWords[index + 1] || "";
    if (!["يوم", "ايام", "day", "days"].some((value) => typoTokenMatches(period, normalize(value)))) continue;
    if (["بعد", "كمان", "in", "after"].some((value) => typoTokenMatches(direction, normalize(value)))) return amount;
    if (["من", "قبل", "before"].some((value) => typoTokenMatches(direction, normalize(value)))) return -amount;
  }
  return null;
}
function targetDate(normalizedQuestion: string, preferActiveDuty = false) {
  const current = cairoParts();
  const stated = explicitDate(normalizedQuestion);
  if (stated) return stated;
  const currentMonthDay = currentMonthDate(normalizedQuestion, current.date);
  if (currentMonthDay) return currentMonthDay;
  const relativeOffset = relativeDayOffset(normalizedQuestion);
  if (relativeOffset !== null) return addDays(current.date, relativeOffset);
  if (includesAny(normalizedQuestion, ["tomorrow", "tmr", "بكره", "غدا"])) return addDays(current.date, 1);
  if (includesAny(normalizedQuestion, ["yesterday", "امس", "امبارح"])) return addDays(current.date, -1);
  const weekday = weekdayDate(normalizedQuestion, current.date);
  if (weekday) return weekday;
  return preferActiveDuty && current.hour < 8 ? addDays(current.date, -1) : current.date;
}
function requestedMonthRange(question: string) {
  const previous = includesAny(question, ["last month", "previous month", "الشهر اللي فات", "الشهر الي فات", "الشهر الماضي", "الشهر السابق"]);
  const next = includesAny(question, ["next month", "coming month", "الشهر اللي جاي", "الشهر الي جاي", "الشهر القادم"]);
  const throughEnd = includesAny(question, [
    "until end of month", "until the end of the month", "through end of month", "through the end of the month", "rest of this month",
    "لنهايه الشهر", "لحد نهايه الشهر", "حتي نهايه الشهر", "الي نهايه الشهر", "لاخر الشهر", "لحد اخر الشهر", "باقي الشهر",
  ]);
  if (!previous && !next && !throughEnd) return null;
  const currentDate = cairoParts().date;
  const [year, month] = currentDate.split("-").map(Number);
  if (throughEnd) {
    const last = new Date(Date.UTC(year, month, 0, 12));
    return {
      start: currentDate,
      end: last.toISOString().slice(0, 10),
    };
  }
  const first = new Date(Date.UTC(year, month - 1 + (previous ? -1 : 1), 1, 12));
  const last = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0, 12));
  return {
    start: first.toISOString().slice(0, 10),
    end: last.toISOString().slice(0, 10),
  };
}

const includesAny = (question: string, values: string[]) => values.some((value) => phraseMatches(question, value));
const ON_CALL_TERMS = [
  "on call", "duty", "night duty",
  "نوبتجيه", "نوبتجية", "نوباتجي", "نوباتجى", "نوباتجيه", "نوباتجية", "نوبتاجي", "نوبتاجى",
  "نبطشي", "النوبتشي", "نوبتشي", "نوبتشية", "نباطشي", "نباطشى", "نباطشيه", "نباطشية",
  "نوبطشيه", "نوبطشية", "مناوبه", "مناوبة",
];
function findResident(question: string, residents: ResidentAlias[]) {
  const candidates = residents.flatMap((resident) => resident.aliases.map((alias) => ({ resident, alias: normalize(alias) })))
    .filter((item) => item.alias.length >= 2)
    .sort((a, b) => b.alias.length - a.alias.length);
  const exact = candidates.find(({ alias }) => alias.length > 3 ? question.includes(alias) : (` ${question} `).includes(` ${alias} `))?.resident;
  if (exact) return exact;
  const questionWords = words(question);
  const fuzzyMatches: Array<{ resident: ResidentAlias; score: number }> = [];
  candidates.forEach(({ resident, alias }) => {
    const aliasWords = words(alias);
    if (!aliasWords.length || aliasWords.length > questionWords.length || aliasWords.some((word) => Array.from(word).length <= 3)) return;
    for (let index = 0; index <= questionWords.length - aliasWords.length; index += 1) {
      const distances = aliasWords.map((expected, offset) => editDistance(questionWords[index + offset], expected));
      if (!distances.every((distance, offset) => sameWritingSystem(questionWords[index + offset], aliasWords[offset]) && distance <= typoBudget(aliasWords[offset], false))) continue;
      fuzzyMatches.push({ resident, score: distances.reduce((sum, distance) => sum + distance, 0) });
    }
  });
  fuzzyMatches.sort((a, b) => a.score - b.score);
  if (!fuzzyMatches.length) return null;
  const best = fuzzyMatches[0];
  const equallyCloseOther = fuzzyMatches.some((item, index) => index > 0 && item.score === best.score && item.resident.scheduleName !== best.resident.scheduleName);
  return equallyCloseOther ? null : best.resident;
}
const RESIDENT_LOOKUP_CUES = [
  "where is ", "where s ", "who is ", "schedule for ", "schedule of ", "duty for ", "duties for ", "assignment for ", "assignments for ",
  "فين ", "اين ", "مكان ", "جدول ", "توزيع ", "نوبتجيه ", "نوبتجية ", "مين ",
];
const NON_NAME_WORDS = new Set([
  ...ON_CALL_TERMS,
  "where", "is", "s", "who", "doctor", "dr", "resident", "schedule", "duty", "duties", "assignment", "assignments", "for", "of", "on", "at", "in", "from", "now", "later", "after", "before", "ago", "day", "days", "today", "tomorrow", "tmr", "yesterday", "this", "next", "last", "previous", "coming", "show", "me", "was", "were", "will", "be", "month", "current",
  "january", "jan", "february", "feb", "march", "mar", "april", "apr", "may", "june", "jun", "july", "jul", "august", "aug", "september", "sep", "sept", "october", "oct", "november", "nov", "december", "dec", "sunday", "sun", "monday", "mon", "tuesday", "tue", "wednesday", "wed", "thursday", "thu", "friday", "fri", "saturday", "sat",
  "miri", "mery", "el", "smouha", "nariman", "borg", "arab", "er", "emergency", "ccu", "angina", "unit", "senior", "cath", "catheter", "lab", "ward", "round", "echo", "clinic", "ep", "electrophysiology", "stress", "holter", "male", "female", "women", "men", "pregnancy", "rotation", "daytime", "night", "coverage",
  "فين", "اين", "مين", "مكان", "جدول", "توزيع", "دكتور", "الدكتور", "د", "في", "من", "الي", "علي", "عن", "يوم", "يومين", "ايام", "النهارده", "اليوم", "بكره", "غدا", "امبارح", "امس", "بعد", "قبل", "كمان", "اول", "الجاي", "القادم", "الماضي", "السابق", "الحالي", "اللي", "كان", "كانت", "يكون", "هيكون", "يبقي", "هيبقي", "شهر", "الشهر", "ده", "دا", "فات", "جاي",
  "يناير", "فبراير", "مارس", "ابريل", "مايو", "يونيو", "يوليو", "اغسطس", "سبتمبر", "اكتوبر", "نوفمبر", "ديسمبر", "الاحد", "الاثنين", "الثلاثاء", "الاربعاء", "الخميس", "الجمعه", "السبت",
  "الميري", "ميري", "ميري", "سموحه", "ناريمان", "برج", "العرب", "طواري", "الطواري", "عنايه", "العنايه", "ذبحه", "الذبحه", "سينيور", "قسطرة", "القسطره", "عنبر", "مرور", "ايكو", "الايكو", "عياده", "العياده", "كهرباء", "القلب", "هولتر", "مجهود", "رجال", "ذكور", "حريم", "سيدات", "اناث", "حمل", "الحوامل", "العمل", "الصباحي",
].map((word) => normalize(word)));
function isNonNameWord(token: string) {
  if (NON_NAME_WORDS.has(token)) return true;
  return [...NON_NAME_WORDS].some((knownWord) => typoTokenMatches(token, knownWord));
}
function unknownResidentCandidate(question: string) {
  let cueIndex = -1;
  let cue = "";
  for (const candidateCue of RESIDENT_LOOKUP_CUES.map((item) => normalize(item))) {
    const index = (` ${question} `).indexOf(` ${candidateCue}`);
    if (index >= 0 && (cueIndex < 0 || index < cueIndex)) {
      cueIndex = index;
      cue = candidateCue;
    }
  }
  if (cueIndex < 0) return "";
  const remainder = (` ${question} `).slice(cueIndex + cue.length + 1);
  return remainder.split(/\s+/)
    .filter((token) => token && !/^\d+$/.test(token) && !isNonNameWord(token))
    .join(" ")
    .trim();
}
function unknownResidentAnswer(question: string) {
  return /[\u0600-\u06ff]/.test(question)
    ? "هل أنت متأكد من اسم الطبيب المقيم؟ تأكد من أن الاسم موجود في جدول المقيمين المعتمد ثم حاول مرة أخرى. يمكنك التواصل مع د. محمد علاء لمزيد من المعلومات."
    : "Are you sure of this resident's name? Make sure the resident is present in the approved residents schedule, then try again. You can contact Dr. Mohamed Alaa for more information.";
}
function unavailableMonthAnswer(question: string) {
  return /[\u0600-\u06ff]/.test(question)
    ? "لا تتوفر لدي جداول هذا الشهر حاليًا. تواصل مع د. محمد علاء لمزيد من المعلومات."
    : "I don't have these schedules right now. Contact Dr. Mohamed Alaa for more information.";
}
function unavailableSourceAnswer(question: string, scheduleType: "on_call" | "daytime") {
  const isArabic = /[\u0600-\u06ff]/.test(question);
  if (scheduleType === "on_call") {
    return isArabic
      ? "تعذر تحميل جدول النوبتجيات 24 ساعة مؤقتًا. حاول مرة أخرى بعد لحظات، أو تواصل مع د. محمد علاء إذا استمرت المشكلة."
      : "The 24-hour duty schedule is temporarily unavailable. Try again shortly, or contact Dr. Mohamed Alaa if the problem continues.";
  }
  return isArabic
    ? "تعذر تحميل جدول التوزيع اليومي مؤقتًا. حاول مرة أخرى بعد لحظات، أو تواصل مع د. محمد علاء إذا استمرت المشكلة."
    : "The daytime schedule is temporarily unavailable. Try again shortly, or contact Dr. Mohamed Alaa if the problem continues.";
}
function requestedHospital(question: string) {
  if (includesAny(question, ["miri", "mery", "el miri", "الميري", "ميري", "ميرى"])) return "Miri";
  if (includesAny(question, ["smouha", "سموحة", "سموحه"])) return "Smouha";
  if (includesAny(question, ["nariman", "ناريمان"])) return "Nariman";
  if (includesAny(question, ["borg el arab", "borg elarab", "برج العرب"])) return "Borg El Arab";
  return "";
}
function requestedUnit(question: string) {
  if (/\ber\b/.test(question) || includesAny(question, ["emergency", "طوارئ", "الطوارئ"])) return "ER";
  if (includesAny(question, ["angina", "ذبحة", "الذبحة"])) return "Angina Unit";
  if (includesAny(question, ["senior", "سينيور", "الكبير"])) return "Senior";
  if (includesAny(question, ["ccu", "عناية", "العناية"])) return "CCU";
  if (includesAny(question, ["cath", "catheter", "قسطرة", "القسطرة"])) return "Cath Lab";
  if (includesAny(question, ["ward", "round", "عنبر", "مرور"])) return "Ward";
  if (includesAny(question, ["echo", "ايكو", "الإيكو"])) return "Echo";
  if (includesAny(question, ["clinic", "عيادة", "عياده"])) return "Clinic";
  if (/\bep\b/.test(question) || includesAny(question, ["electrophysiology", "كهرباء القلب"])) return "EP";
  if (includesAny(question, ["stress", "holter", "هولتر", "مجهود"])) return "Diagnostics";
  return "";
}
function requestedRole(question: string, unit: string) {
  const parts: string[] = [];
  if (includesAny(question, ["4th", "fourth", "رابعه", "الرابعه"])) parts.push("4th");
  if (includesAny(question, ["5th", "fifth", "خامسه", "الخامسه"])) parts.push("5th");
  for (const year of ["2021", "2022", "2023"]) if (question.includes(year)) parts.push(year);
  const serviceNumber = question.match(/(?:cath|echo|clinic|ward|قسطرة|ايكو|عياده|عنبر)\s*(?:lab\s*)?([1-5])\b/);
  if (serviceNumber && ["Cath Lab", "Echo", "Clinic", "Ward"].includes(unit)) parts.push(serviceNumber[1]);
  if (includesAny(question, ["male", "men", "رجال", "ذكور"])) parts.push("male");
  if (includesAny(question, ["female", "women", "حريم", "سيدات", "اناث"])) parts.push("female");
  if (includesAny(question, ["pregnancy", "حمل", "الحوامل"])) parts.push("pregnancy");
  return parts;
}
function matchesUnit(item: Assignment, unit: string) {
  if (!unit || item.unit === unit) return true;
  const service = normalize(`${item.unit} ${item.service}`);
  const tokens: Record<string, string[]> = {
    "Cath Lab": ["cath"], Ward: ["ward"], Echo: ["echo"], Clinic: ["clinic"], EP: ["ep"], Diagnostics: ["stress", "holter"],
  };
  return (tokens[unit] || [unit]).some((token) => service.includes(normalize(token)));
}
function matchesRole(item: Assignment, parts: string[]) {
  if (!parts.length) return true;
  const service = normalize(`${item.role} ${item.service}`);
  const translated: Record<string, string[]> = {
    male: ["male", "رجال"], female: ["female", "سيدات", "حريم", "اناث"], pregnancy: ["pregnancy", "حمل"],
  };
  return parts.every((part) => (translated[part] || [part]).some((candidate) => service.includes(normalize(candidate))));
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
function answerNotes(rows: Assignment[], isArabic: boolean) {
  const notes: string[] = [];
  if (rows.some((item) => item.scheduleType === "on_call")) notes.push(isArabic ? "النوبتجية 24 ساعة: من 8 صباحًا حتى 8 صباحًا في اليوم التالي." : "24-hour duty: 8:00 AM until 8:00 AM the following day.");
  if (rows.some((item) => item.scheduleType === "daytime")) notes.push(isArabic ? "التوزيع اليومي: التوقيت غير مذكور في Google Sheet." : "Day assignment: its time is not specified in the Google Sheet.");
  return notes.length ? `\n${notes.join("\n")}` : "";
}
function buildAnswer(question: string, rows: Assignment[], resident: ResidentAlias | null, dateLabel: string) {
  const isArabic = /[\u0600-\u06ff]/.test(question);
  if (!rows.length) return isArabic ? `لا يوجد توزيع أو نوبتجية معتمدة مطابقة للسؤال بتاريخ ${dateLabel}.` : `No approved daytime assignment or duty matched your question for ${dateLabel}.`;
  const typeLabel = (item: Assignment) => item.scheduleType === "on_call" ? (isArabic ? "نوبتجية 24 ساعة" : "24-hour duty") : (isArabic ? "توزيع يومي" : "day assignment");
  const multipleDates = rows.some((item) => item.date !== rows[0].date);
  if (resident) {
    const displayName = resident.fullName || resident.scheduleName;
    const lines = rows.map((row) => `• ${isArabic ? arabicPlace(row) : englishPlace(row)} — ${typeLabel(row)}${multipleDates ? ` · ${row.date}` : ""}`).join("\n");
    return isArabic ? `جدول د. ${displayName} بتاريخ ${dateLabel}:\n${lines}${answerNotes(rows, true)}` : `Dr ${displayName} on ${dateLabel}:\n${lines}${answerNotes(rows, false)}`;
  }
  const lines = rows.map((row) => `• ${isArabic ? "د. " : "Dr "}${row.resident} — ${isArabic ? arabicPlace(row) : englishPlace(row)} — ${typeLabel(row)}${multipleDates ? ` · ${row.date}` : ""}`).join("\n");
  return isArabic ? `الجدول بتاريخ ${dateLabel}:\n${lines}${answerNotes(rows, true)}` : `Schedule for ${dateLabel}:\n${lines}${answerNotes(rows, false)}`;
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "POST requests only" }, 405);
  try {
    const authorization = request.headers.get("Authorization");
    if (!authorization) return json({ error: "Authentication required" }, 401);
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authorization } } });
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return json({ error: "Authentication required" }, 401);
    const { data: profile } = await supabase.from("profiles").select("role,is_active").eq("id", user.id).maybeSingle();
    if (!profile?.is_active) return json({ error: "Active portal account required" }, 403);
    const body = await request.json();
    const question = String(body.question || "").trim();
    if (question.length < 2 || question.length > 300) return json({ error: "Enter a question between 2 and 300 characters" }, 400);

    const normalizedQuestion = normalize(question);
    const data = await scheduleData();
    const resident = findResident(normalizedQuestion, data.residents);
    const hospital = requestedHospital(normalizedQuestion);
    const unit = requestedUnit(` ${normalizedQuestion} `);
    const asksOnCall = includesAny(normalizedQuestion, ON_CALL_TERMS) || ["CCU", "ER", "Angina Unit", "Senior"].includes(unit);
    const asksDaytime = includesAny(normalizedQuestion, ["day assignment", "daytime", "rotation", "morning assignment", "توزيع", "العمل الصباحي"]);
    const monthRange = requestedMonthRange(normalizedQuestion);
    const date = monthRange?.start || targetDate(normalizedQuestion, asksOnCall);
    const roleParts = requestedRole(normalizedQuestion, unit);
    const asksNext = includesAny(normalizedQuestion, ["next duty", "next shift", "next assignment", "النوبتجيه الجايه", "النوبتجية الجاية", "اقرب نوبتجيه", "أقرب نوبتجية", "التوزيع الجاي"]);
    const asksPrevious = includesAny(normalizedQuestion, ["previous duty", "last duty", "previous assignment", "النوبتجيه اللي فاتت", "النوبتجية السابقة", "التوزيع السابق"]);
    const asksWeek = includesAny(normalizedQuestion, ["this week", "next 7 days", "الاسبوع", "أسبوع"]);

    const unknownCandidate = resident ? "" : unknownResidentCandidate(normalizedQuestion);
    if (unknownCandidate) {
      return json({
        answer: unknownResidentAnswer(question),
        assignments: [],
        date,
        unknownResident: true,
        warnings: data.warnings,
      });
    }

    if (asksOnCall && !data.onCallAvailable) {
      return json({
        answer: unavailableSourceAnswer(question, "on_call"),
        assignments: [],
        date,
        sourceUnavailable: true,
        warnings: data.warnings,
      });
    }
    if (asksDaytime && !data.daytimeAvailable) {
      return json({
        answer: unavailableSourceAnswer(question, "daytime"),
        assignments: [],
        date,
        sourceUnavailable: true,
        warnings: data.warnings,
      });
    }

    let rows = data.assignments.filter((item) => {
      if (resident && normalize(item.resident) !== normalize(resident.scheduleName)) return false;
      if (hospital && item.hospital !== hospital) return false;
      if (!matchesUnit(item, unit) || !matchesRole(item, roleParts)) return false;
      if (asksOnCall && item.scheduleType !== "on_call") return false;
      if (asksDaytime && item.scheduleType !== "daytime") return false;
      return true;
    });
    if (monthRange) {
      rows = rows.filter((item) => item.date >= monthRange.start && item.date <= monthRange.end)
        .sort((a, b) => `${a.date}-${a.scheduleType}-${a.hospital}-${a.unit}-${a.role}`.localeCompare(`${b.date}-${b.scheduleType}-${b.hospital}-${b.unit}-${b.role}`));
      if (!rows.length) {
        return json({
          answer: unavailableMonthAnswer(question),
          assignments: [],
          date: monthRange.start,
          period: monthRange,
          scheduleUnavailable: true,
          warnings: data.warnings,
        });
      }
      return json({
        answer: buildAnswer(question, rows, resident, `${monthRange.start} → ${monthRange.end}`),
        assignments: rows,
        date: monthRange.start,
        period: monthRange,
        warnings: data.warnings,
      });
    }
    if (resident && asksNext) {
      rows = rows.filter((item) => item.date >= date).sort((a, b) => a.date.localeCompare(b.date));
      const nextDate = rows[0]?.date || date;
      rows = rows.filter((item) => item.date === nextDate);
      return json({ answer: buildAnswer(question, rows, resident, nextDate), assignments: rows, date: nextDate, warnings: data.warnings });
    }
    if (resident && asksPrevious) {
      rows = rows.filter((item) => item.date < date).sort((a, b) => b.date.localeCompare(a.date));
      const previousDate = rows[0]?.date || date;
      rows = rows.filter((item) => item.date === previousDate);
      return json({ answer: buildAnswer(question, rows, resident, previousDate), assignments: rows, date: previousDate, warnings: data.warnings });
    }
    if (resident && asksWeek) {
      const endDate = addDays(date, 6);
      rows = rows.filter((item) => item.date >= date && item.date <= endDate).sort((a, b) => a.date.localeCompare(b.date));
      return json({ answer: buildAnswer(question, rows, resident, `${date} → ${endDate}`), assignments: rows, date, warnings: data.warnings });
    }
    rows = rows.filter((item) => item.date === date)
      .sort((a, b) => `${a.scheduleType}-${a.hospital}-${a.unit}-${a.role}`.localeCompare(`${b.scheduleType}-${b.hospital}-${b.unit}-${b.role}`));
    return json({ answer: buildAnswer(question, rows, resident, date), assignments: rows, date, warnings: data.warnings });
  } catch (error) {
    console.error(error);
    return json({ error: error instanceof Error ? error.message : "Unable to read duty schedule" }, 500);
  }
});
