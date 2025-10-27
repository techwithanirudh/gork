import { saveToolMemory } from '@/lib/ai/memory/ingest';
import type { RequestHints } from '@/types/request';
import { Experimental_Agent as Agent, stepCountIs } from 'ai';
import type { Message } from 'discord.js';
import { systemPrompt } from '../prompts';
import { provider } from '../providers';
import { getUserInfo } from '../tools/get-user-info';
import { getWeather } from '../tools/get-weather';
import { searchWeb } from '../tools/search-web';
import { successToolCall } from '../utils';
import { memories, react, reply, skip, startDM } from './tools/chat';

export const orchestratorAgent = ({
  message,
  hints,
}: {
  message: Message;
  hints: RequestHints;
}) =>
  new Agent({
    model: provider.languageModel('chat-model'),
    system: systemPrompt({
      agent: 'chat',
      message,
      requestHints: hints,
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
      memories: memories({ message, hints }),
    },
    temperature: 0,
    onStepFinish: async ({ toolCalls = [], toolResults = [] }) => {
      if (!toolCalls.length) return;

      await Promise.all(
        toolCalls.map(async (call, i) => {
          const result = toolResults[i];
          if (!call || !result) return;
          if (call.toolName === 'memories' || call.toolName === 'searchMemories') return;
          if (call.toolName === 'reply' || call.toolName === 'skip' || call.toolName === 'react') return;

          await saveToolMemory(message, call.toolName, result);
        })
      );
    },
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

