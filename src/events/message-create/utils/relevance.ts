import { relevanceAgent } from '@/lib/ai/agents';
import { createLogger } from '@/lib/logger';

import { type Probability } from '@/lib/validators';
import type { RequestHints } from '@/types';
import { type ModelMessage } from 'ai';
import type { Message } from 'discord.js';

const logger = createLogger('events:message:relevance');

export async function assessRelevance(
  msg: Message,
  messages: ModelMessage[],
  hints: RequestHints
): Promise<Probability> {
  try {
    const agent = relevanceAgent({ message: msg, hints });
    const { experimental_output: output } = await agent.generate({
      messages: [
        ...messages,
        {
          role: 'user',
          content:
            'Analyze the above message and provide a structured assessment of its independent relevance to the bot.',
        },
      ],
    });

    return output;
  } catch (error) {
    logger.error({ error }, 'Failed to assess relevance');
    return {
      probability: 0.5,
      reason: 'Oops! Something went wrong, please try again later',
    };
  }
}
