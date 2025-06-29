import { ITTSService } from './ITTSService';
import { TTSService } from '../../../infrastructure/tts/TTSService';
import { VocabularySettings } from '../../../features/settings/ui/settings';

export class TTSServiceAdapter implements ITTSService {
    private ttsService: TTSService;

    constructor(settings: VocabularySettings) {
        this.ttsService = new TTSService({
            enabled: settings.ttsEnabled,
            voice: settings.ttsVoice,
            playbackSpeed: settings.ttsPlaybackSpeed,
            autoPlay: settings.ttsAutoPlay
        });
    }

    async speakText(text: string): Promise<void> {
        await this.ttsService.speakText(text);
    }

    async speakWord(word: string): Promise<void> {
        await this.ttsService.speakWord(word);
    }

    async speakExample(example: string): Promise<void> {
        await this.ttsService.speakExample(example);
    }

    stopSpeaking(): void {
        this.ttsService.stopSpeaking();
    }

    updateSettings(settings: VocabularySettings): void {
        this.ttsService.updateSettings({
            enabled: settings.ttsEnabled,
            voice: settings.ttsVoice,
            playbackSpeed: settings.ttsPlaybackSpeed,
            autoPlay: settings.ttsAutoPlay
        });
    }

    isEnabled(): boolean {
        return this.ttsService.isEnabled();
    }

    getAvailableVoices(): SpeechSynthesisVoice[] {
        return this.ttsService.getAvailableVoices();
    }
}