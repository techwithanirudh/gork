import { AudioPlayer, AudioPlayerStatus, createAudioPlayer, createAudioResource, NoSubscriberBehavior, StreamType, VoiceConnection } from '@discordjs/voice';
import { createLogger } from '@/lib/logger';
import { VoicePipeline } from './pipeline';
import { VoiceReceiver } from './receiver';
import { Readable } from 'stream';
import prism from 'prism-media';

const logger = createLogger('voice:voice');

export class VoiceHandler {
  private player: AudioPlayer;
  private pipeline: VoicePipeline;
  private receiver: VoiceReceiver | null = null;
  private connection: VoiceConnection | null = null;
  private isProcessing = false;
  private transcriptBuffer = '';
  private silenceTimer: NodeJS.Timeout | null = null;

  constructor(pipeline?: VoicePipeline) {
    this.player = createAudioPlayer({ behaviors: { noSubscriber: NoSubscriberBehavior.Play } });
    this.pipeline = pipeline ?? new VoicePipeline();
    
    this.player.on(AudioPlayerStatus.Idle, () => {
      logger.debug('Audio player idle');
    });
    
    this.player.on('error', (err) => {
      logger.error(`Audio player error: ${err}`);
    });
  }

  async attach(connection: VoiceConnection): Promise<void> {
    this.connection = connection;
    connection.subscribe(this.player);
    this.receiver = new VoiceReceiver(connection);
    
    // Connect the voice pipeline (Deepgram STT WebSocket)
    await this.pipeline.connect();
    
    // Set up transcription handler
    this.pipeline.getSTTClient().onTranscription(async (transcript: string, isFinal: boolean) => {
      await this.handleTranscription(transcript, isFinal);
    });
    
    logger.info('Voice handler attached to connection');
  }

  async startListening(userId?: string): Promise<void> {
    if (!this.receiver || !this.connection) {
      logger.error('Cannot start listening - no receiver or connection');
      return;
    }

    if (userId) {
      // Listen to specific user
      this.startListeningToUser(userId);
      logger.info(`Started listening to user ${userId}`);
    } else {
      // Auto-listen to all users in channel
      await this.autoListenToAllUsers();
    }
  }

  private async autoListenToAllUsers(): Promise<void> {
    if (!this.connection) {
      logger.error('No connection available for auto-listen');
      return;
    }

    try {
      // Get the voice channel from the connection
      const channel = this.connection.joinConfig.channelId;
      if (!channel) {
        logger.error('No channel ID in connection');
        return;
      }

      // Get guild from connection
      const guildId = this.connection.joinConfig.guildId;
      
      logger.info(`Auto-listening to all users in channel ${channel} (guild: ${guildId})`);
      
      // Note: In a real implementation, we'd need access to the Discord client
      // to get channel members. For now, log that auto-listen is enabled
      // and users need to be added manually or via voice state updates
      
      logger.info('Auto-listen enabled. Users will be added as they speak or via voice state updates.');
      
      // Set up voice state tracking for future users
      this.setupVoiceStateTracking();
    } catch (err) {
      logger.error(`Failed to set up auto-listen: ${err}`);
    }
  }

  private setupVoiceStateTracking(): void {
    // This would track voice state changes to auto-add users
    // For now, log that it's set up
    logger.info('Voice state tracking enabled for auto-listen');
  }

  getActiveUsers(): string[] {
    if (!this.receiver) return [];
    return this.receiver.getActiveUsers();
  }

  startListeningToUser(userId: string): void {
    if (!this.receiver) {
      logger.error('Cannot start listening - no receiver');
      return;
    }
    
    this.receiver.startReceivingUser(userId, (audioBuffer) => {
      this.pipeline.processAudio(audioBuffer);
    });
  }

  async stopListening(): Promise<void> {
    if (this.receiver) {
      this.receiver.stopAll();
    }
    
    if (this.silenceTimer) {
      clearTimeout(this.silenceTimer);
      this.silenceTimer = null;
    }
    
    this.pipeline.disconnect();
    logger.info('Stopped listening');
  }

  private async handleTranscription(transcript: string, isFinal: boolean): Promise<void> {
    if (!transcript || transcript.trim().length === 0) return;
    
    // Buffer transcripts
    this.transcriptBuffer += ' ' + transcript;
    
    // Reset silence timer
    if (this.silenceTimer) {
      clearTimeout(this.silenceTimer);
    }
    
    // If final transcript or enough buffered, process
    if (isFinal || this.transcriptBuffer.length > 100) {
      // Set timer to process after silence
      this.silenceTimer = setTimeout(async () => {
        await this.processTranscript();
      }, 1000); // 1 second of silence
    }
  }

  private async processTranscript(): Promise<void> {
    if (this.isProcessing || !this.transcriptBuffer.trim()) return;
    
    this.isProcessing = true;
    const input = this.transcriptBuffer.trim();
    this.transcriptBuffer = '';
    
    try {
      logger.info(`Processing transcript: "${input}"`);
      
      // Generate response using LLM
      const response = await this.pipeline.generateResponse(input);
      
      // Speak the response
      await this.speak(response);
    } catch (err) {
      logger.error(`Failed to process transcript: ${err}`);
    } finally {
      this.isProcessing = false;
    }
  }

  async speak(text: string): Promise<void> {
    try {
      // Get linear16 PCM at 16kHz mono and encode to Opus for Discord playback
      const pcm = await this.pipeline.synthesizeSpeech(text);
      
      if (!pcm || pcm.length === 0) {
        logger.warn('No audio data received from TTS');
        return;
      }
      
      const pcmStream = Readable.from(pcm);

      // Encode PCM -> Opus (Discord expects Opus @ 48k)
      const encoder = new prism.opus.Encoder({
        rate: 48000,
        channels: 1,
        frameSize: 960,
      });

      // Resample 16k -> 48k mono using prism FFmpeg
      const resampler = new prism.FFmpeg({
        args: [
          '-f', 's16le',
          '-ar', '16000',
          '-ac', '1',
          '-i', 'pipe:0',
          '-f', 's16le',
          '-ar', '48000',
          '-ac', '1',
          'pipe:1',
        ],
      });

      const opusStream = pcmStream.pipe(resampler as any).pipe(encoder);
      const resource = createAudioResource(opusStream, { inputType: StreamType.Opus });
      
      this.player.play(resource);
      logger.info(`Speaking: "${text.substring(0, 50)}..."`);
    } catch (err) {
      logger.error(`Failed to speak: ${err}`);
    }
  }

  onAudioReceived(callback: (audio: Buffer) => void): void {
    // Legacy method for compatibility
    logger.info('Registered onAudioReceived callback (use startListeningToUser instead)');
  }

  clearContext(): void {
    this.pipeline.clearContext();
    this.transcriptBuffer = '';
  }
}
