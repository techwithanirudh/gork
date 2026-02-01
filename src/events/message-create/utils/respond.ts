import { orchestratorAgent } from '@/lib/ai/agents/orchestrator';
import { formatMemories, scopedUserId, searchMemories } from '@/lib/memory';
import type { RequestHints } from '@/types';
import type { ModelMessage } from 'ai';
import type { Message } from 'discord.js';

export async function generateResponse(
  msg: Message,
  messages: ModelMessage[],
  hints: RequestHints,
) {
  try {
    const userId = scopedUserId(msg.guild?.id ?? null, msg.author.id);
    const memoryFilter = msg.guild?.id ? { guildId: msg.guild.id } : undefined;
    const memoryResults = await searchMemories(msg.content, userId, {
      limit: 5,
      filters: memoryFilter,
    });
    const memoryPrompt = formatMemories(memoryResults);

    const agent = orchestratorAgent({
      message: msg,
      hints,
    });
    const { toolCalls } = await agent.generate({
      messages: [
        ...(memoryPrompt
          ? ([{ role: 'system', content: memoryPrompt }] as ModelMessage[])
          : []),
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
