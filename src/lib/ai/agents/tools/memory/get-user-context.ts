import { getPeerByUserId, resolveUserId } from './shared';
import { tool } from 'ai';
import type { Message } from 'discord.js';
import { z } from 'zod';

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
      const resolved = await resolveUserId(message, userId);
      if (!resolved.userId) {
        return { success: false, reason: 'User not found.' };
      }

      const peer = await getPeerByUserId(resolved.userId);
      const representation = await peer.representation({
        searchQuery: query,
        searchTopK: 8,
        maxConclusions: 24,
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
