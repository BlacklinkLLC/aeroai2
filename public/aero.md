AeroAI FREE — Implementation spec for Claude
(plain text instructions — follow exactly, be picky, ship something clean)

OVERVIEW
Build a lightweight, accessible, mobile-friendly web UI ("AeroUI") that sits on top of Cloudflare's LLM/Workers AI stack and provides a freemium "AeroAI Free" experience. Deliverables: a single-repo implementation with:
  - frontend: static single-page app (HTML/CSS/JS, no framework required; optional React/Vite variant)
  - backend: Cloudflare Worker (or Pages + Worker) acting as secure proxy to Cloudflare AI model endpoints
  - infrastructure: sample Cloudflare Pages + Worker deploy instructions + minimal Terraform/CF config examples
  - tests: basic end-to-end smoke tests and accessibility checklist

High-level constraints:
  - Free tier must enforce rate limits + captcha + provenance banner (explain model + training data constraints).
  - No user PII logged by default; session logs must be ephemeral and rot after X minutes (configurable).
  - UI must be small (<= 300 KB gzipped ideally) and load offline fast. Progressive enhancement: works w/out JS for basic form submit.

IMPORTANT: Before calling any model endpoints, retrieve API token / Account ID from Cloudflare dashboard and use token auth. Cloudflare exposes Workers AI / REST endpoints for running models; implement calls through a server-side Worker to keep tokens secret.  [oai_citation:0‡Cloudflare Docs](https://developers.cloudflare.com/workers-ai/get-started/rest-api/?utm_source=chatgpt.com)

PROJECT PHASES & TASK LIST (for Claude — do not ask followups; implement)

PHASE 0 — REPO + SCAFFOLD
  - Create repo: `aeroai-free-ui`
  - Top-level files:
    - README.md (deploy instructions + Cloudflare setup)
    - /frontend/index.html
    - /frontend/styles.css
    - /frontend/app.js
    - /worker/worker.js (Cloudflare Worker)
    - /infra/pages-deploy.md (simple one-page deploy instructions)
    - /tests/e2e.md (manual steps + expected outputs)
  - Add CI: GH Actions sample for lint + build + deploy to Cloudflare Pages.

PHASE 1 — AUTH & BACKEND PROXY (Required)
  - Implement Cloudflare Worker that:
    1. Accepts POST `/api/chat` with body `{session_id, messages[], model, options}` coming only from the deployed frontend origin (validate origin).
    2. Enforces per-IP + per-session rate limits (simple in-memory token bucket for prototype; use Durable Objects or KV for production).
    3. Validates size of prompt (max tokens/characters).
    4. Forwards request to Cloudflare AI Run endpoint (use the Execute AI / run endpoint pattern) and returns streaming or chunked responses to the browser. Sample pattern: POST to `POST /accounts/{ACCOUNT_ID}/ai/run/{MODEL}` authenticated with `Authorization: Bearer {API_TOKEN}`.  [oai_citation:1‡Cloudflare Docs](https://developers.cloudflare.com/api/resources/ai/?utm_source=chatgpt.com)
    5. Logs only metadata (timestamp, latency, model, prompt length). Do NOT log raw user content unless user explicitly opts into "share transcripts".
  - Provide endpoints:
    - `GET /api/config` -> returns feature flags (e.g., max_tokens, model_list)
    - `POST /api/chat` -> main chat
    - `POST /api/feedback` -> optional thumbs up/down to collect quality signals
  - Security:
    - Worker must validate incoming origin and CORS for Pages origin only.
    - Apply simple abuse mitigation: challenge with hCaptcha/Cloudflare Turnstile after N requests in short window.
    - Support optional API key for power users (ULTRA) but hide key creation behind admin console.

PHASE 2 — FRONTEND UX (AeroUI)
  - UX principles (follow strictly):
    - Minimal, playful, slightly nerdy tone (Aero personality: helpful, cheeky, concise).
    - Fast startup: skeleton loader, immediate prompt focus.
    - Accessibility first: keyboard navigable, labels, ARIA roles; pass axe-core basics (contrast, form labels).
    - Conversation UI: message list + input composer + minimal toolbar.
    - Composer features:
      - Text input with Enter = send, Shift+Enter = new line.
      - Buttons for "Regenerate", "Stop", "Clear".
      - Dropdown for model selection (Free: small Llama variant; ULTRA: bigger models).
      - Attach file (optional): small text files only; worker will reject binary > 1MB.
    - System message toggles (advanced): "Strict concise", "Explain like I'm 10", "Socratic".
    - Show model provenance banner on top of chat (model name + date + link to Cloudflare docs).
  - Visuals:
    - Use NOVA-like tokens if you have them; otherwise: soft gradient header, compact message bubbles, monospaced assistant output option for code blocks.
    - Mobile: composer pinned to bottom, message list scrolls behind header.
  - Offline/resume:
    - Cache last 5 messages in localStorage for session recovery.
  - Failure states:
    - Friendly error messages, actionable (e.g., "Rate limit hit — try again in 30s" or "Model unavailable — try smaller model").

PHASE 3 — RAG / CONTEXT (Optional mini-RAG)
  - Implement a basic "Upload & Search" flow:
    - Allow user to upload small docs (txt/pdf <= 2MB), extract text on client and create embeddings via Cloudflare Workers AI embeddings model (if available) or client fallback.
    - Save vectors into Cloudflare KV (or index locally for prototype).
    - When user chats, include top-k passages as context to the model run (transform prompt into "System + context + user message").
  - Cite: Cloudflare provides models and embedding options—check models list and AI Search docs.  [oai_citation:2‡Cloudflare Docs](https://developers.cloudflare.com/workers-ai/models/?utm_source=chatgpt.com)

PHASE 4 — OBSERVABILITY & AI GATEWAY (Ops)
  - Integrate with Cloudflare AI Gateway (or Workers analytics) to enable:
    - Traffic & model usage dashboards
    - Rate limiting & model fallback (if primary model fails, fallback to smaller cheaper model)
    - Caching for repeated identical queries (cache TTL short)
  - Add a toggle for "anonymize session" — when on, minimize logs and redact outputs in logs.  [oai_citation:3‡Cloudflare Docs](https://developers.cloudflare.com/ai-gateway/?utm_source=chatgpt.com)

FRONTEND TECHNICAL DETAILS (exact code intent — copy/paste friendly)

index.html
  - Minimal SPA structure:
    - header: brand + mode selector + provenance link
    - main: `<ol id="messages" role="log" aria-live="polite"></ol>`
    - footer: composer form `<form id="composer"><textarea id="prompt"></textarea><button id="send">Send</button></form>`
  - Add `script` that:
    - Fetches `/api/config` on load.
    - Replays cached messages.
    - Hooks submit: disable send, POST to `/api/chat`, stream response and append nodes to `#messages`.
    - Handle streaming by using ReadableStream / fetch streaming or chunk parsing; if streaming unsupported, show spinner and poll for response.

styles.css
  - Focus on high contrast accessibility and compact spacing.
  - Use CSS variables: `--bg`, `--muted`, `--accent`, `--bubble-radius`.
  - Provide `.assistant`, `.user`, `.system` bubble styles.

app.js (important snippets)
  - Use `fetch('/api/chat', {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({session_id, messages})})`
  - When receiving a response, if the worker streams the model, use a reader to append text to the assistant bubble as it arrives.
  - Implement optimistic UI: append "thinking..." bubble immediately; replace with content when streaming begins.
  - Respect `Stop` button: abort fetch via AbortController.

WORKER IMPLEMENTATION (worker/worker.js)
  - Pseudocode:
    - Check method
    - Parse body JSON
    - Rate limit check (KV or in-memory map; use simple map for prototype)
    - Build model call payload:
      - `POST https://api.cloudflare.com/client/v4/accounts/{ACCOUNT_ID}/ai/run/{MODEL}`
      - headers: `Authorization: Bearer ${TOKEN}`, `Content-Type: application/json`
      - body: `{ "input": prompt, "options": { ... } }` (check Cloudflare docs for exact JSON shape).  [oai_citation:4‡Cloudflare Docs](https://developers.cloudflare.com/workers-ai/get-started/rest-api/?utm_source=chatgpt.com)
    - Proxy response: stream back to client, rewrite CORS headers.

SECURITY & COMPLIANCE
  - Never embed API tokens in frontend.
  - Use Cloudflare Access / Turnstile for human verification under rate limit conditions.
  - Provide clear privacy policy link in footer describing ephemeral logs and retention policy.
  - Provide a DMCA/content takedown contact for publishers (since Cloudflare blocks crawlers by default and publishers may have policies). Note relevant Cloudflare policy changes re: crawler protections and pay-per-crawl as context for dataset provenance.  [oai_citation:5‡technijian.com](https://technijian.com/chatgpt/ai-in-tech/cloudflare-revolutionizes-web-content-protection/?srsltid=AfmBOorFhrdLnpjhDNz_ZGROZj7fwDjM0t8NBaGwT5XMkQIbN-Q1tREF&utm_source=chatgpt.com)

ACCEPTANCE CRITERIA (what "done" looks like)
  - Deployable to Cloudflare Pages + Worker with documented steps in README.
  - Frontend shows conversation UI, can send prompts and receive responses from Cloudflare model via Worker proxy.
  - Rate limiting and Turnstile challenge trigger after configurable threshold.
  - Accessibility: basic keyboard navigation, aria-live for messages, color contrast >= 4.5:1.
  - Tests: manual smoke test in `tests/e2e.md` that includes:
    - Open site, send "Hello", receive answer within 10s.
    - Simulator flood: 10 rapid requests result in rate-limit behavior.
    - Turnstile challenge shows up after threshold.

SAMPLE README DEPLOY STEPS (short)
  1. Create Cloudflare account, create Pages site.
  2. Create Worker and set secret `CLOUDFLARE_AI_TOKEN` and `ACCOUNT_ID` in Worker environment.
  3. Deploy Pages with `frontend` build (or raw static).
  4. Configure Worker route `/api/*` to the worker.
  5. Test with local build and then production.

NOTES / REFERENCES (must read before coding)
  - Workers AI REST & model run endpoints — use Worker as proxy and follow token auth patterns.  [oai_citation:6‡Cloudflare Docs](https://developers.cloudflare.com/workers-ai/get-started/rest-api/?utm_source=chatgpt.com)
  - Models catalog & model choices for free vs paid tiers.  [oai_citation:7‡Cloudflare Docs](https://developers.cloudflare.com/workers-ai/models/?utm_source=chatgpt.com)
  - AI Gateway for observability and model fallback patterns.  [oai_citation:8‡Cloudflare Docs](https://developers.cloudflare.com/ai-gateway/?utm_source=chatgpt.com)
  - AI Search (AutoRAG) docs if implementing retrieval augmentation (RAG).  [oai_citation:9‡Cloudflare Docs](https://developers.cloudflare.com/ai-search/usage/rest-api/?utm_source=chatgpt.com)

DELIVERABLE FORMAT (what to commit)
  - `frontend/*` static app
  - `worker/*` Cloudflare Worker code + env examples
  - `infra/pages-deploy.md` (one-page deploy guide)
  - `README.md` with architecture diagram (ASCII ok) + usage + privacy policy + rate limit numbers
  - `tests/e2e.md` manual checks

TONE & VOICE FOR AERO (copy for UI microcopy)
  - Assistant persona: "Aero — small, speedy, and mildly smug."
  - Error: "Oops — Aero ran out of breath. Try again in 30s."
  - Rate limit: "Aero's on a coffee break. Slow down a bit, champ."
  - Privacy: "We don't keep your words — we only borrow them briefly."

FINAL REMINDERS (do these EXACTLY)
  - Do not put API tokens in frontend code.
  - Use the Worker proxy for any call to Cloudflare AI endpoints.  [oai_citation:10‡Cloudflare Docs](https://developers.cloudflare.com/workers-ai/get-started/rest-api/?utm_source=chatgpt.com)
  - Include provenance + model details in UI (model name + docs link).
  - Make the free experience charming, tiny, and reliable — focus on speed and UX polish over features.

END OF SPEC — ship it like you stole it.