# MAAA Dashboard Testing

## Overview
The MAAA web dashboard is a multi-page UI (Overview, Commands, Inventory, Integrations, Logs, Settings) served by Express + Socket.io. It can be tested locally without a Minecraft server, OpenAI API key, or Microsoft auth by using the test harness.

## Setup

```bash
cd <repo-root>
npm install
node test/test-harness.js
```

The dashboard will be available at `http://localhost:3001`.

The test harness provides:
- Mock bot with health=18, food=16, position ~(100, 64, 200), overworld dimension
- 4 inventory items: cobblestone x64, diamond_pickaxe x1, torch x32, iron_ingot x16
- Mock LLM that returns "build" action for "build" keyword, "mine" for "mine", "stop" for "stop", else "chat"
- Simulated position drift (bot moves randomly every 3 seconds)

## Key Test Flows

### 1. Overview Page Vitals
- Open `http://localhost:3001` — default page is Overview
- Verify: Health 18/20, Food 16/20, Position XYZ values, Dimension "overworld", Leash shows "/512 (ON)", Bot status "ONLINE", Connection badge "Connected"
- Position values drift over time due to simulated movement

### 2. Page Navigation
- Click sidebar items (Overview, Commands, Inventory, Integrations, Logs, Settings)
- Use keyboard shortcuts: keys 1-6 switch pages, `/` focuses command input, `?` opens shortcuts modal
- Keyboard shortcuts only work when no input field is focused

### 3. Command Sending
- Navigate to Commands page (sidebar or key "2")
- Type a command in the input at the bottom (e.g., "Build a tower")
- Click the blue send button or press Enter
- Expect: blue user bubble (right) + gray bot bubble (left) with action result
- The mock LLM returns action based on keyword: "build" → build, "mine" → mine, "stop" → stop
- Empty input should be silently rejected (no bubble, no error)

### 4. Theme Toggle
- Click the sun/moon icon in the bottom-left sidebar footer
- Page switches between dark and light themes
- Theme preference is saved to localStorage as 'maaa-theme'

### 5. Discord Integration
- Navigate to Integrations page (sidebar or key "4")
- Fill in Webhook URL field → click "Save & Enable"
- Expect: toast notification "Discord settings saved locally"
- Navigate to Overview → Discord card should show "Connected" with toggle on
- Settings persist in localStorage as 'maaa-discord' JSON
- "Test Webhook" button will fail without a real webhook URL (expected)

### 6. Telegram Integration
- Same flow as Discord but with Bot Token + Chat ID fields
- Settings persist in localStorage as 'maaa-telegram' JSON
- "Test Connection" button will fail without real credentials (expected)

## Unit Tests

```bash
npm test    # runs 38 unit tests
npm run lint  # ESLint check, should return 0 errors/warnings
```

## Known Limitations
- Cannot test real Discord/Telegram webhooks without actual credentials
- Cannot test Minecraft bot connection without a running MC server + Microsoft account
- Cannot test real OpenAI API parsing without an API key
- The test harness mock bot does not emit all real bot events (e.g., no actual block placement)

## Devin Secrets Needed
No secrets are required for local dashboard testing with the test harness. For real integration testing:
- `OPENAI_API_KEY` — for real LLM command parsing
- Discord webhook URL — for real Discord notification testing
- Telegram bot token + chat ID — for real Telegram notification testing
