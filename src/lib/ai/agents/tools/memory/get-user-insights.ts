import {
  getPeerByUserId,
  resolveUserId,
} from './shared';
import { getContextFromMessage, getSessionId } from '@/lib/memory';
import { tool } from 'ai';
import type { Message } from 'discord.js';
import { z } from 'zod';

export const getUserInsights = ({ message }: { message: Message }) =>
  tool({
    description:
      'Get deeper, slower personalization insights about a user (dialectic).',
    inputSchema: z.object({
      query: z.string().describe('Question to answer using long-term memory.'),
      userId: z
        .string()
        .optional()
        .describe('User identifier (ID, username, display name, tag).'),
      scope: z
        .enum(['session', 'global'])
        .optional()
        .describe('Scope for insights (default session).'),
    }),
    execute: async ({ query, userId, scope }) => {
      const ctx = getContextFromMessage(message);
      const resolved = await resolveUserId(message, userId);
      if (!resolved.userId) {
        return { success: false, reason: 'User not found.' };
      }

      const peer = await getPeerByUserId(resolved.userId);
      const sessionId = getSessionId(ctx);
      const response = await peer.chat(query, {
        session: scope === 'global' ? undefined : sessionId,
      });

      return response?.trim()
        ? { success: true, result: response }
        : { success: false, reason: 'No insights found.' };
    },
  });
