import { getPeerByUserId } from './shared';
import { tool } from 'ai';
import type { Message } from 'discord.js';
import { z } from 'zod';
import { resolveUserId } from '@/lib/discord/resolve-user';
import { getContextFromMessage, resolvePeerId } from '@/lib/memory';

export const getUserContext = ({ message }: { message: Message }) =>
  tool({
    description: 'Get a fast user representation (and optional peer card).',
    inputSchema: z.object({
      userId: z
        .string()
        .optional()
        .describe('User identifier (ID, username, display name, tag).'),
      query: z
        .string()
        .optional()
        .describe('Optional query to focus the representation.'),
      includeCard: z
        .boolean()
        .optional()
        .describe('Include peer card summary (default false).'),
    }),
    execute: async ({ userId, query, includeCard }) => {
      const ctx = getContextFromMessage(message);
      const resolvedUserId = userId
        ? await resolveUserId(message, userId)
        : ctx.userId;

      if (!resolvedUserId) {
        return { success: false, reason: 'User not found.' };
      }

      const peer = await getPeerByUserId(resolvedUserId);
      const representation = await peer.representation({
        searchQuery: query,
        searchTopK: 10,
        includeMostFrequent: true,
      });
      const card = includeCard ? await peer.card() : null;

      const parts = [];
      if (representation?.trim()) {
        parts.push(`Representation:\n${representation}`);
      }
      if (card && card.length > 0) {
        parts.push(`Peer card:\n- ${card.join('\n- ')}`);
      }

      const result = parts.join('\n');
      return result
        ? { success: true, result }
        : { success: false, reason: 'No user context.' };
    },
  });
