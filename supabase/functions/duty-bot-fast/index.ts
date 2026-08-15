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

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "POST requests only" }, 405);

  try {
    const authorization = req.headers.get("Authorization");
    if (!authorization) return json({ error: "Authentication required" }, 401);

    const body = await req.json();
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
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
    const names = [...new Set(assignments.map((item: any) => String(item?.resident || "").trim()).filter(Boolean))];
    if (!names.length) return json(dutyData);

    try {
      const contactResponse = await fetch(`${supabaseUrl}/functions/v1/duty-contact`, {
        method: "POST",
        headers,
        body: JSON.stringify({ names }),
      });
      if (!contactResponse.ok) return json(dutyData);

      const contactData = await contactResponse.json().catch(() => ({}));
      const contacts = new Map(
        (Array.isArray(contactData?.contacts) ? contactData.contacts : []).map((contact: any) => [
          String(contact?.scheduleName || "").trim(),
          contact,
        ]),
      );

      const enrichedAssignments = assignments.map((assignment: any) => {
        const resident = String(assignment?.resident || "").trim();
        const contact: any = contacts.get(resident);
        if (!contact) return assignment;
        return {
          ...assignment,
          contactDisplayName: String(contact?.displayName || "").trim() || resident,
          whatsapp: String(contact?.whatsapp || "").trim(),
        };
      });

      return json({ ...dutyData, assignments: enrichedAssignments });
    } catch (contactError) {
      console.warn("Contact enrichment failed; returning duty result without contacts", contactError);
      return json(dutyData);
    }
  } catch (error) {
    console.error(error);
    return json({ error: error instanceof Error ? error.message : "Unable to load El Médico" }, 500);
  }
});
