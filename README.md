<h1 align="center">Gork</h1>

## Table of Contents

1. [Introduction](#introduction)
2. [Tech Stack](#tech-stack)
3. [Getting Started](#getting-started)
4. [Memory](#memory)
5. [Commands](#commands)
6. [License](#license)

## <a name="introduction">Introduction</a>

A human-like Discord bot (called Gork) that is almost indistinguishable from a real person. Gork can chat naturally in servers and DMs, remember things across conversations, search the web, generate images, and join voice channels.

## <a name="tech-stack">Tech Stack</a>

- [Vercel AI SDK][ai-sdk]: LLM orchestration, tool calling, and multi-step agents
- [discord.js][discord.js]: Discord gateway, slash commands, and voice
- [Pinecone][pinecone]: long-term vector memory storage and semantic search
- [Redis][redis]: rate limiting, response modes, silence state, and safety settings
- [Deepgram][deepgram]: speech-to-text for voice channel support
- [Exa][exa]: real-time web search
- [Langfuse][langfuse]: LLM observability and tracing
- [Bun][bun]: runtime, package manager, and test runner
- [TypeScript][ts]

## <a name="getting-started">Getting Started</a>

First, [create a Discord Bot](https://discord.com/developers/applications) and enable the **Message Content**, **Server Members**, and **Presence** privileged intents. You will also need [Git][git] and [Bun][bun].

```bash
# Clone this repository
git clone https://github.com/techwithanirudh/gork.git
cd gork

# Install dependencies
bun install

# Copy and fill in your environment variables
cp .env.example .env

# Register slash commands with Discord
bun run deploy

# Start the development server
bun run dev
```

### Docker (production)

Redis is included in the compose file, no separate setup needed.

```bash
bun run deploy
docker compose build && docker compose up -d
docker compose logs --tail=20 gork
```

### Environment Variables

See `.env.example` for all variables with descriptions. The minimum required set:

| Variable | Description |
|---|---|
| `DISCORD_TOKEN` | Bot token from the Developer Portal |
| `DISCORD_CLIENT_ID` | Application client ID |
| `DISCORD_OWNER_ID` | Your Discord user ID (grants owner-level access) |
| `PINECONE_API_KEY` | Pinecone API key |
| `PINECONE_INDEX` | Pinecone index name |
| `DEEPGRAM_API_KEY` | Deepgram API key for voice STT |
| `EXA_API_KEY` | Exa API key for web search |

At least one AI provider key is required. Set `OPENAI_API_KEY`, `GOOGLE_GENERATIVE_AI_API_KEY`, or `HACKCLUB_API_KEY` and configure the active models in `src/lib/ai/providers.ts`.

## <a name="memory">Memory</a>

Gork uses Pinecone to store long-term memories as vector embeddings. Memories are saved automatically after conversations and retrieved via semantic search during future chats.

Create a Pinecone index with the following spec:

- Type: dense
- Dimension: 1536
- Metric: dotproduct
- Cloud/Region: aws `us-east-1`
- Namespace: `default`

## <a name="commands">Commands</a>

| Command | Description | Who can use |
|---|---|---|
| `/mode set/show/clear/help` | Control when Gork replies: `ping only`, `relevance`, or `ping + keyword` | Server admins / owner |
| `/safety set/show/clear/help` | Set content filtering per server or channel: `unfiltered` or `safe` | Server admins / owner |
| `/shutup` | Silence Gork in a channel for 6 hours (pings still wake it up) | Anyone |
| `/vc join/leave` | Join or leave a voice channel | Anyone |

Prefix any message with `//` to hide it from Gork.

## <a name="license">License</a>

This project is under the MIT license. See the [LICENSE](LICENSE) for details.

> Credit to Fellipe Utaka for the [Discord Bot Template](https://github.com/fellipeutaka/discord-bot-template)

[git]: https://git-scm.com
[ts]: https://www.typescriptlang.org/
[discord.js]: https://discord.js.org/
[ai-sdk]: https://ai-sdk.dev/
[bun]: https://bun.sh/
[pinecone]: https://pinecone.io/
[redis]: https://redis.io/
[deepgram]: https://deepgram.com/
[exa]: https://exa.ai/
[langfuse]: https://langfuse.com/
