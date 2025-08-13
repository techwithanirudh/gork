import type { PineconeMetadataOutput } from '@/types';
import type { ScoredPineconeRecord } from '@pinecone-database/pinecone';

export function formatMemories(
  memories: ScoredPineconeRecord<PineconeMetadataOutput>[]
): string {
  if (memories.length === 0) return '';

  const processedMemories = memories
    .map((memory) => {
      const { metadata } = memory;
      if (!metadata) return null;

      const guildObj = metadata.guild ? JSON.parse(metadata.guild) : null;
      const channelObj = metadata.channel ? JSON.parse(metadata.channel) : null;
      const createdAt = metadata.createdAt
        ? new Date(metadata.createdAt).toISOString()
        : null;

      if (metadata.type === 'chat') {
        return formatChatMemory({
          guild: guildObj,
          channel: channelObj,
          context: metadata.context,
          createdAt,
        });
      } else if (metadata.type === 'tool') {
        return formatToolMemory({
          guild: guildObj,
          channel: channelObj,
          name: metadata.name,
          response: metadata.response,
          createdAt,
        });
      }

      return null;
    })
    .filter(Boolean) as string[];

  if (processedMemories.length === 0) return '';

  return processedMemories.join('\n\n');
}

function formatChatMemory({
  guild,
  channel,
  context,
  createdAt,
}: {
  guild: { id?: string | null; name?: string | null } | null;
  channel: { id: string; name: string } | null;
  context: string;
  createdAt: string | null;
}) {
  const location = guild?.name
    ? `#${channel?.name} in ${guild.name}`
    : channel?.name || 'Unknown';
  const timestamp = createdAt ? `on ${createdAt.split('T')[0]}` : '';

  return `Previous conversation ${location} ${timestamp}:
${context}`;
}

function formatToolMemory({
  guild,
  channel,
  name,
  response,
  createdAt,
}: {
  guild: { id?: string | null; name?: string | null } | null;
  channel: { id: string; name: string } | null;
  name: string;
  response: unknown;
  createdAt: string | null;
}) {
  const location = guild?.name
    ? `#${channel?.name} in ${guild.name}`
    : channel?.name || 'Unknown';
  const timestamp = createdAt ? `on ${createdAt.split('T')[0]}` : '';

  const responseText =
    typeof response === 'string' ? response : JSON.stringify(response, null, 2);

  return `Previous tool usage ${location} ${timestamp}:
Tool: ${name}
Result: ${responseText}`;
}


