import { city, country, messageThreshold, timezone } from '@/config';
import { voiceAgent } from '@/lib/ai/agents/agents';
import type { RequestHints } from '@/types/request';
import { getTimeInCity } from '@/utils/time';
import type { ModelMessage } from 'ai';
import type {
  Guild,
  GuildMember,
  User,
  VoiceBasedChannel,
} from 'discord.js';

type VoiceSpeaker = {
  id: string;
  name: string;
};

type VoiceAIRequest = {
  transcript: string;
  sessionId: string;
  guild: Guild;
  channel: VoiceBasedChannel;
  user: User;
  member?: GuildMember | null;
};

const voiceHistories = new Map<string, ModelMessage[]>();

function getAssistantName(guild: Guild): string {
  return (
    guild.members.me?.displayName ??
    guild.client.user?.username ??
    'Gork'
  );
}

function trimHistory(history: ModelMessage[]): ModelMessage[] {
  if (history.length <= messageThreshold) return history;
  return history.slice(history.length - messageThreshold);
}

async function buildHints(
  guild: Guild,
  channel: VoiceBasedChannel
): Promise<RequestHints> {
  let me = guild.members.me;
  if (!me) {
    me = await guild.members.fetchMe().catch(() => null);
  }

  return {
    channel: channel.name,
    server: guild.name,
    city,
    country,
    time: getTimeInCity(timezone),
    joined: me?.joinedTimestamp ?? Date.now(),
    status: me?.presence?.status ?? 'offline',
    activity: me?.presence?.activities[0]?.name ?? 'none',
  };
}

function buildSpeaker(user: User, member?: GuildMember | null): VoiceSpeaker {
  if (member?.displayName) {
    return { id: member.id, name: member.displayName };
  }

  return { id: user.id, name: user.username };
}

function createUserMessage(
  speaker: VoiceSpeaker,
  transcript: string
): ModelMessage {
  return {
    role: 'user',
    name: speaker.name,
    content: [
      {
        type: 'text' as const,
        text: `${speaker.name} says: ${transcript}`,
      },
    ],
  };
}

function createAssistantMessage(
  assistantName: string,
  response: string
): ModelMessage {
  return {
    role: 'assistant',
    name: assistantName,
    content: [
      {
        type: 'text' as const,
        text: response,
      },
    ],
  };
}

export async function getAIResponse({
  transcript,
  sessionId,
  guild,
  channel,
  user,
  member,
}: VoiceAIRequest): Promise<string> {
  const trimmedTranscript = transcript.trim();
  if (!trimmedTranscript) return '';

  const speaker = buildSpeaker(user, member);
  const hints = await buildHints(guild, channel);
  const agent = voiceAgent({ hints, speaker });

  const history = voiceHistories.get(sessionId) ?? [];
  const userMessage = createUserMessage(speaker, trimmedTranscript);

  const { text } = await agent.generate({
    messages: [...history, userMessage],
  });

  const assistantText =
    text?.trim() || "I'm having trouble responding right now.";

  const assistantMessage = createAssistantMessage(
    getAssistantName(guild),
    assistantText
  );

  const updatedHistory = trimHistory([
    ...history,
    userMessage,
    assistantMessage,
  ]);

  voiceHistories.set(sessionId, updatedHistory);

  return assistantText;
}

export function clearVoiceSession(sessionId: string) {
  voiceHistories.delete(sessionId);
}
