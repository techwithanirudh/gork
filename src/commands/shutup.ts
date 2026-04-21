import { type CommandInteraction, SlashCommandBuilder } from 'discord.js';
import { isSilenced, setSilenced, unsetSilenced } from '@/lib/kv';

export const data = new SlashCommandBuilder()
  .setName('shutup')
  .setDescription('Toggle whether gork talks in this channel');

export async function execute(interaction: CommandInteraction) {
  const ctxId = interaction.channelId;
  if (await isSilenced(ctxId)) {
    await unsetSilenced(ctxId);
    return interaction.reply({
      content: 'fine ill talk again',
      ephemeral: true,
    });
  }
  await setSilenced(ctxId);
  return interaction.reply({ content: 'aight ill shut up', ephemeral: true });
}
