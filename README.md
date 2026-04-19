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
- [TypeScript][ts]
- [Bun][bun]
- [ESLint][eslint]
- [Prettier][prettier]

## <a name="getting-started">📚 Getting Started</a>

To clone and run this application, first you need to create a [Discord Bot](https://www.androidpolice.com/how-to-make-discord-bot/). Afterwards, you will need [Git][git] and [Bun][bun] installed on your computer.

From your command line:

```bash
# Clone this repository
$ git clone https://github.com/techwithanirudh/discord-ai-bot.git

# Install dependencies
$ bun install
```

Next, copy the .env.example file, rename it to .env, and add your environment variables.  
The app now expects a standard Redis connection string via `REDIS_URL` (defaults to `redis://localhost:6379/0`) and uses the official `node-redis` client, so make sure you have a Redis instance running or update the URL accordingly.
Great! Now you just need to start the development server.

```bash
# Start server
$ bun run dev
```

## <a name="running-with-docker">🐳 Running with Docker</a>

Docker bundles the bot and Redis together, no separate Redis setup needed.

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

This bot uses Pinecone to store memory. You can set the `PINECONE_INDEX` environment variable to the name of your Pinecone index.

Set the `PINECONE_API_KEY` environment variable to your Pinecone API key.

Then, create a Pinecone index and set the `PINECONE_INDEX` environment variable to the name of your Pinecone index.

Spec:

- Pinecone index should be dense
- Dimension: 1536
- Metric: dotproduct
- Spec: aws, us-east-1
- Namespace: `default`

## <a name="license">📝 License</a>

This project is under the MIT license. See the [LICENSE](LICENSE) for details.

> Credit to Fellipe Utaka for the [Discord Bot Template](https://github.com/fellipeutaka/discord-bot-template)

[pr]: https://help.github.com/en/github/collaborating-with-issues-and-pull-requests/creating-a-pull-request
[git]: https://git-scm.com
[node]: https://nodejs.org/
[ts]: https://www.typescriptlang.org/
[discord.js]: https://discord.js.org/
[eslint]: https://eslint.org/
[prettier]: https://prettier.io/
[ai-sdk]: https://ai-sdk.dev/
[bun]: https://bun.sh/
[exa]: https://exa.ai/
