import type { PineconeMetadataOutput } from '@/types';
import type { ScoredPineconeRecord } from '@pinecone-database/pinecone';

type GuildInfo = { id?: string | null; name?: string | null } | null;
type ChannelInfo = { id: string; name: string; type?: string } | null;
type EntityRef = {
  id: string;
  kind: string;
  handle?: string;
  display?: string;
  platform?: string;
};

export function formatMemories(
  memories: ScoredPineconeRecord<PineconeMetadataOutput>[]
): string {
  if (memories.length === 0) return '';

  const sections = memories
    .map((memory) => {
      const { metadata } = memory;
      if (!metadata) return null;

      const guild = parseJson<GuildInfo>(metadata.guild);
      const channel = parseJson<ChannelInfo>(metadata.channel);
      const createdAt = metadata.createdAt
        ? new Date(metadata.createdAt).toISOString()
        : 'unknown';

      if (metadata.type === 'chat') {
        return formatChatMemory({
          createdAt,
          guild,
          channel,
          context: metadata.context,
        });
      }

      if (metadata.type === 'tool') {
        return formatToolMemory({
          createdAt,
          guild,
          channel,
          name: metadata.name,
          response: metadata.response,
        });
      }

      if (metadata.type === 'summary' && 'summary' in metadata) {
        return formatSummaryMemory({
          createdAt,
          sessionId: metadata.sessionId,
          summary: metadata.summary,
        });
      }

      if (metadata.type === 'entity' && 'summary' in metadata) {
        const entities = parseJson<EntityRef[]>(metadata.entities) ?? [];
        return formatEntityMemory({
          createdAt,
          summary: metadata.summary,
          entities,
        });
      }

      return null;
    })
    .filter(Boolean) as string[];

  if (!sections.length) return '';

  return ['[memory-pack]', ...sections, '[/memory-pack]'].join('\n');
}

function formatChatMemory({
  createdAt,
  guild,
  channel,
  context,
}: {
  createdAt: string;
  guild: GuildInfo;
  channel: ChannelInfo;
  context: string;
}) {
  const location = formatLocation(guild, channel);
  const snippet = sanitizeMultiline(context);

  return [
    '- entry:',
    `    type: chat`,
    `    when: ${createdAt}`,
    `    where: ${location}`,
    `    transcript: |`,
    ...snippet.map((line) => `      ${line}`),
  ].join('\n');
}

function formatToolMemory({
  createdAt,
  guild,
  channel,
  name,
  response,
}: {
  createdAt: string;
  guild: GuildInfo;
  channel: ChannelInfo;
  name: string;
  response: unknown;
}) {
  const location = formatLocation(guild, channel);
  const payload =
    typeof response === 'string'
      ? sanitizeMultiline(response)
      : sanitizeMultiline(JSON.stringify(response, null, 2));

  return [
    '- entry:',
    `    type: tool`,
    `    when: ${createdAt}`,
    `    where: ${location}`,
    `    tool: ${name ?? 'unknown'}`,
    `    output: |`,
    ...payload.map((line) => `      ${line}`),
  ].join('\n');
}

function formatSummaryMemory({
  createdAt,
  sessionId,
  summary,
}: {
  createdAt: string;
  sessionId: string;
  summary: string;
}) {
  const snippet = sanitizeMultiline(summary);

  return [
    '- entry:',
    `    type: summary`,
    `    when: ${createdAt}`,
    `    session: ${sessionId}`,
    `    recap: |`,
    ...snippet.map((line) => `      ${line}`),
  ].join('\n');
}

function formatEntityMemory({
  createdAt,
  summary,
  entities,
}: {
  createdAt: string;
  summary: string;
  entities: EntityRef[];
}) {
  const names = entities
    .map((entity) => entity.display || entity.handle || entity.id)
    .filter(Boolean)
    .join(', ');

  const snippet = sanitizeMultiline(summary);

  return [
    '- entry:',
    `    type: entity`,
    `    when: ${createdAt}`,
    `    subjects: ${names || 'unknown'}`,
    `    card: |`,
    ...snippet.map((line) => `      ${line}`),
  ].join('\n');
}

function parseJson<T>(value: unknown): T | null {
  if (typeof value !== 'string') return (value as T) ?? null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

function formatLocation(guild: GuildInfo, channel: ChannelInfo) {
  const guildName = guild?.name ?? 'DM';
  const channelName = channel?.name ?? 'private';
  const channelType = channel?.type ? ` (${channel.type})` : '';
  return `${guildName} › ${channelName}${channelType}`;
}

function sanitizeMultiline(value: string) {
  return value
    .split('\n')
    .map((line) => line.trimEnd())
    .filter((line, index, arr) => !(line === '' && arr[index - 1] === ''))
    .slice(0, 40); // keep prompt compact
}
