# Testing MAAA Dashboard

## Quick Start

```bash
cd /home/ubuntu/repos/MAAA
npm install
node test/test-harness.js &   # Starts dashboard on port 3001 with mock bot
```

The test harness runs the full dashboard (Express + Socket.io) with a mock bot — no Minecraft server, OpenAI key, or Microsoft account needed.

## Test Harness Details

- **Port**: 3001 (http://localhost:3001)
- **Mock bot data**: Health 18/20, Food 16/20, Position (100, 64, ~200), Dimension overworld
- **Socket.io**: Connected, emits real-time position updates every 5s
- **API endpoints**: All REST endpoints functional (`/api/status`, `/api/command`, `/api/history`, `/api/leash`, `/api/disconnect`)
- **Integration endpoints**: `/api/integrations/discord/test`, `/api/integrations/telegram/test`

## Dashboard Pages

Navigate via sidebar or keyboard shortcuts (keys 1-6):
1. **Overview** — Bot vitals, position, quick command, recent activity, integration status
2. **Commands** — Chat-style command interface with user/bot bubbles
3. **Inventory** — Item grid display
4. **Integrations** — Discord webhook + Telegram bot configuration forms
5. **Logs** — Activity log viewer
6. **Settings** — Theme toggle, leash config

## Security Testing

### Input Validation (UI)

Test on the **Integrations** page (sidebar → Integrations):

| Field | Invalid Input | Expected Toast |
|-------|--------------|----------------|
| Discord Webhook URL | `https://evil.com/steal` | "Invalid Discord webhook URL. Must start with https://discord.com/api/webhooks/" |
| Discord Webhook URL | Valid: `https://discord.com/api/webhooks/123.../abc...` | "Discord integration saved" (green) |
| Telegram Bot Token | `not-a-real-token` | "Invalid bot token format. Get your token from @BotFather on Telegram" |
| Telegram Chat ID | `abc-not-a-number` | "Invalid Chat ID format. Must be a numeric ID" |

### SSRF Protection (curl)

```bash
# Should return 400 with "Invalid Discord webhook URL format"
curl -s -X POST http://localhost:3001/api/integrations/discord/test \
  -H 'Content-Type: application/json' \
  -d '{"webhookUrl":"https://evil.com/steal"}'

# AWS metadata SSRF attempt — should also return 400
curl -s -X POST http://localhost:3001/api/integrations/discord/test \
  -H 'Content-Type: application/json' \
  -d '{"webhookUrl":"http://169.254.169.254/latest/meta-data/"}'
```

### Security Headers (curl)

```bash
curl -sI http://localhost:3001/api/status
```

Expect: `Content-Security-Policy`, `X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN`, `Strict-Transport-Security`, no `X-Powered-By`.

### Error Sanitization (curl)

```bash
# Non-string message → 400 "Message is required" (no stack trace)
curl -s -X POST http://localhost:3001/api/command \
  -H 'Content-Type: application/json' -d '{"message": 12345}'

# Unknown route → 404 "Not found" (no Express HTML)
curl -s http://localhost:3001/api/secret-admin-panel
```

### Body Size Limit (curl)

```bash
# 300KB payload → 413 "request entity too large"
python3 -c "import json; print(json.dumps({'message': 'A'*300000}))" | \
  curl -s -X POST http://localhost:3001/api/command \
  -H 'Content-Type: application/json' -d @-
```

## Unit Tests

```bash
npm test   # 53 tests across 8 suites (auth, encryption, builder, miner, commandParser, security, etc.)
```

## Known Limitations

- **Real Discord/Telegram**: Cannot test actual message delivery without real credentials. Validation and SSRF protection can be fully tested without them.
- **Minecraft bot**: Requires a real Minecraft server and Microsoft account. Test harness mocks bot state.
- **LLM integration**: Requires OpenAI API key. Command parsing logic is unit-tested.
- **Rate limiting exhaustion**: Rate limit headers are visible in responses (`RateLimit-Policy: 60;w=60`). Full exhaustion test would require 60+ rapid requests in under a minute.
- **localStorage persistence**: Integration configs are saved to localStorage. Clearing browser data or using incognito resets them. Previous session data may appear pre-filled on the Integrations page.

## Tips

- If port 3001 is already in use, kill the existing process: `lsof -ti:3001 | xargs kill -9`
- The test harness runs indefinitely — use `&` to background it or run in a separate shell
- Theme toggle (sun/moon icon in sidebar footer) switches between dark and light mode
- Toast notifications appear at bottom-right and auto-dismiss after ~3 seconds
- Bot Token field is `type="password"` — entered text shows as dots

## Devin Secrets Needed

No secrets required for testing with the test harness. For real integration testing:
- `DISCORD_WEBHOOK_URL` — A real Discord webhook URL for testing message delivery
- `TELEGRAM_BOT_TOKEN` — A real Telegram bot token from @BotFather
- `TELEGRAM_CHAT_ID` — A real Telegram chat/group ID
