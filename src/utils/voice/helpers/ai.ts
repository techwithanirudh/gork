import { systemPrompt } from '@/lib/ai/prompts';
import { myProvider } from '@/lib/ai/providers';
import type { PineconeMetadataOutput } from '@/types';
import type { ScoredPineconeRecord } from '@pinecone-database/pinecone';
import { generateText } from 'ai';

// TODO: Add Memories, and other tools available in the AI provider
// TODO: Add History from the VC Chat Channel
// TODO: Add a better voice prompt, and also switch to 11labs v3 as the voice is much better
export async function getAIResponse(prompt: string): Promise<string> {
  const { text } = await generateText({
    system:
      systemPrompt({
        selectedChatModel: 'chat-model',
        requestHints: {
          time: new Date().toISOString(),
          city: undefined,
          country: undefined,
          server: 'Voice Channel',
          channel: 'voice',
          joined: Date.now(),
          status: 'online',
          activity: 'voice',
        },
        memories:
          [] as unknown as ScoredPineconeRecord<PineconeMetadataOutput>[],
      }) +
      '\n\nYou are talking to a person through a call, do not use markdown formatting, or emojis.',
    model: myProvider.languageModel('chat-model'),
    prompt,
  });

  return text;
}
