import { createLogger } from '@/lib/logger';
import {
  buildMessageContext,
  getPeerCard,
  isSnowflake,
  queryUser,
  resolveSessionId,
} from '@/lib/memory/honcho';
import { tool } from 'ai';
import type { Guild, Message } from 'discord.js';
import { z } from 'zod';

const logger = createLogger('tools:memories');

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
      'Query memories. scope="user" for facts about a person, scope="session" for this channel conversation.',
    inputSchema: z.object({
      query: z
        .string()
        .describe('Natural language question to answer from memory'),
      scope: z
        .enum(['user', 'session'])
        .describe('user=facts about a person, session=this channel only'),
      userId: z
        .string()
        .optional()
        .describe(
          'For scope="user": who to ask about (e.g, id, username, displayName, tag). Defaults to message author.',
        ),
    }),
    execute: async ({ query, scope, userId }) => {
      const ctx = buildMessageContext(message);
      const sessionId = resolveSessionId(ctx);

      logger.debug({ scope, query, userId }, 'Memory query');

      try {
        if (scope === 'user') {
          const resolvedUserId = userId
            ? resolveUserId(userId, message.guild)
            : ctx.userId;

          if (!resolvedUserId) {
            return { success: false, reason: 'User not found.' };
          }

          const result = await queryUser(resolvedUserId, query);
          return result
            ? { success: true, result }
            : { success: false, reason: 'No memory for user yet.' };
        }

        if (scope === 'session') {
          const result = await queryUser(ctx.userId, query, sessionId);
          return result
            ? { success: true, result }
            : { success: false, reason: 'No session context.' };
        }

        return { success: false, reason: 'Invalid scope.' };
      } catch (error) {
        logger.error({ error, query, scope }, 'Memory query failed');
        return { success: false, reason: 'Memory lookup failed.' };
      }
    },
  });

export const peerCard = ({ message }: { message: Message }) =>
  tool({
    description:
      'Get biographical summary of a user - their interests, facts, preferences. Use when you want an overview without a specific question.',
    inputSchema: z.object({
      userId: z
        .string()
        .optional()
        .describe(
          'Who to get the card for (ID or username). Defaults to message author.',
        ),
    }),
    execute: async ({ userId }) => {
      const ctx = buildMessageContext(message);

      const resolvedUserId = userId
        ? resolveUserId(userId, message.guild)
        : ctx.userId;

      logger.debug({ userId: resolvedUserId }, 'Peer card query');

      if (!resolvedUserId) {
        return { success: false, reason: 'User not found.' };
      }

      try {
        const card = await getPeerCard(resolvedUserId);
        if (!card || card.length === 0) {
          return { success: false, reason: 'No peer card yet.' };
        }
        return { success: true, card };
      } catch (error) {
        logger.error(
          { error, userId: resolvedUserId },
          'Peer card query failed',
        );
        return { success: false, reason: 'Peer card lookup failed.' };
      }
    },
  });
