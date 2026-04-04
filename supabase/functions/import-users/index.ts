import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Verify caller is super_admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Verify caller identity
    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } =
      await callerClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const callerId = claimsData.claims.sub;

    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    // Check caller is super_admin
    const { data: callerProfile } = await adminClient
      .from("profiles")
      .select("role")
      .eq("id", callerId)
      .single();
    if (callerProfile?.role !== "super_admin") {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { users } = await req.json();
    if (!Array.isArray(users) || users.length === 0) {
      return new Response(
        JSON.stringify({ error: "No users provided" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Load all warehouses for code->id mapping
    const { data: warehouses } = await adminClient
      .from("warehouses")
      .select("id, code");
    const whMap = new Map<string, string>();
    (warehouses || []).forEach((w: any) =>
      whMap.set(w.code.toLowerCase(), w.id)
    );

    const results: {
      row: number;
      email: string;
      success: boolean;
      error?: string;
    }[] = [];

    for (let i = 0; i < users.length; i++) {
      const u = users[i];
      const row = i + 2; // Excel row (1-indexed + header)
      try {
        if (!u.email || !u.email.includes("@")) {
          results.push({ row, email: u.email || "", success: false, error: "Email invalide" });
          continue;
        }

        const validRoles = ["operations", "chef_agence", "regional", "super_admin"];
        const role = u.role || "operations";
        if (!validRoles.includes(role)) {
          results.push({ row, email: u.email, success: false, error: `Rôle invalide: ${role}` });
          continue;
        }

        // Resolve warehouse codes
        const whCodes = u.warehouse_codes
          ? String(u.warehouse_codes).split(",").map((c: string) => c.trim().toLowerCase()).filter(Boolean)
          : [];
        const whIds: string[] = [];
        const badCodes: string[] = [];
        for (const code of whCodes) {
          const id = whMap.get(code);
          if (id) whIds.push(id);
          else badCodes.push(code);
        }
        if (badCodes.length > 0) {
          results.push({ row, email: u.email, success: false, error: `Codes dépôt inconnus: ${badCodes.join(", ")}` });
          continue;
        }

        // Create auth user
        const tempPassword = `Temp${Math.random().toString(36).slice(2, 10)}!1`;
        const { data: authData, error: authError } =
          await adminClient.auth.admin.createUser({
            email: u.email,
            password: tempPassword,
            email_confirm: true,
            user_metadata: { full_name: u.full_name || u.email },
          });

        if (authError) {
          results.push({ row, email: u.email, success: false, error: authError.message });
          continue;
        }

        const userId = authData.user.id;

        // Update profile
        await adminClient
          .from("profiles")
          .update({ role, full_name: u.full_name || u.email })
          .eq("id", userId);

        // Assign warehouses
        if (whIds.length > 0) {
          await adminClient
            .from("user_warehouses")
            .insert(whIds.map((wid) => ({ user_id: userId, warehouse_id: wid })));
        }

        results.push({ row, email: u.email, success: true });
      } catch (err: any) {
        results.push({ row, email: u.email || "", success: false, error: err.message });
      }
    }

    return new Response(JSON.stringify({ results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
