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

export const GuildSchema = Jsonify(
  z.object({
    id: z.string().nullable().optional(),
    name: z.string().nullable().optional(),
  })
);
export type Guild = z.infer<typeof GuildSchema>;

export const ChannelSchema = Jsonify(
  z.object({
    id: z.string(),
    name: z.string(),
    type: z
      .enum(['dm', 'text', 'voice', 'thread', 'unknown'])
      .default('unknown'),
  })
);
export type Channel = z.infer<typeof ChannelSchema>;

export const ParticipantSchema = z.object({
  id: z.string(),
  kind: z.enum(['user', 'bot', 'guild', 'channel']),
  handle: z.string().optional(),
  display: z.string().optional(),
  platform: z.literal('discord'),
});
export type Participant = z.infer<typeof ParticipantSchema>;

export const BaseSchema = z.object({
  id: z.string().optional(),
  version: z.literal('v2').default('v2'),
  type: z.enum(['chat', 'tool', 'summary', 'entity']),
  createdAt: z.number().int(),
  lastRetrievalTime: z.number().optional(),
  sessionId: z.string(),
  guild: GuildSchema.optional(),
  channel: ChannelSchema.optional(),
  participants: z.array(ParticipantSchema).default([]),
  importance: z.enum(['low', 'med', 'high']).default('med'),
  confidence: z.number().min(0).max(1).default(0.8),
});

export const ChatSchema = BaseSchema.extend({
  type: z.literal('chat'),
  context: z.string(),
});

export const ToolSchema = BaseSchema.extend({
  type: z.literal('tool'),
  name: z.string(),
  response: Jsonify(z.unknown()),
});

export const SummarySchema = BaseSchema.extend({
  type: z.literal('summary'),
  summary: z.string(),
});

export const EntitySchema = BaseSchema.extend({
  type: z.literal('entity'),
  summary: z.string(),
});

export const PineconeMetadataSchema = z.union([
  ChatSchema,
  ToolSchema,
  SummarySchema,
  EntitySchema,
]);

export type PineconeMetadataInput = z.input<typeof PineconeMetadataSchema>;
export type PineconeMetadataOutput = z.output<typeof PineconeMetadataSchema>;
