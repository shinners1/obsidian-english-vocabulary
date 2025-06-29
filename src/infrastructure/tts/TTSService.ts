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
            // Web Speech API 지원 확인
            if (!window.speechSynthesis) {
                new Notice('이 브라우저는 음성 합성을 지원하지 않습니다.');
                return;
            }

            // 현재 재생 중인 음성이 있으면 중지
            this.stopSpeaking();

            // 음성 목록이 로드되지 않았을 수 있으므로 대기
            await this.ensureVoicesLoaded();

            // 음성 합성 설정
            const utterance = new SpeechSynthesisUtterance(text);
            
            // 명시적으로 영어 음성 강제 설정
            const selectedVoice = this.selectEnglishVoice();
            
            if (selectedVoice) {
                utterance.voice = selectedVoice;
                // Edge TTS 플러그인 방식: voice 설정이 우선되므로 lang도 voice에 맞춰 설정
                utterance.lang = selectedVoice.lang;
                console.log(`TTS Voice selected: ${selectedVoice.name} (${selectedVoice.lang})`);
            } else {
                // 폴백: 명시적으로 영어 언어 설정
                utterance.lang = 'en-US';
                console.log('TTS: No specific voice found, using en-US language');
            }
            
            utterance.rate = this.settings.playbackSpeed;
            utterance.volume = 1.0;

            // 음성 재생
            speechSynthesis.speak(utterance);

        } catch (error) {
            console.error('TTS 재생 중 오류 발생:', error);
            new Notice('음성 재생 중 오류가 발생했습니다.');
        }
    }

    private async ensureVoicesLoaded(): Promise<void> {
        return new Promise((resolve) => {
            const voices = speechSynthesis.getVoices();
            if (voices.length > 0) {
                resolve();
                return;
            }

            // Edge TTS 플러그인 방식: voiceschanged 이벤트 대기
            const handleVoicesChanged = () => {
                speechSynthesis.removeEventListener('voiceschanged', handleVoicesChanged);
                resolve();
            };

            speechSynthesis.addEventListener('voiceschanged', handleVoicesChanged);
            
            // 타임아웃 설정 (2초)
            setTimeout(() => {
                speechSynthesis.removeEventListener('voiceschanged', handleVoicesChanged);
                resolve();
            }, 2000);
        });
    }

    private selectEnglishVoice(): SpeechSynthesisVoice | null {
        const voices = speechSynthesis.getVoices();
        
        // Edge TTS 플러그인 방식: 명시적 음성 이름 우선 매칭
        if (this.settings.voice) {
            const exactMatch = voices.find(voice => voice.name === this.settings.voice);
            if (exactMatch) {
                return exactMatch;
            }
        }

        // 영어 음성만 필터링 (Edge TTS 플러그인 참조)
        const englishVoices = voices.filter(voice => 
            voice.lang.startsWith('en-') && !voice.lang.includes('ko')
        );

        if (englishVoices.length === 0) {
            console.warn('No English voices found');
            return null;
        }

        // 우선순위 기반 음성 선택 (Edge TTS 플러그인 TOP_VOICES 참조)
        const preferredVoices = [
            'Microsoft Ava - English (United States)',
            'Microsoft Jenny - English (United States)', 
            'Microsoft Aria - English (United States)',
            'Microsoft Guy - English (United States)',
            'Microsoft Mark - English (United States)',
            'Google US English',
            'en-US-AvaNeural',
            'en-US-JennyNeural',
            'en-US-AriaNeural'
        ];

        // 우선순위 음성 찾기
        for (const preferredName of preferredVoices) {
            const voice = englishVoices.find(v => 
                v.name.includes(preferredName) || v.name === preferredName
            );
            if (voice) {
                return voice;
            }
        }

        // 미국 영어 우선
        const usEnglish = englishVoices.find(voice => voice.lang === 'en-US');
        if (usEnglish) {
            return usEnglish;
        }

        // 그 외 영어 음성 중 첫 번째
        return englishVoices[0];
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
            voice.lang.startsWith('en-') && !voice.lang.includes('ko')
        );
    }

    getCurrentSelectedVoice(): SpeechSynthesisVoice | null {
        return this.selectEnglishVoice();
    }

    isEnabled(): boolean {
        return this.settings.enabled;
    }
}