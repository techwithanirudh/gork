import {
  expandMetadata,
  type Channel,
  type Guild,
  type Participant,
  type PineconeMetadataOutput,
} from '@/types';

type MemoryWithMetadata = {
  metadata?: PineconeMetadataOutput | null;
};

export function formatMemories(memories: MemoryWithMetadata[]): string {
  if (memories.length === 0) return '';

  const sections = memories
    .map((memory) => {
      const { metadata } = memory;
      if (!metadata) return null;

      const structured = expandMetadata(metadata);
      if (structured.version && structured.version !== 2) {
        return null;
      }

      const guild = structured.guild ?? null;
      const channel = structured.channel ?? null;
      const participants = structured.participants ?? [];
      const createdAt = structured.createdAt
        ? new Date(structured.createdAt).toISOString()
        : 'unknown';

      switch (structured.type) {
        case 'chat':
          return formatChatMemory({
            createdAt,
            guild,
            channel,
            participants,
            context: structured.context,
            sessionId: structured.sessionId,
          });
        case 'tool':
          return formatToolMemory({
            createdAt,
            guild,
            channel,
            participants,
            name: structured.name,
            response: structured.response,
            sessionId: structured.sessionId,
          });
        case 'summary':
          return formatSummaryMemory({
            createdAt,
            sessionId: structured.sessionId,
            summary: structured.summary,
          });
        case 'entity': {
          const entities =
            (structured.entities ?? structured.participants) ?? [];
          return formatEntityMemory({
            createdAt,
            summary: structured.summary,
            entities,
          });
        }
        default:
          return null;
      }
    })
    .filter(Boolean) as string[];

  if (!sections.length) return '';

  return ['[memory]', ...sections, '[/memory]'].join('\n');
}

function formatChatMemory({
  createdAt,
  guild,
  channel,
  participants,
  context,
  sessionId,
}: {
  createdAt: string;
  guild: Guild | null;
  channel: Channel | null;
  participants: Participant[];
  context: string;
  sessionId: string;
}) {
  const location = formatLocation(guild, channel);
  const snippet = sanitizeMultiline(context);

  return [
    '- entry:',
    `    type: chat`,
    `    when: ${createdAt}`,
    `    session: ${sessionId}`,
    `    where: ${location}`,
    `    participants: ${formatParticipants(participants)}`,
    `    transcript: |`,
    ...snippet.map((line) => `      ${line}`),
  ].join('\n');
}

function formatToolMemory({
  createdAt,
  guild,
  channel,
  participants,
  name,
  response,
  sessionId,
}: {
  createdAt: string;
  guild: Guild | null;
  channel: Channel | null;
  participants: Participant[];
  name: string;
  response: unknown;
  sessionId: string;
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
    `    session: ${sessionId}`,
    `    where: ${location}`,
    `    participants: ${formatParticipants(participants)}`,
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
  entities: Participant[];
}) {
  const snippet = sanitizeMultiline(summary);

  return [
    '- entry:',
    `    type: entity`,
    `    when: ${createdAt}`,
    `    subjects: ${formatParticipants(entities)}`,
    `    card: |`,
    ...snippet.map((line) => `      ${line}`),
  ].join('\n');
}

function formatParticipants(participants?: Participant[]) {
  if (!participants || !participants.length) return 'unknown';
  return participants
    .map((entity) => entity.display || entity.handle || entity.id)
    .filter(Boolean)
    .join(', ');
}

function formatLocation(guild: Guild | null, channel: Channel | null) {
  const guildName = guild?.name ?? 'DM';
  const channelName = channel?.name ?? 'private';
  const channelType = channel?.type ? ` (${channel.type})` : '';
  return `${guildName} > ${channelName}${channelType}`;
}

function sanitizeMultiline(value: string) {
  return value
    .split('\n')
    .map((line) => line.trimEnd())
    .filter((line, index, arr) => !(line === '' && arr[index - 1] === ''))
    .slice(0, 40);
}
