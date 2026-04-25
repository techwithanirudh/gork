import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { Client, Events, GatewayIntentBits, Partials } from 'discord.js';
import { LangfuseExporter } from 'langfuse-vercel';
import { commands } from '@/commands';
import { deployCommands } from '@/deploy-commands';
import { env } from '@/env';
import { events } from '@/events';
import { redis } from '@/lib/kv';
import { createLogger } from '@/lib/logger';
import { toLogError } from '@/utils/error';
import { beginStatusUpdates } from '@/utils/status';

const logger = createLogger('core');

export const langfuse = new NodeSDK({
  traceExporter: new LangfuseExporter(),
  instrumentations: [getNodeAutoInstrumentations()],
});

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
  partials: [Partials.Channel, Partials.Message, Partials.User],
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
    logger.warn(
      toLogError(error),
      'Redis connection failed; continuing without cache'
    );
  }

  langfuse.start();
  beginStatusUpdates(client);
});

async function sendLogsMessage(message: string) {
  const channelId = env.DISCORD_LOGS_CHANNEL_ID;
  if (!channelId) {
    return;
  }
  try {
    const channel = await client.channels.fetch(channelId);
    if (channel?.isTextBased() && 'send' in channel) {
      await channel.send(message);
    }
  } catch (error) {
    logger.warn(toLogError(error), 'Failed to send logs channel message');
  }
}

client.on(Events.GuildCreate, async (guild) => {
  logger.info({ guildId: guild.id, guildName: guild.name }, 'Added to guild');

  try {
    await deployCommands({ guildId: guild.id });
  } catch (error) {
    logger.warn(
      { ...toLogError(error), guildId: guild.id, guildName: guild.name },
      'Failed to deploy commands for guild'
    );
  }

  await sendLogsMessage(`added to server: **${guild.name}** (\`${guild.id}\`)`);

  const systemChannel = guild.systemChannel;
  if (!systemChannel) {
    return;
  }

  try {
    await systemChannel.send("yeah i'm here, try not to make it weird");
  } catch (error) {
    logger.warn(
      {
        ...toLogError(error),
        guildId: guild.id,
        guildName: guild.name,
        channelId: systemChannel.id,
      },
      'Failed to send guild welcome message'
    );
  }
});

client.on(Events.GuildDelete, async (guild) => {
  try {
    logger.info(
      { guildId: guild.id, guildName: guild.name },
      'Removed from guild'
    );
    await sendLogsMessage(
      `removed from server: **${guild.name}** (\`${guild.id}\`)`
    );
  } catch (error) {
    logger.warn(
      { ...toLogError(error), guildId: guild.id, guildName: guild.name },
      'Guild delete handler failed'
    );
  }
});

client.on(Events.InteractionCreate, (interaction) => {
  if (interaction.isChatInputCommand()) {
    const { commandName } = interaction;
    if (commands[commandName as keyof typeof commands]) {
      commands[commandName as keyof typeof commands]
        // biome-ignore lint/suspicious/noExplicitAny: command execute signatures vary by command
        .execute(interaction as any)
        .catch((error: unknown) => {
          logger.error(toLogError(error), 'Command execution failed');
        });
    }
    return;
  }
});

for (const key of Object.keys(events)) {
  const event = events[key as keyof typeof events];

  const handler = (...args: unknown[]) => {
    const result = (event.execute as (...eventArgs: unknown[]) => unknown)(
      ...args
    );
    if (result instanceof Promise) {
      result.catch((error: unknown) =>
        logger.error(
          toLogError(error),
          `Unhandled error in event: ${event.name}`
        )
      );
    }
  };

  if (event?.once) {
    client.once(event.name, handler);
  } else {
    client.on(event.name, handler);
  }
}

const gracefulShutdown = async (signal: string) => {
  logger.info(`Received ${signal}, shutting down...`);

  if (redis?.isOpen) {
    await redis.quit();
    logger.info('Redis connection closed');
  }

  await langfuse.shutdown();
  process.exit(0);
};

process.on('SIGINT', () => {
  gracefulShutdown('SIGINT').catch((error) => {
    logger.error(toLogError(error), 'Failed during SIGINT shutdown');
  });
});
process.on('SIGTERM', () => {
  gracefulShutdown('SIGTERM').catch((error) => {
    logger.error(toLogError(error), 'Failed during SIGTERM shutdown');
  });
});
process.on('beforeExit', () => {
  if (redis?.isOpen) {
    redis.quit().catch((error) => {
      logger.error(toLogError(error), 'Failed to close Redis on beforeExit');
    });
  }
});

client.login(env.DISCORD_TOKEN).catch(async (err) => {
  logger.error('Login failed:', err);

  await langfuse.shutdown();

  if (redis?.isOpen) {
    await redis.quit();
  }
});
