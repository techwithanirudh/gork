import { z } from 'zod';

/**
 * Structured (in-app) representations
 */
const GuildObjectSchema = z.object({
  id: z.string().nullable().optional(),
  name: z.string().nullable().optional(),
});

const ChannelObjectSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.enum(['dm', 'text', 'voice', 'thread', 'unknown']).default('unknown'),
});

const ParticipantObjectSchema = z.object({
  id: z.string(),
  kind: z.enum(['user', 'bot', 'guild', 'channel']),
  handle: z.string().optional(),
  display: z.string().optional(),
  platform: z.literal('discord'),
});

export type Guild = z.infer<typeof GuildObjectSchema>;
export type Channel = z.infer<typeof ChannelObjectSchema>;
export type Participant = z.infer<typeof ParticipantObjectSchema>;

const StructuredBaseSchema = z.object({
  version: z.literal('v2').default('v2'),
  type: z.enum(['chat', 'tool', 'summary', 'entity']),
  createdAt: z.number().int(),
  lastRetrievalTime: z.number().optional(),
  sessionId: z.string(),
  sessionType: z.enum(['dm', 'guild']).optional(),
  guild: GuildObjectSchema.nullable().optional(),
  channel: ChannelObjectSchema.nullable().optional(),
  participants: z.array(ParticipantObjectSchema).default([]),
  importance: z.enum(['low', 'med', 'high']).default('med'),
  confidence: z.number().min(0).max(1).default(0.8),
  writeReason: z.string().optional(),
});

const StructuredChatSchema = StructuredBaseSchema.extend({
  type: z.literal('chat'),
  context: z.string(),
});

const StructuredToolSchema = StructuredBaseSchema.extend({
  type: z.literal('tool'),
  name: z.string(),
  response: z.unknown(),
});

const StructuredSummarySchema = StructuredBaseSchema.extend({
  type: z.literal('summary'),
  summary: z.string(),
});

const StructuredEntitySchema = StructuredBaseSchema.extend({
  type: z.literal('entity'),
  summary: z.string(),
  entities: z.array(ParticipantObjectSchema).default([]),
});

const StructuredMetadataSchema = z.union([
  StructuredChatSchema,
  StructuredToolSchema,
  StructuredSummarySchema,
  StructuredEntitySchema,
]);

export type PineconeMetadataInput = z.infer<typeof StructuredMetadataSchema>;

/**
 * Flat (Pinecone) representation – only strings, numbers, booleans, and string arrays.
 */
const StorageBaseSchema = z.object({
  hash: z.string().optional(),
  version: z.literal('v2'),
  type: z.enum(['chat', 'tool', 'summary', 'entity']),
  createdAt: z.number().int(),
  lastRetrievalTime: z.number().optional(),
  sessionId: z.string(),
  sessionType: z.enum(['dm', 'guild']).optional(),
  guild: z.string().optional(),
  channel: z.string().optional(),
  participants: z.string().optional(),
  entities: z.string().optional(),
  guildId: z.string().optional(),
  guildName: z.string().optional(),
  channelId: z.string().optional(),
  channelName: z.string().optional(),
  channelType: z.string().optional(),
  participantIds: z.array(z.string()).default([]),
  entityIds: z.array(z.string()).default([]),
  importance: z.enum(['low', 'med', 'high']).default('med'),
  confidence: z.number().min(0).max(1).default(0.8),
  writeReason: z.string().optional(),
});

const StorageChatSchema = StorageBaseSchema.extend({
  type: z.literal('chat'),
  context: z.string(),
});

const StorageToolSchema = StorageBaseSchema.extend({
  type: z.literal('tool'),
  name: z.string(),
  response: z.string(),
});

const StorageSummarySchema = StorageBaseSchema.extend({
  type: z.literal('summary'),
  summary: z.string(),
});

const StorageEntitySchema = StorageBaseSchema.extend({
  type: z.literal('entity'),
  summary: z.string(),
});

export const PineconeMetadataSchema = z.union([
  StorageChatSchema,
  StorageToolSchema,
  StorageSummarySchema,
  StorageEntitySchema,
]);

export type PineconeMetadataStorage = z.infer<typeof PineconeMetadataSchema>;
export type PineconeMetadataOutput = PineconeMetadataStorage;
export type PineconeMetadataStructured = PineconeMetadataInput;

/**
 * Flatten structured metadata into Pinecone-friendly representation.
 */
export function flattenMetadata(
  metadata: PineconeMetadataInput
): Omit<PineconeMetadataStorage, 'hash'> {
  const structured = StructuredMetadataSchema.parse(metadata);
  const guild = structured.guild ?? null;
  const channel = structured.channel ?? null;
  const participants = structured.participants ?? [];

  const entities =
    structured.type === 'entity'
      ? (structured as z.infer<typeof StructuredEntitySchema>).entities ?? []
      : [];

  const flattened = {
    ...structured,
    guild: guild ? JSON.stringify(guild) : undefined,
    channel: channel ? JSON.stringify(channel) : undefined,
    participants: participants.length ? JSON.stringify(participants) : undefined,
    entities: entities.length ? JSON.stringify(entities) : undefined,
    guildId: guild?.id ?? undefined,
    guildName: guild?.name ?? undefined,
    channelId: channel?.id ?? undefined,
    channelName: channel?.name ?? undefined,
    channelType: channel?.type ?? undefined,
    participantIds: participants
      .map((p) => p.id)
      .filter((id): id is string => typeof id === 'string' && id.length > 0),
    entityIds: entities
      .map((p) => p.id)
      .filter((id): id is string => typeof id === 'string' && id.length > 0),
  } as Record<string, unknown>;

  if (structured.type === 'tool') {
    flattened.response = serializeValue(structured.response);
  }

  return PineconeMetadataSchema.parse(flattened);
}

/**
 * Expand flat metadata back to structured form.
 */
export function expandMetadata(
  metadata: PineconeMetadataStorage
): PineconeMetadataInput {
  const guild = safeParseJson<Guild | null>(metadata.guild);
  const channel = safeParseJson<Channel | null>(metadata.channel);
  const participants = safeParseJson<Participant[]>(metadata.participants) ?? [];
  const entities = safeParseJson<Participant[]>(metadata.entities) ?? [];

  const base = {
    ...metadata,
    guild,
    channel,
    participants,
    importance: metadata.importance ?? 'med',
    confidence: metadata.confidence ?? 0.8,
  };

  switch (metadata.type) {
    case 'chat':
      return StructuredChatSchema.parse(base);
    case 'tool':
      return StructuredToolSchema.parse({
        ...base,
        response: safeParseJson<unknown>(metadata.response) ?? metadata.response,
      });
    case 'summary':
      return StructuredSummarySchema.parse(base);
    case 'entity':
      return StructuredEntitySchema.parse({
        ...base,
        entities,
      });
    default:
      return StructuredMetadataSchema.parse(base);
  }
}

function safeParseJson<T>(value: unknown): T | null {
  if (typeof value !== 'string') {
    return (value as T) ?? null;
  }
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

function serializeValue(value: unknown): string {
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

export const ALLOWED_MEMORY_FILTERS = [
  'version',
  'type',
  'sessionId',
  'sessionType',
  'guildId',
  'guildName',
  'channelId',
  'channelName',
  'channelType',
  'participantIds',
  'entityIds',
  'importance',
  'confidence',
  'createdAt',
  'lastRetrievalTime',
] as const;
