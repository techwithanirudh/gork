import { systemPrompt, type RequestHints } from '@/lib/ai/prompts';
import { myProvider } from '@/lib/ai/providers';
import { probabilitySchema, type Probability } from '@/lib/validators';
import { generateObject, type ModelMessage } from 'ai';
import type { Message } from 'discord.js-selfbot-v13';

export async function assessRelevance(
  msg: Message,
  messages: ModelMessage[],
  hints: RequestHints
): Promise<Probability> {
  try {
    const { object } = await generateObject({
      model: myProvider.languageModel('relevance-model'),
      messages,
      schema: probabilitySchema,
      system: systemPrompt({
        selectedChatModel: 'relevance-model',
        requestHints: hints,
      }),
      mode: 'json',
    });
    return object;
  } catch {
    return {
      probability: 0.5,
      reason: 'Oops! Something went wrong, please try again later',
    };
  }
}
