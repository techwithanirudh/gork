import { commands } from '@/commands';
import { env } from '@/env';
import { events } from '@/events';
import logger from '@/lib/logger';
import { beginStatusUpdates } from '@/utils/status';
import { Client, Events, GatewayIntentBits, Partials } from 'discord.js-selfbot-v13';

export const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
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
  logger.info(`Logged in as ${client.user.tag} (ID: ${client.user.id})`);
  logger.info('Bot is ready!');

  beginStatusUpdates(client);
});

client.on(Events.GuildCreate, async (guild) => {
  const channel = guild.systemChannel;
  if (channel) {
    await channel.send('hi');
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

client.login(env.DISCORD_TOKEN);
