import { city, country, timezone } from '@/config';
import { queryMemories } from '@/lib/pinecone/operations';
import { getChannelName, getMessagesByChannel } from '@/lib/queries';
import type { PineconeMetadataOutput, RequestHints } from '@/types';
import { convertToModelMessages } from '@/utils/messages';
import { getTimeInCity } from '@/utils/time';
import type { ScoredPineconeRecord } from '@pinecone-database/pinecone';
import type { ModelMessage } from 'ai';
import { Channel, Message } from 'discord.js-selfbot-v13';

export async function buildChatContext(
  msg: Message,
  opts?: {
    messages?: ModelMessage[];
    hints?: RequestHints;
    memories?: ScoredPineconeRecord<PineconeMetadataOutput>[];
  }
) {
  let messages = opts?.messages;
  let hints = opts?.hints;
  let memories = opts?.memories;

  const channel = msg.channel as Channel;

  if (!messages) {
    const raw = await getMessagesByChannel({ channel: msg.channel, limit: 50 });
    messages = await convertToModelMessages(raw);
  }

  if (!hints) {
    hints = {
      channel: getChannelName(channel),
      time: getTimeInCity(timezone),
      city,
      country,
      server: msg.guild?.name ?? 'DM',
      joined: msg.guild?.members.me?.joinedTimestamp ?? 0,
      status: msg.guild?.members.me?.presence?.status ?? 'offline',
      activity: msg.guild?.members.me?.presence?.activities[0]?.name ?? 'none',
    };
  }

  if (!memories) {
    memories = await queryMemories(msg.content, {
      namespace: 'default',
      limit: 5,
      ignoreRecent: true,
      onlyTools: false,
    });
    console.log(memories)
  }

  return { messages, hints, memories };
}
