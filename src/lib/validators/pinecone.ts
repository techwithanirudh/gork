import { z } from 'zod';

const Jsonify = <T extends z.ZodTypeAny>(schema: T) =>
  z
    .union([
      schema,
      z.string().transform((s) => {
        try {
          return JSON.parse(s);
        } catch {
          throw new Error('Invalid JSON string');
        }
      }),
    ])
    .transform((obj) => JSON.stringify(obj));

const GuildSchema = Jsonify(
  z.object({
    id: z.string().nullable().optional(),
    name: z.string().nullable().optional(),
  })
);

const ChannelSchema = Jsonify(
  z.object({
    id: z.string(),
    name: z.string(),
    type: z
      .enum(['dm', 'text', 'voice', 'thread', 'unknown'])
      .default('unknown'),
  })
);

const EntityRefSchemaInner = z.object({
  id: z.string(),
  kind: z.enum(['user', 'bot', 'guild', 'channel']),
  handle: z.string().optional(),
  display: z.string().optional(),
  platform: z.literal('discord'),
});

const EntityRefsSchema = Jsonify(z.array(EntityRefSchemaInner));

const BaseMetadataSchema = z.object({
  hash: z.string(),
  type: z.enum(['tool', 'chat', 'summary', 'entity']),
  createdAt: z.number(),
  lastRetrievalTime: z.number().optional(),
  sessionId: z.string(),
  guild: GuildSchema,
  channel: ChannelSchema,
  participants: EntityRefsSchema,
  entities: EntityRefsSchema,
  importance: z.enum(['low', 'med', 'high']).default('med'),
  confidence: z.number().min(0).max(1).default(0.8),
});

const ChatMetadataSchema = BaseMetadataSchema.extend({
  type: z.literal('chat'),
  context: z.string(),
});

const ToolMetadataSchema = BaseMetadataSchema.extend({
  type: z.literal('tool'),
  name: z.string(),
  response: Jsonify(z.unknown()),
});

const SummaryMetadataSchema = BaseMetadataSchema.extend({
  type: z.literal('summary'),
  summary: z.string(),
});

const EntityMetadataSchema = BaseMetadataSchema.extend({
  type: z.literal('entity'),
  summary: z.string(),
});

export const PineconeMetadataSchema = z.union([
  ChatMetadataSchema,
  ToolMetadataSchema,
  SummaryMetadataSchema,
  EntityMetadataSchema,
]);

export type PineconeMetadataInput = z.input<typeof PineconeMetadataSchema>;
export type PineconeMetadataOutput = z.output<typeof PineconeMetadataSchema>;
