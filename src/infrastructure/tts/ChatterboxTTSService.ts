import { Notice } from 'obsidian';
import { TTSService } from './TTSInterface';
import { AudioManager, NetworkResourceManager } from '../../shared/AudioManager';

export interface ChatterboxTTSSettings {
    enabled: boolean;
    apiUrl: string;
    voice: string;
    exaggeration: number;
    cfgWeight: number;
    temperature: number;
    autoPlay: boolean;
}

export interface ChatterboxTTSRequest {
    input: string;
    voice?: string;
    exaggeration?: number;
    cfg_weight?: number;
    temperature?: number;
}

export class ChatterboxTTSService implements TTSService {
    private settings: ChatterboxTTSSettings;
    private audioManager: AudioManager;
    private networkManager: NetworkResourceManager;

    constructor(settings: ChatterboxTTSSettings) {
        this.settings = {
            enabled: settings.enabled || false,
            apiUrl: settings.apiUrl || 'http://localhost:4123',
            voice: settings.voice || 'alloy',
            exaggeration: settings.exaggeration || 0.7,
            cfgWeight: settings.cfgWeight || 0.4,
            temperature: settings.temperature || 0.9,
            autoPlay: settings.autoPlay || false
        };
        this.audioManager = AudioManager.getInstance();
        this.networkManager = NetworkResourceManager.getInstance();
    }

    async speakText(text: string): Promise<void> {
        if (!this.settings.enabled) {
            new Notice('TTS 기능이 비활성화되어 있습니다.');
            return;
        }

        if (!text || text.trim().length === 0) {
            console.warn('TTS: 빈 텍스트입니다.');
            return;
        }

        try {
            // 현재 재생 중인 오디오가 있으면 중지
            this.stopSpeaking();

            // Chatterbox TTS API 호출
            const audioBlob = await this.callChatterboxAPI(text);
            
            // 오디오 재생
            await this.playAudioBlob(audioBlob);

        } catch (error) {
            console.error('Chatterbox TTS 오류:', error);
            new Notice('TTS 음성 생성에 실패했습니다. Chatterbox TTS 서버가 실행 중인지 확인해주세요.');
        }
    }

    async speakWord(word: string): Promise<void> {
        if (!word || word.trim().length === 0) {
            console.warn('TTS: 빈 단어입니다.');
            return;
        }

        await this.speakText(word);
    }

    async speakExample(example: string): Promise<void> {
        if (!example || example.trim().length === 0) {
            console.warn('TTS: 빈 예문입니다.');
            return;
        }

        await this.speakText(example);
    }

    private async callChatterboxAPI(text: string): Promise<Blob> {
        // 텍스트 길이 제한 (Chatterbox 권장: 3000자)
        const truncatedText = text.length > 3000 ? text.substring(0, 3000) : text;

        const requestBody: ChatterboxTTSRequest = {
            input: truncatedText,
            voice: this.settings.voice,
            exaggeration: this.settings.exaggeration,
            cfg_weight: this.settings.cfgWeight,
            temperature: this.settings.temperature
        };


        const response = await fetch(`${this.settings.apiUrl}/v1/audio/speech`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            throw new Error(`Chatterbox TTS API 오류: ${response.status} ${response.statusText}`);
        }

        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('audio')) {
            throw new Error(`예상하지 못한 응답 형식: ${contentType}`);
        }

        return await response.blob();
    }

    private async playAudioBlob(audioBlob: Blob): Promise<void> {
        return new Promise((resolve, reject) => {
            try {
                // 이전 오디오 정리
                if (this.audioElement) {
                    this.audioElement.pause();
                    this.audioElement.src = '';
                }

                // 새 오디오 엘리먼트 생성
                this.audioElement = new Audio();
                
                // Blob을 URL로 변환
                const audioUrl = URL.createObjectURL(audioBlob);
                this.audioElement.src = audioUrl;

                // 이벤트 리스너 설정
                this.audioElement.onended = () => {
                    URL.revokeObjectURL(audioUrl);
                    resolve();
                };

                this.audioElement.onerror = () => {
                    URL.revokeObjectURL(audioUrl);
                    reject(new Error('오디오 재생 중 오류가 발생했습니다.'));
                };

                this.audioElement.onloadeddata = () => {
                    if (this.audioElement) {
                        this.audioElement.play().catch(error => {
                            console.error('오디오 재생 실패:', error);
                            URL.revokeObjectURL(audioUrl);
                            reject(error);
                        });
                    }
                };

                // 오디오 로드 시작
                this.audioElement.load();

            } catch (error) {
                reject(error);
            }
        });
    }

    stopSpeaking(): void {
        if (this.audioElement) {
            this.audioElement.pause();
            this.audioElement.currentTime = 0;
            
            // URL 정리
            if (this.audioElement.src && this.audioElement.src.startsWith('blob:')) {
                URL.revokeObjectURL(this.audioElement.src);
            }
            
            this.audioElement.src = '';
        }

        if (this.currentAudioContext) {
            this.currentAudioContext.close().catch(console.error);
            this.currentAudioContext = null;
        }
    }

    isPaused(): boolean {
        return !this.audioElement || this.audioElement.paused;
    }

    resume(): void {
        if (this.audioElement && this.audioElement.paused) {
            this.audioElement.play().catch(error => {
                console.error('오디오 재개 실패:', error);
                new Notice('오디오 재개에 실패했습니다.');
            });
        }
    }

    pause(): void {
        if (this.audioElement && !this.audioElement.paused) {
            this.audioElement.pause();
        }
    }

    // 설정 업데이트
    updateSettings(newSettings: Partial<ChatterboxTTSSettings>): void {
        this.settings = { ...this.settings, ...newSettings };
    }

    // 연결 테스트
    async testConnection(): Promise<boolean> {
        try {
            const testText = 'Hello, this is a test.';
            await this.callChatterboxAPI(testText);
            return true;
        } catch (error) {
            console.error('Chatterbox TTS 연결 테스트 실패:', error);
            return false;
        }
    }

    // 사용 가능한 음성 목록 (Chatterbox는 custom voice 지원)
    getAvailableVoices(): string[] {
        // OpenAI 호환 음성들 + 커스텀 음성 지원
        return [
            'alloy',
            'echo', 
            'fable',
            'onyx',
            'nova',
            'shimmer',
            'custom' // 사용자 정의 음성
        ];
    }

    // 현재 설정 정보 반환
    getSettings(): ChatterboxTTSSettings {
        return { ...this.settings };
    }

    // 리소스 정리
    destroy(): void {
        this.stopSpeaking();
        this.audioElement = null;
        this.currentAudioContext = null;
    }
}