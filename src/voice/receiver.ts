import { createLogger } from '@/lib/logger';
import { EndBehaviorType, VoiceConnection } from '@discordjs/voice';
import prism from 'prism-media';
import { Readable, Transform } from 'stream';

const logger = createLogger('voice:receiver');

export interface AudioReceiver {
  userId: string;
  stream: Readable;
}

export class VoiceReceiver {
  private connection: VoiceConnection;
  private activeStreams: Map<string, Readable> = new Map();

  constructor(connection: VoiceConnection) {
    this.connection = connection;
  }

  /**
   * Start receiving audio from a specific user
   */
  startReceivingUser(userId: string, callback: (audio: Buffer) => void): void {
    try {
      const receiver = this.connection.receiver;

      // Subscribe to user's audio stream
      const opusStream = receiver.subscribe(userId, {
        end: {
          behavior: EndBehaviorType.AfterSilence,
          duration: 100, // ms of silence before ending
        },
      });

      // Decode Opus to PCM
      const decoder = new prism.opus.Decoder({
        rate: 48000,
        channels: 2,
        frameSize: 960,
      });

      // Resample from 48kHz stereo to 16kHz mono for Deepgram
      const resampler = new prism.FFmpeg({
        args: [
          '-f',
          's16le',
          '-ar',
          '48000',
          '-ac',
          '2',
          '-i',
          'pipe:0',
          '-f',
          's16le',
          '-ar',
          '16000',
          '-ac',
          '1',
          'pipe:1',
        ],
      });

      // Create transform stream to buffer and emit chunks
      const bufferStream = new Transform({
        transform(chunk: Buffer, encoding, cb) {
          callback(chunk);
          cb(null, chunk);
        },
      });

      // Chain the streams
      const pipeline = opusStream
        .pipe(decoder)
        .pipe(resampler as any)
        .pipe(bufferStream);

      this.activeStreams.set(userId, pipeline);

      // Handle stream end
      pipeline.on('end', () => {
        logger.info(`Audio stream ended for user ${userId}`);
        this.activeStreams.delete(userId);
      });

      pipeline.on('error', (err: Error) => {
        logger.error({ err }, `Audio stream error for user ${userId}`);
        this.activeStreams.delete(userId);
      });

      logger.info(`Started receiving audio from user ${userId}`);
    } catch (err) {
      logger.error({ err }, `Failed to start receiving from user ${userId}`);
    }
  }

  /**
   * Stop receiving audio from a specific user
   */
  stopReceivingUser(userId: string): void {
    const stream = this.activeStreams.get(userId);
    if (stream) {
      stream.destroy();
      this.activeStreams.delete(userId);
      logger.info(`Stopped receiving audio from user ${userId}`);
    }
  }

  /**
   * Stop receiving all audio
   */
  stopAll(): void {
    for (const [userId, stream] of this.activeStreams) {
      stream.destroy();
      logger.info(`Stopped receiving audio from user ${userId}`);
    }
    this.activeStreams.clear();
  }

  /**
   * Get list of users currently being received from
   */
  getActiveUsers(): string[] {
    return Array.from(this.activeStreams.keys());
  }
}
