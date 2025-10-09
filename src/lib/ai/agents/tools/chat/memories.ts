import type { RequestHints } from '@/types/request';
import { tool } from 'ai';
import type { Message } from 'discord.js';
import { z } from 'zod';
import { memoryAgent } from '../../agents';

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
      query: z.string().describe('The text query to search for in memories'),
    }),
    execute: async ({ query }) => {
      const agent = memoryAgent({ message, hints });

      return agent.generate({
        prompt: query,
      });
    },
  });
