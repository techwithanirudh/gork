import { saveToolMemory } from '@/lib/ai/memory/ingest';
import type { RequestHints } from '@/types/request';
import { Experimental_Agent as Agent, stepCountIs } from 'ai';
import type { Message } from 'discord.js';
import { systemPrompt } from '../../prompts';
import { provider } from '../../providers';
import { getWeather } from '../../tools/get-weather';
import { searchWeb } from '../../tools/search-web';

export const voiceAgent = ({
  hints,
}: {
  hints: RequestHints;
}) =>
  new Agent({
    model: provider.languageModel('chat-model'),
    system: systemPrompt({
      agent: 'voice',
      requestHints: hints,
    }),
    stopWhen: [
      stepCountIs(10)
    ],
    toolChoice: 'required',
    tools: {
      getWeather,
      searchWeb
    },
    temperature: 0,
    onStepFinish: async ({ toolCalls = [], toolResults = [] }) => {
      if (!toolCalls.length) return;

      await Promise.all(
        toolCalls.map(async (call, i) => {
          const result = toolResults[i];
          if (!call || !result) return;
          if (call.toolName === 'memories') return;
          if (call.toolName === 'searchMemories') return;

          await saveToolMemory({} as Message, call.toolName, result);
        })
      );
    },
    experimental_telemetry: {
      isEnabled: true,
      functionId: 'voice',
      metadata: {
        hints: JSON.stringify(hints),
      },
    },
  });
