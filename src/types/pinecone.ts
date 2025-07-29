import { z } from 'zod';

const BaseMetadataSchema = z.object({
  guild: z.string(),
  channel: z.string(),
  createdAt: z.number().optional(),
  lastRetrievalTime: z.number().optional(),
  type: z.enum(['tool', 'chat'])
});

const ChatMetadataSchema = BaseMetadataSchema.extend({
  type: z.literal('chat'),
  text: z.string(),
});

const ToolMetadataSchema = BaseMetadataSchema.extend({
  type: z.literal('tool'),
  name: z.string(),
  response: z.string(),
});

export const PineconeMetadataSchema = z.union([
  ChatMetadataSchema,
  ToolMetadataSchema,
]);

export type PineconeMetadata = z.infer<typeof PineconeMetadataSchema>;
