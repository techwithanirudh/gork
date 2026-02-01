import { orchestratorAgent } from '@/lib/ai/agents/orchestrator';
import type { MemoryContext } from '@/lib/ai/agents/tools/chat';
import { getAllMemories, scopedUserId } from '@/lib/memory';
import type { RequestHints } from '@/types';
import type { ModelMessage } from 'ai';
import type { Message } from 'discord.js';

/**
 * Build memory context from recent messages for scoped memory retrieval
 */
function buildMemoryContext(
  msg: Message,
  messages: ModelMessage[],
): MemoryContext {
  const participantsMap = new Map<
    string,
    { username: string; displayName?: string }
  >();

  // Extract participants from model messages
  for (const m of messages) {
    if (m.role === 'user' && typeof m.content === 'string') {
      // Try to extract username from message format "username: content"
      const match = m.content.match(/^([^:]+):/);
      if (match && match[1]) {
        const username = match[1].trim();
        // We don't have IDs from model messages, but we can track usernames
        participantsMap.set(username, { username });
      }
    }
  }

  // Add the current message author
  participantsMap.set(msg.author.id, {
    username: msg.author.username,
    displayName: msg.author.displayName ?? undefined,
  });

  // Add mentioned users
  for (const [userId, user] of msg.mentions.users) {
    participantsMap.set(userId, {
      username: user.username,
      displayName: user.displayName,
    });
  }

  const participants = Array.from(participantsMap.entries()).map(
    ([id, info]) => ({
      id,
      username: info.username,
      displayName: info.displayName,
    }),
  );

  return {
    guildId: msg.guild?.id,
    guildName: msg.guild?.name,
    channelId: msg.channel.id,
    channelName:
      'name' in msg.channel ? (msg.channel.name ?? undefined) : undefined,
    participants,
  };
}

export async function generateResponse(
  msg: Message,
  messages: ModelMessage[],
  hints: RequestHints,
) {
  try {
    const memoryContext = buildMemoryContext(msg, messages);

    // Load working memory for the message author using mem0
    const workingMemory = msg.guild?.id
      ? await getAllMemories(scopedUserId(msg.guild.id, msg.author.id), {
          limit: 20,
          guildId: msg.guild.id,
        })
      : null;

    const agent = orchestratorAgent({
      message: msg,
      hints,
      memoryContext,
      workingMemory,
    });
    const { toolCalls } = await agent.generate({
      messages: [
        ...messages,
        {
          role: 'user',
          content: 'You are replying to the following message: ' + msg.content,
        },
      ],
    });

    return { success: true, toolCalls };
  } catch (e) {
    return {
      success: false,
      error: (e as Error)?.message,
    };
  }
}
