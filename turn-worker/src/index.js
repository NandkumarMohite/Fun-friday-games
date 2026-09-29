const ALLOWED_LOCAL_ORIGINS = new Set([
  "http://localhost:8000",
  "http://127.0.0.1:8000"
]);

function corsHeaders(origin) {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "600",
    "Cache-Control": "no-store",
    "Vary": "Origin"
  };
}

function jsonResponse(body, status, headers) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...headers, "Content-Type": "application/json; charset=utf-8" }
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname !== "/turn-credentials") return new Response("Not found", { status: 404 });

    const origin = request.headers.get("Origin") || "";
    const allowedOrigins = new Set([env.ALLOWED_ORIGIN, ...ALLOWED_LOCAL_ORIGINS].filter(Boolean));
    if (!allowedOrigins.has(origin)) return new Response("Origin not allowed", { status: 403 });

    const headers = corsHeaders(origin);
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers });
    if (request.method !== "GET") return jsonResponse({ error: "Method not allowed" }, 405, headers);

    const clientIp = request.headers.get("CF-Connecting-IP") || "unknown";
    const rate = await env.TURN_CREDENTIALS_LIMITER.limit({ key: clientIp });
    if (!rate.success) return jsonResponse({ error: "Too many credential requests. Try again shortly." }, 429, headers);

    const appName = env.METERED_APP_NAME;
    const apiKey = env.METERED_TURN_API_KEY;
    if (!appName || !apiKey || !/^[a-z0-9_-]+$/i.test(appName)) {
      return jsonResponse({ error: "TURN provider is not configured." }, 503, headers);
    }

    const providerUrl = new URL(`https://${appName}.metered.live/api/v1/turn/credentials`);
    providerUrl.searchParams.set("apiKey", apiKey);
    let providerResponse;
    try {
      providerResponse = await fetch(providerUrl, { headers: { Accept: "application/json" } });
    } catch {
      return jsonResponse({ error: "TURN credential service is unavailable." }, 502, headers);
    }
    if (!providerResponse.ok) return jsonResponse({ error: "TURN provider rejected the credential request." }, 502, headers);

    let iceServers;
    try {
      iceServers = await providerResponse.json();
    } catch {
      return jsonResponse({ error: "TURN provider returned an invalid response." }, 502, headers);
    }
    const hasTurnRelay = Array.isArray(iceServers) && iceServers.some(server => {
      const urls = Array.isArray(server.urls) ? server.urls : [server.urls];
      return urls.some(value => typeof value === "string" && /^turns?:/i.test(value));
    });
    if (!hasTurnRelay) return jsonResponse({ error: "TURN provider returned no relay servers." }, 502, headers);

    return jsonResponse({ iceServers }, 200, headers);
  }
};
