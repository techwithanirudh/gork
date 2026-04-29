import { type CommandInteraction, SlashCommandBuilder } from 'discord.js';
import { isSilenced, setSilenced } from '@/lib/kv';

export const data = new SlashCommandBuilder()
  .setName('shutup')
  .setDescription('Tell gork to stop talking in this channel');

export async function execute(interaction: CommandInteraction) {
  const ctxId = interaction.channelId;
  if (await isSilenced(ctxId)) {
    return interaction.reply({
      content: 'already shut up. ping me if u want me back',
      ephemeral: true,
    });
  }
  await setSilenced(ctxId);
  return interaction.reply({
    content: 'aight ill shut up. ping me if u want me back',
    ephemeral: false,
  });
}
