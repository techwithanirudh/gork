import { systemPrompt } from '@/lib/ai/prompts';
import { myProvider } from '@/lib/ai/providers';
import { getUserInfo } from '@/lib/ai/tools/get-user-info';
import { getWeather } from '@/lib/ai/tools/get-weather';
import { joinServer } from '@/lib/ai/tools/join-server';
import { react } from '@/lib/ai/tools/react';
import { report } from '@/lib/ai/tools/report';
import { searchMemories } from '@/lib/ai/tools/search-memories';
import { searchWeb } from '@/lib/ai/tools/search-web';
import { startDM } from '@/lib/ai/tools/start-dm';
import type { RequestHints } from '@/types';
import type { ModelMessage } from 'ai';
import { generateText, stepCountIs } from 'ai';
import type { Message } from 'discord.js-selfbot-v13';

export async function generateResponse(
  msg: Message,
  messages: ModelMessage[],
  hints: RequestHints
): Promise<{ success: boolean; response?: string; error?: string }> {
  try {
    const system = systemPrompt({
      selectedChatModel: 'chat-model',
      requestHints: hints,
    });

    const { text } = await generateText({
      model: myProvider.languageModel('chat-model'),
      messages: [...messages],
      activeTools: [
        'getWeather',
        'searchWeb',
        'report',
        'joinServer',
        'startDM',
        'getUserInfo',
        'searchMemories',
        'react',
      ],
      tools: {
        getWeather,
        searchWeb,
        report: report({ message: msg }),
        joinServer: joinServer({ message: msg }),
        startDM: startDM({ message: msg }),
        getUserInfo: getUserInfo({ message: msg }),
        searchMemories: searchMemories({ message: msg }),
        react: react({ message: msg }),
      },
      system,
      stopWhen: stepCountIs(10),
    });

    return { success: true, response: text };
  } catch (e) {
    return {
      success: false,
      error: (e as Error)?.message,
    };
  }
}
