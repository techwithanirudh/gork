import { data as pingData, execute as pingExecute } from './ping';
import { data as vcData, execute as vcExecute } from './voice-channel';

export const commands = {
  ping: {
    data: pingData,
    execute: pingExecute,
  },
  vc: {
    data: vcData,
    execute: vcExecute,
  },
};
