export const safetyHelp = {
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
    }
  ],
  modes: [
    '**unfiltered**: no content restrictions (default)',
    '**safe**: SFW mode, filters explicit content',
  ],
  permissions: 'Server admins or bot owner',
};
