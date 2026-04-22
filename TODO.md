# TODO

## Bugs
- Build context reference replies are broken
- Spam detector is broken — add cooldown on spam
- Relevance agent can also trigger a reply — fix so only the orchestrator sends
- Voice mode is fully broken — fix before anything else in voice
- Fix start DM + memory retrieval
- The bot doesn't always reply to the designated message (reply target)

## AI / Response
- Detect unfinished sentence (wait 1-2s before replying) — deduping
- Handle message interruptions — if user sends while gork is replying, pause and re-reply with context
- Add safety reply filter — when safe mode is on, post-process reply through a second pass
- Store SKIPs and pass summary to relevance engine to reduce unnecessary calls

## Memory
- searchMemories: give AI custom metadata filters + chained queries
- Do not ingest searchMemories tool calls into memory

## Tools
- getMessageInfo — fetch reply context, referenced message, etc.
- Log all tool calls after completion

## Infrastructure
- Add back per-context FIFO queue (removed for latency but caused race conditions)
