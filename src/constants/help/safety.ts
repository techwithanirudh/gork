import type { CommandHelp } from '@/types';

export const safetyHelp: CommandHelp = {
  name: 'safety',
  description: 'Control content filtering for Gork in this server or channel.',
  subcommands: [
    {
      name: 'set',
      usage: '/safety set <scope> <mode>',
      description: 'Set the safety mode for the server or current channel.',
    },
    {
      name: 'show',
      usage: '/safety show [scope]',
      description: 'Show the current safety mode and any channel override.',
    },
    {
      name: 'clear',
      usage: '/safety clear <scope>',
      description: 'Remove the server default or channel override.',
    },
  ],
  modes: [
    { name: 'unfiltered', description: 'no content restrictions (default)' },
    { name: 'safe', description: 'SFW mode, filters explicit content' },
  ],
  permissions: 'Server admins or bot owner',
};
