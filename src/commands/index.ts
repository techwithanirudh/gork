import { data as helpData, execute as helpExecute } from './help';
import { data as modeData, execute as modeExecute } from './mode';
import { data as pingData, execute as pingExecute } from './ping';
import { data as safetyData, execute as safetyExecute } from './safety';
import { data as shutupData, execute as shutupExecute } from './shutup';
import { data as vcData, execute as vcExecute } from './voice-channel';

export const commands = {
  ping: {
    data: pingData,
    execute: pingExecute,
  },
  mode: {
    data: modeData,
    execute: modeExecute,
  },
  shutup: {
    data: shutupData,
    execute: shutupExecute,
  },
  vc: {
    data: vcData,
    execute: vcExecute,
  },
  safety: {
    data: safetyData,
    execute: safetyExecute,
  },
  help: {
    data: helpData,
    execute: helpExecute,
  },
};
