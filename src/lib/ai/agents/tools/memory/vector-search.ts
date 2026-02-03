import { createLogger } from '@/lib/logger';
import {
  buildMessageContext,
  resolveSessionId,
  searchGuild,
} from '@/lib/memory/honcho';
import { getHonchoClient } from '@/lib/memory/honcho/client';
import { tool } from 'ai';
import type { Message } from 'discord.js';
import { z } from 'zod';

const logger = createLogger('tools:vector-search');

export const vectorSearch = ({ message }: { message: Message }) =>
  tool({
    description:
      'Vector search over stored messages. Use for retrieval across session or guild.',
    inputSchema: z.object({
      query: z
        .string()
        .describe('Semantic search query to find relevant messages'),
      scope: z
        .enum(['session', 'guild'])
        .describe('session=this channel only, guild=all channels in server'),
      limit: z
        .number()
        .int()
        .positive()
        .max(20)
        .optional()
        .describe('Optional max number of results to return (default 5).'),
    }),
    execute: async ({ query, scope, limit }) => {
      const ctx = buildMessageContext(message);
      const max = limit ?? 5;

      try {
        if (scope === 'session') {
          const sessionId = resolveSessionId(ctx);
          const client = getHonchoClient();
          const session = await client.session(sessionId);
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
          const results = await searchGuild(ctx.guildId, query);
          if (results.length > 0) {
            return {
              success: true,
              result: results
                .slice(0, max)
                .map((r) => `- ${r.content}`)
                .join('\n'),
            };
          }
          return { success: false, reason: 'No guild matches.' };
        }

        return { success: false, reason: 'Invalid scope.' };
      } catch (error) {
        logger.error({ error, query, scope }, 'Vector search failed');
        return { success: false, reason: 'Vector search failed.' };
      }
    },
  });
