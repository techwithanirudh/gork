import {
  ActionRowBuilder,
  ButtonBuilder,
  type ButtonInteraction,
  ButtonStyle,
  type ChatInputCommandInteraction,
  EmbedBuilder,
  MessageFlags,
  StringSelectMenuBuilder,
  type StringSelectMenuInteraction,
} from 'discord.js';
import { env } from '@/env';
import {
  clearResponseMode,
  getStoredResponseMode,
  type ResponseMode,
  setResponseMode,
} from '@/lib/kv';

export type ModePanelTarget = 'guild' | 'channel';

const modeLabels: Record<ResponseMode, string> = {
  ping: 'ping only',
  relevance: 'relevance',
  'ping+keyword': 'ping + keyword',
};

const targetLabels: Record<ModePanelTarget, string> = {
  guild: 'server',
  channel: 'channel',
};

function getTargetId(
  interaction:
    | ChatInputCommandInteraction<'cached'>
    | ButtonInteraction
    | StringSelectMenuInteraction,
  target: ModePanelTarget
): string {
  return target === 'guild'
    ? (interaction.guildId ?? interaction.channelId)
    : interaction.channelId;
}

function getPanelTarget(customId: string): ModePanelTarget {
  return customId.endsWith(':channel') ? 'channel' : 'guild';
}

function buildRows(target: ModePanelTarget) {
  const targetSelect = new StringSelectMenuBuilder()
    .setCustomId('modepanel:target')
    .setPlaceholder('Target')
    .addOptions(
      { label: 'Server', value: 'guild', default: target === 'guild' },
      { label: 'Channel', value: 'channel', default: target === 'channel' }
    );

  const modeSelect = new StringSelectMenuBuilder()
    .setCustomId(`modepanel:mode:${target}`)
    .setPlaceholder(`Mode for ${targetLabels[target]}`)
    .addOptions(
      { label: 'Ping only', value: 'ping' },
      { label: 'Relevance', value: 'relevance' },
      { label: 'Ping + keyword', value: 'ping+keyword' }
    );

  const controlsRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`modepanel:clear:${target}`)
      .setLabel('Reset Selected')
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId(`modepanel:refresh:${target}`)
      .setLabel('Refresh')
      .setStyle(ButtonStyle.Secondary)
  );

  return [
    new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(targetSelect),
    new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(modeSelect),
    controlsRow,
  ];
}

export async function buildModePanelMessage({
  guildId,
  channelId,
  target,
}: {
  guildId: string;
  channelId: string;
  target: ModePanelTarget;
}) {
  const storedGuildMode = await getStoredResponseMode({
    scope: 'guild',
    id: guildId,
  });
  const storedChannelMode = await getStoredResponseMode({
    scope: 'channel',
    id: channelId,
  });
  const selectedTargetId = target === 'guild' ? guildId : channelId;

  const embed = new EmbedBuilder()
    .setTitle('Response Control')
    .setDescription('Configure when and where gork responds.')
    .addFields(
      {
        name: 'Target',
        value:
          target === 'guild' ? 'Server' : `Channel (<#${selectedTargetId}>)`,
        inline: false,
      },
      {
        name: 'Server default',
        value: storedGuildMode ? modeLabels[storedGuildMode] : 'relevance',
        inline: true,
      },
      {
        name: 'Override',
        value: storedChannelMode ? modeLabels[storedChannelMode] : 'none',
        inline: true,
      }
    )
    .setFooter({ text: 'Channel override wins over server default when set.' });

  return {
    embeds: [embed],
    components: buildRows(target),
  };
}

export async function openModePanel(
  interaction: ChatInputCommandInteraction<'cached'>
) {
  const panel = await buildModePanelMessage({
    guildId: interaction.guildId,
    channelId: interaction.channelId,
    target: 'channel',
  });

  return interaction.reply({
    ...panel,
    flags: MessageFlags.Ephemeral,
  });
}

export async function handleModePanelButton(interaction: ButtonInteraction) {
  if (!interaction.guildId) {
    return interaction.reply({
      content: 'this only works in a server',
      flags: MessageFlags.Ephemeral,
    });
  }

  const canManageGuild = interaction.memberPermissions?.has('ManageGuild');
  const isBotOwner = interaction.user.id === env.DISCORD_OWNER_ID;

  if (!(canManageGuild || isBotOwner)) {
    return interaction.reply({
      content: 'only mods or admins can change this setting',
      flags: MessageFlags.Ephemeral,
    });
  }

  const parts = interaction.customId.split(':');
  const action = parts[1];
  const target = getPanelTarget(interaction.customId);

  if (action === 'clear') {
    await clearResponseMode({
      scope: target,
      id: getTargetId(interaction, target),
    });
    const panel = await buildModePanelMessage({
      guildId: interaction.guildId,
      channelId: interaction.channelId,
      target,
    });
    return interaction.update(panel);
  }

  if (action === 'refresh') {
    const panel = await buildModePanelMessage({
      guildId: interaction.guildId,
      channelId: interaction.channelId,
      target,
    });
    return interaction.update(panel);
  }

  return interaction.reply({
    content: 'unknown mode control action',
    flags: MessageFlags.Ephemeral,
  });
}

export async function handleModePanelSelect(
  interaction: StringSelectMenuInteraction
) {
  if (!interaction.guildId) {
    return interaction.reply({
      content: 'this only works in a server',
      flags: MessageFlags.Ephemeral,
    });
  }

  const canManageGuild = interaction.memberPermissions?.has('ManageGuild');
  const isBotOwner = interaction.user.id === env.DISCORD_OWNER_ID;

  if (!(canManageGuild || isBotOwner)) {
    return interaction.reply({
      content: 'only mods or admins can change this setting',
      flags: MessageFlags.Ephemeral,
    });
  }

  const target = getPanelTarget(interaction.customId);

  if (interaction.customId === 'modepanel:target') {
    const nextTarget =
      interaction.values[0] === 'channel' ? 'channel' : 'guild';
    const panel = await buildModePanelMessage({
      guildId: interaction.guildId,
      channelId: interaction.channelId,
      target: nextTarget,
    });
    return interaction.update(panel);
  }

  const selectedMode = interaction.values[0] as ResponseMode;

  await setResponseMode({
    scope: target,
    id: getTargetId(interaction, target),
    mode: selectedMode,
  });

  const panel = await buildModePanelMessage({
    guildId: interaction.guildId,
    channelId: interaction.channelId,
    target,
  });

  return interaction.update(panel);
}
