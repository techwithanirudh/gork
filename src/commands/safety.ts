import {
  type ChatInputCommandInteraction,
  InteractionContextType,
  MessageFlags,
  PermissionsBitField,
  SlashCommandBuilder,
} from 'discord.js';
import { env } from '@/env';
import {
  clearSafetyMode,
  getSafetyMode,
  getStoredSafetyMode,
  type SafetyMode,
  setSafetyMode,
} from '@/lib/kv';

const safetyLabels: Record<SafetyMode, string> = {
  unfiltered: 'unfiltered',
  safe: 'safe',
};

export const data = new SlashCommandBuilder()
  .setName('safety')
  .setDescription(
    'Control content filtering for Gork in this server or channel'
  )
  .setContexts(InteractionContextType.Guild)
  .addSubcommand((sub) =>
    sub
      .setName('set')
      .setDescription('Set the safety mode for the server or current channel')
      .addStringOption((opt) =>
        opt
          .setName('scope')
          .setDescription('Apply to the server or current channel')
          .setRequired(true)
          .addChoices(
            { name: 'Server', value: 'guild' },
            { name: 'Channel', value: 'channel' }
          )
      )
      .addStringOption((opt) =>
        opt
          .setName('mode')
          .setDescription('Safety level')
          .setRequired(true)
          .addChoices(
            { name: 'Unfiltered', value: 'unfiltered' },
            { name: 'Safe', value: 'safe' }
          )
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName('show')
      .setDescription('Show the current safety mode')
      .addStringOption((opt) =>
        opt
          .setName('scope')
          .setDescription('Show server default or channel override')
          .addChoices(
            { name: 'Server', value: 'guild' },
            { name: 'Channel', value: 'channel' }
          )
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName('clear')
      .setDescription('Remove the server default or channel override')
      .addStringOption((opt) =>
        opt
          .setName('scope')
          .setDescription('Clear server default or channel override')
          .setRequired(true)
          .addChoices(
            { name: 'Server', value: 'guild' },
            { name: 'Channel', value: 'channel' }
          )
      )
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

  const subcommand = interaction.options.getSubcommand();

  if (!(canManageGuild || isBotOwner)) {
    return interaction.reply({
      content: 'only mods or admins can change this setting',
      flags: MessageFlags.Ephemeral,
    });
  }

  switch (subcommand) {
    case 'set': {
      const scope = interaction.options.getString('scope', true) as
        | 'guild'
        | 'channel';
      const mode = interaction.options.getString('mode', true) as SafetyMode;
      const targetId =
        scope === 'guild' ? interaction.guildId : interaction.channelId;

      await setSafetyMode({ scope, id: targetId, mode });

      return interaction.reply({
        content:
          scope === 'guild'
            ? `got it, safety mode for this server is now **${safetyLabels[mode]}**`
            : `got it, safety mode for <#${targetId}> is now **${safetyLabels[mode]}**`,
        flags: MessageFlags.Ephemeral,
      });
    }

    case 'show': {
      const scope = interaction.options.getString('scope', false) as
        | 'guild'
        | 'channel'
        | null;

      if (scope === 'channel') {
        const stored = await getStoredSafetyMode({
          scope: 'channel',
          id: interaction.channelId,
        });
        const effective = await getSafetyMode({
          guildId: interaction.guildId,
          channelId: interaction.channelId,
        });
        return interaction.reply({
          content: stored
            ? `channel override for <#${interaction.channelId}> is **${safetyLabels[stored]}** (effective: **${safetyLabels[effective]}**)`
            : `no channel override set for <#${interaction.channelId}> (effective: **${safetyLabels[effective]}**)`,
          flags: MessageFlags.Ephemeral,
        });
      }

      const stored = await getStoredSafetyMode({
        scope: 'guild',
        id: interaction.guildId,
      });
      const effective = await getSafetyMode({
        guildId: interaction.guildId,
        channelId: interaction.channelId,
      });
      return interaction.reply({
        content: stored
          ? `server safety mode is **${safetyLabels[stored]}** (effective here: **${safetyLabels[effective]}**)`
          : `no server safety mode set (effective here: **${safetyLabels[effective]}**)`,
        flags: MessageFlags.Ephemeral,
      });
    }

    case 'clear': {
      const scope = interaction.options.getString('scope', true) as
        | 'guild'
        | 'channel';
      const targetId =
        scope === 'guild' ? interaction.guildId : interaction.channelId;

      await clearSafetyMode({ scope, id: targetId });

      return interaction.reply({
        content:
          scope === 'guild'
            ? 'server safety mode cleared; channels fall back to default (NSFW) unless overridden'
            : `channel safety mode cleared for <#${targetId}>`,
        flags: MessageFlags.Ephemeral,
      });
    }

    default:
      return interaction.reply({
        content: 'unknown subcommand',
        flags: MessageFlags.Ephemeral,
      });
  }
}
