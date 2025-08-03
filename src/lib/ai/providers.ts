import { customProvider } from 'ai';

import { env } from '@/env';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { openai } from '@ai-sdk/openai';
import { createFallback } from 'ai-fallback';
import { createLogger } from '../logger';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';

const logger = createLogger('ai:providers');

const hackclub = createOpenAICompatible({
  name: 'hackclub',
  apiKey: env.HACKCLUB_API_KEY,
  baseURL: 'https://ai.hackclub.com',
});

const openrouter = createOpenRouter({
  apiKey: env.OPENROUTER_API_KEY!,
});

const google = createGoogleGenerativeAI({
  apiKey: env.GOOGLE_GENERATIVE_AI_API_KEY!,
});

const chatModel = createFallback({
  models: [
    google('gemini-2.5-flash'),
    google('gemini-2.0-flash'),
    google('gemini-2.5-flash-lite'),
    google('gemini-2.0-flash-lite'),
    openai('gpt-4.1'),
  ],
  onError: (error, modelId) => {
    logger.error(`error with model ${modelId}, switching to next model`);
  },
  modelResetInterval: 60000,
});

const relevanceModel = createFallback({
  models: [
    // Top tier
    openrouter('openrouter/horizon-beta'),
    openrouter('moonshotai/kimi-k2:free'),

    // Mistral
    openrouter('cognitivecomputations/dolphin-mistral-24b-venice-edition:free'),
    openrouter('mistralai/mistral-small-3.2-24b-instruct:free'),

    // Qwen
    openrouter('qwen/qwen3-235b-a22b:free'),
    openrouter('qwen/qwen3-30b-a3b:free'),
    openrouter('qwen/qwen3-14b:free'),
    openrouter('qwen/qwen3-8b:free'),

    // Deepseek
    openrouter('deepseek/deepseek-r1-0528-qwen3-8b:free'),

    // Gemma
    // openrouter('google/gemma-3n-e4b-it:free'),
    // openrouter('google/gemma-3n-e2b-it:free'),
    // openrouter('z-ai/glm-4.5-air:free')
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
    // 'relevance-model': openai.responses('gpt-4.1-nano'),
    "relevance-model": relevanceModel,
  },
  imageModels: {
    // 'small-model': openai.imageModel('dall-e-2'),
  },
  textEmbeddingModels: {
    'small-model': openai.embedding('text-embedding-3-small'),
    'large-model': openai.embedding('text-embedding-3-large'),
  },
});
