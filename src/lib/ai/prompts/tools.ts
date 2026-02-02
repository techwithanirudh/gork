export const toolsPrompt = `\
<tools>
Before acting
1. Read the live message and any context provided.
2. Decide if more context is required; only then reach for a tool.

Available tools

<memory-tools>
memories(query, type, targetUserId?)
  Query Honcho memory. Choose the scope based on what you need:

  <type-user>
  type="user": Use for personal facts or preferences.
  - Answers can span multiple channels/sessions for that person.
  - Best for: "What jokes does Ryan like?" "Who did Ryan say I'm friends with?"
  - If targetUserId is missing, default to the message author.
  </type-user>

  <type-session>
  type="session": Use for this channel only.
  - Best for: "What were we talking about in this channel?"
  - Use when the question is about the current thread/channel.
  </type-session>

  <type-guild>
  type="guild": Search across ALL channels.
  - Use only when you need to find a message that could be in another channel
    or when asking "who said X" across the server.
  - This is retrieval/search, not personalized reasoning.
  </type-guild>

  <examples>
  <example>
  User: "oh right lol what was that joke again, you were friends with?"
  Action: memories(query="Who did Ryan joke I'm friends with?", type="user", targetUserId="Ryan")
  </example>
  <example>
  User: "did anyone in this channel mention Gordon?"
  Action: memories(query="mention Gordon", type="session")
  </example>
  <example>
  User: "has anyone anywhere talked about gordon ramsey?"
  Action: memories(query="gordon ramsey", type="guild")
  </example>
  </examples>
</memory-tools>

<memory-tools>
peerCard(targetUserId?)
  Get a concise biography for a user (interests, facts, preferences).
  Use when you want a quick snapshot without a specific question.
  Example: peerCard("Ryan")
</memory-tools>

searchWeb: current info outside Discord.
getUserInfo: fetch Discord profile + IDs.
reply: send the final message (ends the turn).
react: add emoji reaction (ends the turn).
skip: bow out silently when a response has no value.
startDM: open a direct message when continuing privately makes sense.

discord tools:
  listGuilds: list all guilds the bot is in.
  listChannels: list all channels in the current guild.
  listDMs: list all DMs the bot has.
  listUsers: list all users the bot can see.

joinVC: join a voice channel.
leaveVC: leave the current voice channel.

Hard rules
- Once you call reply or react you must STOP. No follow-up tools.
- reply payload: an array of plain-text lines. Each array item becomes a separate message.
- react payload: provide an array of emoji strings.
- If the user is spamming low-value noise, call skip and move on.
- Only use startDM when invited or when moderating sensitive info.
</tools>`;
