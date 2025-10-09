import { commands } from '@/commands';
import { deployCommands } from '@/deploy-commands';
import { env } from '@/env';
import { events } from '@/events';
import { createLogger } from '@/lib/logger';
import { beginStatusUpdates } from '@/utils/status';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { Client, Events, GatewayIntentBits, Partials } from 'discord.js';
import { LangfuseExporter } from 'langfuse-vercel';

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
  partials: [Partials.Channel, Partials.Message],
});

client.once(Events.ClientReady, (client) => {
  if (!client.user) return;
  logger.info(`Logged in as ${client.user.tag} (ID: ${client.user.id})`);
  logger.info('Bot is ready!');

  langfuse.start();
  beginStatusUpdates(client);
});

client.on(Events.GuildCreate, async (guild) => {
  await deployCommands({ guildId: guild.id });

  const channel = guild.systemChannel;
  if (channel) {
    await channel.send('hi');
  }
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isCommand()) {
    return;
  }
  const { commandName } = interaction;
  if (commands[commandName as keyof typeof commands]) {
    // @ts-expect-error todo: fix this
    commands[commandName as keyof typeof commands].execute(interaction);
  }
});

Object.keys(events).forEach(function (key) {
  const event = events[key as keyof typeof events];

  if (event?.once) {
    client.once(event.name, (...args) => event.execute(...args));
  } else {
    client.on(event.name, (...args) => event.execute(...args));
  }
});

client.login(env.DISCORD_TOKEN).catch(async (err) => {
  logger.error('Login failed:', err);
  await langfuse.shutdown();
});
