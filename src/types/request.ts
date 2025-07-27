import type { Geo } from '@vercel/functions';

export interface RequestHints {
  time: string;
  city: Geo['city'];
  country: Geo['country'];
  server: string;
  channel: string;
  joined: number;
  status: string;
  activity: string;
}
