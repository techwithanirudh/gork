import { addMemory } from '@/lib/pinecone/queries';
import { getMessagesByChannel } from '@/lib/queries';
import type { Message } from 'discord.js';

export function buildLocationFromMessage(message: Message) {
  const guild = message.guild
    ? { id: message.guild.id, name: message.guild.name }
    : { id: null, name: null };

  const channel = {
    id: message.channel.id,
    name: message.channel.type === 'DM' ? 'DM' : message.channel.name ?? '',
  };

  return { guild, channel } as const;
}

export async function saveChatMemory(message: Message, contextLimit = 5) {
  const messages = await getMessagesByChannel({
    channel: message.channel,
    limit: contextLimit,
  });

  const data = messages
    .map((msg) => `${msg.author.username}: ${msg.content}`)
    .join('\n');

  const { guild, channel } = buildLocationFromMessage(message);

  const metadata = {
    type: 'chat' as const,
    context: data,
    createdAt: Date.now(),
    lastRetrievalTime: Date.now(),
    guild,
    channel,
  };

  await addMemory(data, metadata);
}

export async function saveToolMemory(
  message: Message,
  toolName: string,
  result: unknown
) {
  const data = JSON.stringify({ toolName, result }, null, 2);
  const { guild, channel } = buildLocationFromMessage(message);

  const metadata = {
    type: 'tool' as const,
    name: toolName,
    response: result,
    createdAt: Date.now(),
    guild,
    channel,
  };

  await addMemory(data, metadata);
}


