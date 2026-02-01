# Gork Memory System: Migration Evaluation Plan

> **Last Updated:** Session handoff document  
> **Status:** Evaluating alternatives to current memory implementation

---

## Table of Contents

1. [Current State](#current-state)
2. [The Problem](#the-problem)
3. [Options Evaluated](#options-evaluated)
4. [Mastra Deep Dive](#mastra-deep-dive)
5. [mem0ai Deep Dive](#mem0ai-deep-dive)
6. [Comparison Matrix](#comparison-matrix)
7. [Recommendation](#recommendation)
8. [Migration Path](#migration-path)

---

## Current State

Gork has a **dual memory system** with ~940 lines of custom code:

### 1. Working Memory (Redis)

**Location:** `src/lib/memory/provider.ts` (232 lines)  
**Library:** `@ai-sdk-tools/memory` v1.2.0 with `RedisProvider`

```
┌─────────────────────────────────────────────┐
│              Working Memory                  │
│  ┌─────────────────────────────────────┐    │
│  │  # User Memory                       │    │
│  │  ## Facts                            │    │
│  │  - User's name is Alex               │    │
│  │  ## Preferences                      │    │
│  │  - Prefers sci-fi movies             │    │
│  │  ## Notes                            │    │
│  │  - Working on a Discord bot          │    │
│  └─────────────────────────────────────┘    │
│                                              │
│  Scoped by: guildId + userId                │
│  Storage: Redis with 90-day TTL             │
└─────────────────────────────────────────────┘
```

**Custom code we wrote:**

- `parseWorkingMemory()` - Extracts facts/preferences/notes from markdown
- `buildWorkingMemory()` - Reconstructs markdown from arrays
- `isDuplicate()` - Checks for similar existing items (substring matching)
- `addToWorkingMemory()` - Safe append with deduplication
- `removeFromWorkingMemory()` - For corrections/forgetting

**Problem:** `@ai-sdk-tools/memory` only does full replace. We had to build all the merge/dedup logic ourselves.

### 2. Semantic Memory (Pinecone)

**Location:** `src/lib/memory/semantic/*` (~620 lines total)  
**Library:** `@pinecone-database/pinecone` (direct client)

| File        | Lines | Purpose                                        |
| ----------- | ----- | ---------------------------------------------- |
| `search.ts` | 140   | Core Pinecone operations (search, add, delete) |
| `ingest.ts` | 203   | `saveChatMemory()`, `saveToolMemory()`         |
| `query.ts`  | 72    | `queryMemories()` with filters                 |
| `format.ts` | ~200  | Format memories for AI consumption             |

**Metadata Schema** (`src/lib/validators/pinecone.ts`, 247 lines):

```typescript
// Rich metadata for Discord multi-tenancy
{
  version: 2,
  type: 'chat' | 'tool' | 'summary' | 'entity',
  createdAt: number,
  sessionId: string,           // "guild:123:456" or "dm:a:b"
  sessionType: 'dm' | 'guild',
  guildId: string,             // Discord server ID
  guildName: string,
  channelId: string,           // Discord channel ID
  channelName: string,
  channelType: 'dm' | 'text' | 'voice' | 'thread',
  participantIds: string[],    // User IDs in conversation
  entityIds: string[],         // Referenced entities
  context: string,             // For chat type
  name: string,                // For tool type
  response: string,            // For tool type
}
```

**Filter usage in Gork:**

```typescript
// From query.ts - we use Pinecone's native filter syntax
const filter = {
  version: { $eq: 2 },
  guildId: { $eq: 'server-456' },
  type: { $eq: 'chat' },
  createdAt: { $gt: timestamp },
};
```

---

## The Problem

### Why consider migration?

1. **940 lines of custom memory code to maintain**
2. **No automatic fact extraction** - AI must explicitly call `rememberFact` tool
3. **Basic deduplication** - Our `isDuplicate()` is just substring matching
4. **No conflict resolution** - If user says "I live in NYC" then "I moved to LA", both are stored
5. **Two separate systems** - Working memory (Redis) and semantic memory (Pinecone) don't share logic

### What we need from any replacement:

| Requirement             | Priority     | Notes                                            |
| ----------------------- | ------------ | ------------------------------------------------ |
| Custom metadata filters | **Critical** | `guildId`, `channelId`, `type`, `participantIds` |
| Pinecone support        | **Critical** | We have existing data                            |
| Multi-tenant isolation  | **Critical** | Thousands of Discord servers                     |
| TypeScript SDK          | **High**     | Project is TypeScript                            |
| Auto deduplication      | **Medium**   | Replace our `isDuplicate()`                      |
| Auto fact extraction    | **Medium**   | Would reduce tool calls                          |
| Working memory merge    | **Medium**   | Replace our custom markdown parsing              |

---

## Options Evaluated

### Option A: Stay with Current Implementation

**Pros:**

- Already working in production
- Full control over behavior
- No migration risk

**Cons:**

- 940 lines to maintain
- No auto-dedup or fact extraction
- Two disconnected systems

### Option B: Mastra

Two separate components to consider:

| Component  | Package          | What it does                                     |
| ---------- | ---------------- | ------------------------------------------------ |
| **Memory** | `@mastra/memory` | High-level: threads, messages, working memory    |
| **RAG**    | `@mastra/rag`    | Low-level: vector store abstraction with filters |

### Option C: mem0ai

Single unified memory system with LLM-powered fact extraction.

---

## Mastra Deep Dive

### `@mastra/memory` - The High-Level API

**What it provides:**

- Thread management (create, list, delete threads)
- Message history (save, retrieve messages)
- Working memory with template-based merge
- Semantic recall (vector search)

**What works:**

```typescript
import { Memory } from '@mastra/memory';

const memory = new Memory({
  storage: new PostgresStorage({ connectionString }),
  vector: new PineconeVector({ apiKey }),
  options: {
    workingMemory: {
      enabled: true,
      template: `<facts>{{facts}}</facts>`, // ✅ Schema-based merge
    },
    semanticRecall: {
      topK: 5,
      messageRange: { before: 2, after: 1 },
    },
  },
});

// ✅ Thread management works
const thread = await memory.createThread({ resourceId: 'user-123' });

// ✅ Message saving works
await memory.saveMessages({ threadId: thread.id, messages });

// ✅ Working memory with merge semantics
await memory.updateWorkingMemory({ threadId, content: newFacts });
```

**What DOESN'T work for Gork:**

```typescript
// ❌ Semantic recall filters are HARDCODED
// From Mastra source (Memory class, lines ~186-198):
filter: resourceScope ? { resource_id: resourceId } : { thread_id: threadId };

// ❌ We CANNOT do this:
await memory.query({
  threadId: thread.id,
  query: 'user preferences',
  filter: {
    // ❌ NOT SUPPORTED
    guildId: 'server-456',
    channelId: 'channel-789',
  },
});
```

**The fundamental problem:**

Mastra Memory assumes a simple scope model:

- `thread_id` - A single conversation thread
- `resource_id` - A user or entity

Gork needs a richer scope model:

- `guildId` - Which Discord server
- `channelId` - Which channel in that server
- `userId` - Which user
- `type` - chat vs tool vs summary
- `participantIds` - Who was in the conversation

**Verdict on `@mastra/memory`:** ❌ **Does not fit Gork's multi-tenant model**

---

### `@mastra/rag` - The Low-Level API

**What it provides:**

- Unified vector store abstraction
- MongoDB/Sift-style filter syntax
- Support for Pinecone, Qdrant, PgVector, etc.

**What works:**

```typescript
import { PineconeVector } from '@mastra/pinecone';

const store = new PineconeVector({
  apiKey: process.env.PINECONE_API_KEY,
  indexName: 'gork-memories',
});

// ✅ Full custom filter support!
const results = await store.query({
  indexName: 'gork-memories',
  queryVector: embedding,
  topK: 10,
  filter: {
    guildId: { $eq: 'server-456' }, // ✅ Works
    channelId: { $in: ['ch-1', 'ch-2'] }, // ✅ Works
    type: { $ne: 'deleted' }, // ✅ Works
    $and: [
      // ✅ Works
      { userId: 'user-123' },
      { createdAt: { $gte: timestamp } },
    ],
  },
});

// ✅ Upsert with custom metadata
await store.upsert({
  indexName: 'gork-memories',
  vectors: [
    {
      id: 'mem-123',
      vector: embedding,
      metadata: {
        guildId: 'server-456',
        channelId: 'channel-789',
        type: 'chat',
        // ... all our custom fields
      },
    },
  ],
});
```

**Supported operators for Pinecone:**

| Operator       | Example                          | Supported  |
| -------------- | -------------------------------- | ---------- |
| `$eq`          | `{ guildId: { $eq: "123" } }`    | ✅         |
| `$ne`          | `{ type: { $ne: "deleted" } }`   | ✅         |
| `$gt` / `$gte` | `{ createdAt: { $gt: ts } }`     | ✅         |
| `$lt` / `$lte` | `{ createdAt: { $lt: ts } }`     | ✅         |
| `$in` / `$nin` | `{ type: { $in: ["a", "b"] } }`  | ✅         |
| `$all`         | `{ tags: { $all: ["x", "y"] } }` | ✅         |
| `$and` / `$or` | Complex boolean logic            | ✅         |
| `$exists`      | `{ field: { $exists: true } }`   | ✅         |
| `$contains`    | Text substring                   | ❌ Limited |
| `$regex`       | Pattern matching                 | ❌ No      |

**What `@mastra/rag` does NOT provide:**

| Feature                   | Provided? | Notes               |
| ------------------------- | --------- | ------------------- |
| Vector store queries      | ✅ Yes    | Full filter support |
| Embedding creation        | ✅ Yes    | Via `@mastra/core`  |
| Automatic fact extraction | ❌ No     | You build it        |
| Automatic deduplication   | ❌ No     | You build it        |
| Working memory management | ❌ No     | You build it        |
| Thread/message management | ❌ No     | You build it        |
| Conflict resolution       | ❌ No     | You build it        |

**Verdict on `@mastra/rag`:** ✅ **Good fit for semantic memory, but only replaces Pinecone client code**

---

### Mastra Summary

| Component        | Fits Gork? | What it replaces            |
| ---------------- | ---------- | --------------------------- |
| `@mastra/memory` | ❌ No      | Nothing (filter limitation) |
| `@mastra/rag`    | ✅ Yes     | `search.ts` (~140 lines)    |

**If we adopt Mastra RAG only:**

- Replace: Direct Pinecone client with unified abstraction
- Keep: All custom metadata schema, ingest logic, query logic
- Keep: Working memory (Redis + custom code)
- Gain: Unified filter syntax, potential to swap vector DBs later
- Lines saved: ~50-80 (just the Pinecone client wrapper)

---

## mem0ai Deep Dive

### What it provides

mem0ai is a unified memory system with LLM-powered intelligence:

```typescript
import { Memory } from 'mem0ai/oss';

const memory = new Memory({
  vectorStore: {
    provider: 'pinecone',
    config: {
      collection_name: 'gork-memories',
      embedding_model_dims: 1536,
      serverless_config: { cloud: 'aws', region: 'us-east-1' },
    },
  },
  embedder: {
    provider: 'openai',
    config: { model: 'text-embedding-3-small' },
  },
  llm: {
    provider: 'openai',
    config: { model: 'gpt-4.1-nano-2025-04-14' }, // Cheap model for extraction
  },
});
```

### Auto Fact Extraction

```typescript
const messages = [
  { role: 'user', content: 'My name is Alex and I live in NYC' },
  { role: 'assistant', content: 'Nice to meet you, Alex!' },
  { role: 'user', content: 'Actually I just moved to LA' },
];

// mem0 AUTOMATICALLY:
// 1. Extracts: "User's name is Alex"
// 2. Extracts: "User lives in LA" (not NYC - conflict resolved!)
// 3. Deduplicates against existing memories
await memory.add(messages, {
  userId: 'user-123',
  metadata: {
    guildId: 'server-456',
    channelId: 'channel-789',
  },
});
```

### Custom Metadata Filters ✅

```typescript
// Full filter support on search!
const results = await memory.search('What do you know about the user?', {
  userId: 'user-123',
  filters: {
    AND: [
      { guildId: { eq: 'server-456' } },
      { type: { in: ['chat', 'tool'] } },
      { createdAt: { gte: timestamp } },
    ],
  },
});
```

**Supported operators:**

| Operator        | mem0 Syntax                       | Supported              |
| --------------- | --------------------------------- | ---------------------- |
| Equality        | `{ field: { eq: "value" } }`      | ✅                     |
| Not equal       | `{ field: { ne: "value" } }`      | ✅                     |
| Greater than    | `{ field: { gt: 100 } }`          | ✅                     |
| Less than       | `{ field: { lt: 100 } }`          | ✅                     |
| In list         | `{ field: { in: ["a", "b"] } }`   | ✅                     |
| Not in list     | `{ field: { nin: ["a", "b"] } }`  | ✅                     |
| Contains (text) | `{ field: { contains: "text" } }` | ⚠️ Limited on Pinecone |
| AND/OR/NOT      | `{ AND: [...] }`                  | ✅                     |

### Full API

```typescript
// Add memories (with auto-extraction)
await memory.add(messages, { userId, metadata });

// Search memories (with filters)
const results = await memory.search(query, { userId, filters });

// Get all memories for a user
const all = await memory.getAll({ userId });

// Get specific memory
const one = await memory.get(memoryId);

// Update a memory manually
await memory.update(memoryId, 'new content');

// Delete a memory
await memory.delete(memoryId);

// Delete all for a user
await memory.deleteAll({ userId });

// Get memory history (audit trail)
const history = await memory.history(memoryId);
```

### What mem0 provides vs requires

| Feature                  | Provided?  | Notes                       |
| ------------------------ | ---------- | --------------------------- |
| Vector storage           | ✅ Yes     | Pinecone, Qdrant, etc.      |
| Embedding creation       | ✅ Yes     | OpenAI, etc.                |
| **Auto fact extraction** | ✅ Yes     | LLM-powered                 |
| **Auto deduplication**   | ✅ Yes     | Conflict resolution         |
| Custom metadata filters  | ✅ Yes     | Full support                |
| Memory history           | ✅ Yes     | SQLite or Supabase          |
| Working memory           | ⚠️ Partial | No markdown template system |
| Thread management        | ❌ No      | Not its focus               |

### Concerns with mem0

| Concern                          | Severity | Mitigation                            |
| -------------------------------- | -------- | ------------------------------------- |
| **LLM cost per add()**           | Medium   | Use cheap model (`gpt-4.1-nano`)      |
| **Latency on add()**             | Medium   | LLM call adds ~500ms-2s               |
| **Different filter syntax**      | Low      | Similar to our current, easy to adapt |
| **Migration of existing data**   | Medium   | New namespace or gradual migration    |
| **Less control over extraction** | Low      | Custom prompts available              |

### Current blockers (OSS in practice)

The OSS package does not match our required stack:

- **No Pinecone adapter in OSS**: `VectorStoreFactory` only supports memory/qdrant/redis/supabase/langchain/vectorize/azure-ai-search. Pinecone is not wired in, so it will never work without patching or upstream changes.
- **No OpenRouter support**: Embedder/LLM factories only expose built-in providers; OpenRouter is not available, so routing all traffic through OpenRouter is not possible without a fork.
- **Native binding friction**: `sqlite3` is eagerly required in the OSS bundle, causing Bun startup crashes without patches.
- **Supabase schema strictness**: Supabase vector store hard-fails at init unless the SQL schema + `match_vectors` function exist. This makes local dev brittle and adds setup burden.

**Net:** mem0 OSS is not drop-in compatible with our Pinecone + OpenRouter setup.

### Cost Estimate

Assuming `gpt-4.1-nano-2025-04-14` at ~$0.10/1M tokens:

- Average conversation: ~500 tokens input
- Extraction: ~100 tokens output
- Cost per `add()`: ~$0.00006

For 100,000 `add()` calls/month: **~$6/month** in extraction costs.

---

## Comparison Matrix

### Feature Comparison

| Feature                 | Current   | Mastra Memory | Mastra RAG        | mem0ai     |
| ----------------------- | --------- | ------------- | ----------------- | ---------- |
| Custom metadata filters | ✅ Native | ❌ Hardcoded  | ✅ MongoDB syntax | ✅ Full    |
| Pinecone support        | ✅ Direct | ✅ Yes        | ✅ Yes            | ✅ Yes     |
| Auto fact extraction    | ❌ No     | ❌ No         | ❌ No             | ✅ Yes     |
| Auto deduplication      | ⚠️ Basic  | ⚠️ Partial    | ❌ No             | ✅ Yes     |
| Conflict resolution     | ❌ No     | ❌ No         | ❌ No             | ✅ Yes     |
| Working memory merge    | ⚠️ Custom | ✅ Built-in   | ❌ No             | ⚠️ Partial |
| Memory history/audit    | ❌ No     | ❌ No         | ❌ No             | ✅ Yes     |
| Thread management       | ❌ Custom | ✅ Built-in   | ❌ No             | ❌ No      |
| Discord multi-tenant    | ✅ Custom | ❌ Poor fit   | ✅ Works          | ✅ Works   |

### Code Impact

| Approach            | Lines Replaced | Lines Added | Net Change |
| ------------------- | -------------- | ----------- | ---------- |
| Stay current        | 0              | 0           | 0          |
| Mastra RAG only     | ~80            | ~60         | -20        |
| mem0 for semantic   | ~400           | ~100        | **-300**   |
| mem0 full migration | ~600           | ~150        | **-450**   |

### Risk Assessment

| Approach            | Risk Level | Main Risks                             |
| ------------------- | ---------- | -------------------------------------- |
| Stay current        | Low        | Technical debt, no improvements        |
| Mastra RAG only     | Low        | Minimal change, easy to revert         |
| mem0 for semantic   | Medium     | New dependency, LLM costs, migration   |
| mem0 full migration | High       | Major refactor, working memory changes |

---

## Recommendation

### TL;DR

**Recommended: Full mem0ai migration (replace BOTH working memory AND semantic memory)**

### Why Full Migration?

The key insight is that mem0's auto fact extraction **eliminates the need for separate working memory**:

**Current (Two Systems):**

```
┌─────────────────┐     ┌─────────────────┐
│ Working Memory  │     │ Semantic Memory │
│    (Redis)      │     │   (Pinecone)    │
│                 │     │                 │
│ - Manual facts  │     │ - Transcripts   │
│ - Markdown fmt  │     │ - Tool results  │
│ - rememberFact  │     │ - Manual embed  │
│   tool needed   │     │                 │
└─────────────────┘     └─────────────────┘
     232 lines              ~620 lines
```

**mem0 (Single System):**

```
┌─────────────────────────────────────────┐
│           mem0ai (Pinecone)             │
│                                         │
│  - Auto fact extraction from convos     │
│  - Auto deduplication                   │
│  - Conflict resolution                  │
│  - Custom metadata filters              │
│  - Memory history/audit                 │
│  - No rememberFact tool needed!         │
│  - No markdown parsing!                 │
│  - No Redis dependency for memory!      │
└─────────────────────────────────────────┘
          ~150 lines wrapper
```

### The Flow Changes

**Current flow (requires AI to decide to remember):**

```
User: "My name is Alex and I love sci-fi"
  ↓
AI processes message
  ↓
AI decides: "I should remember this"
  ↓
AI calls rememberFact("User's name is Alex")
AI calls rememberFact("User loves sci-fi")
  ↓
Our code: parseWorkingMemory() → isDuplicate() → buildWorkingMemory()
  ↓
Stored in Redis as markdown
```

**mem0 flow (automatic extraction):**

```
User: "My name is Alex and I love sci-fi"
  ↓
AI processes message, responds
  ↓
At end of turn: memory.add(messages, { userId, metadata })
  ↓
mem0 automatically:
  - Extracts: "User's name is Alex"
  - Extracts: "User loves sci-fi"
  - Checks for duplicates
  - Resolves conflicts with existing memories
  ↓
Stored in Pinecone with full metadata
```

**Bonus:** If user later says "Actually my name is Alexander", mem0 automatically updates the fact instead of storing a duplicate!

### Reasoning

1. **Mastra Memory doesn't fit** - The hardcoded `thread_id`/`resource_id` filter limitation is a dealbreaker for Discord's multi-tenant model.

2. **Mastra RAG is underwhelming** - It only replaces the Pinecone client (~80 lines). Not worth adding a dependency for such minimal gain.

3. **mem0ai provides massive value:**
   - Auto fact extraction = **no more `rememberFact` tool**
   - Auto deduplication = **no more `isDuplicate()` function**
   - Conflict resolution = **no more stale/contradictory facts**
   - Single system = **no Redis + Pinecone split**
   - Custom metadata filters = **Discord multi-tenant works perfectly**
   - Memory history = **audit trail for debugging**
   - **~800 lines of code eliminated**

4. **Simpler mental model** - One memory system instead of two. Everything goes through `memory.add()` and `memory.search()`.

### Recommended Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                 Gork Memory System (mem0)                    │
│                                                              │
│  ┌─────────────────────────────────────────────────────────┐│
│  │                    mem0ai/oss                            ││
│  │                                                          ││
│  │  memory.add(messages, {                                  ││
│  │    userId: `${guildId}:${userId}`,                       ││
│  │    metadata: { guildId, channelId, type, ... }           ││
│  │  })                                                      ││
│  │                                                          ││
│  │  → Auto extracts facts, preferences, context             ││
│  │  → Auto deduplicates against existing                    ││
│  │  → Auto resolves conflicts ("moved from NYC to LA")      ││
│  │                                                          ││
│  │  memory.search(query, {                                  ││
│  │    userId: `${guildId}:${userId}`,                       ││
│  │    filters: { guildId: {eq: "..."}, type: {in: [...]} }  ││
│  │  })                                                      ││
│  │                                                          ││
│  │  → Returns relevant memories for context                 ││
│  │  → Full filter support for Discord scoping               ││
│  └─────────────────────────────────────────────────────────┘│
│                                                              │
│  Storage: Pinecone (same index, new namespace)               │
│  Embeddings: OpenAI text-embedding-3-small                   │
│  Extraction: gpt-4.1-nano (cheap, fast)                      │
└─────────────────────────────────────────────────────────────┘
```

### What Gets Deleted (🎉)

| File                                               | Lines    | Why it's gone                           |
| -------------------------------------------------- | -------- | --------------------------------------- |
| `src/lib/memory/provider.ts`                       | 232      | mem0 handles facts/prefs automatically  |
| `src/lib/memory/semantic/search.ts`                | 140      | mem0 `memory.add()` / `memory.search()` |
| `src/lib/memory/semantic/ingest.ts`                | 203      | mem0 `memory.add()` with metadata       |
| `src/lib/memory/semantic/query.ts`                 | 72       | mem0 `memory.search()` with filters     |
| `src/lib/memory/semantic/format.ts`                | ~200     | mem0 returns structured data            |
| `src/lib/ai/agents/tools/memory/working-memory.ts` | ~100     | No more manual rememberFact tool!       |
| **Total**                                          | **~850** |                                         |

### What Gets Added

| File                           | Lines    | Purpose                               |
| ------------------------------ | -------- | ------------------------------------- |
| `src/lib/memory/mem0.ts`       | ~80      | mem0 client config + initialization   |
| `src/lib/memory/operations.ts` | ~70      | Thin wrappers for Gork-specific usage |
| **Total**                      | **~150** |                                       |

### Net Result: **~700 lines removed**

### Tools Impact

| Tool               | Current                        | After Migration                        |
| ------------------ | ------------------------------ | -------------------------------------- |
| `rememberFact`     | Required for AI to store facts | **DELETE** - automatic                 |
| `forgetFact`       | Manual deletion                | Keep - maps to `memory.delete()`       |
| `searchMemories`   | Query semantic memory          | Keep - maps to `memory.search()`       |
| `getWorkingMemory` | Get user facts                 | **CHANGE** - becomes `memory.getAll()` |

### Alternative: Partial Migration

If you want to be more conservative:

```
┌─────────────────────────────────────────────────────────────┐
│                    Gork Memory System                        │
│                                                              │
│  ┌─────────────────────┐    ┌─────────────────────────────┐ │
│  │   Working Memory    │    │      Semantic Memory        │ │
│  │   (Keep Current)    │    │      (Migrate to mem0)      │ │
│  │                     │    │                             │ │
│  │  @ai-sdk-tools/     │    │  mem0ai/oss                 │ │
│  │  memory + Redis     │    │  + Pinecone                 │ │
│  └─────────────────────┘    └─────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

But this misses the main benefit: **automatic fact extraction eliminates the need for working memory as a separate concept.**

### Cost Comparison

| Approach                | Code Lines | Dependencies                            | Monthly Cost             |
| ----------------------- | ---------- | --------------------------------------- | ------------------------ |
| Current                 | ~940       | Redis + Pinecone + @ai-sdk-tools/memory | ~$0 (just infra)         |
| Partial (semantic only) | ~500       | Redis + Pinecone + mem0                 | ~$6 (LLM extraction)     |
| **Full mem0**           | **~150**   | **Pinecone + mem0**                     | **~$6 (LLM extraction)** |

The full migration removes a dependency (Redis for working memory) while reducing code by ~700 lines for the same LLM cost.

---

## Migration Path

### Phase 1: Prototype (1-2 days)

1. Install mem0ai: `bun add mem0ai`
2. Create `src/lib/memory/semantic-v2/` with mem0 integration
3. Test with a new Pinecone namespace: `gork-mem0-test`
4. Verify:
   - Custom metadata works
   - Filters work as expected
   - Fact extraction quality is acceptable
   - Latency is acceptable

### Phase 2: Shadow Mode (1 week)

1. Run both systems in parallel
2. Write to both, read from current
3. Compare results
4. Monitor LLM costs

### Phase 3: Gradual Rollout (1-2 weeks)

1. Switch reads to mem0 for new data
2. Keep current system for historical data
3. Monitor for issues

### Phase 4: Full Migration (when confident)

1. Migrate historical data (optional)
2. Remove old semantic memory code
3. Update all consumers

### Rollback Plan

- Keep old code in place during phases 1-3
- Feature flag to switch between systems
- Pinecone data is immutable (old namespace preserved)

---

## Decision Checklist

Before proceeding, confirm:

- [ ] Team agrees on recommended approach
- [ ] LLM cost (~$6/month at 100k ops) is acceptable
- [ ] Latency increase (~500ms-2s on add) is acceptable
- [ ] New Pinecone namespace is provisioned
- [ ] Prototype validates custom filter support
- [ ] Working memory stays on Redis (no changes needed)

---

## Appendix: Code Examples

### Current Implementation

```typescript
// Current: Manual everything
import { addMemory, searchMemories } from './semantic/search';

// Adding memory - manual metadata
await addMemory(transcript, {
  type: 'chat',
  guildId: message.guild.id,
  channelId: message.channel.id,
  // ... 15+ fields
});

// Searching - manual filter construction
const results = await searchMemories(query, {
  filter: {
    guildId: { $eq: guildId },
    type: { $in: ['chat', 'tool'] },
  },
});
```

### mem0 Implementation

```typescript
// mem0: Auto extraction + simpler API
import { Memory } from 'mem0ai/oss';

const memory = new Memory({
  /* config */
});

// Adding memory - auto fact extraction
await memory.add(messages, {
  userId: `${guildId}:${userId}`,
  metadata: {
    guildId: message.guild.id,
    channelId: message.channel.id,
    type: 'chat',
  },
});

// Searching - similar filter syntax
const results = await memory.search(query, {
  userId: `${guildId}:${userId}`,
  filters: {
    guildId: { eq: guildId },
    type: { in: ['chat', 'tool'] },
  },
});
```

---

## Questions?

Ping the team or continue the conversation in the next session.
