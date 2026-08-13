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
];
const residentRecords = ["جمعة", "حسن", "نظامي", "محمد عادل", "رمزي"].map((name, index) => ({
  id: `resident-${index}`,
  fields: { "Schedule name": name },
}));

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

const todayDuty = await ask("مين عناية ميري النهاردة؟");
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

console.log("Duty Bot smoke tests passed");
