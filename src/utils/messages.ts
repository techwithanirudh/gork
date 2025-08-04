import { createLogger } from '@/lib/logger';

import type { FilePart, ModelMessage } from 'ai';
import {
  Message as DiscordMessage,
  type Collection,
  type MessageAttachment as DiscordAttachment,
} from 'discord.js-selfbot-v13';

const logger = createLogger('utils:messages');

export async function convertToModelMessages(
  messages: Collection<string, DiscordMessage<boolean>>
): Promise<Array<ModelMessage>> {
  return await Promise.all(
    messages.map(async (msg) => {
      const ref = msg.reference
        ? await msg.fetchReference().catch(() => null)
        : null;
      const text = ref
        ? `${msg.author.username}: ${msg.content} (${msg.id})`
        : `${msg.author.username}: ${msg.content} (${msg.id})`;
      const isBot = msg.author.id === msg.client.user?.id;

      if (isBot) {
        return {
          role: 'assistant' as const,
          content: [{ type: 'text' as const, text }],
          createdAt: msg.createdAt,
        };
      }

      return {
        role: 'user' as const,
        content: [
          { type: 'text' as const, text },
          ...(await processAttachments(msg.attachments)),
        ],
        createdAt: msg.createdAt,
      };
    })
  );
}

export async function processAttachments(
  attachments: Collection<string, DiscordAttachment>
): Promise<FilePart[]> {
  const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

  const validAttachments = Array.from(attachments.values()).filter(
    (a) => a.contentType && validTypes.includes(a.contentType)
  );

  const invalidNames = attachments
    .filter((a) => !a.contentType || !validTypes.includes(a.contentType))
    .map((a) => a.name);

  if (invalidNames.length > 0) {
    logger.warn(`Ignored attachments: ${invalidNames.join(', ')}`);
  }

  return validAttachments
    .map((attachment) => ({
      type: 'file' as const,
      data: attachment.url,
      mediaType: attachment.contentType || 'application/octet-stream',
    }))
    .filter(Boolean);
}

export function isDiscordMessage(msg: unknown): msg is DiscordMessage {
  return msg instanceof DiscordMessage && typeof msg.reply === 'function';
}
