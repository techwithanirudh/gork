import { voice } from '@/config';
import { createLogger } from '@/lib/logger';

import { LiveTranscriptionEvents } from '@deepgram/sdk';
import {
  AudioPlayer,
  EndBehaviorType,
  type VoiceReceiver,
} from '@discordjs/voice';
import type { Guild, GuildMember, User, VoiceBasedChannel } from 'discord.js';
import * as prism from 'prism-media';
import { deepgram, getAIResponse, playAudio, speak } from './helpers';

const logger = createLogger('voice:stream');

type ListeningContext = {
  user: User;
  member?: GuildMember | null;
  guild: Guild;
  channel: VoiceBasedChannel;
  player: AudioPlayer;
};

type CreateStreamInput = {
  user: User;
  member?: GuildMember | null;
  guild: Guild;
  channel: VoiceBasedChannel;
};

type RecognizerKey = `${string}:${string}:${string}`;

type RecognizerEntry = {
  stt: ReturnType<typeof deepgram.listen.live>;
  context: ListeningContext;
  sessionId: string;
  key: RecognizerKey;
  idleTimer?: NodeJS.Timeout;
};

const recognizers = new Map<RecognizerKey, RecognizerEntry>();

const IDLE_TIMEOUT_MS = 30_000;

function scheduleIdleCleanup(entry: RecognizerEntry) {
  if (entry.idleTimer) {
    clearTimeout(entry.idleTimer);
  }

  entry.idleTimer = setTimeout(() => {
    logger.debug(
      { key: entry.key },
      '[Deepgram] Closing idle transcription stream'
    );
    entry.stt.requestClose();
  }, IDLE_TIMEOUT_MS);
}

function getRecognizer(key: RecognizerKey, context: ListeningContext) {
  let entry = recognizers.get(key);

  if (entry) {
    entry.context = context;
    return entry;
  }

  const sessionId = `${context.guild.id}:${context.channel.id}`;
  const stt = deepgram.listen.live({
    smart_format: true,
    filler_words: true,
    interim_results: true,
    vad_events: true,
    sample_rate: 48_000,
    model: 'nova-3',
    language: 'en-US',
  });

  entry = {
    stt,
    context,
    sessionId,
    key,
  };

  recognizers.set(key, entry);

  stt.on(LiveTranscriptionEvents.Open, () => {
    logger.debug({ key }, '[Deepgram] Stream opened');
  });

  stt.on(LiveTranscriptionEvents.Close, () => {
    logger.debug({ key }, '[Deepgram] Stream closed');
    if (entry?.idleTimer) {
      clearTimeout(entry.idleTimer);
    }
    recognizers.delete(key);
  });

  stt.on(LiveTranscriptionEvents.Error, (error) => {
    logger.error({ error, key }, '[Deepgram] Stream error');
  });

  stt.on(LiveTranscriptionEvents.Metadata, (data) => {
    logger.debug({ data, key }, '[Deepgram] Metadata');
  });

  stt.on(LiveTranscriptionEvents.Transcript, async (data) => {
    const transcript = data.channel.alternatives[0].transcript;
    if (transcript.trim().length === 0) return;

    if (!data.speech_final) {
      return;
    }

    const { player, guild, channel, user, member } = entry!.context;

    player.pause(true);

    logger.info(
      { transcript, speakerId: user.id, sessionId: entry!.sessionId },
      '[Deepgram] Transcript'
    );

    try {
      const text = await getAIResponse({
        transcript,
        sessionId: entry!.sessionId,
        guild,
        channel,
        user,
        member,
      });

      logger.info(
        { text, speakerId: user.id, sessionId: entry!.sessionId },
        '[Deepgram] AI Response'
      );

      const audio = await speak({ text, model: voice.model });
      if (!audio) return;
      await playAudio(player, audio);
    } catch (error) {
      logger.error({ error }, '[Deepgram] Failed to process transcript');
      player.unpause();
    }
  });

  return entry;
}

function pipeToRecognizer(
  entry: RecognizerEntry,
  receiver: VoiceReceiver,
  userId: string
) {
  if (entry.idleTimer) {
    clearTimeout(entry.idleTimer);
    entry.idleTimer = undefined;
  }

  const opusStream = receiver.subscribe(userId, {
    end: {
      behavior: EndBehaviorType.AfterSilence,
      duration: 1_000,
    },
  });

  const oggStream = new prism.opus.OggLogicalBitstream({
    opusHead: new prism.opus.OpusHead({
      channelCount: 1,
      sampleRate: 48_000,
    }),
    pageSizeControl: {
      maxPackets: 10,
    },
  });

  opusStream.pipe(oggStream);
  oggStream.on('readable', () => {
    let chunk;
    while (null !== (chunk = oggStream.read())) {
      entry.stt.send(chunk);
    }
  });

  opusStream.on('end', () => {
    scheduleIdleCleanup(entry);
  });
}

export async function createListeningStream(
  receiver: VoiceReceiver,
  player: AudioPlayer,
  context: CreateStreamInput
) {
  const fullContext: ListeningContext = { ...context, player };
  const sessionKey: RecognizerKey = `${context.guild.id}:${context.channel.id}:${context.user.id}`;
  const entry = getRecognizer(sessionKey, fullContext);
  pipeToRecognizer(entry, receiver, context.user.id);
}
