import { createLogger } from '@/lib/logger';
import {
  entersState,
  getVoiceConnection,
  joinVoiceChannel,
  VoiceConnection,
  VoiceConnectionStatus,
} from '@discordjs/voice';
import { Client, GatewayIntentBits, Message, Partials } from 'discord.js';
import '../config/env';

const logger = createLogger('voice:client');

export class DiscordClient {
  private client: Client;
  private connection: VoiceConnection | null = null;

  constructor() {
    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.MessageContent,
      ],
      partials: [Partials.Channel],
    });
  }

  async connect(): Promise<void> {
    const token = process.env.DISCORD_BOT_TOKEN;
    if (!token) throw new Error('DISCORD_BOT_TOKEN not set');
    await this.client.login(token);
    logger.info('Discord client logged in');
  }

  async disconnect(): Promise<void> {
    const conn = this.connection || getVoiceConnection('');
    if (conn) {
      try {
        conn.destroy();
      } catch {}
    }
    await this.client.destroy();
    logger.info('Discord client disconnected');
  }

  getClient(): Client {
    return this.client;
  }

  async joinVoiceChannel(channelId: string): Promise<VoiceConnection> {
    const channel = await this.client.channels.fetch(channelId);
    if (!channel || !('guild' in channel)) throw new Error('Invalid channel');

    this.connection = joinVoiceChannel({
      channelId,
      guildId: channel.guild.id,
      adapterCreator: channel.guild.voiceAdapterCreator as any,
      selfDeaf: false,
      selfMute: false,
    });

    await entersState(this.connection, VoiceConnectionStatus.Ready, 15_000);
    logger.info(`Joined voice channel ${channelId}`);
    return this.connection;
  }

  async joinStageChannel(channelId: string): Promise<VoiceConnection> {
    // Same join flow; unsuppress handled by requestSpeakerPermission
    return this.joinVoiceChannel(channelId);
  }

  async requestSpeakerPermission(): Promise<void> {
    // Caller should ensure bot has moderator perms on stage.
    // The unsuppress call requires fetching the GuildMember for the bot.
    // This is a placeholder; actual elevation must be done by a moderator or via permissions.
    logger.info(
      'Requesting speaker permission (ensure bot has Stage Moderator)'
    );
  }

  async leaveVoiceChannel(): Promise<void> {
    if (this.connection) {
      this.connection.destroy();
      this.connection = null;
      logger.info('Left voice channel');
    }
  }

  onTextMessage(callback: (message: Message) => void): void {
    this.client.on('messageCreate', (msg) => callback(msg));
  }
}
