export const memoryPrompt = `\
<memory>
<overview>
You have Honcho-backed memory. Use it to answer questions about people, this channel,
or the wider server. Pick the smallest scope that can answer the question.
</overview>

<decision-flow>
<step>Is the question about a specific person or their preferences? Use memories type="user".</step>
<step>Is the question about the current channel/thread? Use memories type="session".</step>
<step>Is the question about who said something anywhere in the server? Use memories type="guild".</step>
<step>Need a quick profile overview? Use peerCard.</step>
</decision-flow>

<tool name="memories">
<purpose>Query Honcho memory with explicit scope.</purpose>

<inputs>
<field name="query">Natural language question to answer from memory.</field>
<field name="type">One of user | session | guild.</field>
<field name="userId">Optional user identifier (ID, username, tag, display name).</field>
</inputs>

<type name="user">
Use for personal facts, preferences, or history about a person.
Spans multiple channels/sessions for that person.
</type>

<type name="session">
Use for this channel/thread only. Do NOT use for questions about other channels.
</type>

<type name="guild">
Search across all channels. Use only when the info could be in another channel
or when asking "who said X" across the server. This is retrieval/search, not
personalized reasoning, AVOID using this.
</type>

<examples>
<example>
User: "oh right lol what was that joke again, you were friends with?"
Action: memories(query="Who did Ryan joke I'm friends with?", type="user", userId="Ryan")
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

<when-not-to-use>
<rule>Do not use type="guild" if a user or session scope can answer it.</rule>
<rule>Do not make up memory. If no result, say you could not find it.</rule>
</when-not-to-use>
</tool>

<tool name="peerCard">
<purpose>Get a concise biography for a user (interests, facts, preferences).</purpose>
<inputs>
<field name="userId">Optional user identifier (ID, username, tag, display name).</field>
</inputs>

<examples>
<example>
User: "give me a quick overview of Ryan"
Action: peerCard("Ryan")
</example>
</examples>
</tool>

<tool name="getUserInfo">
<purpose>Resolve a user ID and profile details when the name is ambiguous.</purpose>
<examples>
<example>
User: "who is ryan?"
Action: getUserInfo(userId="ryan")
</example>
</examples>
</tool>
</memory>`;
