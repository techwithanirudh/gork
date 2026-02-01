# Gork Memory Plan

> **Last Updated:** 2026-02-01
> **Status:** Reframing options and evaluating Honcho

## Goals

- High‑quality recall with minimal context bloat
- Multi‑tenant Discord scoping (guild, channel, user, participants)
- Works with current stack (Bun + TS, Pinecone, OpenRouter proxy)
- Low operational friction for local dev

## Current Reality

We need memory that can:

- Store rich metadata and filter across it
- Avoid irrelevant context injection
- Support provider‑agnostic LLM routing (OpenRouter or similar)
- Scale to thousands of guilds

## Options (Reframed)

### Option A — Keep Current Architecture (Working + Vector)

**Shape**

- Working memory: custom Redis per user
- Vector memory: Pinecone (direct client or Mastra RAG wrapper)
- Query both; stitch results into prompt

**Pros**

- Fully compatible with Pinecone + OpenRouter
- Known behavior in prod
- No new vendor lock‑in

**Cons**

- Two systems to maintain
- Dedup/conflict handling is basic
- Context bloat risk unless we keep top‑K tight

**Best for:** low risk, quick improvements, preserve stack

---

### Option B — LLM‑Extracted Facts Per Turn (mem0‑style, custom)

**Shape**

- Each turn: extract facts + update/merge existing memory
- CRUD memory records with conflict resolution
- Use Pinecone for storage; OpenRouter for LLMs

**Pros**

- Best response quality (cleaner context)
- Automatic dedup + conflict resolution
- Single memory system

**Cons**

- Extra latency and LLM cost per turn
- Requires building/maintaining extraction logic

**Best for:** highest quality, willing to build custom layer

---

### Option C — Mastra Memory (Working + Vector)

**Shape**

- Use `@mastra/memory` for both working and semantic memory

**Todo**
- See if using just `@mastra/rag` and `@mastra/memory` work fine, so we have the best of both worlds

**Pros**

- Cleaner code
- Unified API

**Cons**

- Hard‑coded scoping (`thread_id`/`resource_id`) does not fit Discord
- Limited custom filters for our multi‑tenant model

**Best for:** not a fit without forking core

---

### Option D — Honcho (New Direction)

**What it is**

Honcho is a memory library + managed service for stateful agents. It models:

- **Workspaces** (top‑level isolation)
- **Peers** (users, agents, or any entity)
- **Sessions** (interaction threads)
- **Messages** (ingest + background reasoning)

It continuously reasons over messages to build peer representations and can return synthesized context via a chat or context endpoint. It is LLM‑provider agnostic and supports managed or self‑hosted deployments.

**Why it might fit**

- Built for multi‑entity memory (peers + sessions)
- Background reasoning can reduce context bloat
- Works with any LLM provider
- Strong conceptual model for multi‑tenant systems

**Unknowns to validate**

- TS SDK maturity and ergonomics in Bun
- Whether we can map Discord multi‑tenant scoping cleanly
- Cost, latency, and control tradeoffs vs Pinecone

---

## Short Recommendation

- **If we want minimal change and compatibility:** Option A
- **If we want best response quality:** Option B (custom mem0‑style layer)
- **If we want a new foundation:** Option D (Honcho) — needs discovery
