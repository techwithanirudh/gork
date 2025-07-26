import type { RequestHints } from '@/lib/ai/prompts';
import { systemPrompt } from '@/lib/ai/prompts';
import { myProvider } from '@/lib/ai/providers';
import { getWeather } from '@/lib/ai/tools/get-weather';
import { report } from '@/lib/ai/tools/report';
import { searchWeb } from '@/lib/ai/tools/search-web';
import { isDiscordMessage, type MinimalContext } from '@/utils/messages';
import type { ModelMessage } from 'ai';
import { generateText, stepCountIs } from 'ai';

export async function generateResponse(
  msg: MinimalContext,
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
      activeTools: ['getWeather', 'searchWeb', 'report'],
      tools: {
        getWeather,
        searchWeb,
        report: report({ message: msg })
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
