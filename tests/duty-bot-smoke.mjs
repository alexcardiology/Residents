import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { stripTypeScriptTypes } from "node:module";

const fixtureCsv = `Date,Day,Male Ward Round 1,Mery Cath 1,Clinic 1
,,Male ward 1,Cath 1,
13 Aug,Thursday,حسن,محمد عادل,رمزي
15 Aug,Saturday,,نظامي,
23 Aug,Sunday,,حسن,حسن
`;
const csv = process.env.DUTY_BOT_CSV_FILE
  ? await readFile(process.env.DUTY_BOT_CSV_FILE, "utf8")
  : fixtureCsv;

const dutyRecords = [
  {
    id: "duty-1",
    fields: {
      Date: "2026-08-13",
      Day: "Thursday",
      Hospital: "Miri",
      Unit: "CCU",
      "Role / Group": "CCU duty",
      "Resident schedule name": "جمعة",
      Status: "Approved",
    },
  },
  {
    id: "duty-2",
    fields: {
      Date: "2026-08-23",
      Day: "Sunday",
      Hospital: "Miri",
      Unit: "ER",
      "Role / Group": "ER duty",
      "Resident schedule name": "حسن",
      Status: "Approved",
    },
  },
  {
    id: "duty-3",
    fields: {
      Date: "2026-08-15",
      Day: "Saturday",
      Hospital: "Miri",
      Unit: "CCU",
      "Role / Group": "CCU duty",
      "Resident schedule name": "نظامي",
      Status: "Approved",
    },
  },
  {
    id: "duty-4",
    fields: {
      Date: "2026-08-15",
      Day: "Saturday",
      Hospital: "Smouha",
      Unit: "ER",
      "Role / Group": "ER duty",
      "Resident schedule name": "جمعة",
      Status: "Approved",
    },
  },
  {
    id: "duty-5",
    fields: {
      Date: "2026-08-05",
      Day: "Wednesday",
      Hospital: "Smouha",
      Unit: "CCU",
      "Role / Group": "CCU duty",
      "Resident schedule name": "رمزي",
      Status: "Approved",
    },
  },
];
const residentRecords = ["جمعة", "حسن", "نظامي", "محمد عادل", "رمزي"].map((name, index) => ({
  id: `resident-${index}`,
  fields: {
    "Schedule name": name,
    "Other aliases / nicknames": name === "حسن" ? "Hassan" : "",
  },
}));

const NativeDate = globalThis.Date;
const fixedNow = "2026-08-14T12:00:00Z";
globalThis.Date = class extends NativeDate {
  constructor(...args) {
    super(...(args.length ? args : [fixedNow]));
  }
  static now() { return new NativeDate(fixedNow).getTime(); }
};

globalThis.Deno = {
  env: { get: (name) => name === "AIRTABLE_TOKEN" ? "test-token" : undefined },
  serve: (handler) => { globalThis.__dutyBotHandler = handler; },
};
globalThis.__createClient = () => ({
  auth: { getUser: async () => ({ data: { user: { id: "test-user" } } }) },
  from: () => ({
    select() { return this; },
    eq() { return this; },
    maybeSingle: async () => ({ data: { role: "owner", is_active: true } }),
  }),
});
globalThis.fetch = async (input) => {
  const url = String(input);
  if (url.includes("docs.google.com")) {
    return new Response(csv, {
      status: 200,
      headers: { "content-disposition": 'attachment; filename="August2026duties-August2026.csv"' },
    });
  }
  if (url.includes("Bot_Assignments")) return Response.json({ records: dutyRecords });
  if (url.includes("Residents")) return Response.json({ records: residentRecords });
  throw new Error(`Unexpected request: ${url}`);
};

let source = await readFile(new URL("../supabase/functions/duty-bot/index.ts", import.meta.url), "utf8");
source = source.replace(
  /^import \{ createClient \} from "npm:@supabase\/supabase-js@2";$/m,
  "const createClient = globalThis.__createClient;",
);
const runnable = stripTypeScriptTypes(source, { mode: "transform" });
await import(`data:text/javascript;base64,${Buffer.from(runnable).toString("base64")}`);

async function ask(question) {
  const response = await globalThis.__dutyBotHandler(new Request("https://example.test/duty-bot", {
    method: "POST",
    headers: { Authorization: "Bearer test" },
    body: JSON.stringify({ question }),
  }));
  assert.equal(response.status, 200);
  return response.json();
}

const todayDuty = await ask("مين عناية ميري امبارح؟");
assert.equal(todayDuty.date, "2026-08-13");
assert.match(todayDuty.answer, /جمعة/);
assert.equal(todayDuty.assignments[0].scheduleType, "on_call");

const futureResident = await ask("Where is Hassan on 23 August 2026?");
assert.ok(futureResident.assignments.some((item) => item.scheduleType === "daytime" && item.service === "Miri Cath 1"));
assert.ok(futureResident.assignments.some((item) => item.scheduleType === "on_call" && item.unit === "ER"));

const futureService = await ask("Who is in Miri Cath 1 on 15 August 2026?");
assert.deepEqual(futureService.assignments.map((item) => item.resident), ["نظامي"]);

const arabicDigits = await ask("مين حسن يوم ٢٣ أغسطس ٢٠٢٦؟");
assert.equal(arabicDigits.date, "2026-08-23");
assert.ok(arabicDigits.assignments.length >= 2);

const tomorrow = await ask("مين في قسطرة ميري بكرة؟");
assert.equal(tomorrow.date, "2026-08-15");

const egyptianDutySpelling = await ask("مين نباطشية ميري بكرة؟");
assert.equal(egyptianDutySpelling.date, "2026-08-15");
assert.equal(egyptianDutySpelling.unknownResident, undefined);
assert.deepEqual(egyptianDutySpelling.assignments.map((item) => item.resident), ["نظامي"]);
assert.ok(egyptianDutySpelling.assignments.every((item) => item.scheduleType === "on_call"));

for (const dutyWord of ["نوباتجي", "نوبتاجى", "نباطشي", "نباطشى", "نباطشيه", "نوباتجيه"]) {
  const result = await ask(`مين ${dutyWord} ميري بكرة؟`);
  assert.equal(result.date, "2026-08-15", dutyWord);
  assert.equal(result.unknownResident, undefined, dutyWord);
  assert.deepEqual(result.assignments.map((item) => item.resident), ["نظامي"], dutyWord);
  assert.ok(result.assignments.every((item) => item.scheduleType === "on_call"), dutyWord);
}

for (const hospitalWord of ["ميري", "الميري", "الميرى"]) {
  const result = await ask(`مين نباطشي ${hospitalWord} بكره؟`);
  assert.deepEqual(result.assignments.map((item) => item.resident), ["نظامي"], hospitalWord);
}

for (const hospitalWord of ["سموحه", "سموحة"]) {
  const result = await ask(`مين نوباتجي ${hospitalWord} بكرة؟`);
  assert.deepEqual(result.assignments.map((item) => item.resident), ["جمعة"], hospitalWord);
}

for (const tomorrowWord of ["بكرة", "بكره"]) {
  const result = await ask(`مين نباطشي ميري ${tomorrowWord}؟`);
  assert.equal(result.date, "2026-08-15", tomorrowWord);
}

for (const yesterdayWord of ["امبارح", "امس", "أمس"]) {
  const result = await ask(`مين نباطشي ميري ${yesterdayWord}؟`);
  assert.equal(result.date, "2026-08-13", yesterdayWord);
  assert.deepEqual(result.assignments.map((item) => item.resident), ["جمعة"], yesterdayWord);
}

for (const currentMonthQuestion of [
  "مين كان نباطشية سموحه يوم 5؟",
  "مين نباطشي سموحه 5 الشهر ده؟",
  "مين نباطشي سموحه يوم 5 في الشهر؟",
  "مين نباطشي سموحه يوم 5 فى الشهر؟",
]) {
  const result = await ask(currentMonthQuestion);
  assert.equal(result.date, "2026-08-05", currentMonthQuestion);
  assert.equal(result.unknownResident, undefined, currentMonthQuestion);
  assert.deepEqual(result.assignments.map((item) => item.resident), ["رمزي"], currentMonthQuestion);
}

const previousMonth = await ask("مين نباطشي ميري الشهر اللي فات؟");
assert.equal(previousMonth.scheduleUnavailable, true);
assert.deepEqual(previousMonth.period, { start: "2026-07-01", end: "2026-07-31" });
assert.match(previousMonth.answer, /د\. محمد علاء/);

const nextMonth = await ask("مين نباطشي ميري الشهر اللي جاي؟");
assert.equal(nextMonth.scheduleUnavailable, true);
assert.deepEqual(nextMonth.period, { start: "2026-09-01", end: "2026-09-30" });
assert.match(nextMonth.answer, /لا تتوفر لدي جداول هذا الشهر حاليًا/);

const afterFourDays = await ask("جدول حسن بعد ٤ أيام");
assert.equal(afterFourDays.date, "2026-08-18");

const fiveDaysAgo = await ask("مين عناية ميري من 5 ايام؟");
assert.equal(fiveDaysAgo.date, "2026-08-09");

const unknownArabicResident = await ask("فين عبد الرحمن بكرة؟");
assert.equal(unknownArabicResident.unknownResident, true);
assert.equal(unknownArabicResident.assignments.length, 0);
assert.match(unknownArabicResident.answer, /متأكد من اسم الطبيب المقيم/);
assert.match(unknownArabicResident.answer, /د\. محمد علاء/);

const unknownEnglishResident = await ask("Where is John Doe tomorrow?");
assert.equal(unknownEnglishResident.unknownResident, true);
assert.match(unknownEnglishResident.answer, /Are you sure of this resident's name/);
assert.match(unknownEnglishResident.answer, /Dr\. Mohamed Alaa/);

const typoArabicQuestion = await ask("مين نباطشسي سموحا بكرخ؟");
assert.equal(typoArabicQuestion.date, "2026-08-15");
assert.equal(typoArabicQuestion.unknownResident, undefined);
assert.deepEqual(typoArabicQuestion.assignments.map((item) => item.resident), ["جمعة"]);
assert.ok(typoArabicQuestion.assignments.every((item) => item.scheduleType === "on_call"));

const typoDayWord = await ask("مين نباطشي سموحه يم 5؟");
assert.equal(typoDayWord.date, "2026-08-05");
assert.deepEqual(typoDayWord.assignments.map((item) => item.resident), ["رمزي"]);

const typoService = await ask("مين قسطرا ميري بكرة؟");
assert.equal(typoService.date, "2026-08-15");
assert.deepEqual(typoService.assignments.map((item) => item.resident), ["نظامي"]);

const typoWeekday = await ask("مين نباطشي ميري السبب؟");
assert.equal(typoWeekday.date, "2026-08-15");
assert.deepEqual(typoWeekday.assignments.map((item) => item.resident), ["نظامي"]);

const typoMonth = await ask("فين حسن يوم 23 اغصطس 2026؟");
assert.equal(typoMonth.date, "2026-08-23");
assert.ok(typoMonth.assignments.length >= 2);

const typoResidentAlias = await ask("Where is Hasan on 23 August 2026?");
assert.equal(typoResidentAlias.unknownResident, undefined);
assert.ok(typoResidentAlias.assignments.some((item) => item.resident === "حسن"));

console.log("Duty Bot smoke tests passed");
