export const shutupHelp = {
  name: 'shutup',
  description: 'Toggle whether Gork talks in this channel.',
  subcommands: [
    {
      name: '',
      usage: '/shutup',
      description:
        'Silences Gork for 6 hours. Run again to unsilence. Pings always wake Gork up.',
    },
  ],
  permissions: 'Anyone',
};
