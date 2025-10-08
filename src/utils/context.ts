import { city, country, timezone, memories as memoriesConfig } from '@/config';
import baseLogger from '@/lib/logger';
import { queryMemories } from '@/lib/pinecone/operations';
import { getChannelName, getMessagesByChannel } from '@/lib/queries';
import type { PineconeMetadataOutput, RequestHints } from '@/types';
import { convertToModelMessages, formatDiscordMessage } from '@/utils/messages';
import { getTimeInCity } from '@/utils/time';
import type { ScoredPineconeRecord } from '@pinecone-database/pinecone';
import type { ModelMessage } from 'ai';
import { Message } from 'discord.js';

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
  const channel = msg.channel;

  let rawMessages: Message[] = [];

  if (!messages) {
    const raw = await getMessagesByChannel({ channel: msg.channel, limit: 50 });
    rawMessages = Array.from(raw.values());
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
    const tinyHistory = rawMessages
      .slice(-3)
      .map((rM) => formatDiscordMessage(rM, null))
      .join('\n');
    const onlyMessage = messages.length
      ? formatDiscordMessage(rawMessages[rawMessages.length - 1]!, null, {
        withAuthor: false,
        withContext: false,
        withReactions: false
      })
      : String(msg.content ?? '');

    const [
      memories0,
      memories1,
      memories2,
      memories3,
      memories4,
      memories5,
      memories6,
    ] = await Promise.all([
      queryMemories(msg.content, { namespace: 'default', limit: memoriesConfig.eachLimit }),
      queryMemories(tinyHistory, { namespace: 'default', limit: memoriesConfig.eachLimit }),
      queryMemories(tinyHistory, {
        namespace: 'default',
        limit: memoriesConfig.eachLimit,
        ageLimit: 1000 * 60 * 60, // 1 hour in ms
      }),
      queryMemories(onlyMessage, { namespace: 'default', limit: memoriesConfig.eachLimit }),
      queryMemories(onlyMessage, {
        namespace: 'default',
        limit: memoriesConfig.eachLimit,
        ageLimit: 1000 * 60 * 60,
      }),
      queryMemories(tinyHistory, {
        namespace: 'default',
        limit: memoriesConfig.eachLimit,
        ignoreRecent: false,
        onlyTools: true,
      }),
      queryMemories(tinyHistory, {
        namespace: 'default',
        limit: memoriesConfig.eachLimit,
        ignoreRecent: false,
        onlyTools: true,
        ageLimit: 1000 * 60 * 60,
      }),
    ]);

    const memoryLists = [
      memories6,
      memories1,
      memories4,
      memories3,
      memories5,
      memories0,
      memories2,
    ];

    const combined: ScoredPineconeRecord<PineconeMetadataOutput>[] = [];
    const seen = new Set<string>();
    for (let i = 0; i < memoriesConfig.eachLimit; i++) {
      for (let j = 0; j < memoryLists.length; j++) {
        const list = memoryLists[j] ?? [];
        if (i < list.length && combined.length < memoriesConfig.maxMemories) {
          const mem = list[i];
          if (!mem) continue;
          const id = mem.id ?? '';
          if (!id) continue;
          if (!seen.has(id)) {
            seen.add(id);
            combined.push(mem);
            if (combined.length === memoriesConfig.maxMemories) {
              break;
            }
          }
        }
      }
      if (combined.length === memoriesConfig.maxMemories) break;
    }

    memories = combined;
  }

  return { messages, hints, memories };
}
