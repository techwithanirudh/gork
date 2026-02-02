import { createLogger } from '@/lib/logger';
import {
  buildMessageContext,
  getPeerCard,
  isSnowflake,
  queryUser,
  resolveSessionId,
  searchGuild,
} from '@/lib/memory/honcho';
import { tool } from 'ai';
import type { Guild, Message } from 'discord.js';
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

function resolveUserId(input: string, guild: Guild | null): string | null {
  if (isSnowflake(input)) return input;
  if (!guild) return null;

  const needle = input.toLowerCase();
  const member = guild.members.cache.find(
    (m) =>
      m.user.username.toLowerCase() === needle ||
      m.displayName.toLowerCase() === needle ||
      m.user.tag?.toLowerCase() === needle,
  );
  return member?.user.id ?? null;
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
        .describe('User ID or username for type "user" (defaults to message author)'),
    }),
    execute: async ({ query, type = 'session', targetUserId }) => {
      const ctx = buildMessageContext(message);
      const sessionId = resolveSessionId(ctx);

      logger.debug({ type, query, targetUserId }, 'Memory query');

      try {
        if (type === 'user') {
          const userId = targetUserId
            ? resolveUserId(targetUserId, message.guild)
            : ctx.userId;

          if (!userId) {
            return { success: false, reason: 'User not found.' };
          }

          const result = await queryUser(userId, query, sessionId);
          return result
            ? { success: true, result }
            : { success: false, reason: 'No memory for user yet.' };
        }

        if (type === 'guild') {
          if (!ctx.guildId) {
            return { success: false, reason: 'Guild search requires a server.' };
          }
          const results = await searchGuild(ctx.guildId, query);
          if (results.length > 0) {
            return {
              success: true,
              result: results
                .slice(0, 5)
                .map((r) => `- ${r.content}`)
                .join('\n'),
            };
          }
          return { success: false, reason: 'No guild matches.' };
        }

        const result = await queryUser(ctx.userId, query, sessionId);
        return result
          ? { success: true, result }
          : { success: false, reason: 'No session context.' };
      } catch (error) {
        logger.error({ error, query, type }, 'Memory query failed');
        return { success: false, reason: 'Memory lookup failed.' };
      }
    },
  });

export const peerCard = ({ message }: { message: Message }) =>
  tool({
    description: 'Get biographical summary for a user.',
    inputSchema: z.object({
      targetUserId: z
        .string()
        .optional()
        .describe('User ID or username (defaults to message author)'),
    }),
    execute: async ({ targetUserId }) => {
      const ctx = buildMessageContext(message);

      const userId = targetUserId
        ? resolveUserId(targetUserId, message.guild)
        : ctx.userId;

      logger.debug({ userId }, 'Peer card query');

      if (!userId) {
        return { success: false, reason: 'User not found.' };
      }

      try {
        const card = await getPeerCard(userId);
        if (!card || card.length === 0) {
          return { success: false, reason: 'No peer card yet.' };
        }
        return { success: true, card };
      } catch (error) {
        logger.error({ error, userId }, 'Peer card query failed');
        return { success: false, reason: 'Peer card lookup failed.' };
      }
    },
  });
