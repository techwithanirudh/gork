import type { CommandHelp } from '@/types';

export const vcHelp: CommandHelp = {
  name: 'vc',
  description: 'Control Gork in voice channels.',
  subcommands: [
    {
      name: 'join',
      usage: '/vc join',
      description: 'Gork joins your current voice channel and listens.',
    },
    {
      name: 'leave',
      usage: '/vc leave',
      description: 'Gork leaves the voice channel.',
    },
  ],
  permissions: 'Anyone',
};
