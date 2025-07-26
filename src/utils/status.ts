import { activities, statuses } from '@/config';
import logger from '@/lib/logger';
import type { ActivityType, PresenceStatusData } from 'discord.js-selfbot-v13';
import { Client } from 'discord.js-selfbot-v13';

type Activity = (typeof activities)[number];

const getRandomItem = <T>(arr: readonly T[]): T => {
  if (arr.length === 0) throw new Error('Array must not be empty');
  const randomIndex = Math.floor(Math.random() * arr.length);
  const item = arr[randomIndex];
  if (item === undefined) throw new Error('Selected item is undefined');
  return item;
};

const updateStatus = (client: Client): void => {
  if (!client.user) return;

  const status = getRandomItem(statuses) as PresenceStatusData;
  const activity = getRandomItem(activities) as Activity;

  client.user.setPresence({
    status,
    activities: [
      {
        name: activity.name,
        type: [
          'PLAYING',
          'STREAMING',
          'LISTENING',
          'WATCHING',
          'CUSTOM',
          'COMPETING',
          'HANG',
        ][activity.type] as ActivityType,
      },
    ],
  });

  logger.info(`Status: ${status}, Activity: ${activity.name}`);
};

const beginStatusUpdates = (
  client: Client,
  intervalMs = 10 * 60 * 1000
): void => {
  updateStatus(client);
  setInterval(() => updateStatus(client), intervalMs);
};

export { beginStatusUpdates, updateStatus };
