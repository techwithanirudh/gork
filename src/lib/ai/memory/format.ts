import type {
  Channel,
  Guild,
  Participant,
  PineconeMetadataOutput,
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

      const version = (metadata as unknown as { version?: string }).version;
      if (version && version !== 'v2') {
        return null; // ignore legacy formats
      }

      const rawGuild = parseJson<Guild | null | string>(metadata.guild);
      const rawChannel = parseJson<Channel | null | string>(metadata.channel);
      const guild = typeof rawGuild === 'string' ? null : rawGuild;
      const channel = typeof rawChannel === 'string' ? null : rawChannel;
      const parsedParticipants = parseJson<Participant[] | string>(
        metadata.participants
      );
      const participants = Array.isArray(parsedParticipants)
        ? parsedParticipants
        : [];
      const createdAt = metadata.createdAt
        ? new Date(metadata.createdAt).toISOString()
        : 'unknown';

      switch (metadata.type) {
        case 'chat':
          return formatChatMemory({
            createdAt,
            guild,
            channel,
            participants,
            context: metadata.context,
            sessionId: metadata.sessionId,
            importance: metadata.importance,
            confidence: metadata.confidence,
          });
        case 'tool':
          return formatToolMemory({
            createdAt,
            guild,
            channel,
            participants,
            name: metadata.name,
            response: metadata.response,
            sessionId: metadata.sessionId,
            importance: metadata.importance,
            confidence: metadata.confidence,
          });
        case 'summary':
          if ('summary' in metadata) {
            return formatSummaryMemory({
              createdAt,
              sessionId: metadata.sessionId,
              summary: metadata.summary,
              importance: metadata.importance,
              confidence: metadata.confidence,
            });
          }
          return null;
        case 'entity':
          if ('summary' in metadata) {
            const parsedEntities = parseJson<Participant[] | string>(
              (metadata as unknown as Record<string, unknown>).entities
            );
            const entities = Array.isArray(parsedEntities)
              ? parsedEntities
              : participants;
            return formatEntityMemory({
              createdAt,
              summary: metadata.summary,
              entities,
              importance: metadata.importance,
              confidence: metadata.confidence,
            });
          }
          return null;
        default:
          return null;
      }
    })
    .filter(Boolean) as string[];

  if (!sections.length) return '';

  return ['[memory-pack v2]', ...sections, '[/memory-pack]'].join('\n');
}

function formatChatMemory({
  createdAt,
  guild,
  channel,
  participants,
  context,
  sessionId,
  importance,
  confidence,
}: {
  createdAt: string;
  guild: Guild | null;
  channel: Channel | null;
  participants: Participant[];
  context: string;
  sessionId: string;
  importance: string;
  confidence: number;
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
    `    importance: ${importance ?? 'med'}`,
    `    confidence: ${formatConfidence(confidence)}`,
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
  importance,
  confidence,
}: {
  createdAt: string;
  guild: Guild | null;
  channel: Channel | null;
  participants: Participant[];
  name: string;
  response: unknown;
  sessionId: string;
  importance: string;
  confidence: number;
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
    `    importance: ${importance ?? 'med'}`,
    `    confidence: ${formatConfidence(confidence)}`,
    `    tool: ${name ?? 'unknown'}`,
    `    output: |`,
    ...payload.map((line) => `      ${line}`),
  ].join('\n');
}

function formatSummaryMemory({
  createdAt,
  sessionId,
  summary,
  importance,
  confidence,
}: {
  createdAt: string;
  sessionId: string;
  summary: string;
  importance: string;
  confidence: number;
}) {
  const snippet = sanitizeMultiline(summary);

  return [
    '- entry:',
    `    type: summary`,
    `    when: ${createdAt}`,
    `    session: ${sessionId}`,
    `    importance: ${importance ?? 'med'}`,
    `    confidence: ${formatConfidence(confidence)}`,
    `    recap: |`,
    ...snippet.map((line) => `      ${line}`),
  ].join('\n');
}

function formatEntityMemory({
  createdAt,
  summary,
  entities,
  importance,
  confidence,
}: {
  createdAt: string;
  summary: string;
  entities: Participant[];
  importance: string;
  confidence: number;
}) {
  const snippet = sanitizeMultiline(summary);

  return [
    '- entry:',
    `    type: entity`,
    `    when: ${createdAt}`,
    `    subjects: ${formatParticipants(entities)}`,
    `    importance: ${importance ?? 'med'}`,
    `    confidence: ${formatConfidence(confidence)}`,
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
    .slice(0, 40); // keep prompt compact
}

function formatConfidence(confidence?: number) {
  return typeof confidence === 'number' ? confidence.toFixed(2) : '0.80';
}
