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
      'Query memories. type="user" for facts about a person, type="session" for this channel conversation, type="guild" to search all channels.',
    inputSchema: z.object({
      query: z
        .string()
        .describe('Natural language question to answer from memory'),
      type: z
        .enum(['user', 'session', 'guild'])
        .describe(
          'user=facts about a person, session=this channel only, guild=search all channels in server',
        ),
      userId: z
        .string()
        .optional()
        .describe(
          'For type="user": who to ask about (e.g, id, username, displayName, tag). Defaults to message author.',
        ),
    }),
    execute: async ({ query, type = 'session', userId }) => {
      const ctx = buildMessageContext(message);
      const sessionId = resolveSessionId(ctx);

      logger.debug({ type, query, userId }, 'Memory query');

      try {
        if (type === 'user') {
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

        if (type === 'guild') {
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
