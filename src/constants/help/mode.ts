import type { CommandHelp } from '@/types';

export const modeHelp: CommandHelp = {
  name: 'mode',
  description: 'Control when Gork replies in this server or channel.',
  subcommands: [
    {
      name: 'set',
      usage: '/mode set <scope> <mode>',
      description: 'Set the reply mode for the server or current channel.',
    },
    {
      name: 'show',
      usage: '/mode show [scope]',
      description: 'Show the current mode and any channel override.',
    },
    {
      name: 'clear',
      usage: '/mode clear <scope>',
      description: 'Remove the server default or channel override.',
    },
  ],
  modes: [
    { name: 'ping only', description: 'only replies when pinged' },
    {
      name: 'relevance',
      description: 'decides whether to reply based on context (default)',
    },
    {
      name: 'ping + keyword',
      description: 'replies on pings or keyword matches',
    },
    { name: 'none', description: 'completely silent, ignores everything' },
  ],
  permissions: 'Server admins or bot owner',
};
