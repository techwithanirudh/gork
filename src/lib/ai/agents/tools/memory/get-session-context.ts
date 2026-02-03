import { getContextFromMessage } from '@/lib/memory';
import { getSessionForContext } from './shared';
import { tool } from 'ai';
import type { Message } from 'discord.js';
import { z } from 'zod';

export const getSessionContext = ({ message }: { message: Message }) =>
  tool({
    description: 'Get a fast summary and highlights for this channel/thread.',
    inputSchema: z.object({
      query: z
        .string()
        .optional()
        .describe('Optional search query to focus the context.'),
      tokens: z
        .number()
        .int()
        .positive()
        .max(4096)
        .optional()
        .describe('Token budget for session context (default 2048).'),
    }),
    execute: async ({ query, tokens }) => {
      const ctx = getContextFromMessage(message);
      const session = await getSessionForContext(ctx);
      const context = await session.context({
        summary: true,
        tokens: tokens ?? 2048,
        searchQuery: query,
      });

      const summary = context.summary?.content?.trim();
      const highlights = context.messages
        .slice(0, 3)
        .map((m) => `- ${m.content}`)
        .join('\n');
      const result = [summary, highlights].filter(Boolean).join('\n');

      return result
        ? { success: true, result }
        : { success: false, reason: 'No session context.' };
    },
  });
