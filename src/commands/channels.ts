import { redis, redisKeys } from '@/lib/kv';
import type {
  ApplicationCommandChannelOptionData,
  ApplicationCommandData,
  ApplicationCommandSubCommandData,
} from 'discord.js-selfbot-v13';
import { CommandInteraction, TextChannel } from 'discord.js-selfbot-v13';

export const data: ApplicationCommandData = {
  name: 'channels',
  description: 'Manage allowed channels for the bot',
  type: 1, // ChatInput
  defaultMemberPermissions: '16', // ManageChannels
  options: [
    {
      name: 'add',
      description: 'Add a channel to the allowed list',
      type: 1, // Subcommand
      options: [
        {
          name: 'channel',
          description: 'The text channel to add',
          type: 7, // Channel
          channelTypes: [0], // GuildText
          required: true,
        } as ApplicationCommandChannelOptionData,
      ],
    },
    {
      name: 'remove',
      description: 'Remove a channel from the allowed list',
      type: 1, // Subcommand
      options: [
        {
          name: 'channel',
          description: 'The text channel to remove',
          type: 7, // Channel
          channelTypes: [0], // GuildText
          required: true,
        } as ApplicationCommandChannelOptionData,
      ],
    } as ApplicationCommandSubCommandData,
    {
      name: 'list',
      description: 'List all allowed channels',
      type: 1, // Subcommand
    } as ApplicationCommandSubCommandData,
    {
      name: 'clear',
      description: 'Clear all allowed channels',
      type: 1, // Subcommand
    } as ApplicationCommandSubCommandData,
  ],
};

export async function execute(interaction: CommandInteraction) {
  if (!interaction.guild) {
    return interaction.reply({
      content: 'This can only be used inside a server.',
      ephemeral: true,
    });
  }

  const sub = interaction.options.getSubcommand();
  const guildKey = redisKeys.allowedChannels(interaction.guild.id);

  const getChannel = () =>
    interaction.options.getChannel('channel', true) as TextChannel;

  if (sub === 'add' || sub === 'remove') {
    const channel = getChannel();

    if (typeof channel.type === 'number' && channel.type !== 0) {
      // 0 = GuildText
      return interaction.reply({
        content: 'Please pick a text channel.',
        ephemeral: true,
      });
    }

    if (sub === 'add') {
      const isMember = await redis.sismember(guildKey, channel.id);
      if (isMember) {
        return interaction.reply({
          content: `${channel} is already allowed.`,
          ephemeral: true,
        });
      }
      await redis.sadd(guildKey, channel.id);
      return interaction.reply({
        content: `done! thanks for letting me talk in ${channel}!`,
        ephemeral: true,
      });
    } else {
      const removedCount = await redis.srem(guildKey, channel.id);
      if (!removedCount) {
        return interaction.reply({
          content: `there's nothing to remove! ${channel} wasn't even on the list.`,
          ephemeral: true,
        });
      }
      return interaction.reply({
        content: `aw... ${channel} has been removed from the allowed list. i won't talk there anymore...`,
        ephemeral: true,
      });
    }
  }

  if (sub === 'list') {
    const ids = await redis.smembers(guildKey);
    if (!ids.length) {
      return interaction.reply({
        content: 'no channels are locked down, i can talk anywhere.',
        ephemeral: true,
      });
    }
    const mentions = ids.map((id) => `<#${id}>`).join(' • ');
    return interaction.reply({
      content: `**allowed channels:** ${mentions}`,
      ephemeral: true,
    });
  }

  if (sub === 'clear') {
    await redis.del(guildKey);
    return interaction.reply({
      content: 'yay, thanks! i can talk anywhere now.',
      ephemeral: true,
    });
  }

  return interaction.reply({
    content: 'Unknown subcommand. ',
    ephemeral: true,
  });
}
