import type { ApplicationCommandData } from 'discord.js-selfbot-v13';
import { CommandInteraction } from 'discord.js-selfbot-v13';

export const data: ApplicationCommandData = {
  name: 'ping',
  description: 'Replies with Pong!',
  type: 1, // ChatInput
};

export async function execute(interaction: CommandInteraction) {
  return interaction.reply('Pong!');
}
