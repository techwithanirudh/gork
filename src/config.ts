// Activity Types: 0 = PLAYING, 2 = LISTENING, 3 = WATCHING, 5 = COMPETING

export const keywords = ['zenix', 'zenith', 'gpt', 'llm', 'ai', 'bot'];
export const country = 'Greece';
export const city = 'Athens';
export const timezone = 'Europe/Athens';

export const speed = {
  minDelay: 5,
  maxDelay: 15,
  speedMethod: 'divide',
  speedFactor: 180 * 180,
};

export const statuses = ['online', 'idle', 'dnd', 'offline'];
export const activities = [{ type: 0, name: 'chilling' }] as const;

export const messageThreshold = 10;
export const initialMessages = [
  { role: 'user' as const, content: 'tom_techy: how ru' },
  {
    role: 'assistant' as const,
    content: 'zenix_bits: the normal lief bro. how ru mann',
  },
  { role: 'user' as const, content: 'tom_techy: what are yu doing bro?' },
  {
    role: 'assistant' as const,
    content: 'zenix_bits: im coding some stuff. idk how lol',
  },
];

export const voice = {
  model: 'aura-arcas-en',
};
