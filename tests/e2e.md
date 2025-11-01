# AeroAI Free — End-to-End Testing Guide

Manual smoke tests and acceptance criteria for AeroAI Free.

## Prerequisites

- Cloudflare Worker deployed and accessible
- Browser with JavaScript enabled
- Network connection

## Test Suite

### 1. Basic Functionality Test

**Objective**: Verify core chat functionality works

**Steps**:
1. Open the application in a browser
2. Wait for page to load completely
3. Type "Hello" in the input field
4. Press Enter or click Send

**Expected Results**:
- ✅ Input is cleared after sending
- ✅ User message appears in chat (yellow bubble, right-aligned)
- ✅ Typing indicator appears ("Aero is thinking...")
- ✅ Assistant response appears within 10 seconds
- ✅ Assistant message has blue gradient bubble, left-aligned
- ✅ Typing indicator disappears after response completes

**Pass Criteria**: All responses appear within 10 seconds

---

### 2. Streaming Response Test

**Objective**: Verify streaming updates work correctly

**Steps**:
1. Send a message: "Write a short story about a robot"
2. Observe the response as it streams in

**Expected Results**:
- ✅ Response appears token-by-token (streaming)
- ✅ Message updates smoothly without flicker
- ✅ Markdown formatting is applied correctly
- ✅ Auto-scroll keeps latest content visible

**Pass Criteria**: Streaming is visible and smooth

---

### 3. Model Selection Test

**Objective**: Verify model dropdown works

**Steps**:
1. Check the model selector dropdown
2. Verify available models are listed
3. Select a model
4. Send a test message

**Expected Results**:
- ✅ Model dropdown populates on page load
- ✅ Shows "Llama 3.3 70B (free)" or similar
- ✅ Selection persists during session
- ✅ Messages use selected model

**Pass Criteria**: Model selector is functional

---

### 4. System Mode Test

**Objective**: Verify system mode toggles work

**Steps**:
1. Select "Strict & Concise" mode
2. Send: "Explain quantum physics"
3. Select "Explain Like I'm 10" mode
4. Send: "Explain quantum physics"
5. Select "Socratic Tutor" mode
6. Send: "How do I learn programming?"

**Expected Results**:
- ✅ Strict mode: Short, direct response
- ✅ ELI5 mode: Simple language, friendly tone
- ✅ Socratic mode: Responds with guiding questions
- ✅ Default mode: Balanced, helpful tone

**Pass Criteria**: Different modes produce noticeably different response styles

---

### 5. Regenerate Button Test

**Objective**: Verify regenerate functionality

**Steps**:
1. Send a message: "Tell me a joke"
2. Wait for response
3. Click "🔄 Regenerate" button
4. Observe new response

**Expected Results**:
- ✅ Regenerate button is disabled initially
- ✅ Button enables after receiving a response
- ✅ Clicking regenerate removes last assistant message
- ✅ New response is generated
- ✅ User message is NOT duplicated

**Pass Criteria**: Regeneration produces a new response

---

### 6. Stop Button Test

**Objective**: Verify stop functionality

**Steps**:
1. Send a message: "Write a very long essay about space exploration"
2. Immediately click "⏹ Stop" while response is streaming
3. Observe behavior

**Expected Results**:
- ✅ Stop button is disabled when not generating
- ✅ Stop button enables during generation
- ✅ Clicking Stop aborts the request
- ✅ Partial response is kept in chat
- ✅ Typing indicator disappears
- ✅ Input is re-enabled

**Pass Criteria**: Generation stops immediately

---

### 7. Clear Chat Test

**Objective**: Verify clear functionality

**Steps**:
1. Send 2-3 messages to build history
2. Click "🗑 Clear" button
3. Confirm the dialog

**Expected Results**:
- ✅ Confirmation dialog appears
- ✅ If confirmed, all messages are cleared
- ✅ Welcome message reappears
- ✅ localStorage is cleared
- ✅ If cancelled, nothing changes

**Pass Criteria**: Clear completely resets the chat

---

### 8. Rate Limiting Test

**Objective**: Verify rate limiting triggers correctly

**Steps**:
1. Send 15-20 rapid messages (flood test)
   - Tip: Use a script or fast manual sending
2. Observe error behavior

**Expected Results**:
- ✅ Initial messages succeed
- ✅ After threshold (~15-20 requests), rate limit triggers
- ✅ Error banner shows: "Aero's on a coffee break. Slow down a bit, champ."
- ✅ Error includes retry-after time
- ✅ After waiting, requests succeed again

**Pass Criteria**: Rate limit triggers and shows friendly error message

---

### 9. Turnstile Challenge Test

**Objective**: Verify captcha challenge appears (if configured)

**Steps**:
1. Send 15-20 messages to trigger rate limit
2. If Turnstile is configured, challenge should appear

**Expected Results**:
- ✅ Challenge container becomes visible
- ✅ Message says "Just checking you're human..."
- ✅ Turnstile widget appears (if secrets configured)
- ✅ Completing challenge allows continued use

**Pass Criteria**: Challenge appears at threshold (if Turnstile configured)

**Note**: If Turnstile secrets are not configured, challenge UI appears but widget won't load (expected behavior for dev environment).

---

### 10. Session Recovery Test

**Objective**: Verify localStorage session recovery

**Steps**:
1. Send 3 messages and receive responses
2. Refresh the page
3. Observe restored messages

**Expected Results**:
- ✅ Last 5 messages are restored from localStorage
- ✅ Messages appear with correct styling
- ✅ Session ID persists
- ✅ Can continue conversation seamlessly

**Pass Criteria**: Messages persist across page refresh

---

### 11. Markdown & Code Blocks Test

**Objective**: Verify markdown rendering works

**Steps**:
1. Send: "Show me a Python hello world program"
2. Observe code block rendering
3. Click the "Copy" button on the code block

**Expected Results**:
- ✅ Code block is syntax-highlighted
- ✅ Copy button appears in top-right of code block
- ✅ Clicking copy copies code to clipboard
- ✅ Button shows "Copied!" feedback
- ✅ Markdown (bold, italic, lists) renders correctly

**Pass Criteria**: Code blocks and markdown work correctly

---

### 12. Error Handling Test

**Objective**: Verify graceful error handling

**Steps**:
1. Stop the Cloudflare Worker (or disconnect network)
2. Try sending a message
3. Reconnect and try again

**Expected Results**:
- ✅ Network errors show friendly message
- ✅ Error banner appears: "Oops — Aero ran out of breath..."
- ✅ Input remains enabled to retry
- ✅ After reconnection, messages work again

**Pass Criteria**: Errors are handled gracefully with friendly messages

---

### 13. Provenance Banner Test

**Objective**: Verify model provenance is displayed

**Steps**:
1. Load the page
2. Check the banner above the chat
3. Click the Cloudflare Workers AI link

**Expected Results**:
- ✅ Banner shows model name (e.g., "llama-3.3-70b-instruct-fp8-fast")
- ✅ Link to Cloudflare Workers AI docs is present
- ✅ Link opens correct documentation page

**Pass Criteria**: Provenance information is accurate and links work

---

### 14. Keyboard Navigation Test

**Objective**: Verify keyboard accessibility

**Steps**:
1. Use Tab key to navigate through controls
2. Press Enter in textarea to send message
3. Press Shift+Enter in textarea

**Expected Results**:
- ✅ Tab cycles through: model selector, mode selector, buttons, textarea
- ✅ Enter sends message
- ✅ Shift+Enter creates new line in textarea
- ✅ All controls have visible focus indicators

**Pass Criteria**: Full keyboard navigation works

---

### 15. Mobile Responsiveness Test

**Objective**: Verify mobile layout works

**Steps**:
1. Open on mobile device or resize browser to <768px width
2. Send messages
3. Test all controls

**Expected Results**:
- ✅ Layout adapts to narrow screen
- ✅ Message bubbles use more width (90%)
- ✅ Toolbar wraps nicely
- ✅ Buttons remain accessible
- ✅ Virtual keyboard doesn't break layout

**Pass Criteria**: App is fully functional on mobile

---

## Acceptance Criteria Summary

### ✅ Must Pass (Critical)

1. **Basic chat works**: Send message, get response within 10s
2. **Rate limiting works**: Triggers after ~15-20 rapid requests
3. **Error handling**: Friendly messages for all error cases
4. **Session recovery**: Last 5 messages persist on refresh
5. **Accessibility**: Keyboard navigation and ARIA labels work

### ✅ Should Pass (Important)

1. **Streaming**: Responses stream token-by-token
2. **Stop/Regenerate/Clear**: All toolbar functions work
3. **Model/Mode selection**: Dropdowns functional
4. **Markdown/Code**: Proper rendering with copy buttons
5. **Mobile**: Responsive design works on small screens

### ⚠️ Optional (Nice to Have)

1. **Turnstile**: Challenge appears if configured
2. **AI Gateway**: Caching works if enabled
3. **Dark mode**: Theme switching (if implemented)

---

## Performance Benchmarks

- **Initial load**: < 2 seconds
- **First response**: < 10 seconds
- **Streaming latency**: < 500ms first token
- **Page size**: < 300 KB gzipped (excluding marked.js CDN)

---

## Security Checklist

- ✅ No API tokens visible in frontend source
- ✅ CORS headers restrict to allowed origins
- ✅ Rate limiting prevents abuse
- ✅ No user content logged to console (only metadata)
- ✅ Session IDs are anonymized in logs

---

## Browser Compatibility

Test in:
- ✅ Chrome/Edge (latest)
- ✅ Firefox (latest)
- ✅ Safari (latest)
- ✅ Mobile Safari (iOS)
- ✅ Mobile Chrome (Android)

---

## Known Limitations

1. **Turnstile**: Requires TURNSTILE_SECRET_KEY env var to fully work
2. **AI Gateway**: Requires AI_GATEWAY_ID env var to enable caching
3. **Rate limiting**: In-memory storage resets on Worker restart (use KV/DO for production)

---

## Reporting Issues

If tests fail, note:
- Browser and version
- Exact steps to reproduce
- Expected vs actual behavior
- Console errors (if any)
- Network tab details (for API errors)

---

**Test completed**: [Date]
**Tester**: [Name]
**Environment**: [Local/Staging/Production]
**Pass rate**: ___/15 tests passed
