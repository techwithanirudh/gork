import { Client, Events, GatewayIntentBits, Partials } from 'discord.js';
import { commands } from '@/commands';
import { deployCommands } from '@/deploy-commands';
import { env } from '@/env';
import { events } from '@/events';
import { redis } from '@/lib/kv';
import { createLogger } from '@/lib/logger';
import { beginStatusUpdates } from '@/utils/status';

const logger = createLogger('core');
export const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildPresences,
    GatewayIntentBits.GuildMessageTyping,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.DirectMessageTyping,
    GatewayIntentBits.DirectMessageReactions,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates,
  ],
  partials: [Partials.Channel, Partials.Message],
});

client.once(Events.ClientReady, async (client) => {
  if (!client.user) {
    return;
  }
  logger.info(`Logged in as ${client.user.tag} (ID: ${client.user.id})`);
  logger.info('Bot is ready!');

  try {
    if (redis && !redis.isOpen) {
      await redis.connect();
    }
    if (redis) {
      const pong = await redis.ping();
      logger.info({ ping: pong }, 'Redis connected');
    } else {
      logger.warn('REDIS_URL not set; running without Redis-backed caching');
    }
  } catch (error) {
    logger.warn({ error }, 'Redis connection failed; continuing without cache');
  }

  beginStatusUpdates(client);
});

client.on(Events.GuildCreate, async (guild) => {
  await deployCommands({ guildId: guild.id });

  const channel = guild.systemChannel;
  if (channel) {
    await channel.send('hi');
  }
});

client.on(Events.InteractionCreate, (interaction) => {
  if (!(interaction.isChatInputCommand() && interaction.inCachedGuild())) {
    return;
  }
  const { commandName } = interaction;
  if (commands[commandName as keyof typeof commands]) {
    commands[commandName as keyof typeof commands]
      .execute(interaction)
      .catch((error: unknown) => {
        logger.error({ error }, 'Command execution failed');
      });
  }
});

for (const key of Object.keys(events)) {
  const event = events[key as keyof typeof events];

  if (event?.once) {
    client.once(event.name, (...args: unknown[]) =>
      (event.execute as (...eventArgs: unknown[]) => unknown)(...args)
    );
  } else {
    client.on(event.name, (...args: unknown[]) =>
      (event.execute as (...eventArgs: unknown[]) => unknown)(...args)
    );
  }
}

const gracefulShutdown = async (signal: string) => {
  logger.info(`Received ${signal}, shutting down...`);

  if (redis?.isOpen) {
    await redis.quit();
    logger.info('Redis connection closed');
  }

  process.exit(0);
};

process.on('SIGINT', () => {
  gracefulShutdown('SIGINT').catch((error) => {
    logger.error({ error }, 'Failed during SIGINT shutdown');
  });
});
process.on('SIGTERM', () => {
  gracefulShutdown('SIGTERM').catch((error) => {
    logger.error({ error }, 'Failed during SIGTERM shutdown');
  });
});
process.on('beforeExit', () => {
  if (redis?.isOpen) {
    redis.quit().catch((error) => {
      logger.error({ error }, 'Failed to close Redis on beforeExit');
    });
  }
});

client.login(env.DISCORD_TOKEN).catch((err) => {
  logger.error('Login failed:', err);
});
