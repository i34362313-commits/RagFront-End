const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
};

const BACKEND_URL = "http://187.127.5.187:8000";

const transientStatuses = new Set([502, 503, 504]);

function isPollingEndpoint(path: string): boolean {
  return path.startsWith("/status/") || path.startsWith("/summary-status/");
}

function fallbackPollingResponse(path: string, backendStatus: number): Response {
  const body = path.startsWith("/summary-status/")
    ? { status: "processing", message: `Backend temporariamente indisponível (${backendStatus}). Aguardando próximo poll.` }
    : {
        status: "processing",
        stage: "uploading",
        progress: 0,
        total_files: 0,
        processed_files: 0,
        total_chunks: 0,
        processed_chunks: 0,
        message: `Backend temporariamente indisponível (${backendStatus}). Aguardando próximo poll.`,
      };

  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);

    // Extract the target path from the query parameter
    const targetPath = url.searchParams.get("path");
    if (!targetPath) {
      return new Response(
        JSON.stringify({ error: "Missing 'path' query parameter" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build the backend URL preserving remaining query params
    const backendUrl = new URL(targetPath, BACKEND_URL);

    // Forward all query params except "path"
    for (const [key, value] of url.searchParams.entries()) {
      if (key !== "path") {
        backendUrl.searchParams.set(key, value);
      }
    }

    // Build headers to forward (skip hop-by-hop headers)
    const forwardHeaders = new Headers();
    const skipHeaders = new Set([
      "host",
      "connection",
      "keep-alive",
      "transfer-encoding",
      "te",
      "trailer",
      "upgrade",
      "proxy-authorization",
      "proxy-authenticate",
    ]);

    for (const [key, value] of req.headers.entries()) {
      if (!skipHeaders.has(key.toLowerCase())) {
        forwardHeaders.set(key, value);
      }
    }

    // Add internal API key for backend authentication
    const internalApiKey = Deno.env.get("INTERNAL_API_KEY");
    if (internalApiKey) {
      forwardHeaders.set("x-api-key", internalApiKey);
    }

    // Forward the request to the Python backend
    const fetchOptions: RequestInit = {
      method: req.method,
      headers: forwardHeaders,
    };

    // Forward body for non-GET/HEAD requests
    if (req.method !== "GET" && req.method !== "HEAD") {
      fetchOptions.body = req.body;
      // @ts-ignore - duplex is needed for streaming body
      fetchOptions.duplex = "half";
    }

    const backendResponse = await fetch(backendUrl.toString(), fetchOptions);

    if (isPollingEndpoint(targetPath) && transientStatuses.has(backendResponse.status)) {
      console.warn(`Backend polling indisponível (${backendResponse.status}) para ${targetPath}; retornando fallback.`);
      await backendResponse.body?.cancel();
      return fallbackPollingResponse(targetPath, backendResponse.status);
    }

    // Build response headers
    const responseHeaders = new Headers(corsHeaders);
    const passHeaders = [
      "content-type",
      "content-disposition",
      "content-length",
    ];
    for (const h of passHeaders) {
      const val = backendResponse.headers.get(h);
      if (val) responseHeaders.set(h, val);
    }

    return new Response(backendResponse.body, {
      status: backendResponse.status,
      headers: responseHeaders,
    });
  } catch (error) {
    console.error("Proxy error:", error);
    try {
      const url = new URL(req.url);
      const targetPath = url.searchParams.get("path") || "";
      if (isPollingEndpoint(targetPath)) {
        return fallbackPollingResponse(targetPath, 502);
      }
    } catch (_) {
      // Keep the default proxy error response below.
    }

    return new Response(
      JSON.stringify({ error: "Proxy error", details: String(error) }),
      { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
