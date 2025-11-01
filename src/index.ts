/**
 * AeroAI Free — Cloudflare Worker Backend
 *
 * Secure proxy for Cloudflare Workers AI with rate limiting, CORS validation,
 * and Turnstile captcha integration.
 *
 * @license MIT
 */
import { Env, ChatMessage, ChatRequest, RateLimitState, FeedbackRequest } from "./types";

// ============================================================================
// CONFIGURATION
// ============================================================================

// Available models for different tiers
const MODELS = {
  free: "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
  ultra: "@cf/meta/llama-3.3-70b-instruct-fp8-fast", // Can be upgraded to larger model
};

// System prompts for different modes
const SYSTEM_PROMPTS = {
  default: "You are Aero — a helpful, friendly, and slightly playful AI assistant. Keep responses concise, accurate, and engaging. You're small, speedy, and mildly smug about it.",
  strict: "You are Aero. Provide strictly concise responses. Be direct, factual, and brief. No fluff, just facts.",
  eli5: "You are Aero. Explain everything like I'm 10 years old. Use simple words, fun examples, and be patient and encouraging.",
  socratic: "You are Aero in Socratic tutor mode. Guide learning through thoughtful questions. Help users discover answers themselves. Ask clarifying questions and encourage critical thinking.",
};

// Rate limiting configuration (token bucket algorithm)
const RATE_LIMIT = {
  maxTokens: 20,           // Max requests in bucket
  refillRate: 1,           // Tokens added per minute
  challengeThreshold: 15,  // Requests before requiring Turnstile
  windowMs: 60000,         // 1 minute window
};

// Request size limits
const MAX_PROMPT_LENGTH = 8000;  // Characters
const MAX_MESSAGES = 50;         // Message history limit

// CORS allowed origins (adjust for production)
const ALLOWED_ORIGINS = [
  "http://localhost:8787",
  "http://127.0.0.1:8787",
  // Add your production domain: "https://yourapp.pages.dev"
];

// ============================================================================
// RATE LIMITING (In-Memory for Prototype)
// ============================================================================

// Simple in-memory rate limit store (use KV or Durable Objects in production)
const rateLimitStore = new Map<string, RateLimitState>();

function getRateLimitKey(request: Request, sessionId: string): string {
  const ip = request.headers.get("cf-connecting-ip") || "unknown";
  return `${ip}:${sessionId}`;
}

function checkRateLimit(key: string): { allowed: boolean; needsChallenge: boolean; retryAfter?: number } {
  const now = Date.now();
  let state = rateLimitStore.get(key);

  // Initialize or refill tokens
  if (!state) {
    state = { tokens: RATE_LIMIT.maxTokens, lastRefill: now };
  } else {
    const timePassed = now - state.lastRefill;
    const refillAmount = (timePassed / RATE_LIMIT.windowMs) * RATE_LIMIT.refillRate;
    state.tokens = Math.min(RATE_LIMIT.maxTokens, state.tokens + refillAmount);
    state.lastRefill = now;
  }

  // Check if challenge is needed
  const needsChallenge = state.tokens <= RATE_LIMIT.maxTokens - RATE_LIMIT.challengeThreshold;

  // Check if request is allowed
  if (state.tokens >= 1) {
    state.tokens -= 1;
    rateLimitStore.set(key, state);
    return { allowed: true, needsChallenge };
  }

  // Rate limited
  const retryAfter = Math.ceil((1 - state.tokens) * (RATE_LIMIT.windowMs / RATE_LIMIT.refillRate) / 1000);
  return { allowed: false, needsChallenge: true, retryAfter };
}

// Cleanup old entries periodically (basic memory management)
function cleanupRateLimitStore() {
  const now = Date.now();
  const maxAge = 10 * 60 * 1000; // 10 minutes

  for (const [key, state] of rateLimitStore.entries()) {
    if (now - state.lastRefill > maxAge) {
      rateLimitStore.delete(key);
    }
  }
}

// ============================================================================
// TURNSTILE VERIFICATION
// ============================================================================

async function verifyTurnstile(token: string, env: Env): Promise<boolean> {
  if (!env.TURNSTILE_SECRET_KEY) {
    console.warn("Turnstile secret key not configured, skipping verification");
    return true; // Allow if not configured
  }

  try {
    const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        secret: env.TURNSTILE_SECRET_KEY,
        response: token,
      }),
    });

    const data = await response.json() as { success: boolean };
    return data.success;
  } catch (error) {
    console.error("Turnstile verification failed:", error);
    return false;
  }
}

// ============================================================================
// CORS HELPERS
// ============================================================================

function validateOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true; // Allow requests without origin (same-origin)

  // In production, be strict about origins
  return ALLOWED_ORIGINS.some(allowed => origin.startsWith(allowed)) || origin.includes("pages.dev");
}

function corsHeaders(origin: string | null): Record<string, string> {
  const headers: Record<string, string> = {
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };

  if (origin && (ALLOWED_ORIGINS.includes(origin) || origin.includes("pages.dev"))) {
    headers["Access-Control-Allow-Origin"] = origin;
  }

  return headers;
}

// ============================================================================
// MAIN HANDLER
// ============================================================================

export default {
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext,
  ): Promise<Response> {
    const url = new URL(request.url);
    const origin = request.headers.get("origin");

    // Handle CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders(origin),
      });
    }

    // Periodic cleanup (fire-and-forget)
    if (Math.random() < 0.01) {
      ctx.waitUntil(Promise.resolve(cleanupRateLimitStore()));
    }

    // Handle static assets (frontend)
    if (url.pathname === "/" || !url.pathname.startsWith("/api/")) {
      return env.ASSETS.fetch(request);
    }

    // Validate origin for API requests
    if (!validateOrigin(request)) {
      return new Response(JSON.stringify({ error: "Origin not allowed" }), {
        status: 403,
        headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
      });
    }

    // API Routes
    try {
      if (url.pathname === "/api/config" && request.method === "GET") {
        return handleConfigRequest(env, origin);
      }

      if (url.pathname === "/api/chat" && request.method === "POST") {
        return handleChatRequest(request, env, origin);
      }

      if (url.pathname === "/api/feedback" && request.method === "POST") {
        return handleFeedbackRequest(request, env, origin);
      }

      // 404 for unmatched routes
      return new Response(JSON.stringify({ error: "Not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
      });
    } catch (error) {
      console.error("API error:", error);
      return new Response(JSON.stringify({ error: "Internal server error" }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
      });
    }
  },
} satisfies ExportedHandler<Env>;

// ============================================================================
// API HANDLERS
// ============================================================================

/**
 * GET /api/config - Return feature flags and model configuration
 */
async function handleConfigRequest(env: Env, origin: string | null): Promise<Response> {
  const config = {
    models: [
      {
        id: MODELS.free,
        name: "Llama 3.3 70B",
        tier: "free",
        description: "Fast and capable model for everyday tasks",
      },
    ],
    max_tokens: 1024,
    max_prompt_length: MAX_PROMPT_LENGTH,
    max_messages: MAX_MESSAGES,
    rate_limit: {
      max_requests: RATE_LIMIT.maxTokens,
      window_minutes: 1,
      challenge_threshold: RATE_LIMIT.challengeThreshold,
    },
    system_modes: ["default", "strict", "eli5", "socratic"],
    features: {
      file_upload: false, // Phase 3
      rag: false,         // Phase 3
    },
    provenance: {
      model: MODELS.free,
      provider: "Cloudflare Workers AI",
      docs_url: "https://developers.cloudflare.com/workers-ai/",
      last_updated: "2025-04",
    },
  };

  return new Response(JSON.stringify(config), {
    status: 200,
    headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
  });
}

/**
 * POST /api/chat - Main chat endpoint
 */
async function handleChatRequest(
  request: Request,
  env: Env,
  origin: string | null,
): Promise<Response> {
  try {
    // Parse request
    const body = await request.json() as Partial<ChatRequest>;
    const { session_id, messages = [], model, system_mode = "default", turnstile_token } = body;

    // Validate required fields
    if (!session_id || !messages.length) {
      return new Response(
        JSON.stringify({ error: "Missing session_id or messages" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders(origin) } },
      );
    }

    // Check rate limit
    const rateLimitKey = getRateLimitKey(request, session_id);
    const { allowed, needsChallenge, retryAfter } = checkRateLimit(rateLimitKey);

    if (!allowed) {
      return new Response(
        JSON.stringify({
          error: "rate_limit",
          message: "Aero's on a coffee break. Slow down a bit, champ.",
          retry_after: retryAfter,
        }),
        {
          status: 429,
          headers: {
            "Content-Type": "application/json",
            "Retry-After": String(retryAfter || 30),
            ...corsHeaders(origin),
          },
        },
      );
    }

    // Verify Turnstile if challenge is needed and token provided
    if (needsChallenge && turnstile_token) {
      const isValid = await verifyTurnstile(turnstile_token, env);
      if (!isValid) {
        return new Response(
          JSON.stringify({
            error: "challenge_failed",
            message: "Captcha verification failed. Please try again.",
          }),
          { status: 403, headers: { "Content-Type": "application/json", ...corsHeaders(origin) } },
        );
      }
    } else if (needsChallenge && !turnstile_token) {
      return new Response(
        JSON.stringify({
          error: "challenge_required",
          message: "Please complete the challenge to continue.",
          needs_turnstile: true,
        }),
        { status: 429, headers: { "Content-Type": "application/json", ...corsHeaders(origin) } },
      );
    }

    // Validate message limits
    if (messages.length > MAX_MESSAGES) {
      return new Response(
        JSON.stringify({ error: `Message history too long (max ${MAX_MESSAGES})` }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders(origin) } },
      );
    }

    // Validate prompt length
    const totalLength = messages.reduce((sum, msg) => sum + msg.content.length, 0);
    if (totalLength > MAX_PROMPT_LENGTH) {
      return new Response(
        JSON.stringify({ error: `Prompt too long (max ${MAX_PROMPT_LENGTH} characters)` }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders(origin) } },
      );
    }

    // Select model (free tier only for now)
    const selectedModel = MODELS.free;

    // Inject system prompt based on mode
    const systemPrompt = SYSTEM_PROMPTS[system_mode] || SYSTEM_PROMPTS.default;
    const messagesCopy = [...messages];
    if (!messagesCopy.some((msg) => msg.role === "system")) {
      messagesCopy.unshift({ role: "system", content: systemPrompt });
    }

    // Log metadata (not content)
    const metadata = {
      timestamp: new Date().toISOString(),
      session_id: session_id.substring(0, 8), // Partial ID only
      model: selectedModel,
      system_mode,
      message_count: messages.length,
      prompt_length: totalLength,
    };
    console.log("Chat request:", JSON.stringify(metadata));

    // Call Workers AI
    const aiOptions: any = {
      messages: messagesCopy,
      max_tokens: 1024,
    };

    const runOptions: any = {
      returnRawResponse: true,
    };

    // Use AI Gateway if configured
    if (env.AI_GATEWAY_ID) {
      runOptions.gateway = {
        id: env.AI_GATEWAY_ID,
        skipCache: false,
        cacheTtl: 300, // 5 minutes cache for identical queries
      };
    }

    const response = await env.AI.run(selectedModel as any, aiOptions, runOptions) as Response;

    // Return streaming response with CORS headers
    const headers = new Headers(response.headers);
    Object.entries(corsHeaders(origin)).forEach(([key, value]) => {
      headers.set(key, value);
    });

    return new Response(response.body, {
      status: response.status,
      headers,
    });
  } catch (error) {
    console.error("Error processing chat request:", error);
    return new Response(
      JSON.stringify({
        error: "processing_failed",
        message: "Oops — Aero ran out of breath. Try again in a moment.",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
      },
    );
  }
}

/**
 * POST /api/feedback - Collect user feedback (thumbs up/down)
 */
async function handleFeedbackRequest(
  request: Request,
  env: Env,
  origin: string | null,
): Promise<Response> {
  try {
    const body = await request.json() as Partial<FeedbackRequest>;
    const { session_id, message_id, rating, comment } = body;

    // Validate
    if (!session_id || !message_id || !rating) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders(origin) } },
      );
    }

    // Log feedback (in production, store in KV or analytics)
    console.log("Feedback received:", {
      session_id: session_id.substring(0, 8),
      message_id: message_id.substring(0, 8),
      rating,
      has_comment: !!comment,
    });

    return new Response(
      JSON.stringify({ success: true, message: "Thanks for the feedback!" }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders(origin) } },
    );
  } catch (error) {
    console.error("Error processing feedback:", error);
    return new Response(
      JSON.stringify({ error: "Failed to process feedback" }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders(origin) } },
    );
  }
}
