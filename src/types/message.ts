import type {
  DMChannel,
  GroupDMChannel,
  Guild,
  Message,
  NewsChannel,
  PartialDMChannel,
  StageChannel,
  TextChannel,
  ThreadChannel,
  VoiceChannel,
} from 'discord.js-selfbot-v13';

export interface MinimalContext {
  id: string;
  author: {
    id: string;
    username: string;
  };
  content: string;
  reference?: Message['reference'];
  client: Message['client'];
  channel:
    | TextChannel
    | DMChannel
    | PartialDMChannel
    | GroupDMChannel
    | NewsChannel
    | StageChannel
    | ThreadChannel
    | VoiceChannel;
  guild?: Guild | null;
}
