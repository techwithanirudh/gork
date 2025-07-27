import logger from '@/lib/logger';
import type { MinimalContext } from '@/types';
import type { FilePart, ModelMessage } from 'ai';
import {
  Message as DiscordMessage,
  type Collection,
  type MessageAttachment as DiscordAttachment,
} from 'discord.js-selfbot-v13';

export type { MinimalContext };

export async function convertToModelMessages(
  messages: Collection<string, DiscordMessage<boolean>>
): Promise<Array<ModelMessage>> {
  return await Promise.all(
    messages.map(async (msg) => {
      const ref = msg.reference
        ? await msg.fetchReference().catch(() => null)
        : null;
      const text = ref
        ? `> ${ref.author.username}: ${ref.content}
${msg.author.username}: ${msg.content}`
        : `${msg.author.username}: ${msg.content}`;

      return {
        role: msg.author.id === msg.client.user?.id ? 'assistant' : 'user',
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
  const validTypes = ['image/jpeg', 'image/png', 'application/pdf'];

  const validAttachments = attachments.filter(
    (a) => a.contentType !== null && validTypes.includes(a.contentType)
  );

  const invalidAttachments = attachments.filter(
    (a) => a.contentType === null || !validTypes.includes(a.contentType)
  );

  if (invalidAttachments.size > 0) {
    logger.warn(
      `Ignored attachments: ${Array.from(invalidAttachments.values())
        .map((a) => a.name)
        .join(', ')}`
    );
  }

  const results: FilePart[] = [];

  for (const attachment of validAttachments.values()) {
    try {
      const res = await fetch(attachment.url);
      const buffer = await res.arrayBuffer();

      results.push({
        type: 'file',
        data: buffer,
        mediaType: attachment.contentType || 'application/octet-stream',
        filename: attachment.name || 'unknown',
      });
    } catch (err) {
      logger.warn(`Failed to fetch attachment ${attachment.name}:`, err);
    }
  }

  return [];
}

export function isDiscordMessage(msg: unknown): msg is DiscordMessage {
  return msg instanceof DiscordMessage && typeof msg.reply === 'function';
}
