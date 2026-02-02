import { createLogger } from '@/lib/logger';
import {
  buildMessageContext,
  getPeerCard,
  queryUser,
  resolveSessionId,
  searchGuild,
} from '@/lib/memory/honcho';
import { tool } from 'ai';
import { SnowflakeUtil, type Message } from 'discord.js';
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
        .describe(
          'User ID or username for type "user" (defaults to message author)',
        ),
    }),
    execute: async ({ query, type = 'session', targetUserId }) => {
      const ctx = buildMessageContext(message);
      const sessionId = resolveSessionId(ctx);

      logger.info({ type, query, targetUserId }, 'Memory query');

      try {
        if (type === 'user') {
          let userId = targetUserId ?? ctx.userId;
          let looksLikeSnowflake = false;
          try {
            SnowflakeUtil.deconstruct(userId);
            looksLikeSnowflake = true;
          } catch {
            looksLikeSnowflake = false;
          }

          if (!looksLikeSnowflake && message.guild) {
            const needle = userId.toLowerCase();
            const member = message.guild.members.cache.find((m) => {
              return (
                m.user.username.toLowerCase() === needle ||
                m.displayName.toLowerCase() === needle ||
                m.user.tag?.toLowerCase() === needle
              );
            });
            if (member) {
              userId = member.user.id;
            } else {
              return {
                success: false,
                reason:
                  'User not found in this server. Use a valid ID or username.',
              };
            }
          }

          const result = await queryUser(userId, query, sessionId);
          if (!result) {
            return {
              success: false,
              reason: "I don't have enough information about this user yet.",
            };
          }
          return { success: true, result };
        }

        if (type === 'guild') {
          if (!ctx.guildId) {
            return {
              success: false,
              reason: 'Guild search is only available in servers, not DMs.',
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
          return {
            success: false,
            reason:
              "I couldn't find any relevant discussions about that in this server.",
          };
        }

        const result = await queryUser(ctx.userId, query, sessionId);
        if (!result) {
          return {
            success: false,
            reason:
              "I don't have enough context from this conversation to answer that.",
          };
        }
        return { success: true, result };
      } catch (error) {
        logger.error({ error, query, type }, 'Memory query failed');
        return {
          success: false,
          reason: 'I had trouble searching my memories. Please try again.',
        };
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
      let userId = targetUserId ?? ctx.userId;

      logger.debug({ userId }, 'Peer card query');

      try {
        let looksLikeSnowflake = false;
        try {
          SnowflakeUtil.deconstruct(userId);
          looksLikeSnowflake = true;
        } catch {
          looksLikeSnowflake = false;
        }

        if (!looksLikeSnowflake && message.guild) {
          const needle = userId.toLowerCase();
          const member = message.guild.members.cache.find(
            (m) =>
              m.user.username.toLowerCase() === needle ||
              m.displayName.toLowerCase() === needle ||
              m.user.tag?.toLowerCase() === needle,
          );
          if (member) {
            userId = member.user.id;
          } else {
            return { success: false, reason: 'User not found.' };
          }
        }

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
