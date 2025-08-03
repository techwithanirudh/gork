import type { LanguageModelV2Middleware } from '@ai-sdk/provider';

export const imageFilterMiddleware: LanguageModelV2Middleware = {
  transformParams: async ({ params }) => {
    // Check if prompt has messages (for chat-style prompts)
    if (params.prompt && typeof params.prompt === 'object' && 'messages' in params.prompt) {
      return {
        ...params,
        prompt: {
          ...params.prompt,
          messages: (params.prompt as any).messages.map((message: any) => ({
            ...message,
            content: Array.isArray(message.content)
              ? message.content.filter((part: any) => part.type !== 'image')
              : message.content
          }))
        }
      };
    }
    
    // For other prompt types, return as-is
    return params;
  }
};
