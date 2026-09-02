import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const BACKEND_URL = "http://187.127.5.187:8000";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { project_id } = await req.json();
    if (!project_id) {
      return new Response(JSON.stringify({ error: "project_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Get user ID from auth
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // 1. Get project storage folder path and document count before deleting
    const { data: project } = await supabase
      .from("projects")
      .select("storage_folder_path")
      .eq("id", project_id)
      .single();

    const { data: docs } = await supabase
      .from("documents")
      .select("id")
      .eq("project_id", project_id);

    const docCount = docs?.length ?? 0;

    // 2. Delete ChromaDB data via Python backend (with API key)
    const internalApiKey = Deno.env.get("INTERNAL_API_KEY");
    const folderPath = project?.storage_folder_path || project_id;
    
    try {
      const backendUrl = new URL(`/delete-project/${project_id}`, BACKEND_URL);
      backendUrl.searchParams.set("folder_path", folderPath);
      
      const backendHeaders: Record<string, string> = { "Content-Type": "application/json" };
      if (internalApiKey) {
        backendHeaders["x-api-key"] = internalApiKey;
      }
      
      const backendRes = await fetch(backendUrl.toString(), {
        method: "DELETE",
        headers: backendHeaders,
      });
      
      if (!backendRes.ok) {
        const errText = await backendRes.text();
        console.warn("Python backend delete error (non-blocking):", errText);
      } else {
        console.log("Python backend data cleaned successfully");
      }
    } catch (backendErr) {
      console.warn("Python backend unreachable (non-blocking):", backendErr);
    }

    // 3. Delete storage files using service role (bypasses RLS)
    console.log(`Cleaning storage folder: ${folderPath}`);
    const { data: storageFiles } = await supabase.storage
      .from("sped-documents")
      .list(folderPath, { limit: 10000 });

    if (storageFiles && storageFiles.length > 0) {
      const filePaths = storageFiles.map((f: any) => `${folderPath}/${f.name}`);
      const { error: storageError } = await supabase.storage
        .from("sped-documents")
        .remove(filePaths);
      if (storageError) {
        console.warn("Storage cleanup error (non-blocking):", storageError);
      } else {
        console.log(`Deleted ${filePaths.length} files from storage`);
      }
    }

    // 3. Delete DB records via cascade
    console.log(`Deleting project ${project_id} for user ${user.id}...`);
    const { data, error } = await supabase.rpc("delete_project_cascade", {
      p_project_id: project_id,
      p_user_id: user.id,
    });

    if (error) {
      console.error("delete_project_cascade error:", error);
      throw error;
    }

    return new Response(
      JSON.stringify({
        success: true,
        deleted: {
          embeddings: data?.embeddings_deleted ?? 0,
          documents: data?.documents_deleted ?? docCount,
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Delete project error:", err);
    return new Response(
      JSON.stringify({ error: "Failed to delete project", details: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
