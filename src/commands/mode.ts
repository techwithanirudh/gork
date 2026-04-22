import {
  type ChatInputCommandInteraction,
  InteractionContextType,
  MessageFlags,
  PermissionsBitField,
  SlashCommandBuilder,
} from 'discord.js';
import { env } from '@/env';
import {
  clearResponseMode,
  getResponseMode,
  getStoredResponseMode,
  type ResponseMode,
  setResponseMode,
} from '@/lib/kv';

const modeLabels: Record<ResponseMode, string> = {
  ping: 'ping only',
  relevance: 'relevance',
  'ping+keyword': 'ping + keyword',
};

export const data = new SlashCommandBuilder()
  .setName('mode')
  .setDescription('Edit how Gork replies in this server or channel')
  .setContexts(InteractionContextType.Guild)
  .addSubcommand((subcommand) =>
    subcommand
      .setName('set')
      .setDescription('Set the reply mode for the server or current channel')
      .addStringOption((option) =>
        option
          .setName('scope')
          .setDescription('Apply this mode to the server or current channel')
          .setRequired(true)
          .addChoices(
            { name: 'Server', value: 'guild' },
            { name: 'Channel', value: 'channel' }
          )
      )
      .addStringOption((option) =>
        option
          .setName('mode')
          .setDescription('Choose how Gork should respond')
          .setRequired(true)
          .addChoices(
            { name: 'Ping only', value: 'ping' },
            { name: 'Relevance', value: 'relevance' },
            { name: 'Ping + keyword', value: 'ping+keyword' }
          )
      )
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName('show')
      .setDescription('Show the current mode for the server or current channel')
      .addStringOption((option) =>
        option
          .setName('scope')
          .setDescription('Show the server default or the channel override')
          .addChoices(
            { name: 'Server', value: 'guild' },
            { name: 'Channel', value: 'channel' }
          )
      )
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName('clear')
      .setDescription('Clear the server default or current channel override')
      .addStringOption((option) =>
        option
          .setName('scope')
          .setDescription('Clear the server default or the channel override')
          .setRequired(true)
          .addChoices(
            { name: 'Server', value: 'guild' },
            { name: 'Channel', value: 'channel' }
          )
      )
  )
  .addSubcommand((subcommand) =>
    subcommand.setName('help').setDescription('Show how to use /mode')
  );

export async function execute(
  interaction: ChatInputCommandInteraction<'cached'>
) {
  if (!interaction.guildId) {
    return interaction.reply({
      content: 'this only works in a server',
      flags: MessageFlags.Ephemeral,
    });
  }

  const canManageGuild = interaction.memberPermissions?.has(
    PermissionsBitField.Flags.ManageGuild
  );
  const isBotOwner = interaction.user.id === env.DISCORD_OWNER_ID;

  if (!(canManageGuild || isBotOwner)) {
    return interaction.reply({
      content: 'only mods or admins can change this setting',
      flags: MessageFlags.Ephemeral,
    });
  }

  const subcommand = interaction.options.getSubcommand();

  switch (subcommand) {
    case 'help':
      return interaction.reply({
        content: [
          '**`/mode set`** — set reply mode for the server or a channel',
          '**`/mode show`** — show the current mode (server default or channel override)',
          '**`/mode clear`** — remove the server default or channel override',
          '',
          '**Modes:** `ping only` · `relevance` · `ping + keyword`',
          '**Scopes:** `server` (default for all channels) · `channel` (overrides server)',
        ].join('\n'),
        flags: MessageFlags.Ephemeral,
      });

    case 'set': {
      const selectedScope = interaction.options.getString('scope', true) as
        | 'guild'
        | 'channel';
      const selectedMode = interaction.options.getString(
        'mode',
        true
      ) as ResponseMode;
      const targetId =
        selectedScope === 'guild' ? interaction.guildId : interaction.channelId;

      await setResponseMode({
        scope: selectedScope,
        id: targetId,
        mode: selectedMode,
      });

      return interaction.reply({
        content:
          selectedScope === 'guild'
            ? `cool, i will now use **${modeLabels[selectedMode]}** replies in this server`
            : `cool, i will now use **${modeLabels[selectedMode]}** replies in <#${targetId}>`,
        flags: MessageFlags.Ephemeral,
      });
    }

    case 'show': {
      const selectedScope = interaction.options.getString('scope', false) as
        | 'guild'
        | 'channel'
        | null;

      if (selectedScope === 'channel') {
        const storedMode = await getStoredResponseMode({
          scope: 'channel',
          id: interaction.channelId,
        });
        const effectiveMode = await getResponseMode({
          guildId: interaction.guildId,
          channelId: interaction.channelId,
        });

        return interaction.reply({
          content: storedMode
            ? `channel mode for <#${interaction.channelId}> is **${modeLabels[storedMode]}** (effective: **${modeLabels[effectiveMode]}**)`
            : `no channel override is set for <#${interaction.channelId}> (effective: **${modeLabels[effectiveMode]}**)`,
          flags: MessageFlags.Ephemeral,
        });
      }

      const storedMode = await getStoredResponseMode({
        scope: 'guild',
        id: interaction.guildId,
      });
      const effectiveMode = await getResponseMode({
        guildId: interaction.guildId,
        channelId: interaction.channelId,
      });

      return interaction.reply({
        content: storedMode
          ? `server mode is **${modeLabels[storedMode]}** (effective in this channel: **${modeLabels[effectiveMode]}**)`
          : `no server default is set (effective in this channel: **${modeLabels[effectiveMode]}**)`,
        flags: MessageFlags.Ephemeral,
      });
    }

    case 'clear': {
      const selectedScope = interaction.options.getString('scope', true) as
        | 'guild'
        | 'channel';
      const targetId =
        selectedScope === 'guild' ? interaction.guildId : interaction.channelId;

      await clearResponseMode({ scope: selectedScope, id: targetId });

      return interaction.reply({
        content:
          selectedScope === 'guild'
            ? 'server mode cleared; channels will fall back to relevance unless overridden'
            : `channel mode cleared for <#${targetId}>`,
        flags: MessageFlags.Ephemeral,
      });
    }

    default:
      return interaction.reply({
        content: 'unknown mode subcommand',
        flags: MessageFlags.Ephemeral,
      });
  }
}
