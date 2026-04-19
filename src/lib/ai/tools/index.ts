import type { RequestHints } from '@/types/request';
import type { Message } from 'discord.js';
import { getUserInfo } from './get-user-info';
import { getWeather } from './get-weather';
import { listChannels } from './list-channels';
import { listGuilds } from './list-guilds';
import { searchMemories } from './search-memories';
import { react } from './react';
import { reply } from './reply';
import { searchWeb } from './search-web';
import { skip } from './skip';
import { startDM } from './start-dm';

export function createToolset({
  message,
  hints,
}: {
  message: Message;
  hints: RequestHints;
}): ToolSet {
  return {
    getWeather,
    searchWeb,
    startDM: startDM({ message }),
    getUserInfo: getUserInfo({ message }),
    react: react({ message }),
    reply: reply({ message }),
    skip: skip({ message }),
    searchMemories,
    listGuilds: listGuilds({ message }),
    listChannels: listChannels({ message }),
  };
}
