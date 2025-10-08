import { Message as DiscordMessage, type Collection } from 'discord.js';

export interface UserMapEntry {
  username: string;
  displayName: string;
}

export function buildUserMap(
  messages: Collection<string, DiscordMessage>
): Map<string, UserMapEntry> {
  const userMap = new Map<string, UserMapEntry>();

  for (const msg of messages.values()) {
    userMap.set(msg.author.id, {
      username: msg.author.username,
      displayName: msg.author.displayName,
    });

    for (const [userId, user] of msg.mentions.users) {
      userMap.set(userId, {
        username: user.username,
        displayName: user.displayName,
      });
    }
  }

  return userMap;
}
