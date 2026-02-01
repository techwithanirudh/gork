import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { customProvider, wrapLanguageModel } from 'ai';
import { createRetryable } from 'ai-retry';
import { env } from '@/env';
import logger from '@/lib/logger';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';

const hackclub = createOpenRouter({
  apiKey: env.HACKCLUB_API_KEY,
  baseURL: 'https://ai.hackclub.com/proxy/v1',
});

const google = createGoogleGenerativeAI({
  apiKey: env.GOOGLE_GENERATIVE_AI_API_KEY ?? '',
});

const chatModel = createRetryable({
  model: hackclub('google/gemini-3-flash-preview'),
  retries: [
    hackclub('google/gemini-2.5-flash'),
    hackclub('openai/gpt-5-mini'),
    google('gemini-2.5-flash'),
    google('gemini-2.0-flash'),
  ],
  onError: (context) => {
    const { model } = context.current;
    logger.error(
      `error with model ${model.provider}/${model.modelId}, switching to next model`,
    );
  },
});

const relevanceModel = createRetryable({
  model: hackclub('openai/gpt-5-mini'),
  retries: [
    hackclub('google/gemini-2.5-flash'),
    google('gemini-2.5-flash-lite'),
  ],
  onError: (context) => {
    const { model } = context.current;
    logger.error(
      `error with model ${model.provider}/${model.modelId}, switching to next model`,
    );
  },
});

export const provider = customProvider({
  languageModels: {
    'chat-model': chatModel,
    'relevance-model': relevanceModel,
    'agent-model': hackclub('moonshotai/kimi-k2.5'),
  },
  embeddingModels: {
    'small-model': hackclub.textEmbeddingModel('openai/text-embedding-3-small'),
    'large-model': hackclub.textEmbeddingModel('openai/text-embedding-3-large'),
  },
});
