import { customProvider } from 'ai';

import { env } from '@/env';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { openai } from '@ai-sdk/openai';
import { createFallback } from 'ai-fallback';
import { createLogger } from '../logger';

const logger = createLogger('ai:providers');

// const hackclub = createOpenAICompatible({
//   name: 'hackclub',
//   apiKey: env.HACKCLUB_API_KEY,
//   baseURL: 'https://ai.hackclub.com',
// });

// const openrouter = createOpenRouter({
//   apiKey: env.OPENROUTER_API_KEY!,
// });

const google = createGoogleGenerativeAI({
  apiKey: env.GOOGLE_GENERATIVE_AI_API_KEY!,
});

const chatModel = createFallback({
  models: [
    google('gemini-2.5-flash'),
    google('gemini-2.0-flash'),
    google('gemini-2.5-flash-lite'),
    google('gemini-2.0-flash-lite'),
    openai('gpt-4.1')
  ],
  onError: (error, modelId) => {
    logger.error(`error with model ${modelId}, switching to next model`);
  },
  modelResetInterval: 60000,
});

export const myProvider = customProvider({
  languageModels: {
    // "chat-model": hackclub("llama-3.3-70b-versatile"),
    // 'chat-model': openai.responses('gpt-4.1-mini'),
    'chat-model': chatModel,
    'reasoning-model': google('gemini-2.5-flash'),
    'relevance-model': openai.responses('gpt-4.1-mini'),
    // "relevance-model": hackclub("llama-3.3-70b-versatile"),
  },
  imageModels: {
    // 'small-model': openai.imageModel('dall-e-2'),
  },
  textEmbeddingModels: {
    'small-model': openai.embedding('text-embedding-3-small'),
    'large-model': openai.embedding('text-embedding-3-large'),
  },
});
