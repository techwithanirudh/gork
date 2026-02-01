import type { RequestHints } from '@/types/request';
import { Experimental_Agent as Agent, stepCountIs } from 'ai';
import type { Message } from 'discord.js';
import { systemPrompt, type WorkingMemory } from '../prompts';
import { provider } from '../providers';
import { getUserInfo } from '../tools/get-user-info';
import { getWeather } from '../tools/get-weather';
import { searchWeb } from '../tools/search-web';
import { successToolCall } from '../utils';
import {
  memories,
  react,
  reply,
  skip,
  startDM,
  type MemoryContext,
} from './tools/chat';
import { joinVC, leaveVC } from './tools/chat/voice-channel';
import { listChannels, listDMs, listGuilds, listUsers } from './tools/memory';

export const orchestratorAgent = ({
  message,
  hints,
  memoryContext,
  workingMemory,
}: {
  message: Message;
  hints: RequestHints;
  memoryContext?: MemoryContext;
  workingMemory?: WorkingMemory | null;
}) =>
  new Agent({
    model: provider.languageModel('chat-model'),
    instructions: systemPrompt({
      agent: 'chat',
      message,
      requestHints: hints,
      workingMemory,
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
      getUserInfo: getUserInfo({ message }),
      react: react({ message }),
      reply: reply({ message }),
      skip: skip({ message }),
      memories: memories({ message, hints, context: memoryContext }),
      listGuilds: listGuilds({ message }),
      listChannels: listChannels({ message }),
      listDMs: listDMs({ message }),
      listUsers: listUsers({ message }),
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
