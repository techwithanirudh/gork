import { systemPrompt } from '@/lib/ai/prompts';
import { myProvider } from '@/lib/ai/providers';
import { createLogger } from '@/lib/logger';

import { probabilitySchema, type Probability } from '@/lib/validators';
import type { RequestHints } from '@/types';
import { generateObject, type ModelMessage } from 'ai';
import type { Message } from 'discord.js';
import type { ScoredPineconeRecord } from '@pinecone-database/pinecone';
import type { PineconeMetadataOutput } from '@/types';

const logger = createLogger('events:message:relevance');

export async function assessRelevance(
  msg: Message,
  messages: ModelMessage[],
  hints: RequestHints,
  memories: ScoredPineconeRecord<PineconeMetadataOutput>[]
): Promise<Probability> {
  try {
    const { object } = await generateObject({
      model: myProvider.languageModel('relevance-model'),
      messages,
      schema: probabilitySchema,
      system: systemPrompt({
        selectedChatModel: 'relevance-model',
        requestHints: hints,
        memories
      }),
      mode: 'json',
    });
    return object;
  } catch (error) {
    logger.error({ error }, 'Failed to assess relevance');
    return {
      probability: 0.5,
      reason: 'Oops! Something went wrong, please try again later',
    };
  }
}
