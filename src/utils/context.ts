import { city, country, timezone } from '@/config';
import { getChannelName, getMessagesByChannel } from '@/lib/queries';
import type { RequestHints } from '@/types';
import { convertToModelMessages } from '@/utils/messages';
import { getTimeInCity } from '@/utils/time';
import type { ModelMessage } from 'ai';
import { Message } from 'discord.js';
import { buildUserMap, type UserMapEntry } from './users';

export async function buildChatContext(
  msg: Message,
  opts?: {
    messages?: ModelMessage[];
    hints?: RequestHints;
  },
) {
  let messages = opts?.messages;
  let hints = opts?.hints;
  const channel = msg.channel;

  let rawMessages: Message[] = [];
  let userMap: Map<string, UserMapEntry> = new Map();

  if (!messages) {
    const raw = await getMessagesByChannel({
      channel: msg.channel,
      limit: 50,
      before: msg.id,
    });
    rawMessages = Array.from(raw.values());
    messages = await convertToModelMessages(raw);
    userMap = buildUserMap(raw);
  }

  if (!hints) {
    const me = msg.guild?.members.me;

    hints = {
      channel: getChannelName(channel),
      time: getTimeInCity(timezone),
      city,
      country,
      server: msg.guild?.name ?? 'DM',
      joined: me?.joinedTimestamp ?? 0,
      status: me?.presence?.status ?? 'offline',
      activity: me?.presence?.activities[0]?.name ?? 'none',
    };
  }

  return { messages, hints };
}
