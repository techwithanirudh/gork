import { createLogger } from '@/lib/logger';
import {
  queryUser,
  searchGuild,
  buildMessageContext,
  resolveSessionId,
} from '@/lib/memory/honcho';
import { tool } from 'ai';
import type { Message } from 'discord.js';
import { z } from 'zod';

const logger = createLogger('tools:memories');

export interface ChatParticipant {
  id: string;
  username: string;
  displayName?: string;
}

export interface MemoryContext {
  guildId?: string;
  guildName?: string;
  channelId: string;
  channelName?: string;
  participants: ChatParticipant[];
}

export const memories = ({ message }: { message: Message }) =>
  tool({
    description:
      'Query memories. Use "user" for user info, "session" for current channel, "guild" for server-wide search.',
    inputSchema: z.object({
      query: z.string().describe('The question to answer'),
      type: z
        .enum(['user', 'session', 'guild'])
        .default('session')
        .describe('Search scope'),
      targetUserId: z
        .string()
        .optional()
        .describe('User ID for type "user" (defaults to message author)'),
    }),
    execute: async ({ query, type = 'session', targetUserId }) => {
      const ctx = buildMessageContext(message);
      const sessionId = resolveSessionId(ctx);

      logger.debug({ type, query, targetUserId }, 'Memory query');

      try {
        if (type === 'user') {
          const userId = targetUserId ?? ctx.userId;
          const result = await queryUser(userId, query, sessionId);
          return result ?? `I don't have enough information about this user yet.`;
        }

        if (type === 'guild') {
          if (!ctx.guildId) {
            return `Guild search is only available in servers, not DMs.`;
          }
          const results = await searchGuild(ctx.guildId, query);
          if (results.length > 0) {
            return results
              .slice(0, 5)
              .map((r) => `- ${r.content}`)
              .join('\n');
          }
          return `I couldn't find any relevant discussions about that in this server.`;
        }

        const result = await queryUser(ctx.userId, query, sessionId);
        return result ?? `I don't have enough context from this conversation to answer that.`;
      } catch (error) {
        logger.error({ error, query, type }, 'Memory query failed');
        return `I had trouble searching my memories. Please try again.`;
      }
    },
  });
