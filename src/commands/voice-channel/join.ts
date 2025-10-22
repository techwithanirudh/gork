import {
  entersState,
  getVoiceConnection,
  joinVoiceChannel,
  VoiceConnectionStatus,
} from '@discordjs/voice';
import { VoiceHandler } from '@/voice';
import { getVoiceHandler, setVoiceHandler } from '@/voice/state';
import type { ChatInputCommandInteraction } from 'discord.js';

// export const data = new SlashCommandBuilder()
//   .setName('join')
//   .setDescription('Joins the voice channel that you are in');

export async function execute(
  interaction: ChatInputCommandInteraction<'cached'>
) {
  await interaction.deferReply();

  let connection = getVoiceConnection(interaction.guildId);

  if (!connection) {
    const memberChannel = interaction.member?.voice.channel;
    if (!memberChannel) {
      await interaction.followUp("okay, but you're not in vc");

      return;
    }

    connection = joinVoiceChannel({
      adapterCreator: interaction.guild.voiceAdapterCreator,
      channelId: interaction.member.voice.channel.id,
      guildId: interaction.guild.id,
      selfDeaf: false,
      selfMute: true,
    });
  }

  try {
    await entersState(connection, VoiceConnectionStatus.Ready, 20_000);

    let handler = getVoiceHandler(interaction.guildId);
    if (!handler) {
      handler = new VoiceHandler();
      setVoiceHandler(interaction.guildId, handler);
    } else {
      await handler.stopListening();
    }

    await handler.attach(connection);
    await handler.startListening();
  } catch (error) {
    console.warn(error);

    await interaction.followUp(
      "oops, idk what happened. I couldn't join the voice channel."
    );
  }

  await interaction.followUp('thanks for inviting me! joined');
}
