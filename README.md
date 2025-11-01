# AeroAI Free — Small, Speedy, and Mildly Smug

A lightweight, accessible, mobile-friendly AI chat application built on Cloudflare Workers AI. AeroAI Free delivers a freemium experience with personality, security, and speed.

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/)

---

## ✨ Features

### User Experience
- 🎨 **Playful Personality**: Aero is helpful, cheeky, and concise
- ⚡ **Streaming Responses**: Real-time token-by-token output
- 🎯 **System Modes**: Default, Strict, ELI5, and Socratic tutor modes
- 🔄 **Regenerate & Stop**: Full control over AI responses
- 💾 **Session Recovery**: Auto-saves last 5 messages to localStorage
- 📱 **Mobile-First**: Responsive design that works everywhere
- ♿ **Accessibility**: Keyboard navigation, ARIA labels, semantic HTML

### Security & Performance
- 🛡️ **Rate Limiting**: Token bucket algorithm prevents abuse
- 🔒 **CORS Validation**: Restricts API access to approved origins
- 🤖 **Turnstile Ready**: Cloudflare captcha integration for challenges
- 📊 **Provenance Banner**: Transparent model information and data sources
- 🚫 **No PII Logging**: Only metadata logged, user content ephemeral
- 🎯 **AI Gateway Support**: Optional caching and analytics

### Developer Experience
- 📦 **Zero Dependencies**: Vanilla HTML/CSS/JS frontend (except marked.js for markdown)
- 🔥 **TypeScript Backend**: Type-safe Cloudflare Worker
- 🚀 **One-Command Deploy**: `npm run deploy` and you're live
- 📝 **Comprehensive Docs**: Deployment guide, E2E tests, and architecture diagrams

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    User Browser                          │
│  ┌────────────────────────────────────────────────────┐ │
│  │  Frontend (Static HTML/CSS/JS)                     │ │
│  │  - Chat UI with Aero personality                   │ │
│  │  - Model & mode selectors                          │ │
│  │  - Stop/Regenerate/Clear controls                  │ │
│  │  - localStorage session recovery                   │ │
│  └────────────────────────────────────────────────────┘ │
│                          │                               │
│                     HTTPS (streaming)                    │
└──────────────────────────┼──────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────┐
│         Cloudflare Worker (Backend Proxy)               │
│  ┌────────────────────────────────────────────────────┐ │
│  │  src/index.ts                                      │ │
│  │  - Rate limiting (token bucket)                    │ │
│  │  - CORS validation                                 │ │
│  │  - Request size validation                         │ │
│  │  - Turnstile verification                          │ │
│  │  - Metadata logging (no content)                   │ │
│  └────────────────────────────────────────────────────┘ │
│                          │                               │
│              /api/config │ /api/chat │ /api/feedback     │
└──────────────────────────┼──────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────┐
│           Cloudflare Workers AI                          │
│  ┌────────────────────────────────────────────────────┐ │
│  │  Model: @cf/meta/llama-3.3-70b-instruct-fp8-fast  │ │
│  │  - System prompt injection                         │ │
│  │  - Streaming response generation                   │ │
│  │  - Optional AI Gateway caching                     │ │
│  └────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

---

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- Cloudflare account (free tier works!)
- 5 minutes of your time

### Installation

```bash
# 1. Clone repository
git clone <your-repo-url>
cd aeroai2

# 2. Install dependencies
npm install

# 3. Login to Cloudflare
npx wrangler login

# 4. Test locally
npm run dev
# Open http://localhost:8787

# 5. Deploy to production
npm run deploy
```

**That's it!** Your AeroAI instance is now live.

📖 **Detailed deployment guide**: [infra/pages-deploy.md](infra/pages-deploy.md)

---

## 📁 Project Structure

```
aeroai2/
├── public/                  # Frontend (static assets)
│   ├── index.html          # Chat UI (AeroUI)
│   ├── chat.js             # Frontend application logic
│   └── aero.md             # Implementation specification
├── src/                    # Backend (Cloudflare Worker)
│   ├── index.ts            # Main Worker entry point
│   └── types.ts            # TypeScript definitions
├── tests/                  # Testing
│   └── e2e.md              # Manual E2E test guide
├── infra/                  # Infrastructure
│   └── pages-deploy.md     # Deployment instructions
├── wrangler.jsonc          # Cloudflare Worker config
├── tsconfig.json           # TypeScript config
├── package.json            # Dependencies & scripts
└── README.md               # This file
```

---

## 🎮 Usage

### Chat Interface

1. **Send Messages**: Type and press Enter (Shift+Enter for new lines)
2. **Select Model**: Choose from available models in dropdown
3. **Choose Mode**:
   - **Default**: Balanced, friendly Aero personality
   - **Strict & Concise**: Direct, minimal responses
   - **Explain Like I'm 10**: Simple language, kid-friendly
   - **Socratic Tutor**: Guides with questions, encourages thinking

### Toolbar Controls

- **🔄 Regenerate**: Get a new response to your last message
- **⏹ Stop**: Cancel ongoing generation
- **🗑 Clear**: Reset chat (with confirmation)

### Features

- **Auto-save**: Last 5 messages persist on page refresh
- **Markdown Support**: Code blocks with syntax highlighting and copy buttons
- **Rate Limiting**: Friendly errors when you hit limits
- **Responsive**: Works on desktop, tablet, and mobile

---

## ⚙️ Configuration

### Environment Variables

Set secrets using Wrangler CLI:

```bash
npx wrangler secret put TURNSTILE_SECRET_KEY
npx wrangler secret put AI_GATEWAY_ID
```

**Available secrets**:

| Variable | Required? | Purpose |
|----------|-----------|---------|
| `TURNSTILE_SECRET_KEY` | Optional | Enables captcha verification after rate limits |
| `AI_GATEWAY_ID` | Optional | Enables caching, analytics, and observability |

### Rate Limiting

Default configuration (edit in `src/index.ts`):

```typescript
const RATE_LIMIT = {
  maxTokens: 20,           // Max requests in bucket
  refillRate: 1,           // Tokens added per minute
  challengeThreshold: 15,  // Requests before requiring Turnstile
  windowMs: 60000,         // 1 minute window
};
```

**Note**: Current implementation uses in-memory storage (resets on Worker restart). For production, use Cloudflare KV or Durable Objects.

### CORS Configuration

Edit allowed origins in `src/index.ts`:

```typescript
const ALLOWED_ORIGINS = [
  "http://localhost:8787",
  "http://127.0.0.1:8787",
  "https://yourdomain.com",  // Add your production domain
];
```

---

## 🔒 Security & Privacy

### Data Handling

- **No PII Logging**: User messages are NOT logged or stored
- **Metadata Only**: Only timestamps, model names, and prompt lengths logged
- **Ephemeral Sessions**: Session data exists only in browser localStorage
- **No Backend Storage**: No databases, no message history persistence

### Security Features

- ✅ API tokens never exposed to frontend
- ✅ CORS restricts API access to approved origins
- ✅ Rate limiting prevents abuse and spam
- ✅ Request size validation prevents oversized payloads
- ✅ Turnstile captcha challenges automated abuse
- ✅ Session IDs anonymized in logs (first 8 chars only)

### Privacy Policy

**What we collect**:
- Request metadata (timestamp, latency, model, prompt length)
- No user content, no IP addresses (beyond rate limiting)

**What we don't collect**:
- User messages or responses
- Personal information
- Analytics or tracking data

**Data retention**:
- Metadata logs: 7 days (Cloudflare Workers default)
- Session data: Client-side only, user-controlled

---

## 🧪 Testing

### Manual Testing

See comprehensive test guide: [tests/e2e.md](tests/e2e.md)

**Quick smoke test**:
1. Open app in browser
2. Send "Hello"
3. Verify response within 10 seconds
4. Test Stop and Regenerate buttons
5. Clear chat and verify reset

### Automated Testing (Future)

```bash
npm test  # Runs vitest (currently minimal)
```

---

## 📊 Monitoring

### Real-Time Logs

```bash
npx wrangler tail
```

Shows:
- Request metadata
- Error messages
- Rate limit events

### Cloudflare Dashboard

View analytics:
1. Go to Cloudflare Dashboard → Workers & Pages
2. Select your Worker
3. Click **Metrics** tab

Metrics available:
- Request volume
- Error rate
- CPU time
- Data transferred

### AI Gateway (if enabled)

1. Go to AI Gateway dashboard
2. View:
   - Cache hit rate
   - Model usage
   - Average latency
   - Cost estimates

---

## 🛠️ Development

### Local Development

```bash
npm run dev
```

Runs Worker at `http://localhost:8787` with hot reload.

### Type Checking

```bash
npm run check
```

Runs TypeScript type checker and dry-run deployment.

### Build

```bash
npm run deploy
```

Builds TypeScript and deploys to Cloudflare.

---

## 🎨 Customization

### Change Aero's Personality

Edit system prompts in `src/index.ts`:

```typescript
const SYSTEM_PROMPTS = {
  default: "You are Aero — helpful, friendly, and slightly playful...",
  // Customize other modes
};
```

### Styling

All CSS is in `public/index.html` `<style>` section. Change CSS variables:

```css
:root {
  --accent: #06b6d4;        /* Primary color */
  --aero-gradient: linear-gradient(135deg, #3b82f6, #06b6d4);
  --bubble-radius: 12px;    /* Message bubble radius */
  /* ... more variables */
}
```

### Models

Add more models in `src/index.ts`:

```typescript
const MODELS = {
  free: "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
  ultra: "@cf/meta/llama-3.1-405b-instruct-fp8-fast",  // Example
};
```

Update `/api/config` endpoint to return new models.

---

## 📈 Scalability

### Free Tier Limits

**Cloudflare Workers**:
- 100,000 requests/day
- 10ms CPU time per request

**Workers AI**:
- Currently in beta (free)
- Check latest pricing: https://developers.cloudflare.com/workers-ai/platform/pricing/

### Upgrading for Production

For high-traffic deployments:

1. **Enable AI Gateway** for caching
2. **Use KV or Durable Objects** for rate limiting persistence
3. **Add CDN caching** for static assets
4. **Consider Workers Paid plan** ($5/month) for higher limits

---

## 🐛 Known Issues & Limitations

1. **In-memory rate limiting**: Resets on Worker restart
   - **Fix**: Use Cloudflare KV or Durable Objects for persistence

2. **Turnstile widget**: Requires manual script integration
   - **Status**: Placeholder UI exists, full integration pending

3. **No message history**: Sessions are ephemeral
   - **By Design**: Privacy-first, no backend storage

4. **Limited model selection**: Free tier uses Llama 3.3 70B only
   - **Upgrade**: Add more models with Workers AI paid tiers

---

## 🤝 Contributing

Contributions welcome! Please:

1. Fork the repository
2. Create a feature branch
3. Test your changes (`npm run dev`)
4. Submit a pull request

---

## 📚 Resources

### Cloudflare Docs
- [Workers Documentation](https://developers.cloudflare.com/workers/)
- [Workers AI Documentation](https://developers.cloudflare.com/workers-ai/)
- [AI Gateway Documentation](https://developers.cloudflare.com/ai-gateway/)
- [Turnstile Documentation](https://developers.cloudflare.com/turnstile/)

### Community
- [Cloudflare Community Forum](https://community.cloudflare.com/)
- [Workers Discord](https://discord.gg/cloudflaredev)

---

## 📄 License

MIT License - see LICENSE file for details

---

## 🙏 Acknowledgments

- Built with [Cloudflare Workers AI](https://developers.cloudflare.com/workers-ai/)
- Markdown rendering by [marked.js](https://marked.js.org/)
- Design inspired by the aero.md specification
- Created by [Blacklink Labs](https://blacklinkeducation.com)

---

## 💬 Support

Issues? Questions? Ideas?

- **GitHub Issues**: [Your repo URL]
- **Email**: support@blacklinkeducation.com
- **Discord**: Join our community server

---

**Made with ❤️ by Blacklink Labs**

*Small, speedy, and mildly smug about it.*
