import { systemPrompt } from '@/lib/ai/prompts';
import { myProvider } from '@/lib/ai/providers';
import { createLogger } from '@/lib/logger';

import { probabilitySchema, type Probability } from '@/lib/validators';
import type { PineconeMetadataOutput, RequestHints } from '@/types';
import type { ScoredPineconeRecord } from '@pinecone-database/pinecone';
import { generateObject, type ModelMessage } from 'ai';
import type { Message } from 'discord.js';

import { jsonrepair } from 'jsonrepair';

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
        memories,
        message: msg,
      }),
      experimental_repairText: async ({ text, error }) => {
        logger.info(
          { originalText: text, error },
          '[experimental_repairText] invoked'
        );

        try {
          const repaired = jsonrepair(text);

          const parsed = JSON.parse(repaired);
          const result = probabilitySchema.safeParse(parsed);

          if (!result.success) {
            throw new Error('Schema validation failed');
          }

          return JSON.stringify(result);
        } catch (err) {
          logger.error(
            { err },
            '[experimental_repairText] repair failed, falling back to model'
          );

          const { object: repaired } = await generateObject({
            model: myProvider.languageModel('chat-model'),
            schema: probabilitySchema,
            prompt: [
              'The model tried to output JSON with the following data:',
              text,
              'and encountered an error:',
              String(error?.cause ?? ''),
              'The tool accepts the following schema:',
              `{ "probability": number, "reason": string }`,
              'Please fix the outputs.',
            ].join('\n'),
          });

          return JSON.stringify(repaired);
        }
      },
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
