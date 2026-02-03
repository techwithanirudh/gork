import { createLogger } from '@/lib/logger';
import { getContextFromMessage } from '@/lib/memory';
import { getSessionForContext, client } from './shared';
import { tool } from 'ai';
import type { Message } from 'discord.js';
import { z } from 'zod';

const logger = createLogger('tools:vector-search');

export const vectorSearch = ({ message }: { message: Message }) =>
  tool({
    description:
      'Vector search over stored messages. Use for retrieval across session, guild, or global workspace.',
    inputSchema: z.object({
      query: z
        .string()
        .describe('Semantic search query to find relevant messages'),
      scope: z
        .enum(['session', 'guild', 'global'])
        .describe(
          'session=this channel only, guild=this server, global=all sessions in workspace',
        ),
      limit: z
        .number()
        .int()
        .positive()
        .max(20)
        .optional()
        .describe('Optional max number of results to return (default 5).'),
    }),
    execute: async ({ query, scope, limit }) => {
      const ctx = getContextFromMessage(message);
      const max = limit ?? 5;

      try {
        if (scope === 'session') {
          const session = await getSessionForContext(ctx);
          const results = await session.search(query, { limit: max });
          return results.length > 0
            ? {
                success: true,
                result: results.map((r) => `- ${r.content}`).join('\n'),
              }
            : { success: false, reason: 'No session matches.' };
        }

        if (scope === 'guild') {
          if (!ctx.guildId) {
            return {
              success: false,
              reason: 'Guild search requires a server.',
            };
          }
          const results = await client.search(query, {
            limit: max,
            filters: { metadata: { guildId: ctx.guildId } },
          });
          if (results.length > 0) {
            return {
              success: true,
              result: results.map((r) => `- ${r.content}`).join('\n'),
            };
          }
          return { success: false, reason: 'No guild matches.' };
        }

        if (scope === 'global') {
          const filters = ctx.guildId
            ? undefined
            : { metadata: { userId: ctx.userId } };
          const results = await client.search(query, {
            limit: max,
            filters,
          });

          if (results.length > 0) {
            return {
              success: true,
              result: results.map((r) => `- ${r.content}`).join('\n'),
            };
          }
          return { success: false, reason: 'No global matches.' };
        }

        return { success: false, reason: 'Invalid scope.' };
      } catch (error) {
        logger.error({ error, query, scope }, 'Vector search failed');
        return { success: false, reason: 'Vector search failed.' };
      }
    },
  });
