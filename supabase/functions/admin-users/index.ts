import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization,x-client-info,apikey,content-type",
};

const json = (payload: unknown, status = 200) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...cors,
      "Content-Type": "application/json",
    },
  });

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: cors });
  }

  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey =
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const admin = createClient(url, serviceRoleKey);
    const body = await request.json();

    /*
     * Username or email login
     * This action does not require an existing signed-in session.
     */
    if (body.action === "login") {
      const identifier = String(
        body.identifier || "",
      )
        .trim()
        .toLowerCase();

      const password = String(body.password || "");

      if (!identifier || !password) {
        return json({
          error: "Enter your username or email and password.",
        });
      }

      let email = identifier;

      if (!identifier.includes("@")) {
        const { data: profile, error: profileError } =
          await admin
            .from("profiles")
            .select("email")
            .ilike("username", identifier)
            .maybeSingle();

        if (profileError || !profile?.email) {
          return json({
            error: "Invalid username, email, or password.",
          });
        }

        email = String(profile.email)
          .trim()
          .toLowerCase();
      }

      const publicClient = createClient(url, anonKey);

      const {
        data: signInData,
        error: signInError,
      } = await publicClient.auth.signInWithPassword({
        email,
        password,
      });

      if (
        signInError ||
        !signInData.session ||
        !signInData.user
      ) {
        return json({
          error: "Invalid username, email, or password.",
        });
      }

      const { data: profile } = await admin
        .from("profiles")
        .select("role,is_active")
        .eq("id", signInData.user.id)
        .single();

      if (!profile?.is_active) {
        await publicClient.auth.signOut();

        return json({
          error: "Account inactive. Contact the owner.",
        });
      }

      return json({
        success: true,
        access_token:
          signInData.session.access_token,
        refresh_token:
          signInData.session.refresh_token,
        role: profile.role,
      });
    }

    /*
     * All actions below require an active owner account.
     */
    const authorization =
      request.headers.get("Authorization");

    if (!authorization) {
      return json(
        { error: "Authentication required" },
        401,
      );
    }

    const userClient = createClient(url, anonKey, {
      global: {
        headers: {
          Authorization: authorization,
        },
      },
    });

    const {
      data: { user },
    } = await userClient.auth.getUser();

    if (!user) {
      return json(
        { error: "Authentication required" },
        401,
      );
    }

    const { data: ownerProfile } = await admin
      .from("profiles")
      .select("role,is_active")
      .eq("id", user.id)
      .single();

    if (
      ownerProfile?.role !== "owner" ||
      !ownerProfile.is_active
    ) {
      return json(
        { error: "Owner access required" },
        403,
      );
    }

    if (body.action === "create_user") {
      if (
        !["resident", "observer", "assessor"].includes(
          body.role,
        ) ||
        String(body.password).length < 8
      ) {
        return json(
          { error: "Invalid account data" },
          400,
        );
      }

      if (
        body.role === "resident" &&
        ![1, 2, 3, 4, 5].includes(
          Number(body.residency_year),
        )
      ) {
        return json(
          {
            error:
              "A valid residency year is required for residents",
          },
          400,
        );
      }

      const residencyYear =
        body.role === "resident"
          ? Number(body.residency_year)
          : null;

      const { data, error } =
        await admin.auth.admin.createUser({
          email: String(body.email)
            .trim()
            .toLowerCase(),
          password: body.password,
          email_confirm: true,
          user_metadata: {
            username: String(body.username).trim(),
            display_name: String(
              body.display_name,
            ).trim(),
            role: body.role,
            residency_year: residencyYear,
          },
        });

      return error
        ? json({ error: error.message }, 400)
        : json({
            success: true,
            id: data.user.id,
          });
    }

    if (body.action === "set_status") {
      const { data: targetProfile } = await admin
        .from("profiles")
        .select("role")
        .eq("id", body.user_id)
        .single();

      if (targetProfile?.role === "owner") {
        return json(
          { error: "Owner cannot be suspended" },
          400,
        );
      }

      await admin
        .from("profiles")
        .update({
          is_active: !!body.is_active,
        })
        .eq("id", body.user_id);

      const { error } =
        await admin.auth.admin.updateUserById(
          body.user_id,
          {
            ban_duration: body.is_active
              ? "none"
              : "876000h",
          },
        );

      return error
        ? json({ error: error.message }, 400)
        : json({ success: true });
    }

    return json(
      { error: "Unknown action" },
      400,
    );
  } catch (error) {
    return json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unexpected error",
      },
      500,
    );
  }
});
