/**
 * Cloudflare Worker: VAPI → MERaLiON HTTPS Proxy
 *
 * VAPI requires an HTTPS custom LLM endpoint. MERaLiON runs on HTTP.
 * This worker:
 *  1. Accepts HTTPS requests from VAPI (OpenAI-compatible format)
 *  2. Rewrites the model field to the MERaLiON model name
 *  3. Swaps the Authorization header to use the MERaLiON API key
 *  4. Forwards to MERaLiON over HTTP
 *  5. Streams SSE responses back to VAPI (required for real-time voice)
 *
 * Deploy:
 *   wrangler deploy
 *   wrangler secret put MERALION_API_KEY
 *
 * In VAPI Custom LLM settings, set URL to:
 *   https://<your-worker>.workers.dev/v1
 */

const MERALION_BASE = "http://meralion.org:8010";
const MERALION_MODEL = "MERaLiON/MERaLiON-3-100";

export default {
  async fetch(request, env) {
    // CORS preflight
    if (request.method === "OPTIONS") {
      return corsResponse(null, 204);
    }

    const url = new URL(request.url);

    // Health check
    if (url.pathname === "/" || url.pathname === "/health") {
      return corsResponse(JSON.stringify({ status: "ok", model: MERALION_MODEL }), 200, "application/json");
    }

    // Proxy all other paths to MERaLiON
    const targetUrl = `${MERALION_BASE}${url.pathname}${url.search}`;

    try {
      let requestBody;
      let isStreaming = false;

      if (request.method === "POST") {
        const rawBody = await request.text();

        if (url.pathname.includes("/chat/completions")) {
          // Rewrite model name and ensure streaming is enabled
          let body;
          try {
            body = JSON.parse(rawBody);
          } catch {
            return corsResponse(
              JSON.stringify({ error: "Invalid JSON body" }),
              400,
              "application/json"
            );
          }

          // Always override model to the correct MERaLiON model
          body.model = MERALION_MODEL;

          // VAPI needs streaming for real-time voice responses
          // Force stream: true so VAPI receives tokens as they're generated
          body.stream = true;
          isStreaming = true;

          requestBody = JSON.stringify(body);
          console.log(`[MERaLiON Proxy] chat/completions → model=${body.model}, messages=${body.messages?.length}, stream=${body.stream}`);
        } else {
          requestBody = rawBody;
        }
      }

      // Build forwarded headers — replace auth with MERaLiON key
      const forwardHeaders = new Headers();
      forwardHeaders.set("Content-Type", "application/json");
      forwardHeaders.set("Accept", "text/event-stream, application/json");

      const meralionKey = env.MERALION_API_KEY;
      if (!meralionKey) {
        console.error("[MERaLiON Proxy] MERALION_API_KEY secret is not set");
        return corsResponse(
          JSON.stringify({ error: "Proxy misconfigured: missing API key" }),
          500,
          "application/json"
        );
      }
      forwardHeaders.set("Authorization", `Bearer ${meralionKey}`);

      // Forward request to MERaLiON
      const meralionResponse = await fetch(targetUrl, {
        method: request.method,
        headers: forwardHeaders,
        body: requestBody,
      });

      if (!meralionResponse.ok && !isStreaming) {
        const errText = await meralionResponse.text();
        console.error(`[MERaLiON Proxy] Upstream error ${meralionResponse.status}: ${errText}`);
        return corsResponse(errText, meralionResponse.status, "application/json");
      }

      // Stream the SSE response back to VAPI
      const responseHeaders = new Headers();
      responseHeaders.set("Access-Control-Allow-Origin", "*");
      responseHeaders.set("Access-Control-Allow-Headers", "Content-Type, Authorization");

      // Pass through content-type (text/event-stream for streaming, application/json otherwise)
      const contentType = meralionResponse.headers.get("content-type") || "text/event-stream";
      responseHeaders.set("Content-Type", contentType);

      // Pass through transfer-encoding if present
      const transferEncoding = meralionResponse.headers.get("transfer-encoding");
      if (transferEncoding) {
        responseHeaders.set("Transfer-Encoding", transferEncoding);
      }

      return new Response(meralionResponse.body, {
        status: meralionResponse.status,
        headers: responseHeaders,
      });

    } catch (err) {
      console.error("[MERaLiON Proxy] Fetch error:", err.message);
      return corsResponse(
        JSON.stringify({ error: "Failed to reach MERaLiON", detail: err.message }),
        502,
        "application/json"
      );
    }
  },
};

function corsResponse(body, status = 200, contentType = "application/json") {
  return new Response(body, {
    status,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Content-Type": contentType,
    },
  });
}
