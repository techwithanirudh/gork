import { Client, Events, GatewayIntentBits, Partials } from 'discord.js';
import { commands } from '@/commands';
import { deployCommands } from '@/deploy-commands';
import { env } from '@/env';
import { events } from '@/events';
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

client.once(Events.ClientReady, (client) => {
  if (!client.user) {
    return;
  }
  logger.info(`Logged in as ${client.user.tag} (ID: ${client.user.id})`);
  logger.info('Bot is ready!');

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

client.login(env.DISCORD_TOKEN).catch((err) => {
  logger.error('Login failed:', err);
});
