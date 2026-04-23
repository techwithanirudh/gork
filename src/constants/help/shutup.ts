import type { CommandHelp } from '@/types';

export const shutupHelp: CommandHelp = {
  name: 'shutup',
  description: 'Toggle whether Gork talks in this channel.',
  subcommands: [
    {
      name: 'shutup',
      usage: '/shutup',
      description:
        'Silences Gork for 6 hours. Run again to unsilence. Pings always wake Gork up.',
    },
  ],
  permissions: 'Server admins or bot owner',
};
