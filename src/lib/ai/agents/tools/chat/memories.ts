import { createLogger } from '@/lib/logger';
import type { RequestHints } from '@/types/request';
import { tool } from 'ai';
import type { Message } from 'discord.js';
import { z } from 'zod';
import { memoryAgent } from '../../agents';

const logger = createLogger('tools:chat:memories');

export const memories = ({
  message,
  hints,
}: {
  message: Message;
  hints: RequestHints;
}) =>
  tool({
    description: 'Search through stored memories using a text query.',
    inputSchema: z.object({
      query: z
        .string()
        .describe('The fully-detailed question to search for in memories'),
    }),
    execute: async ({ query }) => {
      const agent = memoryAgent({ message, hints });

      const { text } = await agent.generate({
        prompt: query,
      });

      logger.info({ text }, 'Memory search results');

      return text;
    },
  });
