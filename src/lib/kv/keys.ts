const PREFIX =
  process.env.NODE_ENV === 'development' ? 'beta:discord' : 'discord';

export const redisKeys = {
  messageCount: (ctx: string) => `${PREFIX}:ctx:messageCount:${ctx}`,
  channelCount: (ctx: string) => `${PREFIX}:ctx:channelCount:${ctx}`,
  memorySessions: () => `${PREFIX}:memory:sessions`,
  responseModeGuild: (guildId: string) =>
    `${PREFIX}:responseMode:guild:${guildId}`,
  responseModeChannel: (channelId: string) =>
    `${PREFIX}:responseMode:channel:${channelId}`,
  silenced: (ctx: string) => `${PREFIX}:silenced:${ctx}`,
  safetyGuild: (guildId: string) => `${PREFIX}:safety:guild:${guildId}`,
  safetyChannel: (channelId: string) => `${PREFIX}:safety:channel:${channelId}`,
};
