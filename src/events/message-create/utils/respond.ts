import { systemPrompt } from '@/lib/ai/prompts';
import { provider } from '@/lib/ai/providers';
import { getUserInfo } from '@/lib/ai/tools/get-user-info';
import { getWeather } from '@/lib/ai/tools/get-weather';
import { react } from '@/lib/ai/tools/react';
import { reply } from '@/lib/ai/tools/reply';
import { searchWeb } from '@/lib/ai/tools/search-web';
import { skip } from '@/lib/ai/tools/skip';
import { startDM } from '@/lib/ai/tools/start-dm';
import { successToolCall } from '@/lib/ai/utils';
import { saveToolMemory } from '@/lib/memory';
import type { RequestHints } from '@/types';
import type { ModelMessage } from 'ai';
import { generateText, stepCountIs } from 'ai';
import type { Message } from 'discord.js';

export async function generateResponse(
  msg: Message,
  messages: ModelMessage[],
  hints: RequestHints,
) {
  try {
    const system = systemPrompt({
      agent: 'chat',
      requestHints: hints,
      message: msg,
    });

    const { toolCalls } = await generateText({
      model: provider.languageModel('chat-model'),
      messages: [
        ...messages,
        {
          role: 'user',
          content: 'You are replying to the following message: ' + msg.content,
        },
      ],
      activeTools: [
        'getWeather',
        'searchWeb',
        'startDM',
        'getUserInfo',
        'react',
        'reply',
        'skip',
      ],
      toolChoice: 'required',
      tools: {
        getWeather,
        searchWeb,
        startDM: startDM({ message: msg }),
        getUserInfo: getUserInfo({ message: msg }),
        react: react({ message: msg }),
        reply: reply({ message: msg }),
        skip: skip({ message: msg }),
      },
      system,
      stopWhen: [
        stepCountIs(10),
        successToolCall('reply'),
        successToolCall('react'),
        successToolCall('skip'),
      ],
      onStepFinish: async ({ toolCalls = [], toolResults = [] }) => {
        if (!toolCalls.length) return;

        await Promise.all(
          toolCalls.map(async (call, i) => {
            const result = toolResults[i];
            if (!call || !result) return;
            if (call.toolName === 'searchMemories') return;

            await saveToolMemory(msg, call.toolName, result);
          })
        );
      },
    });

    return { success: true, toolCalls };
  } catch (e) {
    return {
      success: false,
      error: (e as Error)?.message,
    };
  }
}
