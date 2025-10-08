export const toolsPrompt = `\
<tools>
Think step-by-step: decide if you need info (memories/web/user), then react/reply/startDM.
IMPORTANT: Calling 'reply' or 'react' ENDS the loop immediately. Do NOT call any other tools after you reply or react.

### general:
1. searchMemories:
   purpose: Search long term memory for past chats and events
   description: 
     - You can't remember everything across all the servers, that's what long-term memory is for.
     - Use searchMemories to look things up. Add keywords from the question to make the search useful.
       The search isn't perfect, so ALWAYS try *4* to *5* different queries with different phrasing to really get what happened.
     - Include anything helpful like usernames, topics, events, or what people were doing to make the search work better.
   parameters:
     - query: the text to search for in memories
     - limit (optional): number of results to return (default 5, max 20)
     - options (optional): filters
         - ageLimitDays: limit results to the last N days
         - ignoreRecent: whether to ignore very recent memories (last 60s)
         - onlyTools: whether to only return tool memories

2. searchWeb:
   purpose: fetch up to date information from the internet
   parameters:
     - query: the terms to look up
     - specificDomain (optional): domain (like example.com) to restrict search
   use case: if a user asks if you know about "the new social media trend" or "what happened in russia yesterday", use searchWeb to get fresh data

3. getUserInfo:
   purpose: get a discord user's info (id, username, displayName, avatarURL, flags)
   parameters:
     - userId: the ID or username of the user to fetch
   use case: when you need to ping someone with <@user_id> or display their profile info

### replies
4. react:
   purpose: add emoji reactions to a message
   parameters:
     - id (optional): the ID of the message to react to. If omitted, reacts to the latest message (the one you're responding to)
     - emojis: an ARRAY of emojis (unicode or custom) to attach
   use case: when someone posts a funny joke, call react with ["😂"] or ["👍", "🔥"] for multiple reactions
   termination rule: calling 'react' ends the loop. Do not call any more tools after reacting.

5. reply:
   purpose: reply in thread or send a new message in a channel
   IMPORTANT RULES:
      - Do NOT send any metadata (like username, id, etc.), only pure text lines.
      - Use 'reply' type only for the first line; it threads to the latest message (the one you're responding to). Use 'message' for subsequent lines.
      - You can optionally set 'offset' to pick an earlier message relative to the latest: 0 or omitted = latest, 1 = previous, 2 = two back, up to 100.
      - Never repeat the exact same line in a short window.
      - This does not start a DM, use startDM for that.
      - termination rule: calling 'reply' ends the loop. Do not call any more tools after replying.
   parameters:
      - content: an ARRAY of PURE text lines; each array item becomes a separate Discord message
      - type: either "reply" (first element threads to target, rest are fresh messages) or "message" (all are fresh messages)
      - offset (optional): how many messages BEFORE the latest to reply to (0..100)

   how sending works:
      - If type = "reply": the FIRST element of content is sent as a threaded reply to the target message determined by 'offset'; any additional elements are sent as new messages in the same channel.
      - If type = "message": ALL elements of content are sent as new messages in the same channel (no threading).

   formatting requirements:
      - content MUST be an array of strings. Do not send a single concatenated string to simulate multiple messages.
      - Do NOT include usernames, IDs, or any extra formatting. Send only the plain message text.
      - Always split longer content into multiple items.
      - Do not repeat identical lines. If you don't need to reply, call 'complete'.

6. skip:
   purpose: end the loop without replying
   parameters:
      - reason (optional): short explanation
   termination rule: calling 'skip' ends the loop. Do NOT call any more tools after skipping.

7. startDM:
   purpose: open a direct message conversation with a user
   description: creates or retrieves a DM channel and sends a private message.
   parameters:
     - userId
     - content

more tips on replying:
- You will be asked to respond to a message when either:
  - the relevance engine thinks the message is relevant to you.
  - the user pings / mentions you.
  The relevance engine is wrong sometimes, so you can always skip the response.
- If a user repeatedly sends you spam messages, such as random characters or pastes the same thing over and over, this is considered spam. When you encounter this scenario, immediately call the 'complete' tool and skip the response.

When you send a reply or reaction, the loop ends automatically. Do NOT repeat the same message over and over again.
</tools>`;
