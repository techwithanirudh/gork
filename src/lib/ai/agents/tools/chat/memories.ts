import { createLogger } from '@/lib/logger';
import type { RequestHints } from '@/types/request';
import { tool } from 'ai';
import type { Message } from 'discord.js';
import { z } from 'zod';
import { memoryAgent } from '../../agents';

const logger = createLogger('tools:chat:memories');

const SEARCH_STATUS_MESSAGE = '🔍 Searching memories...';

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

export const memories = ({
  message,
  hints,
  context,
}: {
  message: Message;
  hints: RequestHints;
  context?: MemoryContext;
}) =>
  tool({
    description: 'Search through stored memories using a text query.',
    inputSchema: z.object({
      query: z
        .string()
        .describe('The fully-detailed question to search for in memories'),
    }),
    execute: async ({ query }) => {
      // Send status message - memory searches can take 30-60+ seconds
      let statusMessage: Message | null = null;
      try {
        if ('send' in message.channel) {
          statusMessage = await message.channel.send(SEARCH_STATUS_MESSAGE);
        }
      } catch (error) {
        logger.warn({ error }, 'Failed to send memory search status message');
      }

      try {
        const agent = memoryAgent({ message, hints, context });

        const { text } = await agent.generate({
          prompt: query,
        });

        logger.info({ text }, 'Memory search results');

        return text;
      } finally {
        // Clean up status message
        if (statusMessage) {
          try {
            await statusMessage.delete();
          } catch (error) {
            logger.warn(
              { error },
              'Failed to delete memory search status message',
            );
          }
        }
      }
    },
  });
