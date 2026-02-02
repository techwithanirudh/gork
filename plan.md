# Gork Honcho Integration Plan

## Overview

Gork needs to remember three kinds of things:

1. **Who a user is** (preferences, style, recurring traits)
2. **What happens in a channel** (ongoing context, decisions, lore)
3. **What happens across channels in a guild** (cross-channel recall when asked)

We're replacing the current dual-memory system (Redis working memory + Pinecone semantic) with Honcho.

---

## Architecture Decision: Single Workspace

After analysis, we chose **one workspace** over multiple workspaces.

### Why Single Workspace

| Concern | Two Workspaces | Single Workspace |
|---------|----------------|------------------|
| User identity | Fragmented across workspaces | Unified - one peer learns from all interactions |
| DM + guild knowledge | Requires cross-workspace queries | Natural - peer representation includes all context |
| Privacy | Isolation by design | Controlled at query time |
| Complexity | Multiple clients/connections | Simple - one client |

### Data Model

```
Workspace: gork

Peers:
├── discord:<userId>        # Human users (observe_me: true)
└── gork                    # The bot itself (observe_me: false)

Sessions:
├── dm:<oderedUserIds>                     # DM conversations
└── guild:<guildId>:chan:<parentChannelId> # Guild channels (threads merged)
```

### Privacy Model

Privacy is handled at **query time**, not storage time:
- In guild channels: pull session context + user peer context
- In DMs: pull user peer context (unified from all interactions)
- Cross-channel recall: only when triggered, use summaries not raw transcripts
- Never expose channel-specific details in DMs without explicit ask

---

## Reference: Official Discord Bot Pattern

From [plastic-labs/discord-python-starter](https://github.com/plastic-labs/discord-python-starter):

```python
# Initialize client with workspace
honcho_client = Honcho(workspace_id=os.getenv("HONCHO_WORKSPACE_ID", "default"))

# Create bot peer (not observed)
assistant = honcho_client.peer(id="assistant", config={"observe_me": False})

# Per-message: create user peer and session
peer = honcho_client.peer(id=f"discord_{message.author.id}")
session = honcho_client.session(id=str(message.channel.id))

# Get context for LLM (converts to OpenAI format)
messages = session.get_context(tokens=1024, peer_target=peer.id).to_openai(assistant=assistant)

# After response: store both messages
session.add_messages([
    peer.message(user_input),
    assistant.message(response)
])

# Dialectic: query about a user
response = peer.chat(query="What does this user care about?", session_id=session.id)
```

---

## Implementation Spec

### 1. ID Resolution Functions

```typescript
// Peer ID: one per Discord user
function resolvePeerId(userId: string): string {
  return `discord:${userId}`;
}

// Session ID: DM or guild channel (threads merged to parent)
function resolveSessionId(message: Message): string {
  if (!message.guild) {
    // DM: sort user IDs for consistency
    const botId = message.client.user?.id ?? 'gork';
    const [a, b] = [message.author.id, botId].sort();
    return `dm:${a}:${b}`;
  }

  // Guild: use parent channel for threads
  const channelId = message.channel.isThread()
    ? message.channel.parentId
    : message.channel.id;
  return `guild:${message.guild.id}:chan:${channelId}`;
}
```

### 2. Honcho Service Interface

```typescript
// src/lib/memory/honcho/service.ts

export interface HonchoService {
  // Store a message exchange
  ingestMessage(ctx: MessageContext, content: string, role: 'user' | 'assistant'): Promise<void>;

  // Get context for LLM generation
  getContext(ctx: MessageContext, options?: { tokens?: number }): Promise<ContextResult>;

  // Query user representation (dialectic)
  queryUser(userId: string, query: string, sessionId?: string): Promise<string>;

  // Cross-channel search within a guild (ask-driven)
  searchGuild(guildId: string, query: string): Promise<SearchResult[]>;
}

export interface MessageContext {
  userId: string;
  channelId: string;
  guildId?: string;
  parentChannelId?: string; // For threads
  isDM: boolean;
}
```

### 3. File Structure

```
src/lib/memory/
├── index.ts                 # Re-exports (update to include honcho)
├── types.ts                 # Shared types
├── honcho/
│   ├── index.ts             # Exports
│   ├── client.ts            # Honcho client initialization
│   ├── service.ts           # Main service implementation
│   ├── ids.ts               # ID resolution functions
│   └── triggers.ts          # Cross-channel recall trigger detection
└── provider.ts              # REMOVE or keep for migration
└── semantic/                # REMOVE entirely
```

### 4. Integration Points

**Message handler** (`src/events/message-create/index.ts`):
```typescript
// Before: calls saveChatMemory() with Pinecone
// After: calls honchoService.ingestMessage()

// Before: working memory from Redis
// After: honchoService.getContext() includes user representation
```

**Agent orchestrator** (`src/lib/ai/agents/orchestrator.ts`):
```typescript
// Before: memories tool queries Pinecone
// After: memories tool calls honchoService.queryUser() or .searchGuild()
```

**Tools** (`src/lib/ai/agents/tools/`):
```typescript
// Before: rememberFact/forgetFact modify Redis working memory
// After: REMOVE these tools - Honcho infers facts automatically from conversations
```

---

## Cross-Channel Recall Rules

### When to trigger cross-channel search

**Explicit triggers** (always search):
- "what did we decide"
- "earlier we said"
- "last time"
- "in another channel"
- "didn't we discuss"
- "what's the status"
- "remind me"

**Soft triggers** (search if current context insufficient):
- Decision-history questions: "Are we using X or Y?"
- Policy questions: "What's our approach to Z?"

### Implementation

```typescript
// src/lib/memory/honcho/triggers.ts

const EXPLICIT_TRIGGERS = [
  /what did we decide/i,
  /earlier we said/i,
  /last time/i,
  /in another channel/i,
  /didn't we discuss/i,
  /what's the status/i,
  /remind me/i,
];

export function shouldSearchCrossChannel(prompt: string): boolean {
  return EXPLICIT_TRIGGERS.some(pattern => pattern.test(prompt));
}
```

---

## Migration Steps

### Phase 1: Setup
1. Install `@honcho-ai/sdk`
2. Add `HONCHO_API_KEY` and `HONCHO_BASE_URL` to env
3. Create `src/lib/memory/honcho/` structure

### Phase 2: Implement
4. Create Honcho client initialization
5. Implement service with ingest/getContext/queryUser
6. Wire into message handler (parallel to existing)

### Phase 3: Switch
7. Remove Pinecone semantic memory calls
8. Remove Redis working memory (or keep for non-memory state)
9. Remove `rememberFact`/`forgetFact` tools
10. Update `memories` tool to use Honcho

### Phase 4: Cleanup
11. Delete `src/lib/memory/semantic/` directory
12. Remove Pinecone dependency
13. Update exports in `src/lib/memory/index.ts`

---

## Environment Variables

```bash
# Honcho (self-hosted)
HONCHO_API_KEY=your-api-key
HONCHO_BASE_URL=http://localhost:8000  # or your self-hosted URL
HONCHO_WORKSPACE_ID=gork
```

---

## Context Budget

Start with these defaults (tune based on usage):
- `tokens: 1024` for standard replies
- `tokens: 2048` for complex queries or cross-channel recall
- Include `peer_target` to get user-specific representation

---

## What Gets Removed

| Component | Current Location | Action |
|-----------|------------------|--------|
| Pinecone client | `src/lib/memory/semantic/` | Delete entire directory |
| Redis working memory | `src/lib/memory/provider.ts` | Delete or repurpose for rate limiting only |
| `saveChatMemory()` | `src/lib/memory/semantic/ingest.ts` | Replace with Honcho ingest |
| `saveToolMemory()` | `src/lib/memory/semantic/ingest.ts` | Replace with Honcho ingest |
| `searchMemories()` | `src/lib/memory/semantic/search.ts` | Replace with Honcho context/query |
| `rememberFact` tool | `src/lib/ai/agents/tools/` | Remove - Honcho infers facts |
| `forgetFact` tool | `src/lib/ai/agents/tools/` | Remove - or implement via Honcho API |
| `PINECONE_*` env vars | `.env` | Remove |

---

## Resources

- Honcho Docs: https://docs.honcho.dev
- TypeScript SDK: https://github.com/plastic-labs/honcho-node
- Discord Starter: https://github.com/plastic-labs/discord-python-starter
- Architecture: https://docs.honcho.dev/v3/documentation/core-concepts/architecture
