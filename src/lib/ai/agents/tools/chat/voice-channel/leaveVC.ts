import { createLogger } from '@/lib/logger';
import { getVoiceConnection } from '@discordjs/voice';
import { getVoiceHandler, deleteVoiceHandler } from '@/voice/state';
import { tool } from 'ai';
import { type Message } from 'discord.js';
import { z } from 'zod';

const logger = createLogger('tools:leaveVC');

export const leaveVC = ({ message }: { message: Message }) =>
  tool({
    description: 'Leave the current voice channel',
    inputSchema: z.object({
      guildId: z.string().describe('The ID of the guild to leave the voice channel from'),
    }),
    execute: async ({ guildId }) => {
      try {
        const connection = getVoiceConnection(guildId);

        if (!connection) {
          return {
            success: false,
            error: 'Not currently in a voice channel',
          };
        }

        const handler = getVoiceHandler(guildId);
        if (handler) {
          await handler.stopListening();
          deleteVoiceHandler(guildId);
        }

        connection.destroy();
        
        logger.info(`Successfully left voice channel in guild ${guildId}`);
        
        return {
          success: true,
          message: 'Successfully left the voice channel',
        };
      } catch (error) {
        logger.error({ error }, 'Error leaving voice channel');
        return {
          success: false,
          error: 'An error occurred while leaving the voice channel',
        };
      }
    },
  });
