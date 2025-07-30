import { tool } from 'ai';
import type { Message } from 'discord.js-selfbot-v13';
import { z } from 'zod';

export const react = ({ message: { channel } }: { message: Message }) =>
  tool({
    description: 'React to a message on discord',
    inputSchema: z.object({
      emoji: z.string().describe('The emoji you want to react with'),
      id: z.string().describe('The ID of the message to react to'),
      // author: z.string().describe('The author of the message to react to'),
    }),
    execute: async ({ id, emoji }) => {
      try {
        const target = await channel.messages.fetch(id);
        await target.react(emoji);
        return {
          success: true,
          content: `Reacted with ${emoji}`,
        };
      } catch (error) {
        return {
          success: false,
          error: String(error),
        };
      }
    },
  });
