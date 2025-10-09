import { probabilitySchema } from '@/lib/validators';
import type { RequestHints } from '@/types/request';
import { Experimental_Agent as Agent, Output, stepCountIs } from 'ai';
import type { Message } from 'discord.js';
import { systemPrompt } from '../../prompts';
import { provider } from '../../providers';
import { listGuilds, searchMemories } from '../tools/memory';

export const relevanceAgent = ({
  message,
  hints,
}: {
  message: Message;
  hints: RequestHints;
}) =>
  new Agent({
    model: provider.languageModel('relevance-model'),
    system: systemPrompt({
      agent: 'relevance',
      message,
      requestHints: hints,
    }),
    tools: {
      searchMemories: searchMemories(),
      listGuilds: listGuilds({ message }),
    },
    stopWhen: [stepCountIs(5)],
    experimental_output: Output.object({
      schema: probabilitySchema,
    }),
    experimental_telemetry: {
      isEnabled: true,
      functionId: 'relevance',
      metadata: {
        userId: message.author.id,
        guildId: message.guild?.id ?? 'DM',
      },
    },
  });
