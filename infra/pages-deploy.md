# AeroAI Free — Cloudflare Deployment Guide

One-page guide to deploy AeroAI Free on Cloudflare Workers.

---

## Prerequisites

- Cloudflare account (free tier works!)
- Node.js 18+ installed
- npm or pnpm installed
- Git (optional, for version control)

---

## Quick Start (5 Minutes)

### 1. Clone or Download Repository

```bash
git clone <your-repo-url>
cd aeroai2
```

Or download and extract the ZIP file.

---

### 2. Install Dependencies

```bash
npm install
```

This installs:
- `wrangler` - Cloudflare Workers CLI
- TypeScript build tools
- Type definitions

---

### 3. Login to Cloudflare

```bash
npx wrangler login
```

This opens a browser window to authenticate with Cloudflare.

**Alternative**: Use API token authentication:
```bash
export CLOUDFLARE_API_TOKEN=your_token_here
```

---

### 4. Configure Your Worker

Edit `wrangler.jsonc` if needed:

```jsonc
{
  "name": "aeroai2",  // Change this to your preferred worker name
  "main": "src/index.ts",
  "compatibility_date": "2025-04-01",
  "compatibility_flags": ["nodejs_compat", "global_fetch_strictly_public"],

  "assets": {
    "directory": "./public"
  },

  "ai": {
    "binding": "AI"
  },

  "observability": {
    "enabled": true
  }
}
```

---

### 5. (Optional) Configure Turnstile

For captcha/rate limiting challenges:

1. Get a Turnstile site key from Cloudflare dashboard:
   - Go to: https://dash.cloudflare.com/?to=/:account/turnstile
   - Click "Add Site"
   - Choose "Managed" or "Invisible" widget
   - Add your domains

2. Set the secret key as a Worker secret:

```bash
npx wrangler secret put TURNSTILE_SECRET_KEY
# Paste your secret key when prompted
```

3. (Optional) Add site key to HTML for widget rendering:
   - Edit `public/index.html`
   - Add Turnstile script and widget in `#turnstile-widget` div
   - See: https://developers.cloudflare.com/turnstile/get-started/client-side-rendering/

---

### 6. (Optional) Configure AI Gateway

For caching and observability:

1. Create AI Gateway:
   - Go to: https://dash.cloudflare.com/?to=/:account/ai/ai-gateway
   - Click "Create Gateway"
   - Name it (e.g., "aeroai-gateway")
   - Copy the Gateway ID

2. Set as Worker secret:

```bash
npx wrangler secret put AI_GATEWAY_ID
# Paste your gateway ID when prompted
```

AI Gateway provides:
- Request caching (reduce API calls)
- Analytics dashboard
- Rate limiting
- Model fallback

---

### 7. Test Locally

```bash
npm run dev
```

This starts a local dev server at `http://localhost:8787`

**Test checklist**:
- ✅ Page loads
- ✅ Can send a message
- ✅ Gets a response from Aero
- ✅ Model selector works
- ✅ System mode selector works

Press `Ctrl+C` to stop.

---

### 8. Deploy to Cloudflare

```bash
npm run deploy
```

**What this does**:
1. Builds TypeScript to JavaScript
2. Uploads Worker code to Cloudflare
3. Uploads static assets (public folder)
4. Configures bindings (AI, Assets)

**Expected output**:
```
✨ Built successfully
🌀 Uploading...
✨ Success! Published aeroai2
   https://aeroai2.<your-subdomain>.workers.dev
```

---

### 9. Verify Deployment

Visit your Worker URL:
```
https://aeroai2.<your-subdomain>.workers.dev
```

**Quick test**:
1. Send "Hello"
2. Verify you get a response from Aero
3. Check browser console for any errors

---

### 10. (Optional) Add Custom Domain

1. Go to Cloudflare Dashboard → Workers & Pages → Your Worker
2. Click "Triggers" tab
3. Click "Add Custom Domain"
4. Enter your domain (must be in same Cloudflare account)
5. Click "Add Custom Domain"

Cloudflare automatically:
- Creates DNS records
- Provisions SSL certificate
- Routes traffic to your Worker

**Example**:
- `aero.yourdomain.com` → Your Worker

---

## Configuration Reference

### Environment Variables / Secrets

Set secrets using:
```bash
npx wrangler secret put <NAME>
```

**Available secrets**:

| Secret Name | Required? | Purpose |
|-------------|-----------|---------|
| `TURNSTILE_SECRET_KEY` | Optional | Enables captcha verification |
| `AI_GATEWAY_ID` | Optional | Enables AI Gateway caching/analytics |

**To list secrets**:
```bash
npx wrangler secret list
```

**To delete a secret**:
```bash
npx wrangler secret delete <NAME>
```

---

### CORS Configuration

By default, CORS allows:
- `http://localhost:8787`
- `http://127.0.0.1:8787`
- Any `*.pages.dev` domain

**To add production domain**:

Edit `src/index.ts`, line ~42:
```typescript
const ALLOWED_ORIGINS = [
  "http://localhost:8787",
  "http://127.0.0.1:8787",
  "https://yourdomain.com",  // Add your domain
];
```

Then redeploy:
```bash
npm run deploy
```

---

## Updating Your Deployment

### Update Code

1. Make changes to `src/` or `public/` files
2. Test locally:
   ```bash
   npm run dev
   ```
3. Deploy:
   ```bash
   npm run deploy
   ```

### Update Dependencies

```bash
npm update
npm run deploy
```

---

## Monitoring & Logs

### View Real-Time Logs

```bash
npx wrangler tail
```

Shows:
- Request metadata
- Console.log output
- Errors

Press `Ctrl+C` to stop.

### View Analytics

1. Go to Cloudflare Dashboard
2. Workers & Pages → Your Worker
3. Click "Metrics" tab

Shows:
- Request count
- Errors
- CPU time
- Data transferred

### AI Gateway Dashboard (if configured)

1. Go to: https://dash.cloudflare.com/?to=/:account/ai/ai-gateway
2. Click your gateway
3. View:
   - Request volume
   - Cache hit rate
   - Average latency
   - Model usage

---

## Troubleshooting

### Issue: "No route found"

**Cause**: Worker not published or route not configured

**Fix**:
```bash
npm run deploy
```

### Issue: "AI binding not found"

**Cause**: Workers AI not enabled in wrangler.jsonc

**Fix**: Ensure `wrangler.jsonc` has:
```jsonc
"ai": {
  "binding": "AI"
}
```

### Issue: "Origin not allowed" CORS error

**Cause**: Your domain not in ALLOWED_ORIGINS

**Fix**: Add domain to `src/index.ts` ALLOWED_ORIGINS array and redeploy

### Issue: Rate limit not working

**Cause**: In-memory rate limiting resets on Worker restart

**Fix**: For production, implement rate limiting with:
- Cloudflare KV (persistent storage)
- Durable Objects (stateful coordination)

**Example with KV**:
```bash
npx wrangler kv:namespace create RATE_LIMIT
```

Then update `wrangler.jsonc` and code to use KV.

### Issue: Turnstile widget not showing

**Cause**: Turnstile script not loaded or site key not configured

**Fix**:
1. Add Turnstile script to `public/index.html`:
   ```html
   <script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>
   ```
2. Add site key to widget rendering in `public/chat.js`

---

## Cost Estimation

**Cloudflare Workers Free Tier**:
- 100,000 requests/day
- 10ms CPU time per request
- Unlimited Workers AI requests (currently free in beta)

**Typical usage for small app**:
- ~1,000 requests/day = **FREE**
- ~10,000 requests/day = **FREE**
- 100,000+ requests/day = Consider upgrading to Paid plan ($5/month)

**Workers AI**: Currently in beta and free. Check current pricing:
https://developers.cloudflare.com/workers-ai/platform/pricing/

---

## Security Best Practices

1. **Never commit secrets** to git
   - Use `npx wrangler secret put` for sensitive values

2. **Review CORS settings** for production
   - Restrict to your actual domains

3. **Enable Turnstile** for public deployments
   - Prevents abuse and scraping

4. **Use AI Gateway** for production
   - Adds caching and rate limiting

5. **Monitor logs** regularly
   - Watch for unusual patterns

---

## Production Checklist

Before going live:

- [ ] Custom domain configured
- [ ] CORS restricted to production domain
- [ ] Turnstile captcha enabled
- [ ] AI Gateway configured
- [ ] Rate limiting tested
- [ ] Error handling tested
- [ ] Mobile responsiveness verified
- [ ] Privacy policy link added
- [ ] Monitoring/alerts set up

---

## Additional Resources

- **Cloudflare Workers Docs**: https://developers.cloudflare.com/workers/
- **Workers AI Docs**: https://developers.cloudflare.com/workers-ai/
- **AI Gateway Docs**: https://developers.cloudflare.com/ai-gateway/
- **Turnstile Docs**: https://developers.cloudflare.com/turnstile/
- **Wrangler CLI Docs**: https://developers.cloudflare.com/workers/wrangler/

---

## Support

- **Cloudflare Community**: https://community.cloudflare.com/
- **Workers Discord**: https://discord.gg/cloudflaredev
- **GitHub Issues**: [Your repo URL]

---

**That's it!** Your AeroAI Free instance should now be live and ready to use. 🚀
