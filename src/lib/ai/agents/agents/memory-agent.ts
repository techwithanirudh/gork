import type { RequestHints } from '@/types/request';
import { Experimental_Agent as Agent, stepCountIs } from 'ai';
import type { Message } from 'discord.js';
import { systemPrompt } from '../../prompts';
import { provider } from '../../providers';
import { listGuilds, searchMemories } from '../tools/memory';

export const memoryAgent = ({
  message,
  hints,
}: {
  message: Message;
  hints: RequestHints;
}) =>
  new Agent({
    model: provider.languageModel('agent-model'),
    system: systemPrompt({
      agent: 'memory',
      message,
      requestHints: hints,
    }),
    tools: {
      searchMemories: searchMemories(),
      listGuilds: listGuilds({ message }),
    },
    stopWhen: [stepCountIs(5)],
    experimental_telemetry: {
      isEnabled: true,
      functionId: 'memory',
      metadata: {
        userId: message.author.id,
        guildId: message.guild?.id ?? 'DM',
      },
    },
  });
