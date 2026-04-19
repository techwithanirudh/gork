import type { RequestHints } from '@/types/request';
import { Experimental_Agent as Agent, stepCountIs } from 'ai';
import { systemPrompt } from '../../prompts';
import { provider } from '../../providers';
import { getWeather } from '../../tools/get-weather';
import { searchWeb } from '../../tools/search-web';

export const voiceAgent = ({
  speaker,
  hints,
}: {
  speaker: {
    id: string;
    name: string;
  };
  hints: RequestHints;
}) =>
  new Agent({
    model: provider.languageModel('chat-model'),
    instructions: systemPrompt({
      agent: 'voice',
      requestHints: hints,
      speakerName: speaker.name,
    }),
    stopWhen: [stepCountIs(6)],
    toolChoice: 'auto',
    tools: {
      getWeather,
      searchWeb,
    },
    temperature: 0.7,
    experimental_telemetry: {
      isEnabled: true,
      functionId: 'voice',
      metadata: {
        speakerId: speaker.id,
        speakerName: speaker.name,
        hints: JSON.stringify(hints),
      },
    },
  });
