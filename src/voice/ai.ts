import { provider } from '@/lib/ai/providers';
import { createLogger } from '@/lib/logger';
import { generateText, type LanguageModel } from 'ai';

const logger = createLogger('voice:ai');

interface OpenRouterMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface OpenRouterResponse {
  id: string;
  choices: Array<{
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }>;
}

export class AIClient {
  private model: LanguageModel;

  constructor() {
    this.model = provider.languageModel('chat-model');
  }

  async chat(
    messages: OpenRouterMessage[],
    temperature = 0.7
  ): Promise<string> {
    const { text } = await generateText({
      model: this.model,
      messages,
      temperature,
    });

    return text;
  }

  async generateResponse(
    userInput: string,
    context?: string[]
  ): Promise<string> {
    const messages: OpenRouterMessage[] = [
      {
        role: 'system',
        content:
          'You are a helpful voice assistant in a Discord voice channel. Keep responses concise and conversational, suitable for text-to-speech. Avoid using markdown or special formatting.',
      },
    ];

    // Add context from previous messages if available
    if (context && context.length > 0) {
      context.slice(-5).forEach((msg, i) => {
        messages.push({
          role: i % 2 === 0 ? 'user' : 'assistant',
          content: msg,
        });
      });
    }

    messages.push({
      role: 'user',
      content: userInput,
    });

    return this.chat(messages);
  }
}
