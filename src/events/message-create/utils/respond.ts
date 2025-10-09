import { orchestratorAgent } from '@/lib/ai/agents/orchestrator';
import type { RequestHints } from '@/types';
import type { ModelMessage } from 'ai';
import type { Message } from 'discord.js';

export async function generateResponse(
  msg: Message,
  messages: ModelMessage[],
  hints: RequestHints,
) {
  try {
    const agent = orchestratorAgent({ message: msg, hints });
    const { toolCalls } = await agent.generate({
      messages: [
        ...messages,
        {
          role: 'user',
          content: 'You are replying to the following message: ' + msg.content,
        },
      ]
    });

    return { success: true, toolCalls };
  } catch (e) {
    return {
      success: false,
      error: (e as Error)?.message,
    };
  }
}
