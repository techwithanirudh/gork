import type { LanguageModelV2Middleware } from '@ai-sdk/provider';

export const imageFilterMiddleware: LanguageModelV2Middleware = {
  transformParams: async ({ params }) => {
    const { prompt: messages } = params;

    messages.forEach((msg) => {
      if (Array.isArray(msg.content)) {
        msg.content = msg.content.filter((part) => part.type !== 'file');
      }
    });

    return { ...params, prompt: messages };
  },
};
