import {
  type CommandInteraction,
  MessageFlags,
  PermissionsBitField,
  SlashCommandBuilder,
} from 'discord.js';
import { env } from '@/env';
import { isSilenced, setSilenced, unsetSilenced } from '@/lib/kv';

export const data = new SlashCommandBuilder()
  .setName('shutup')
  .setDescription('Toggle whether gork talks in this channel');

export async function execute(interaction: CommandInteraction) {
  const canManageGuild = interaction.memberPermissions?.has(
    PermissionsBitField.Flags.ManageGuild
  );
  const isBotOwner = interaction.user.id === env.DISCORD_OWNER_ID;

  if (!(canManageGuild || isBotOwner)) {
    return interaction.reply({
      content: 'only mods or admins can use this',
      flags: MessageFlags.Ephemeral,
    });
  }

  const ctxId = interaction.channelId;
  if (await isSilenced(ctxId)) {
    await unsetSilenced(ctxId);
    return interaction.reply({
      content: 'fine ill talk again',
      ephemeral: false,
    });
  }
  await setSilenced(ctxId);
  return interaction.reply({
    content:
      'aight ill shut up. ping me or run /shutup again if u want me back',
    ephemeral: false,
  });
}
