import { env } from '@/env';
import { createLogger } from '@/lib/logger';
import { tool } from 'ai';
import type { Message } from 'discord.js';
import { AttachmentBuilder } from 'discord.js';
import { z } from 'zod';

const logger = createLogger('tools:generate-image');

type OpenAIImageResponse = {
  data?: Array<{
    b64_json?: string;
    revised_prompt?: string;
    url?: string;
  }>;
};

export const generateImage = ({ message }: { message: Message }) =>
  tool({
    description:
      'Generate an image from a prompt and send it in the channel with a short caption.',
    inputSchema: z.object({
      prompt: z.string().min(1).describe('The image prompt to generate.'),
      caption: z
        .string()
        .optional()
        .describe('Optional short caption to send along with the image.'),
      size: z
        .enum(['1024x1024', '1536x1024', '1024x1536'])
        .optional()
        .describe('Requested output size.'),
    }),
    execute: async ({ prompt, caption, size = '1024x1024' }) => {
      if (!env.OPENAI_API_KEY) {
        return {
          success: false,
          error: 'OPENAI_API_KEY is not configured',
        };
      }

      try {
        const channel = message.channel;
        if (!('send' in channel) || typeof channel.send !== 'function') {
          return { success: false, error: 'Channel is not text-based' };
        }

        const response = await fetch(
          'https://api.openai.com/v1/images/generations',
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${env.OPENAI_API_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: 'gpt-image-1',
              prompt,
              size,
            }),
          },
        );

        if (!response.ok) {
          const body = await response.text().catch(() => '');
          logger.error(
            { status: response.status, body },
            'Image generation failed',
          );
          return {
            success: false,
            error: `Image generation failed (${response.status})`,
          };
        }

        const payload = (await response.json()) as OpenAIImageResponse;
        const result = payload.data?.[0];

        if (!result) {
          return { success: false, error: 'No image returned by provider' };
        }

        const messagePayload =
          caption?.trim() || `here's your image for: ${prompt}`;

        if (result.b64_json) {
          const imageBuffer = Buffer.from(result.b64_json, 'base64');
          const attachment = new AttachmentBuilder(imageBuffer, {
            name: 'generated-image.png',
          });
          await channel.send({
            content: messagePayload,
            files: [attachment],
          });
        } else if (result.url) {
          await channel.send({
            content: `${messagePayload}\n${result.url}`,
          });
        } else {
          return {
            success: false,
            error: 'Provider returned an empty image response',
          };
        }

        logger.info({ prompt, size }, 'Generated image successfully');
        return {
          success: true,
          content: 'Image generated and sent to the channel',
        };
      } catch (error) {
        logger.error({ error, prompt, size }, 'Failed to generate image');
        return {
          success: false,
          error: String(error),
        };
      }
    },
  });
