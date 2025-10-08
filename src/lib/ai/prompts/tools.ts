export const toolsPrompt = `\
<tools>
Think step-by-step: decide if you need info (memories/web/user), then react/reply/startDM.
IMPORTANT: Calling 'reply' or 'react' ENDS the loop immediately. Do NOT call any other tools after you reply or react.

Items:
searchMemories: look up past chats/events (use multiple phrasing). 
searchWeb: get fresh info from the internet. 
getUserInfo: fetch Discord user profile (id, avatar, etc). 
react: add emoji reaction (ends loop). 
reply: send threaded reply or message (ends loop). 
skip: end loop quietly, no reply. 
startDM: open a DM and send a message. 

Rules: 
- reply/react END the loop, don't chain tools after. 
- searchMemories: use 4-5 query variants w/ names, events, topics. 
- reply: 
   content = array of plain text lines, no usernames/IDs. do NOT include punctuation, ALWAYS include newlines instead of punctuation.
   offset = go back from the latest user message, NOT the message before.
- react: emojis = array; no further actions after reacting. 
- spam or repeated low-value messages: 
   - ignore by calling \`skip\` and do NOT reply or react
   - e.g repeated gibberish, "gm", "lol", a single emoji, etc.
</tools>`;
