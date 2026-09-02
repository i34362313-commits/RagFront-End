import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { client_id, cnpj } = await req.json();
    if (!client_id || !cnpj) {
      return new Response(
        JSON.stringify({ error: "client_id and cnpj are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Strip CNPJ formatting
    const cleanCnpj = cnpj.replace(/\D/g, "");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const drivaToken = Deno.env.get("DRIVA_API_TOKEN");

    if (!drivaToken) {
      console.error("DRIVA_API_TOKEN not configured");
      return new Response(
        JSON.stringify({ error: "Enrichment service not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify user owns this client
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: clientData, error: clientError } = await userClient
      .from("clients")
      .select("id")
      .eq("id", client_id)
      .single();

    if (clientError || !clientData) {
      return new Response(JSON.stringify({ error: "Client not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Use service role for enriched data operations
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Upsert pending status
    const { error: upsertError } = await supabase
      .from("client_enriched_data")
      .upsert(
        { client_id, cnpj: cleanCnpj, status: "pending", raw_data: null, error_message: null },
        { onConflict: "client_id" }
      );

    if (upsertError) {
      console.error("Upsert error:", upsertError);
      throw new Error("Failed to create enrichment record");
    }

    // Return immediately — enrichment runs in background
    const enrichmentPromise = (async () => {
      try {
        console.log(`Fetching Driva data for CNPJ: ${cleanCnpj}`);
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 30000);

        const response = await fetch(
          `https://services.driva.io/search/v2/empresas/export/rz3/${cleanCnpj}?base=empresas`,
          {
            headers: { Authorization: `Bearer ${drivaToken}` },
            signal: controller.signal,
          }
        );
        clearTimeout(timeout);

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Driva API returned ${response.status}: ${errorText}`);
        }

        const rawData = await response.json();
        console.log(`Driva data received for CNPJ ${cleanCnpj}, size: ${JSON.stringify(rawData).length} chars`);

        await supabase
          .from("client_enriched_data")
          .update({ raw_data: rawData, status: "success", error_message: null })
          .eq("client_id", client_id);

        console.log(`Enrichment success for client ${client_id}`);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        console.error(`Enrichment failed for client ${client_id}:`, message);

        await supabase
          .from("client_enriched_data")
          .update({ status: "error", error_message: message })
          .eq("client_id", client_id);
      }
    })();

    // Use waitUntil if available (Deno Deploy), otherwise just fire-and-forget
    // The edge function will keep running the promise even after responding
    enrichmentPromise;

    return new Response(
      JSON.stringify({ success: true, message: "Enrichment started" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("enrich-client error:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
