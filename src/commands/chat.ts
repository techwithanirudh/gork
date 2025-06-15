import {
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
} from 'discord.js';
import { buildChatContext } from '@/utils/context';
import { generateResponse } from '@/events/message-create/utils/respond';
import { logIncoming, logReply } from '@/utils/log';

export const data = new SlashCommandBuilder()
  .setName('chat')
  .setDescription('Chat with the assistant')
  .addStringOption((opt) =>
    opt
      .setName('prompt')
      .setDescription('What do you want to say?')
      .setRequired(true),
  );

export async function execute(
  interaction: ChatInputCommandInteraction<'cached'>,
) {
  await interaction.deferReply();

  const prompt = interaction.options.getString('prompt', true);
  const ctxId = interaction.guild
    ? interaction.guild.id
    : `dm:${interaction.user.id}`;

  logIncoming(ctxId, interaction.user.username, prompt);

  const chatContext = {
    author: interaction.user,
    content: prompt,
    channel: interaction.channel!,
    guild: interaction.guild,
    client: interaction.client,
  };

  const initialMessages = !interaction.guild
    ? [
        {
          role: 'system' as const,
          content:
            'You are currently running in an environment where previous context cannot be retrieved.',
        },
      ]
    : undefined;

  const { messages, hints, memories } = await buildChatContext(chatContext, {
    messages: initialMessages,
  });

  const result = await generateResponse(chatContext, messages, hints, memories);

  logReply(ctxId, interaction.user.username, result, 'slash command');

  if (result.success && result.response) {
    await interaction.followUp(result.response);
  } else {
    await interaction.followUp({
      content: "oops, my message didn't go through.",
      ephemeral: true,
    });
  }
}
