import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  type ChatInputCommandInteraction,
  EmbedBuilder,
  MessageFlags,
  OAuth2Scopes,
  PermissionsBitField,
  SlashCommandBuilder,
} from 'discord.js';
import { modeHelp, safetyHelp, shutupHelp, vcHelp } from '@/constants/help';

export const data = new SlashCommandBuilder()
  .setName('help')
  .setDescription('Show what Gork can do')
  .addStringOption((opt) =>
    opt
      .setName('command')
      .setDescription('Get detailed help for a specific command')
      .addChoices(
        { name: 'mode', value: 'mode' },
        { name: 'safety', value: 'safety' },
        { name: 'shutup', value: 'shutup' },
        { name: 'vc', value: 'vc' }
      )
  );

function buildActionRow(interaction: ChatInputCommandInteraction) {
  const inviteUrl = interaction.client.generateInvite({
    scopes: [OAuth2Scopes.Bot, OAuth2Scopes.ApplicationsCommands],
    permissions: [
      PermissionsBitField.Flags.ViewChannel,
      PermissionsBitField.Flags.SendMessages,
      PermissionsBitField.Flags.ReadMessageHistory,
      PermissionsBitField.Flags.AttachFiles,
      PermissionsBitField.Flags.EmbedLinks,
      PermissionsBitField.Flags.AddReactions,
      PermissionsBitField.Flags.Connect,
      PermissionsBitField.Flags.Speak,
    ],
  });

  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setLabel('Invite Gork')
      .setStyle(ButtonStyle.Link)
      .setURL(inviteUrl),
    new ButtonBuilder()
      .setLabel('Developer')
      .setStyle(ButtonStyle.Link)
      .setURL('https://techwithanirudh.com')
  );
}

function buildOverviewEmbed(interaction: ChatInputCommandInteraction) {
  const guild = interaction.guild;

  const embed = new EmbedBuilder()
    .setTitle('Gork')
    .setDescription(
      guild ? `Commands in **${guild.name}**` : 'A human-like Discord bot.'
    )
    .addFields(
      {
        name: 'mode',
        value: modeHelp.description,
        inline: false,
      },
      {
        name: 'safety',
        value: safetyHelp.description,
        inline: false,
      },
      {
        name: 'shutup',
        value: shutupHelp.subcommands[0]?.description ?? shutupHelp.description,
        inline: false,
      },
      {
        name: 'vc',
        value: vcHelp.description,
        inline: false,
      },
      {
        name: 'Tips',
        value:
          'Prefix any message with `//` to hide it from Gork.\nUse `/help command:<name>` for detailed usage.',
        inline: false,
      }
    )
    .setFooter({ text: 'Developed by Anirudh.' })
    .setColor(0x58_65_f2);

  return embed;
}

function buildCommandEmbed(command: string) {
  const helpMap = {
    mode: modeHelp,
    safety: safetyHelp,
    shutup: shutupHelp,
    vc: vcHelp,
  };
  const help = helpMap[command as keyof typeof helpMap];
  if (!help) {
    return null;
  }

  const embed = new EmbedBuilder()
    .setTitle(`Command: ${help.name}`)
    .setDescription(help.description)
    .setColor(0x58_65_f2);

  const usageLines = help.subcommands
    .map((s) => `- **\`${s.usage}\`**: ${s.description}`)
    .join('\n');

  if (usageLines) {
    embed.addFields({ name: 'Usage', value: usageLines });
  }

  if (help.modes && help.modes.length > 0) {
    const modeLines = help.modes
      .map((m) => `- **${m.name}**: ${m.description}`)
      .join('\n');
    embed.addFields({ name: 'Modes', value: modeLines });
  }

  embed.addFields({ name: 'Permission', value: help.permissions });

  return embed;
}

export function execute(interaction: ChatInputCommandInteraction) {
  const command = interaction.options.getString('command');

  if (command) {
    const embed = buildCommandEmbed(command);
    if (!embed) {
      return interaction.reply({
        content: 'unknown command',
        flags: MessageFlags.Ephemeral,
      });
    }
    return interaction.reply({
      embeds: [embed],
      flags: MessageFlags.Ephemeral,
    });
  }

  const embed = buildOverviewEmbed(interaction);
  const row = buildActionRow(interaction);

  return interaction.reply({
    embeds: [embed],
    components: [row],
    flags: MessageFlags.Ephemeral,
  });
}
