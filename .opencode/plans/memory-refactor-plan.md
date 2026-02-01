# Mem0 OSS Memory Refactor (Discord Bot)

## Goal

Replace the legacy Redis/Pinecone memory stack with a clean Mem0 OSS loop:

1. **Pre-step retrieval** before each response.
2. **Turn-based ingestion** (user + assistant) immediately after the reply.
3. **Strict Mem0 filters** only (no legacy `$` operators).
4. **Minimal tools**: `searchMemory` and `deleteMemory` only.

## Core Loop (Mem0 OSS)

```ts
// 1) Retrieve memories for current user
const memories = await memory.search(query, {
  userId: scopedUserId,
  limit: 5,
  filters: { guildId: message.guild?.id },
});

// 2) Inject into prompt (System message)
const memoryPrompt = formatMemories(memories);

// 3) Call model with injected memory block
// 4) After reply: addTurnMemory(user, assistant, metadata)
```

## Metadata + Filters

All stored memories include these fields so the filter surface is complete:

- `version`
- `type`
- `sessionId`
- `sessionType`
- `guildId`
- `guildName`
- `channelId`
- `channelName`
- `channelType`
- `participantIds`
- `entityIds`
- `createdAt`
- `lastRetrievalTime`

Allowed operators:
`eq`, `ne`, `gt`, `gte`, `lt`, `lte`, `in`, `nin`, `contains`, `icontains`, `*`, plus `AND/OR/NOT`.

## Tool Surface

Keep only:

- `searchMemory(query, userId?, filter?, limit?)`
- `deleteMemory(memoryId)`

No working memory tools, no memory agent, no transcript batching.

## Implementation Steps

1. Remove legacy memory agent, working memory, and Pinecone validators.
2. Implement Mem0 OSS wrapper (`addTurnMemory`, `searchMemories`, `deleteMemory`).
3. Inject memories pre-step in `generateResponse`.
4. Call `addTurnMemory` right after reply.
5. Update prompts and tools to reflect the new surface.

## Verification

- Reply once, confirm `addTurnMemory` is called.
- Confirm pre-step retrieval injects a mem0-style system block.
- Validate filters reject unsupported keys/operators.
