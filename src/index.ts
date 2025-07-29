import { env } from '@/env';
import { events } from '@/events';
import { createLogger } from '@/lib/logger';
import { beginStatusUpdates } from '@/utils/status';
import { Client } from 'discord.js-selfbot-v13';

const logger = createLogger('core');
export const client = new Client();

client.once('ready', async () => {
  if (!client.user) return;
  logger.info(`Logged in as ${client.user.tag} (ID: ${client.user.id})`);
  logger.info('Bot is ready!');
  await beginStatusUpdates(client);
});

client.on('guildCreate', (guild) => {
  const channel = guild.systemChannel;
  if (channel) {
    channel
      .send('hi')
      .catch((err) => logger.error('Failed to send greeting:', err));
  }
});

Object.keys(events).forEach((key) => {
  const event = events[key as keyof typeof events];
  if (!event) return;

  const listener = (...args: Parameters<typeof event.execute>) => {
    try {
      event.execute(...args);
    } catch (err) {
      logger.error(`Error in event ${event.name}:`, err);
    }
  };

  if (event.once) {
    client.once(event.name, listener);
  } else {
    client.on(event.name, listener);
  }
});

client.login(env.DISCORD_TOKEN).catch((err) => {
  logger.error('Login failed:', err);
});
