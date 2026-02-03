import type { ContextResult } from '@/lib/memory/honcho';
import type { RequestHints } from '@/types/request';
import { Experimental_Agent as Agent, stepCountIs } from 'ai';
import type { Message } from 'discord.js';
import { systemPrompt } from '../prompts';
import { provider } from '../providers';
import { getWeather } from './tools/get-weather';
import { searchWeb } from './tools/search-web';
import { successToolCall } from '../utils';
import {
  getSessionContext,
  getUserContext,
  getUserInsights,
  getDiscordUser,
  react,
  reply,
  skip,
  startDM,
  vectorSearch,
} from './tools';
import { joinVC, leaveVC } from './tools/voice-channel';

export const orchestratorAgent = ({
  message,
  hints,
  context,
}: {
  message: Message;
  hints: RequestHints;
  context?: ContextResult | null;
}) =>
  new Agent({
    model: provider.languageModel('chat-model'),
    instructions: systemPrompt({
      agent: 'chat',
      message,
      requestHints: hints,
      context,
    }),
    stopWhen: [
      stepCountIs(10),
      successToolCall('reply'),
      successToolCall('react'),
      successToolCall('skip'),
    ],
    toolChoice: 'required',
    tools: {
      getWeather,
      searchWeb,
      startDM: startDM({ message }),
      getDiscordUser: getDiscordUser({ message }),
      react: react({ message }),
      reply: reply({ message }),
      skip: skip({ message }),
      getSessionContext: getSessionContext({ message }),
      getUserContext: getUserContext({ message }),
      getUserInsights: getUserInsights({ message }),
      vectorSearch: vectorSearch({ message }),
      joinVC: joinVC({ message }),
      leaveVC: leaveVC({ message }),
    },
    temperature: 0,
    experimental_telemetry: {
      isEnabled: true,
      functionId: 'orchestrator',
      metadata: {
        message: message.content,
        hints: JSON.stringify(hints),
        userId: message.author.id,
        guildId: message.guild?.id ?? 'DM',
      },
    },
  });
