LLMS: https://docs.honcho.dev/llms.txt

I want to start building with Honcho - an open source memory library for building stateful agents.

## Honcho Resources

**Documentation:**
- Main docs: https://docs.honcho.dev
- API Reference: https://docs.honcho.dev/v3/api-reference/introduction
- Quickstart: https://docs.honcho.dev/v3/documentation/introduction/quickstart
- Architecture: https://docs.honcho.dev/v3/documentation/core-concepts/architecture

**Code & Examples:**
- Core repo: https://github.com/plastic-labs/honcho
- Python SDK: https://github.com/plastic-labs/honcho-python
- TypeScript SDK: https://github.com/plastic-labs/honcho-node
- Discord bot starter: https://github.com/plastic-labs/discord-python-starter
- Telegram bot example: https://github.com/plastic-labs/telegram-python-starter

**What Honcho Does:**
Honcho is an open source memory library with a managed service for building stateful agents. It enables agents to build and maintain state about any entity--users, agents, groups, ideas, and more. Because it's a continual learning system, it understands entities that change over time.

When you write messages to Honcho, they're stored and processed in the background. Custom reasoning models perform formal logical reasoning to generate conclusions about each peer. These conclusions are stored as representations that you can query to provide rich context for your agents.

**Architecture Overview:**
- Core primitives: Workspaces contain Peers (any entity that persists but changes) and Sessions (interaction threads between peers)
- Peers can observe other peers in sessions (configurable with observe_me and observe_others)
- Background reasoning processes messages to extract premises, draw conclusions, and build representations
- Representations enable continuous improvement as new messages refine existing conclusions and scaffold new ones over time
- Chat endpoint provides personalized responses based on learned context
- Supports any LLM (OpenAI, Anthropic, open source)
- Can use managed service or self-host

Please assess the resources above and ask me relevant questions to help build a well-structured application using Honcho. Consider asking about:
- What I'm trying to build
- My technical preferences and stack
- Whether I want to use the managed service or self-host
- My experience level with the technologies involved
- Specific features I need (multi-peer sessions, perspective-taking, streaming, etc.)

Once you understand my needs, help me create a working implementation with proper memory and statefulness.

## What you are building

Gork needs to remember three kinds of things:

1. **Who a user is** (preferences, style, recurring traits)
2. **What happens in a channel** (ongoing context, decisions, lore)
3. **What happens across channels in a guild** (cross-channel recall when asked)

Honcho is a good fit because it is built around **workspaces, peers, sessions**, and provides a **context endpoint** that returns a curated pack of messages, summaries, conclusions up to a token limit, so conversations can continue indefinitely. ([GitHub][1])
It also has SDKs for TypeScript/JavaScript. ([docs.honcho.dev][2])
And it has session summaries endpoints you can use to avoid transcript dumping. ([docs.honcho.dev][3])

---

## 1) Two-workspace strategy (this solves your DM + guild needs)

### Workspace A: Global

* Purpose: user identity that works in DMs
* Stores: DM sessions and global peer representations
* ID: `ws:global`

### Workspace B: Per guild

* Purpose: “home” context and social dynamics inside that server
* ID: `ws:guild:<guildId>`

This matters because otherwise you end up mixing memory between servers, which becomes a privacy nightmare and also makes the bot act “creepy”.

Honcho is designed for isolation via workspaces and for modeling multiple entities via peers/sessions. ([GitHub][1])

---

## 2) Your Discord mapping with merged threads

You said: “threads are related to the original channel so it should be merged”.

So treat **thread messages as part of the parent channel session**.

### IDs

**Peer ID**

* `peer:discord:<userId>`

**Session ID in guild workspace**

* `sess:chan:<parentChannelId>`
* For threads, use `thread.parentId` as the session key

**Session ID in global workspace (DM)**

* `sess:dm:<dmChannelId>`

### Why this is clean

* One channel has one evolving memory stream.
* Thread chatter reinforces channel context instead of fragmenting it.

---

## 3) The 3 “context packs” you will use

When building a reply, you will pull context from different scopes depending on where the message arrived.

### A) User DM to bot

Use:

* Global user context from `ws:global`
* Optionally, a small “guild behavior snapshot” if the user asks about a guild or history

### B) User speaks in guild channel

Use:

* Channel session context from `ws:guild:<guildId>` and `sess:chan:<channelId>`
* User peer context inside that guild workspace
* Optionally, global user context if it’s a preference question

### C) Cross-channel recall in same guild

Use:

* A search step across sessions inside `ws:guild:<guildId>`
* Then inject 1 to 3 findings, ideally summaries, not raw chat

Honcho supports session summaries and a context endpoint that packs information into a token budget. ([docs.honcho.dev][3])

---

## 4) The “when to recall cross-channel” rule

You’re unsure if you should recall only when asked. You’re right to be cautious. Unprompted cross-channel recall can feel wrong.

### Best rule: “ask-driven recall” + “soft triggers”

Use cross-channel recall when either:

**Explicit ask triggers**

* “what did we decide”
* “earlier we said”
* “last time”
* “in another channel”
* “didn’t we discuss”
* “what’s the status”
* “remind me”

**Soft triggers (rare)**

* The user asks a question that is obviously decision-history, like:

  * “Are we using X or Y for memory?”
  * “What’s our policy on Z?”
    In this case, you do a quick cross-channel search only if current channel context is insufficient.

This keeps the bot feeling smart without randomly dredging up old stuff.

---

## 5) Clean module API (this is what keeps code clean)

Your bot code should not know Honcho details. It should only call a memory service with a small surface area.

### `memoryService.ts`

Expose these functions:

1. `ingestDiscordMessage(ctx)`
2. `getReplyContext(ctx, userPrompt)`
3. `maybeCrossChannelRecall(ctx, userPrompt)`

Where `ctx` includes:

* `isDM`
* `guildId` (optional)
* `channelId`
* `parentChannelId` (for threads)
* `userId`
* `participantIds` (mentions + recent speakers if you want)

Your Discord handler then becomes:

* normalize ids
* call `ingestDiscordMessage`
* call `getReplyContext`
* call model
* ingest assistant reply

That is the cleanest possible architecture.

---

## 6) What you actually call in Honcho

### Ingestion

* Ensure workspace exists
* Ensure peer exists
* Ensure session exists
* Add message to session

### Retrieval for generation

* `session.get_context(tokens=...)` with `peer_target=<userPeerId>`
  The Honcho example you showed uses `get_context(tokens=1024, peer_target=peer.id)` for personalized context assembly. The repo describes this as the solution to long-running conversations. ([GitHub][1])

### Summaries

* Use `Get Session Summaries` endpoint when you want a stable summary that you can safely inject without dumping transcripts. ([docs.honcho.dev][3])

### Config knobs

Honcho supports configuration controls (hierarchical message/session/workspace/global) so you can reduce reasoning in spammy channels. ([docs.honcho.dev][2])

---

## 7) Quality and cost controls you should enable immediately

### Channel classes

You should define a simple channel policy list in your DB:

* `MEMORY_FULL`: dev, moderation, project channels
* `MEMORY_LIGHT`: general chat
* `MEMORY_OFF`: memes, bot-commands, spam

Then you either:

* still ingest messages but disable heavy reasoning, or
* skip ingestion entirely for OFF channels

Honcho’s repo and docs emphasize curated context and background reasoning, and configuration is how you keep this from becoming a money furnace. ([GitHub][1])

---

## 8) How DMs can reflect “how they act in guilds” safely

This is the privacy trap. You want:

* In DM: “I remember what you’re like and what you do”
  But you must not:
* Leak that they said something in guild X to someone who is not in guild X

### Safe method

Maintain your own mapping table:

* `user_guild_memberships(userId, guildId, lastSeenAt, messageCount)`

Then in DM, if user asks “how do I act in servers?” you:

* Pull global peer context from `ws:global`
* For guild behavior, only consider guilds where:

  * bot is present
  * user is present (from your table)
* Pull at most 1 to 2 “guild behavior summaries” and keep them generic:

  * “You usually ask about infra and memory systems.”
    Not:
  * “In <GuildName> you argued with <User> in <Channel>”

This gives the vibe without leaking specifics.

---

## 9) Libraries and packages you will use

For TS/JS, Honcho provides SDKs. ([docs.honcho.dev][2])
Practically, you’ll likely touch:

* `@honcho-ai/sdk` for the higher-level SDK ([npm][4])
* `@honcho-ai/core` if you need lower-level access or want to wire custom clients ([GitHub][5])

---

## The decision you already made, turned into a crisp implementation spec

### Defaults

* Workspaces: `ws:global` and `ws:guild:<guildId>`
* Threads: merged into parent channel session
* Cross-channel recall: only when asked, plus soft triggers
* Context budget: 1024 tokens from Honcho, you tune later
* DMs: global context always, guild behavior only when asked and only generic

### Minimal required functions

* `resolveWorkspace(message)`
* `resolveSessionId(message)`
* `resolvePeerId(userId)`
* `ingestMessage(workspace, session, peer, content, metadata)`
* `getContext(workspace, session, peerTarget, tokens)`
* `crossChannelSearch(workspaceGuild, query)` only when triggered

---

[1]: https://github.com/plastic-labs/honcho?utm_source=chatgpt.com "plastic-labs/honcho: Memory library for building stateful ..."
[2]: https://docs.honcho.dev/v2/documentation/reference/sdk?utm_source=chatgpt.com "SDK Reference - Honcho"
[3]: https://docs.honcho.dev/v2/api-reference/endpoint/sessions/get-session-summaries?utm_source=chatgpt.com "Get Session Summaries - Honcho"
[4]: https://www.npmjs.com/package/%40honcho-ai/sdk?utm_source=chatgpt.com "honcho-ai/sdk"
[5]: https://github.com/plastic-labs/honcho-node-core?utm_source=chatgpt.com "plastic-labs/honcho-node-core: NodeJS SDK for Honcho"
