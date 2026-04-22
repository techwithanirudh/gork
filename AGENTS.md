# Agents

This file provides guidance to AI Agents when working in this repository.

## Commands

```bash
bun run dev          # run with --watch (hot reload)
bun run start        # run without watch
bun run deploy       # register slash commands with Discord
bun run typecheck    # tsc --noEmit
bun run check        # ultracite lint check (biome wrapper)
bun run fix          # ultracite auto-fix
bun run check:spelling  # cspell against .cspell.jsonc
```

**Deploy to production:**
```bash
bun run deploy                        # register slash commands first
docker compose build && docker compose up -d
docker compose logs --tail=20 gork    # verify Bot is ready + Redis connected
```

Path alias: `@/` maps to `src/`.

## Architecture

Gork is a human-like Discord bot built on discord.js + Vercel AI SDK. It runs as a single `bun` process backed by Redis and Pinecone.

### Message Flow

`messageCreate` → `execute()` (early exits: bot, self, `//` prefix) → `handleMessage()` → response mode check → relevance assessment → `generateResponse()`

Messages prefixed with `//` are silently ignored (used to hide messages from Gork in chat).

**Response modes** (per guild or channel, stored in Redis):
- `relevance` — Gork decides whether to reply based on an LLM relevance check
- `ping` — only replies when pinged
- `ping+keyword` — replies on pings or keyword matches (`gork`, `grok`)

**Safety modes** (per guild or channel, stored in Redis):
- `unfiltered` — default, no content restrictions
- `safe` — injects a SFW prompt into the system prompt

### AI Pipeline

`orchestratorAgent` → `ToolLoopAgent` (Vercel AI SDK) → stops on `reply`, `react`, or `skip` tool call, or after 10 steps.

System prompt assembly order: `core` → `personality` → `examples` → `requestHints` (context) → `safetyPrompt` (if safe mode) → `tools` → `reply`.

The **relevance agent** runs a separate LLM call (`assessRelevance`) to decide if Gork should engage. It uses the same core/personality/examples but with a `relevancePrompt` instead of `replyPrompt`.

### KV (Redis)

All Redis keys are namespaced `discord:` (prod) or `beta:discord:` (dev). Modules in `src/lib/kv/`:
- `response-mode.ts` — guild/channel response mode
- `safety.ts` — guild/channel safety mode
- `silence.ts` — per-channel/DM silence (set by `/shutup`, 6h TTL, bypassed by pings)
- `ratelimit.ts` — sliding window rate limits

### Memory (Pinecone)

Long-term memory stored as vector embeddings in Pinecone. Memories are saved after successful tool calls (`saveChatMemory`, `saveToolMemory`) and retrieved via the `searchMemories` tool. Pinecone index must be dense, 1536-dim, dotproduct metric, `us-east-1`.

### Slash Commands

Registered via `bun run deploy`. Commands live in `src/commands/`, exported as `{ data, execute }` and registered in `src/commands/index.ts`.

- `/mode` — set response mode (admins/owner only)
- `/safety` — set content filtering (admins/owner only)
- `/shutup` — toggle silence for 6h
- `/vc` — voice channel join/leave

### Tools Available to the AI

`reply`, `react`, `skip`, `getUserInfo`, `getWeather`, `searchWeb`, `searchMemories`, `generateImage`, `startDM`, `listChannels`, `listGuilds`

### Logging

Pino-based. Log files written to `logs/YYYY-MM-DD_HH-MM-SS.log`. Log level via `LOG_LEVEL` env var. Use `createLogger('context-name')` for child loggers.

### Linting

ultracite wraps biome. Run `bun run check` before committing. The formatter enforces single quotes, 2-space indent, and semicolons. Barrel files are disallowed except `src/types/index.ts`.
