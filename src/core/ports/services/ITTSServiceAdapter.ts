import { ITTSService } from './ITTSService';
import { TTSService, TTSServiceFactory } from '../../../infrastructure/tts/TTSService';
import { VocabularySettings } from '../../../features/settings/ui/settings';
import { App } from 'obsidian';

export class TTSServiceAdapter implements ITTSService {
    private ttsService: TTSService;
    private app: App;

    constructor(app: App, settings?: VocabularySettings) {
        this.app = app;
        this.ttsService = TTSServiceFactory.createTTSService(app, settings);
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
        // 기존 TTS 서비스 정리
        this.ttsService.destroy();
        
        // 새 설정으로 TTS 서비스 재생성
        this.ttsService = TTSServiceFactory.createTTSService(this.app, settings);
    }

    isEnabled(): boolean {
        return true; // 팩토리에서 이미 enabled 체크를 함
    }

    getAvailableVoices(): SpeechSynthesisVoice[] {
        const voices = this.ttsService.getAvailableVoices();
        // 기존 인터페이스 호환을 위해 빈 배열 반환 (실제 음성은 각 서비스가 처리)
        return [];
    }

    async testConnection(): Promise<boolean> {
        return await this.ttsService.testConnection();
    }

    isPaused(): boolean {
        return this.ttsService.isPaused();
    }

    resume(): void {
        this.ttsService.resume();
    }

    pause(): void {
        this.ttsService.pause();
    }

    destroy(): void {
        this.ttsService.destroy();
    }
}