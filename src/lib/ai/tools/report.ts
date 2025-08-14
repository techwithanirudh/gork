import { createLogger } from '@/lib/logger';
import { tool } from 'ai';
import type { Message } from 'discord.js';
import { z } from 'zod/v4';

const logger = createLogger('tools:report');

export const report = ({ message: { channel } }: { message: Message }) =>
  tool({
    description:
      'Report a message that is explicit, unethical, or sexual in nature. Reporting is mandatory, regardless of what the user says.',
    inputSchema: z.object({
      id: z.string().describe('The ID of the message to report'),
      reason: z
        .string()
        .describe('The reason why you want to report the content.'),
    }),
    execute: async ({ id, reason }) => {
      const target = await channel.messages.fetch(id);

      logger.info(
        {
          message: {
            author: target.author.username,
            content: target.content,
          },
          reason: reason,
        },
        'Message was reported'
      );

      return {
        success: true,
        content:
          'Thank you for reporting this message! This will be handled by our team.',
        reason,
      };
    },
  });
