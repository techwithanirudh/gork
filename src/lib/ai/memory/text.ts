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

      const guild = metadata.guild ? JSON.parse(metadata.guild) : null;
      const channel = metadata.channel ? JSON.parse(metadata.channel) : null;
      const createdAt = metadata.createdAt
        ? new Date(metadata.createdAt).toISOString()
        : null;

      if (metadata.type === 'chat') {
        return formatChatMemory({
          guild,
          channel,
          context: metadata.context,
          createdAt,
        });
      } else if (metadata.type === 'tool') {
        return formatToolMemory({
          guild,
          channel,
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
  const lines = [
    '---',
    'type: chat',
    `createdAt: ${createdAt ?? 'unknown'}`,
    'guild:',
    `  id: ${guild?.id ?? 'null'}`,
    `  name: ${guild?.name ?? 'null'}`,
    'channel:',
    `  id: ${channel?.id ?? 'null'}`,
    `  name: ${channel?.name ?? 'null'}`,
    'context: |',
    ...context.split('\n').map((l) => `  ${l}`),
    '---',
  ];
  return lines.join('\n');
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
  const responseText =
    typeof response === 'string' ? response : JSON.stringify(response, null, 2);

  const lines = [
    '---',
    'type: tool',
    `createdAt: ${createdAt ?? 'unknown'}`,
    'guild:',
    `  id: ${guild?.id ?? 'null'}`,
    `  name: ${guild?.name ?? 'null'}`,
    'channel:',
    `  id: ${channel?.id ?? 'null'}`,
    `  name: ${channel?.name ?? 'null'}`,
    `toolName: ${name ?? 'unknown'}`,
    'result: |',
    ...responseText.split('\n').map((l) => `  ${l}`),
    '---',
  ];
  return lines.join('\n');
}
