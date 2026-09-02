import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
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

    const openaiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openaiKey) {
      return new Response(JSON.stringify({ error: "OPENAI_API_KEY not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabaseAuth.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claimsData.claims.sub as string;

    const { project_id } = await req.json();
    if (!project_id) {
      return new Response(JSON.stringify({ error: "project_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch project with prompt template
    const { data: project, error: projError } = await supabaseAuth
      .from("projects")
      .select("*, prompt_templates(*)")
      .eq("id", project_id)
      .eq("user_id", userId)
      .single();

    if (projError || !project) {
      return new Response(JSON.stringify({ error: "Project not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if prompt template is defined
    const promptTemplate = project.prompt_templates;
    if (!promptTemplate || !promptTemplate.content) {
      return new Response(
        JSON.stringify({ error: "Nenhum template de prompt definido para este projeto. Selecione um template antes de gerar o sumário." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch all indexed chunks for this project
    const { data: chunks, error: chunksError } = await supabaseAdmin
      .from("document_embeddings")
      .select("chunk_text, metadata, document_id")
      .eq("project_id", project_id)
      .eq("user_id", userId)
      .not("embedding", "is", null)
      .order("chunk_index", { ascending: true });

    if (chunksError || !chunks || chunks.length === 0) {
      return new Response(
        JSON.stringify({ error: "Nenhum chunk vetorizado encontrado. Processe e vetorize os documentos primeiro." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build context from all chunks
    const contextParts = chunks.map((c, i) => {
      const docName = (c.metadata as any)?.original_name || "documento";
      return `[Trecho ${i + 1} - ${docName}]\n${c.chunk_text}`;
    });
    const fullContext = contextParts.join("\n\n---\n\n");

    // Truncate context if too large (GPT-4 ~128k tokens, ~400k chars conservative)
    const maxContextChars = 300000;
    const truncatedContext = fullContext.length > maxContextChars
      ? fullContext.substring(0, maxContextChars) + "\n\n[... contexto truncado ...]"
      : fullContext;

    const systemPrompt = `Você é um analista financeiro e contábil especialista em documentos SPED (Sistema Público de Escrituração Digital).
Sua tarefa é analisar os dados SPED fornecidos e gerar um sumário estruturado.

O sumário DEVE conter obrigatoriamente:
1. insights: lista de observações relevantes encontradas nos dados
2. calculations: cálculos e valores consolidados identificados
3. data_crossings: cruzamentos de dados entre diferentes registros/blocos
4. justifications: justificativas para cada insight e conclusão
5. source_references: referências explícitas aos trechos/documentos fonte

Responda SEMPRE em JSON válido com a seguinte estrutura:
{
  "title": "Título do sumário",
  "executive_summary": "Resumo executivo em texto",
  "insights": ["insight 1", "insight 2", ...],
  "calculations": [{"description": "...", "value": "...", "formula": "..."}],
  "data_crossings": [{"description": "...", "sources": ["..."], "result": "..."}],
  "justifications": ["justificativa 1", ...],
  "source_references": [{"document": "...", "excerpt": "...", "relevance": "..."}]
}`;

    const userPrompt = `${promptTemplate.content}\n\n--- DADOS SPED ---\n\n${truncatedContext}`;

    const startTime = Date.now();

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openaiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.3,
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("OpenAI API error:", response.status, errorText);
      return new Response(
        JSON.stringify({ error: `OpenAI API error: ${response.status}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const aiData = await response.json();
    const generationTimeMs = Date.now() - startTime;
    const tokensUsed = aiData.usage?.total_tokens ?? null;
    const rawContent = aiData.choices?.[0]?.message?.content;

    let parsedContent;
    try {
      parsedContent = JSON.parse(rawContent);
    } catch {
      parsedContent = { raw_text: rawContent };
    }

    // Get next version number
    const { data: existingSummaries } = await supabaseAuth
      .from("summaries")
      .select("version")
      .eq("project_id", project_id)
      .order("version", { ascending: false })
      .limit(1);

    const nextVersion = (existingSummaries?.[0]?.version ?? 0) + 1;

    // Insert summary
    const { data: summary, error: summaryError } = await supabaseAuth
      .from("summaries")
      .insert({
        project_id,
        user_id: userId,
        version: nextVersion,
        content: parsedContent,
        insights: parsedContent.insights || [],
        calculations: parsedContent.calculations || [],
        data_crossings: parsedContent.data_crossings || [],
        justifications: parsedContent.justifications || [],
        source_references: parsedContent.source_references || [],
        prompt_used: promptTemplate.content,
        model_used: "gpt-4o",
        tokens_used: tokensUsed,
        generation_time_ms: generationTimeMs,
      })
      .select()
      .single();

    if (summaryError) {
      console.error("Summary insert error:", summaryError);
      return new Response(
        JSON.stringify({ error: "Failed to save summary", details: summaryError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        summary_id: summary.id,
        version: nextVersion,
        tokens_used: tokensUsed,
        generation_time_ms: generationTimeMs,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Generate summary error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error", details: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
