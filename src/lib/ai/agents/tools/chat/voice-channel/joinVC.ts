import { createLogger } from '@/lib/logger';
import { createListeningStream } from '@/utils/voice/stream';
import {
  createAudioPlayer,
  entersState,
  getVoiceConnection,
  joinVoiceChannel,
  VoiceConnectionStatus,
} from '@discordjs/voice';
import { tool } from 'ai';
import { ChannelType, type Message } from 'discord.js';
import { z } from 'zod';

const logger = createLogger('tools:joinVC');

export const joinVC = ({ message }: { message: Message }) =>
  tool({
    description: 'Join a voice channel',
    inputSchema: z.object({
      channelId: z.string().describe('The ID of the voice channel to join'),
    }),
    execute: async ({ channelId }) => {
      try {
        const channel = await message.client.channels.fetch(channelId);
        if (!channel || channel.type !== ChannelType.GuildVoice) {
          return {
            success: false,
            error: 'Invalid channel ID or not a voice channel',
          };
        }

        const guild = channel.guild;
        if (!guild) {
          return {
            success: false,
            error: 'Channel is not in a guild',
          };
        }

        let connection = getVoiceConnection(guild.id);

        if (!connection) {
          connection = joinVoiceChannel({
            adapterCreator: guild.voiceAdapterCreator,
            channelId: channel.id,
            guildId: guild.id,
            selfDeaf: false,
            selfMute: true,
          });
        }

        try {
          await entersState(connection, VoiceConnectionStatus.Ready, 20_000);
          const receiver = connection.receiver;

          const player = createAudioPlayer();
          connection.subscribe(player);

          receiver.speaking.on('start', async (userId) => {
            const user = await message.client.users.fetch(userId);
            await createListeningStream(receiver, player, user);
          });

          logger.info(
            `Successfully joined voice channel ${channel.name} in guild ${guild.name}`
          );

          return {
            success: true,
            message: `Successfully joined voice channel ${channel.name}`,
          };
        } catch (error) {
          logger.error({ error }, 'Failed to establish voice connection');
          return {
            success: false,
            error: 'Failed to establish voice connection',
          };
        }
      } catch (error) {
        logger.error({ error }, 'Error joining voice channel');
        return {
          success: false,
          error: 'An error occurred while joining the voice channel',
        };
      }
    },
  });
