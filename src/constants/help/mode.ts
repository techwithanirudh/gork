export const modeHelp = {
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
    }
  ],
  modes: [
    '**ping only**: only replies when pinged',
    '**relevance**: decides whether to reply based on context (default)',
    '**ping + keyword**: replies on pings or keyword matches',
  ],
  permissions: 'Server admins or bot owner',
};
