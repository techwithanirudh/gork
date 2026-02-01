# Gork Memory System Migration: From Dual-Memory to mem0ai

## Executive Summary

**Goal:** Replace the current dual-memory architecture (Redis working memory + Pinecone semantic memory) with a unified mem0ai-based system.

**Benefits:**

- ~800 lines deleted, ~200 lines added
- Automatic fact extraction (no more manual `rememberFact` tool)
- Automatic deduplication and conflict resolution
- Single unified memory API
- Better multi-tenant filtering support

**Trade-offs:**

- ~$6/month additional LLM cost for automatic fact extraction
- mem0 calls LLM on every `add()` operation

---

## Current Architecture

### 1. Working Memory (Redis-based)

**Files:**

- `src/lib/memory/provider.ts` (232 lines)

**Functionality:**

- Stores user facts, preferences, notes in markdown format
- Uses `@ai-sdk-tools/memory` RedisProvider
- Key functions:
  - `getWorkingMemory({ guildId, userId })` - Retrieve stored facts
  - `updateWorkingMemory({ guildId, userId, content })` - Update full content
  - `addToWorkingMemory({ guildId, userId, section, item })` - Add fact with dedup
  - `removeFromWorkingMemory({ guildId, userId, item })` - Remove fact
  - `parseWorkingMemory(content)` - Parse markdown into sections

**Data Model:**

```markdown
# User Memory

## Facts

- User's name is John
- Works at Acme Corp

## Preferences

- Prefers dark mode
- Likes sci-fi movies

## Notes

- Mentioned a project deadline on Monday
```

### 2. Semantic Memory (Pinecone-based)

**Files:**

- `src/lib/memory/semantic/search.ts` (140 lines) - Pinecone client, embeddings
- `src/lib/memory/semantic/ingest.ts` (203 lines) - Save chat/tool memories
- `src/lib/memory/semantic/query.ts` (72 lines) - Query with filters
- `src/lib/memory/semantic/format.ts` (208 lines) - Format for AI consumption
- `src/lib/memory/semantic/index.ts` (11 lines) - Exports

**Functionality:**

- Stores chat transcripts and tool results as vector embeddings
- Key functions:
  - `saveChatMemory(message, contextLimit)` - Save recent chat context
  - `saveToolMemory(message, toolName, result)` - Save tool execution
  - `queryMemories(query, options)` - Search with filters
  - `searchMemories(query, options)` - Low-level Pinecone search
  - `formatMemories(memories)` - Convert to AI-readable format

**Metadata Schema:**

```typescript
{
  type: 'chat' | 'tool' | 'summary' | 'entity',
  sessionId: string,
  sessionType: 'dm' | 'guild',
  guildId: string | null,
  channelId: string,
  participantIds: string[],
  createdAt: number,
  // Chat-specific
  context?: string,
  // Tool-specific
  name?: string,
  response?: unknown,
}
```

### 3. Memory Tools

**Files:**

- `src/lib/ai/agents/tools/memory/working-memory.ts` (127 lines)
  - `rememberFact` - Store fact/preference/note (WILL BE REMOVED - mem0 auto-extracts)
  - `forgetFact` - Remove item from memory
  - `getMemory` - Retrieve user's working memory
- `src/lib/ai/agents/tools/memory/search-memories.ts` (136 lines)
  - `searchMemories` - Semantic search with filters
- `src/lib/ai/agents/tools/memory/index.ts` (7 lines)

### 4. Consumers

**Files that import from `@/lib/memory`:**

- `src/events/message-create/index.ts` (line 2, 67)
  - Uses: `saveChatMemory`
- `src/lib/ai/agents/orchestrator.ts` (line 1, 97)
  - Uses: `saveToolMemory`
- `src/lib/ai/agents/tools/memory/search-memories.ts` (line 1)
  - Uses: `formatMemories`, `queryMemories`
- `src/lib/ai/agents/agents/memory-agent.ts` (line 15)
  - Uses: `searchMemories` (tool export)
- `src/lib/ai/prompts/index.ts` (line 1-2)
  - Uses: `WorkingMemory` type, `formatWorkingMemory` from `@ai-sdk-tools/memory`
- `src/tests/pinecone.ts` (line 1)
  - Uses: `queryMemories`

### 5. Types & Validators

**Files:**

- `src/lib/memory/types.ts` (55 lines) - Memory type definitions
- `src/lib/validators/pinecone.ts` (247 lines) - Metadata schemas, flatten/expand

---

## mem0ai API Reference

### Installation

```bash
bun add mem0ai
```

### Initialization (from docs)

```typescript
import { Memory } from 'mem0ai/oss';

const memory = new Memory({
  vectorStore: {
    provider: 'pinecone',
    config: {
      apiKey: process.env.PINECONE_API_KEY,
      indexName: 'gork-memories', // Use existing index
      namespace: 'mem0', // Separate namespace to avoid conflicts
      embeddingModelDims: 1536, // text-embedding-3-small
    },
  },
  embedder: {
    provider: 'openai',
    config: {
      apiKey: process.env.OPENAI_API_KEY,
      model: 'text-embedding-3-small',
    },
  },
  llm: {
    provider: 'openai',
    config: {
      apiKey: process.env.OPENAI_API_KEY,
      model: 'gpt-4.1-nano-2025-04-14', // Cheap model for extraction
    },
  },
  disableHistory: true, // No SQLite audit trail needed
});
```

### Core Operations

#### Add Memory

```typescript
// mem0 automatically extracts facts from conversation
await memory.add(
  [
    { role: 'user', content: 'I love sci-fi movies' },
    { role: 'assistant', content: "Great! I'll remember that." },
  ],
  {
    userId: 'guild:123:user456', // Scoped user ID
    metadata: {
      type: 'chat',
      guildId: '123',
      channelId: '789',
      sessionId: 'guild:123:789',
    },
  },
);
// mem0 extracts: "User loves sci-fi movies" automatically
```

#### Search Memory

```typescript
const results = await memory.search('movie preferences', {
  userId: 'guild:123:user456',
  limit: 5,
  filters: {
    guildId: '123', // Simple equality
    type: { in: ['chat', 'tool'] }, // List filter
  },
});
// Returns: { results: [{ id, memory, score, metadata, createdAt }] }
```

#### Get All Memories

```typescript
const all = await memory.getAll({
  userId: 'guild:123:user456',
  limit: 50,
});
```

#### Delete Memory

```typescript
await memory.delete('memory-id-here');
await memory.deleteAll({ userId: 'guild:123:user456' });
```

### Filter Syntax (from docs)

```typescript
// mem0 uses simple syntax, NOT Pinecone's $eq format
filters: {
  guildId: "123",              // Equality
  type: { in: ["chat", "tool"] },  // List membership
  score: { gt: 0.8 },          // Greater than
  priority: { gte: 5 },        // Greater than or equal
  status: { ne: "archived" },  // Not equal
  AND: [                       // Logical AND
    { category: "work" },
    { priority: { gte: 7 } }
  ],
  OR: [                        // Logical OR
    { category: "urgent" },
    { deadline: { contains: "today" } }
  ]
}
```

---

## Migration Plan

### Phase 1: Create mem0 Module (NEW FILES)

#### 1.1 Create `src/lib/memory/mem0/client.ts`

```typescript
import { Memory } from 'mem0ai/oss';
import { env } from '@/env';
import { createLogger } from '@/lib/logger';

const logger = createLogger('memory:mem0:client');

let memoryInstance: Memory | null = null;

export function getMemory(): Memory {
  if (!memoryInstance) {
    memoryInstance = new Memory({
      vectorStore: {
        provider: 'pinecone',
        config: {
          apiKey: env.PINECONE_API_KEY,
          indexName: env.PINECONE_INDEX,
          namespace: 'mem0',
          embeddingModelDims: 1536,
        },
      },
      embedder: {
        provider: 'openai',
        config: {
          apiKey: env.OPENAI_API_KEY,
          model: 'text-embedding-3-small',
        },
      },
      llm: {
        provider: 'openai',
        config: {
          apiKey: env.OPENAI_API_KEY,
          model: 'gpt-4.1-nano-2025-04-14',
        },
      },
      disableHistory: true,
    });
    logger.info('mem0 memory client initialized');
  }
  return memoryInstance;
}

// Scoped user ID: ensures memory isolation per guild
export function scopedUserId(guildId: string | null, userId: string): string {
  if (!guildId) return `dm:${userId}`;
  return `guild:${guildId}:${userId}`;
}

// Session ID for grouping related memories
export function sessionId(guildId: string | null, channelId: string): string {
  if (!guildId) return `dm:${channelId}`;
  return `guild:${guildId}:${channelId}`;
}
```

#### 1.2 Create `src/lib/memory/mem0/operations.ts`

```typescript
import type { Message } from 'discord.js';
import { ChannelType } from 'discord.js';
import { createLogger } from '@/lib/logger';
import { getMemory, scopedUserId, sessionId } from './client';
import { getMessagesByChannel } from '@/lib/queries';

const logger = createLogger('memory:mem0:operations');

export interface MemoryMetadata {
  type: 'chat' | 'tool';
  sessionId: string;
  sessionType: 'dm' | 'guild';
  guildId: string | null;
  guildName: string | null;
  channelId: string;
  channelName: string;
  channelType: 'dm' | 'text' | 'voice' | 'thread' | 'unknown';
  participantIds: string[];
  createdAt: number;
  toolName?: string;
}

// Build metadata from Discord message
function buildMetadata(
  message: Message,
  type: 'chat' | 'tool',
  toolName?: string,
): MemoryMetadata {
  // ... implementation
}

// Format transcript from messages
function formatTranscript(messages: Message[]): string {
  return messages
    .map((msg) => `${msg.author.username}: ${msg.content ?? ''}`.trim())
    .join('\n')
    .trim();
}

// Save chat memory - mem0 auto-extracts facts
export async function saveChatMemory(
  message: Message,
  contextLimit = 5,
): Promise<void> {
  const recentMessages = await getMessagesByChannel({
    channel: message.channel,
    limit: contextLimit,
  });

  const transcript = formatTranscript(Array.from(recentMessages.values()));
  if (!transcript.trim()) return;

  const memory = getMemory();
  const metadata = buildMetadata(message, 'chat');
  const userId = scopedUserId(message.guild?.id ?? null, message.author.id);

  await memory.add([{ role: 'user', content: transcript }], {
    userId,
    metadata,
  });
  logger.debug({ userId, type: 'chat' }, 'Saved chat memory');
}

// Save tool memory
export async function saveToolMemory(
  message: Message,
  toolName: string,
  result: unknown,
): Promise<void> {
  const memory = getMemory();
  const metadata = buildMetadata(message, 'tool', toolName);
  const userId = scopedUserId(message.guild?.id ?? null, message.author.id);
  const content = `Tool "${toolName}" was used. Result: ${JSON.stringify(result)}`;

  await memory.add([{ role: 'assistant', content }], { userId, metadata });
  logger.debug({ userId, toolName }, 'Saved tool memory');
}

// Search memories with filters
export interface SearchOptions {
  limit?: number;
  guildId?: string;
  channelId?: string;
  type?: 'chat' | 'tool';
  participantId?: string;
}

export interface MemoryResult {
  id: string;
  content: string;
  score: number;
  metadata: Record<string, unknown>;
  createdAt?: string;
}

export async function searchMemories(
  query: string,
  userId: string,
  options: SearchOptions = {},
): Promise<MemoryResult[]> {
  const memory = getMemory();
  const { limit = 5, guildId, channelId, type, participantId } = options;

  const filters: Record<string, unknown> = {};
  if (guildId) filters.guildId = guildId;
  if (channelId) filters.channelId = channelId;
  if (type) filters.type = type;
  if (participantId) filters.participantIds = { in: [participantId] };

  const results = await memory.search(query, {
    userId,
    limit,
    filters: Object.keys(filters).length > 0 ? filters : undefined,
  });

  return (results.results ?? []).map((r) => ({
    id: r.id,
    content: r.memory,
    score: r.score ?? 0,
    metadata: r.metadata ?? {},
    createdAt: r.createdAt,
  }));
}

// Get all memories for a user (replaces working memory getAll)
export async function getAllMemories(
  userId: string,
  options: { limit?: number; guildId?: string } = {},
): Promise<MemoryResult[]> {
  const memory = getMemory();
  const results = await memory.getAll({ userId, limit: options.limit ?? 50 });
  return (results.results ?? []).map((r) => ({
    id: r.id,
    content: r.memory,
    score: 1,
    metadata: r.metadata ?? {},
    createdAt: r.createdAt,
  }));
}

// Delete specific memory
export async function deleteMemory(memoryId: string): Promise<boolean> {
  const memory = getMemory();
  await memory.delete(memoryId);
  return true;
}

// Delete all memories for user
export async function deleteAllMemories(userId: string): Promise<boolean> {
  const memory = getMemory();
  await memory.deleteAll({ userId });
  return true;
}
```

#### 1.3 Create `src/lib/memory/mem0/format.ts`

```typescript
import type { MemoryResult } from './operations';

// Format memories for AI consumption
export function formatMemories(memories: MemoryResult[]): string {
  if (memories.length === 0) return '';

  const sections = memories.map((m) => {
    const when = m.createdAt ? new Date(m.createdAt).toISOString() : 'unknown';
    const meta = m.metadata;
    const type = (meta.type as string) ?? 'memory';
    const guildName = (meta.guildName as string) ?? 'Unknown';
    const channelName = (meta.channelName as string) ?? 'Unknown';

    return [
      '- entry:',
      `    type: ${type}`,
      `    when: ${when}`,
      `    where: ${guildName} > ${channelName}`,
      `    content: ${m.content}`,
      `    relevance: ${(m.score * 100).toFixed(0)}%`,
    ].join('\n');
  });

  return ['[memory]', ...sections, '[/memory]'].join('\n');
}

// Format all memories as "working memory" style
export function formatAllMemories(memories: MemoryResult[]): string {
  if (memories.length === 0) {
    return '# User Memory\n\nNo memories stored yet.';
  }

  const lines = ['# User Memory', ''];
  for (const m of memories) {
    lines.push(`- ${m.content}`);
  }
  return lines.join('\n');
}
```

#### 1.4 Create `src/lib/memory/mem0/index.ts`

```typescript
export { getMemory, scopedUserId, sessionId } from './client';
export {
  saveChatMemory,
  saveToolMemory,
  searchMemories,
  getAllMemories,
  deleteMemory,
  deleteAllMemories,
  type SearchOptions,
  type MemoryResult,
  type MemoryMetadata,
} from './operations';
export { formatMemories, formatAllMemories } from './format';
```

### Phase 2: Update Memory Tools

#### 2.1 Update `src/lib/ai/agents/tools/memory/search-memories.ts`

- Replace `queryMemories` with mem0 `searchMemories`
- Replace `formatMemories` import
- Update filter syntax from `$eq` to mem0 style
- Handle `participantIds` filter properly

#### 2.2 Update `src/lib/ai/agents/tools/memory/working-memory.ts`

**REMOVE:** `rememberFact` tool (mem0 auto-extracts facts)

**UPDATE:** `forgetFact` tool

- Use mem0's search to find memories matching content
- Then use mem0's delete to remove them

**UPDATE:** `getMemory` tool

- Use mem0's `getAllMemories` with scoped userId
- Format with `formatAllMemories`

#### 2.3 Update `src/lib/ai/agents/tools/memory/index.ts`

- Remove `rememberFact` export
- Keep `forgetFact`, `getMemory`, `searchMemories`

### Phase 3: Update Consumers

#### 3.1 Update `src/events/message-create/index.ts`

```typescript
// Before
import { saveChatMemory } from '@/lib/memory';

// After
import { saveChatMemory } from '@/lib/memory/mem0';
```

#### 3.2 Update `src/lib/ai/agents/orchestrator.ts`

```typescript
// Before
import { saveToolMemory } from '@/lib/memory';

// After
import { saveToolMemory } from '@/lib/memory/mem0';
```

Also remove `rememberFact` from:

- EPHEMERAL_TOOLS set
- tools object

#### 3.3 Update `src/lib/ai/agents/agents/memory-agent.ts`

- Remove `rememberFact` import and tool

#### 3.4 Update `src/lib/ai/prompts/index.ts`

```typescript
// Before
import type { WorkingMemory } from '@ai-sdk-tools/memory';
import { formatWorkingMemory } from '@ai-sdk-tools/memory';

// After
// Remove these imports - we'll inline a simple formatter or use mem0's format
```

For working memory in prompts, either:

- Fetch memories at prompt generation time using `getAllMemories`
- Or pass pre-fetched memories and format inline

#### 3.5 Update `src/lib/ai/prompts/tasks/memory.ts`

- Update filter syntax examples from `$eq` to mem0 style
- Remove references to `rememberFact` tool
- Update workflow to reflect automatic fact extraction

### Phase 4: Update Main Exports

#### 4.1 Update `src/lib/memory/index.ts`

```typescript
// Re-export everything from mem0 module
export * from './mem0';

// Keep types if still needed
export * from './types';
```

### Phase 5: Delete Old Files

**DELETE these files:**

- `src/lib/memory/provider.ts` (232 lines)
- `src/lib/memory/semantic/search.ts` (140 lines)
- `src/lib/memory/semantic/ingest.ts` (203 lines)
- `src/lib/memory/semantic/query.ts` (72 lines)
- `src/lib/memory/semantic/format.ts` (208 lines)
- `src/lib/memory/semantic/index.ts` (11 lines)

**DELETE directory:**

- `src/lib/memory/semantic/`

### Phase 6: Cleanup & Verification

#### 6.1 Update package.json

- Remove `@ai-sdk-tools/memory` if no longer used elsewhere
- Verify `mem0ai` is already installed

#### 6.2 Run Type Check

```bash
bun run typecheck
```

#### 6.3 Test the Bot

```bash
bun run dev
```

---

## Files Summary

### Files to CREATE

| File                                | Purpose                                       |
| ----------------------------------- | --------------------------------------------- |
| `src/lib/memory/mem0/client.ts`     | mem0 client initialization, scoped IDs        |
| `src/lib/memory/mem0/operations.ts` | Core memory operations (save, search, delete) |
| `src/lib/memory/mem0/format.ts`     | Format memories for AI                        |
| `src/lib/memory/mem0/index.ts`      | Public exports                                |

### Files to MODIFY

| File                                                | Changes                                          |
| --------------------------------------------------- | ------------------------------------------------ |
| `src/lib/ai/agents/tools/memory/search-memories.ts` | Use mem0 operations, new filter syntax           |
| `src/lib/ai/agents/tools/memory/working-memory.ts`  | Remove rememberFact, update forgetFact/getMemory |
| `src/lib/ai/agents/tools/memory/index.ts`           | Remove rememberFact export                       |
| `src/events/message-create/index.ts`                | Import from mem0                                 |
| `src/lib/ai/agents/orchestrator.ts`                 | Import from mem0, remove rememberFact            |
| `src/lib/ai/agents/agents/memory-agent.ts`          | Remove rememberFact tool                         |
| `src/lib/ai/prompts/index.ts`                       | Remove @ai-sdk-tools/memory imports              |
| `src/lib/ai/prompts/tasks/memory.ts`                | Update filter syntax, remove rememberFact refs   |
| `src/lib/memory/index.ts`                           | Re-export from mem0                              |

### Files to DELETE

| File                                | Lines   |
| ----------------------------------- | ------- |
| `src/lib/memory/provider.ts`        | 232     |
| `src/lib/memory/semantic/search.ts` | 140     |
| `src/lib/memory/semantic/ingest.ts` | 203     |
| `src/lib/memory/semantic/query.ts`  | 72      |
| `src/lib/memory/semantic/format.ts` | 208     |
| `src/lib/memory/semantic/index.ts`  | 11      |
| **TOTAL DELETED**                   | **866** |

---

## Key Technical Details

### User ID Scoping

mem0 uses `userId` for memory isolation. We need to scope it:

```typescript
// Format: "guild:{guildId}:{userId}" or "dm:{userId}"
scopedUserId('123456789', '987654321'); // => "guild:123456789:987654321"
scopedUserId(null, '987654321'); // => "dm:987654321"
```

### Filter Syntax Migration

```typescript
// OLD (Pinecone style)
{ guildId: { $eq: "123" }, participantIds: { $in: ["456"] } }

// NEW (mem0 style)
{ guildId: "123", participantIds: { in: ["456"] } }
```

### Namespace Strategy

Use `namespace: "mem0"` to avoid conflicts with existing Pinecone data during migration.

### Environment Variables

Already have (no changes needed):

- `PINECONE_API_KEY`
- `PINECONE_INDEX`
- `OPENAI_API_KEY`

---

## Testing Checklist

- [ ] Bot starts without errors
- [ ] Chat memories are saved after conversations
- [ ] Tool memories are saved after tool executions
- [ ] `searchMemories` tool returns relevant results
- [ ] `getMemory` tool returns user's stored memories
- [ ] `forgetFact` tool can delete memories
- [ ] Memory search respects guild filters
- [ ] DM conversations are properly isolated
- [ ] No TypeScript errors (`bun run typecheck`)

---

## Rollback Plan

If issues arise:

1. The old Pinecone data remains in the default namespace
2. Restore deleted files from git: `git checkout HEAD -- src/lib/memory/`
3. Revert import changes
4. The `mem0` namespace can be deleted from Pinecone if needed

---

## Implementation Order

1. **First:** Create all `src/lib/memory/mem0/*` files
2. **Second:** Update `src/lib/memory/index.ts` to export from mem0
3. **Third:** Update tools (`search-memories.ts`, `working-memory.ts`)
4. **Fourth:** Update consumers (`message-create`, `orchestrator`, `memory-agent`)
5. **Fifth:** Update prompts (`index.ts`, `tasks/memory.ts`)
6. **Sixth:** Delete old files
7. **Seventh:** Run typecheck and fix any issues
8. **Eighth:** Test the bot
