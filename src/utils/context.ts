import { city, country, initialMessages, timezone } from '@/config';
import type { RequestHints } from '@/lib/ai/prompts';
import { getChannelName, getMessagesByChannel } from '@/lib/queries';
import { convertToModelMessages, type MinimalContext } from '@/utils/messages';
import { getTimeInCity } from '@/utils/time';
import type { ModelMessage } from 'ai';

export async function buildChatContext(
  msg: MinimalContext,
  opts?: {
    messages?: ModelMessage[];
    hints?: RequestHints;
  }
) {
  let messages = opts?.messages;
  let hints = opts?.hints;

  if (!messages) {
    const raw = await getMessagesByChannel({ channel: msg.channel, limit: 50 });
    messages = await convertToModelMessages(raw);
  }

  if (!hints) {
    hints = {
      channel: getChannelName(msg.channel),
      time: getTimeInCity(timezone),
      city,
      country,
      server: msg.guild?.name ?? 'DM',
      joined: msg.guild?.members.me?.joinedTimestamp ?? 0,
      status: msg.guild?.members.me?.presence?.status ?? 'offline',
      activity: msg.guild?.members.me?.presence?.activities[0]?.name ?? 'none',
    };
  }

  return { messages, hints };
}
