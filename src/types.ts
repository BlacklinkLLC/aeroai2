/**
 * Type definitions for the LLM chat application.
 */

export interface Env {
  /**
   * Binding for the Workers AI API.
   */
  AI: Ai;

  /**
   * Binding for static assets.
   */
  ASSETS: { fetch: (request: Request) => Promise<Response> };

  /**
   * Optional: Cloudflare Turnstile secret key for captcha verification
   */
  TURNSTILE_SECRET_KEY?: string;

  /**
   * Optional: AI Gateway ID for observability
   */
  AI_GATEWAY_ID?: string;
}

/**
 * Represents a chat message.
 */
export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

/**
 * Request body for /api/chat endpoint
 */
export interface ChatRequest {
  session_id: string;
  messages: ChatMessage[];
  model?: string;
  system_mode?: "default" | "strict" | "eli5" | "socratic";
  turnstile_token?: string;
}

/**
 * Rate limit state for IP or session
 */
export interface RateLimitState {
  tokens: number;
  lastRefill: number;
}

/**
 * Feedback request body
 */
export interface FeedbackRequest {
  session_id: string;
  message_id: string;
  rating: "up" | "down";
  comment?: string;
}
