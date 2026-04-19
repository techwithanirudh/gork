<h1 align="center">Gork</h4>

## 📋 Table of Contents

1. 🤖 [Introduction](#introduction)
2. 🚀 [Tech Stack](#tech-stack)
3. 📚 [Getting Started](#getting-started)
4. 🐳 [Running with Docker](#running-with-docker)
5. 🧠 [Memory](#memory)
6. 📝 [License](#license)

## <a name="introduction">🤖 Introduction</a>

A human-like bot (called Gork) that is almost indistinguishable from a real person.

## <a name="tech-stack">🚀 Tech Stack</a>

This project was developed with the following technologies:

- [Vercel AI SDK][ai-sdk]
- [Exa AI][exa]
- [discord.js][discord.js]
- [Redis][redis]
- [TypeScript][ts]
- [Bun][bun]
- [Biome][biome]

## <a name="getting-started">📚 Getting Started</a>

First, create a [Discord Bot](https://discord.com/developers/applications). You will also need [Git][git], [Bun][bun], and a running [Redis][redis] instance.

```bash
# Clone this repository
$ git clone https://github.com/techwithanirudh/gork.git

# Install dependencies
$ bun install

# Copy and fill in your environment variables
$ cp .env.example .env
```

```bash
# Start in development (watch mode)
$ bun run dev

# Start in production
$ bun run start
```

## <a name="running-with-docker">🐳 Running with Docker</a>

Docker bundles the bot and Redis together — no separate Redis setup needed.

```bash
# Clone and enter the repo
$ git clone https://github.com/techwithanirudh/gork.git && cd gork

# Copy and fill in your environment variables
$ cp .env.example .env

# Build and start
$ docker compose up -d

# View logs
$ docker compose logs -f gork

# Stop
$ docker compose down
```

> **Note:** When running with Docker, set `REDIS_URL=redis://redis:6379/0` in your `.env`.

## <a name="memory">🧠 Memory</a>

This bot uses Pinecone to store memory. Create a Pinecone index with the following spec:

- Type: dense
- Dimension: 1536
- Metric: dotproduct
- Cloud: aws, us-east-1
- Namespace: `default`

Set `PINECONE_API_KEY` and `PINECONE_INDEX` in your `.env` accordingly.

## <a name="license">📝 License</a>

This project is under the MIT license. See the [LICENSE](LICENSE) for details.

> Credit to Fellipe Utaka for the [Discord Bot Template](https://github.com/fellipeutaka/discord-bot-template)

[git]: https://git-scm.com
[ts]: https://www.typescriptlang.org/
[discord.js]: https://discord.js.org/
[biome]: https://biomejs.dev/
[ai-sdk]: https://ai-sdk.dev/
[bun]: https://bun.sh/
[exa]: https://exa.ai/
[redis]: https://redis.io/
