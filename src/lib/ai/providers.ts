import { customProvider } from 'ai';

import { env } from '@/env';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { createFallback } from 'ai-fallback';
import { createLogger } from '../logger';
import { cohere } from '@ai-sdk/cohere';
import { openai } from "@ai-sdk/openai";

const logger = createLogger('ai:providers');

const hackclub = createOpenAICompatible({
  name: 'hackclub',
  apiKey: env.HACKCLUB_API_KEY,
  baseURL: 'https://ai.hackclub.com/proxy/v1',
});

const google = createGoogleGenerativeAI({
  apiKey: env.GOOGLE_GENERATIVE_AI_API_KEY ?? '',
});

const chatModel = createFallback({
  models: [
    hackclub('google/gemini-2.5-flash'),
    google('gemini-2.5-flash'),
    google('gemini-2.0-flash'),
    cohere('command-a-03-2025'),
    // openai('gpt-4.1'),
  ],
  onError: (error, modelId) => {
    logger.error(`error with model ${modelId}, switching to next model`);
  },
  modelResetInterval: 60000,
});

const relevanceModel = createFallback({
  models: [
    hackclub('openai/gpt-5-mini'),
    hackclub('google/gemini-2.5-flash'),
    google('gemini-2.5-flash-lite'),
    google('gemini-2.0-flash-lite'),
  ],
  onError: (error, modelId) => {
    logger.error(`error with model ${modelId}, switching to next model`);
  },
  modelResetInterval: 60000,
});

export const provider = customProvider({
  languageModels: {
    'chat-model': chatModel,
    'relevance-model': relevanceModel,
    'agent-model': hackclub('moonshotai/kimi-k2-thinking'),
  },
  imageModels: {
    // 'small-model': openai.imageModel('dall-e-2'),
  },
  textEmbeddingModels: {
    'small-model': openai.embedding('text-embedding-3-small'),
    'large-model': hackclub.textEmbeddingModel('openai/text-embedding-3-large'),
  },
});
