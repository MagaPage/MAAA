# MAAA - Minecraft AI Architect & Automator

An AI-powered Minecraft bot that interprets natural language commands and executes them in-game through autonomous navigation, procedural building, and intelligent mining.

## Features

- **Natural Language Commands** — Tell the bot what to do in plain English; GPT-4o translates your intent into executable actions
- **Autonomous Navigation** — A* pathfinding via mineflayer-pathfinder with obstacle avoidance
- **Procedural Building** — Generate towers, walls, cubes, pyramids, and floors, or load custom schematics
- **Intelligent Mining** — Scan for ore clusters within configurable radius and auto-mine with optimal tool selection
- **Live Dashboard** — Real-time Socket.io web viewer showing bot position, health, inventory, and task progress
- **Microsoft Auth** — OAuth2 Device Code flow via prismarine-auth with encrypted token caching
- **Safety Controls** — Soft-leash boundary system prevents the bot from wandering too far

## Architecture

```
User Input (CLI / Web Dashboard)
        │
        ▼
   LLM Interface (GPT-4o)
        │ JSON command
        ▼
   Skill Controller
   ┌────┴────┐────────┐
   ▼         ▼        ▼
Builder   Miner   Navigator
   │         │        │
   └─────────┴────────┘
             │
        Mineflayer Bot
```

## Quick Start

### Prerequisites

- Node.js v18+
- A Microsoft account with Minecraft: Java Edition
- An OpenAI API key (for GPT-4o)
- A Minecraft server to connect to

### Installation

```bash
git clone https://github.com/MagaPage/MAAA.git
cd MAAA
npm install
```

### Configuration

Copy the example environment file and fill in your values:

```bash
cp .env.example .env
```

Edit `.env`:

```env
MC_HOST=your-server.com
MC_PORT=25565
MC_VERSION=1.20.4
OPENAI_API_KEY=sk-your-key-here
ENCRYPTION_KEY=your-32-char-key
```

### Running

```bash
npm start
```

On first run, you'll see a device code to authenticate with Microsoft:

```
To sign in, visit: https://microsoft.com/devicelogin
Enter code: ABC123
```

Once authenticated, the bot connects to your Minecraft server and the web dashboard starts at `http://localhost:3001`.

## Usage

### CLI Commands

Type natural language commands directly:

```
MAAA> Build a 20-block high cobblestone tower
MAAA> Mine all diamonds within 50 blocks
MAAA> Follow player Steve
MAAA> Navigate to coordinates 100, 64, -200
```

Built-in commands:
- `status` — Show bot state (position, health, inventory)
- `scan` — Scan for nearby ore clusters
- `quit` — Disconnect and exit

### Web Dashboard

Open `http://localhost:3001` to access the live dashboard with:
- Real-time bot position and health bars
- Inventory viewer
- Command input with task progress tracking
- Activity log

### REST API

```
POST /api/command     — Send a natural language command
GET  /api/status      — Get bot state
GET  /api/history     — Command execution history
POST /api/disconnect  — Disconnect the bot
POST /api/leash       — Update leash settings
```

## Supported Actions

| Action | Description | Example Command |
|--------|-------------|-----------------|
| `build` | Build procedural structures or schematics | "Build a 5x5 stone cube" |
| `mine` | Auto-mine ore clusters | "Mine iron ore within 64 blocks" |
| `navigate` | Move to coordinates | "Go to 100, 64, 200" |
| `follow` | Follow a player | "Follow player Alex" |
| `scan` | Scan for nearby ores | "What ores are nearby?" |
| `chat` | Send a chat message | "Say hello to everyone" |
| `equip` | Equip an item | "Equip diamond sword" |
| `craft` | Craft an item | "Craft 4 torches" |
| `stop` | Stop current activity | "Stop everything" |

## Project Structure

```
src/
├── index.js              # Entry point & CLI
├── config.js             # Environment configuration
├── auth/
│   ├── authenticator.js  # Microsoft OAuth2 device code flow
│   └── tokenCache.js     # AES-256-GCM encrypted token storage
├── bot/
│   ├── botManager.js     # Bot lifecycle management
│   ├── skillController.js # Maps LLM commands to engine calls
│   └── leash.js          # Soft-leash boundary enforcement
├── engine/
│   ├── builder.js        # Schematic parsing & block placement
│   ├── miner.js          # Ore scanning & mining automation
│   └── navigator.js      # Pathfinder wrapper with goal types
├── ai/
│   ├── llmInterface.js   # OpenAI GPT-4o integration
│   ├── contextGenerator.js # Bot state → LLM context
│   └── commandParser.js  # LLM JSON response parsing
├── web/
│   ├── server.js         # Express + Socket.io server
│   ├── routes.js         # REST API endpoints
│   └── public/           # Dashboard frontend
└── utils/
    ├── logger.js         # Structured logging (winston)
    └── encryption.js     # AES-256-GCM helpers
```

## Security

- **Token Encryption**: Auth tokens cached with AES-256-GCM encryption at rest
- **Soft-Leash**: Configurable boundary radius — bot auto-returns if it exceeds the limit
- **No Secrets in Code**: All credentials via `.env` (excluded from git)

## Tech Stack

| Component | Technology |
|-----------|-----------|
| Runtime | Node.js v18+ |
| Bot API | Mineflayer |
| Auth | prismarine-auth |
| Pathfinding | mineflayer-pathfinder |
| AI | OpenAI GPT-4o |
| Dashboard | Express + Socket.io |
| Logging | Winston |

## Development

```bash
# Run tests
npm test

# Run with file watching
npm run dev

# Lint
npm run lint
```

## License

MIT
