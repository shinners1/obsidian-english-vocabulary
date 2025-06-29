import { Notice } from 'obsidian';

interface TTSSettings {
    enabled: boolean;
    voice: string;
    playbackSpeed: number;
    autoPlay: boolean;
}

export class TTSService {
    private audioElement: HTMLAudioElement | null = null;
    private settings: TTSSettings;

    constructor(settings: TTSSettings) {
        this.settings = settings;
    }

    async speakText(text: string): Promise<void> {
        if (!this.settings.enabled) {
            new Notice('TTS 기능이 비활성화되어 있습니다.');
            return;
        }

        try {
            // Edge TTS가 설치되어 있는지 확인
            if (!window.speechSynthesis) {
                new Notice('이 브라우저는 음성 합성을 지원하지 않습니다.');
                return;
            }

            // 현재 재생 중인 음성이 있으면 중지
            this.stopSpeaking();

            // 음성 합성 설정
            const utterance = new SpeechSynthesisUtterance(text);
            
            // 영어 음성으로 설정
            utterance.lang = 'en-US';
            utterance.rate = this.settings.playbackSpeed;
            utterance.volume = 1.0;

            // 사용 가능한 음성 중에서 설정된 음성 찾기
            const voices = speechSynthesis.getVoices();
            const selectedVoice = voices.find(voice => 
                voice.name === this.settings.voice || 
                voice.lang.startsWith('en')
            );
            
            if (selectedVoice) {
                utterance.voice = selectedVoice;
            }

            // 음성 재생
            speechSynthesis.speak(utterance);

        } catch (error) {
            console.error('TTS 재생 중 오류 발생:', error);
            new Notice('음성 재생 중 오류가 발생했습니다.');
        }
    }

    async speakWord(word: string): Promise<void> {
        await this.speakText(word);
    }

    async speakExample(example: string): Promise<void> {
        await this.speakText(example);
    }

    stopSpeaking(): void {
        if (speechSynthesis.speaking) {
            speechSynthesis.cancel();
        }
        
        if (this.audioElement) {
            this.audioElement.pause();
            this.audioElement.currentTime = 0;
        }
    }

    updateSettings(newSettings: Partial<TTSSettings>): void {
        this.settings = { ...this.settings, ...newSettings };
    }

    getAvailableVoices(): SpeechSynthesisVoice[] {
        return speechSynthesis.getVoices().filter(voice => 
            voice.lang.startsWith('en')
        );
    }

    isEnabled(): boolean {
        return this.settings.enabled;
    }
}