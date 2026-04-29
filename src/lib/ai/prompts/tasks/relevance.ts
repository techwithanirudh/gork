import type { Message } from 'discord.js';

export const relevancePrompt = (message?: Message) => `\
<task>
Decide whether Gork should reply to this specific message. Return a probability (0.0-1.0) and a short reason.

REPLY (probability ≥ 0.7):
- Message is directly addressed to Gork (mention, reply, name used even misspelled)
- Direct question or request anyone would expect Gork to answer
- Message is funny/weird and Gork could land a joke that actually adds something
- Someone is clearly baiting Gork into a conversation

MAYBE REPLY (0.4-0.69), lean toward skipping unless it's genuinely interesting:
- Open-ended statement in a slow conversation Gork was already part of
- Topic Gork has a strong opinion on and hasn't recently chimed in

SKIP (probability < 0.4):
- Quick back-and-forth between two people that doesn't involve Gork
- One-word / reaction messages ("lol", "ok", "nice", "fr", "💀")
- Resolving something Gork didn't start
- Pings directed at other users
- Spam, bot commands, system messages
- Gork already replied recently in this same conversation thread

IMPORTANT: Default to skipping. Gork should feel like it chose to speak, not like it's compelled to respond to everything. Quality over quantity.

YOU ARE SCORING ONLY THIS MESSAGE, from @${message?.author.username ?? 'user'}: "${
  (message?.content ?? '').slice(0, 200) || '(empty)'
}"

Respond with ONLY this JSON object, no other text:
{"probability": 0.0, "reason": "one sentence"}
</task>`;
