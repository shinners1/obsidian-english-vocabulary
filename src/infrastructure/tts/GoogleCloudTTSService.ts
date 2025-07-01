import { Notice, App } from 'obsidian';
import { TTSService } from './TTSInterface';
import { AudioManager, NetworkResourceManager } from '../../shared/AudioManager';
import { TTSCacheManager, CacheSettings } from './TTSCacheManager';

export interface GoogleCloudTTSSettings {
    enabled: boolean;
    apiKey: string;
    voice: string;
    languageCode: string;
    speakingRate: number;
    pitch: number;
    autoPlay: boolean;
    cacheEnabled: boolean;
}

export interface GoogleCloudTTSRequest {
    input: {
        text: string;
    };
    voice: {
        languageCode: string;
        name?: string;
        ssmlGender?: 'MALE' | 'FEMALE' | 'NEUTRAL';
    };
    audioConfig: {
        audioEncoding: 'MP3' | 'LINEAR16' | 'OGG_OPUS';
        speakingRate?: number;
        pitch?: number;
    };
}

export interface GoogleCloudTTSResponse {
    audioContent: string; // Base64 encoded audio
}

export class GoogleCloudTTSService implements TTSService {
    private settings: GoogleCloudTTSSettings;
    private audioManager: AudioManager;
    private networkManager: NetworkResourceManager;
    private cacheManager: TTSCacheManager;

    constructor(app: App, settings?: GoogleCloudTTSSettings) {
        this.settings = {
            enabled: settings?.enabled || false,
            apiKey: settings?.apiKey || '',
            voice: settings?.voice || 'en-US-Journey-F',
            languageCode: settings?.languageCode || 'en-US',
            speakingRate: settings?.speakingRate || 1.0,
            pitch: settings?.pitch || 0.0,
            autoPlay: settings?.autoPlay || false,
            cacheEnabled: settings?.cacheEnabled !== false
        };
        this.audioManager = AudioManager.getInstance();
        this.networkManager = NetworkResourceManager.getInstance();
        this.cacheManager = new TTSCacheManager(app);
    }

    async speakText(text: string): Promise<void> {
        if (!this.settings.enabled) {
            new Notice('TTS 기능이 비활성화되어 있습니다.');
            return;
        }

        if (!this.settings.apiKey) {
            new Notice('Google Cloud TTS API 키가 설정되지 않았습니다.');
            return;
        }

        if (!text || text.trim().length === 0) {
            console.warn('TTS: 빈 텍스트입니다.');
            return;
        }

        try {
            this.stopSpeaking();

            let audioData: string;
            
            // 캐시 확인 (캐시가 활성화된 경우)
            if (this.settings.cacheEnabled) {
                const cacheSettings: CacheSettings = {
                    languageCode: this.settings.languageCode,
                    voice: this.settings.voice,
                    speakingRate: this.settings.speakingRate,
                    pitch: this.settings.pitch
                };
                
                const cachedAudio = await this.cacheManager.getCachedAudio(text, cacheSettings);
                if (cachedAudio) {
                    await this.playAudioBuffer(cachedAudio);
                    return;
                }
            }

            // 캐시에 없으면 API 호출
            audioData = await this.callGoogleCloudAPI(text);
            
            // 캐시에 저장 (캐시가 활성화된 경우)
            if (this.settings.cacheEnabled) {
                const cacheSettings: CacheSettings = {
                    languageCode: this.settings.languageCode,
                    voice: this.settings.voice,
                    speakingRate: this.settings.speakingRate,
                    pitch: this.settings.pitch
                };
                
                await this.cacheManager.setCachedAudio(text, cacheSettings, audioData);
            }
            
            await this.playAudioData(audioData);

        } catch (error) {
            console.error('Google Cloud TTS 오류:', error);
            new Notice('TTS 음성 생성에 실패했습니다. API 키와 인터넷 연결을 확인해주세요.');
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

    private async callGoogleCloudAPI(text: string): Promise<string> {
        const truncatedText = text.length > 5000 ? text.substring(0, 5000) : text;

        const requestBody: GoogleCloudTTSRequest = {
            input: {
                text: truncatedText
            },
            voice: {
                languageCode: this.settings.languageCode,
                name: this.settings.voice
            },
            audioConfig: {
                audioEncoding: 'MP3',
                speakingRate: this.settings.speakingRate,
                pitch: this.settings.pitch
            }
        };


        const response = await this.networkManager.fetch(
            `https://texttospeech.googleapis.com/v1/text:synthesize?key=${this.settings.apiKey}`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestBody)
            },
            `google-tts-${Date.now()}`, // 고유 식별자
            10000 // 10초 타임아웃
        );

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            const errorMessage = this.getDetailedErrorMessage(response.status, errorData);
            throw new Error(errorMessage);
        }

        const data: GoogleCloudTTSResponse = await response.json();
        return data.audioContent;
    }

    private getDetailedErrorMessage(status: number, errorData: any): string {
        if (errorData?.error) {
            const error = errorData.error;
            
            // API가 차단된 경우 (403 PERMISSION_DENIED with API_KEY_SERVICE_BLOCKED)
            if (status === 403 && error.details?.some((detail: any) => 
                detail.reason === 'API_KEY_SERVICE_BLOCKED' || 
                detail['@type']?.includes('ErrorInfo') && detail.reason === 'API_KEY_SERVICE_BLOCKED'
            )) {
                return 'Google Cloud Text-to-Speech API가 활성화되지 않았습니다. Google Cloud Console에서 Text-to-Speech API를 활성화해주세요.';
            }
            
            // API 키 관련 오류들
            if (status === 403) {
                if (error.message?.includes('API key not valid') || error.code === 'INVALID_ARGUMENT') {
                    return 'Google Cloud API 키가 올바르지 않습니다. API 키를 다시 확인해주세요.';
                }
                if (error.message?.includes('quota') || error.message?.includes('QUOTA_EXCEEDED')) {
                    return 'Google Cloud TTS API 할당량이 초과되었습니다. 할당량을 확인하거나 요금제를 변경해주세요.';
                }
                return 'Google Cloud TTS API 접근이 거부되었습니다. API 키 권한을 확인해주세요.';
            }
            
            // 인증 오류 (401)
            if (status === 401) {
                return 'Google Cloud API 키 인증에 실패했습니다. API 키가 올바른지 확인해주세요.';
            }
            
            // 요청 오류 (400)
            if (status === 400) {
                return 'Google Cloud TTS API 요청이 잘못되었습니다. 음성 설정을 확인해주세요.';
            }
            
            // 서비스 사용 불가 (503)
            if (status === 503) {
                return 'Google Cloud TTS 서비스가 일시적으로 사용할 수 없습니다. 잠시 후 다시 시도해주세요.';
            }
            
            return `Google Cloud TTS API 오류 (${status}): ${error.message || '알 수 없는 오류'}`;
        }
        
        return `Google Cloud TTS API 오류: ${status} 상태 코드`;
    }

    private async playAudioData(base64Audio: string): Promise<void> {
        return new Promise((resolve, reject) => {
            try {
                // AudioManager를 사용한 안전한 오디오 재생
                const audioBlob = this.base64ToBlob(base64Audio, 'audio/mp3');
                const audioUrl = URL.createObjectURL(audioBlob);
                
                const audio = this.audioManager.createAudio(audioUrl);

                const cleanup = () => {
                    URL.revokeObjectURL(audioUrl);
                    this.audioManager.releaseAudio(audio);
                };

                audio.onended = () => {
                    cleanup();
                    resolve();
                };

                audio.onerror = () => {
                    cleanup();
                    reject(new Error('오디오 재생 중 오류가 발생했습니다.'));
                };

                audio.onloadeddata = () => {
                    audio.play().catch(error => {
                        console.error('오디오 재생 실패:', error);
                        cleanup();
                        reject(error);
                    });
                };

                // 타임아웃 설정 (30초)
                setTimeout(() => {
                    if (!audio.ended && !audio.paused) {
                        cleanup();
                        reject(new Error('오디오 재생 시간 초과'));
                    }
                }, 30000);

            } catch (error) {
                reject(error);
            }
        });
    }

    private async playAudioBuffer(audioBuffer: ArrayBuffer): Promise<void> {
        return new Promise((resolve, reject) => {
            try {
                // ArrayBuffer를 Blob으로 변환
                const audioBlob = new Blob([audioBuffer], { type: 'audio/mp3' });
                const audioUrl = URL.createObjectURL(audioBlob);
                
                const audio = this.audioManager.createAudio(audioUrl);

                const cleanup = () => {
                    URL.revokeObjectURL(audioUrl);
                    this.audioManager.releaseAudio(audio);
                };

                audio.onended = () => {
                    cleanup();
                    resolve();
                };

                audio.onerror = () => {
                    cleanup();
                    reject(new Error('캐시된 오디오 재생 중 오류가 발생했습니다.'));
                };

                audio.onloadeddata = () => {
                    audio.play().catch(error => {
                        console.error('캐시된 오디오 재생 실패:', error);
                        cleanup();
                        reject(error);
                    });
                };

                // 타임아웃 설정 (30초)
                setTimeout(() => {
                    if (!audio.ended && !audio.paused) {
                        cleanup();
                        reject(new Error('캐시된 오디오 재생 시간 초과'));
                    }
                }, 30000);

            } catch (error) {
                reject(error);
            }
        });
    }

    private base64ToBlob(base64: string, mimeType: string): Blob {
        const byteCharacters = atob(base64);
        const byteNumbers = new Array(byteCharacters.length);
        
        for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        
        const byteArray = new Uint8Array(byteNumbers);
        return new Blob([byteArray], { type: mimeType });
    }

    stopSpeaking(): void {
        // AudioManager를 통해 모든 오디오 정지
        this.audioManager.stopAllAudio();
    }

    isPaused(): boolean {
        // 현재 활성 오디오가 있는지 확인
        const status = this.audioManager.getStatus();
        return status.active === 0;
    }

    resume(): void {
        // AudioManager는 개별 오디오 요소를 관리하므로 
        // 여기서는 새로운 요청으로 처리
        new Notice('음성을 다시 재생하려면 버튼을 다시 클릭해주세요.');
    }

    pause(): void {
        this.stopSpeaking();
    }

    updateSettings(newSettings: Partial<GoogleCloudTTSSettings>): void {
        this.settings = { ...this.settings, ...newSettings };
    }

    // 리소스 정리
    cleanup(): void {
        this.audioManager.cleanup();
        this.networkManager.cancelAllRequests();
    }

    async testConnection(): Promise<boolean> {
        try {
            const testText = 'Hello, this is a test.';
            await this.callGoogleCloudAPI(testText);
            return true;
        } catch (error) {
            console.error('Google Cloud TTS 연결 테스트 실패:', error);
            return false;
        }
    }

    getAvailableVoices(): string[] {
        return [
            'en-US-Journey-D',
            'en-US-Journey-F',
            'en-US-Journey-O',
            'en-US-Neural2-A',
            'en-US-Neural2-C',
            'en-US-Neural2-D',
            'en-US-Neural2-E',
            'en-US-Neural2-F',
            'en-US-Neural2-G',
            'en-US-Neural2-H',
            'en-US-Neural2-I',
            'en-US-Neural2-J',
            'en-US-Standard-A',
            'en-US-Standard-B',
            'en-US-Standard-C',
            'en-US-Standard-D',
            'en-US-Standard-E',
            'en-US-Standard-F',
            'en-US-Standard-G',
            'en-US-Standard-H',
            'en-US-Standard-I',
            'en-US-Standard-J',
            'en-GB-Neural2-A',
            'en-GB-Neural2-B',
            'en-GB-Neural2-C',
            'en-GB-Neural2-D',
            'en-GB-Neural2-F',
            'en-AU-Neural2-A',
            'en-AU-Neural2-B',
            'en-AU-Neural2-C',
            'en-AU-Neural2-D'
        ];
    }

    getSettings(): GoogleCloudTTSSettings {
        return { ...this.settings };
    }

    destroy(): void {
        this.stopSpeaking();
    }

    // 캐시 관리 메서드들
    async getCacheInfo() {
        return await this.cacheManager.getCacheInfo();
    }

    async clearCache(): Promise<boolean> {
        return await this.cacheManager.clearCache();
    }

    updateCacheFolder(vocabularyFolderPath: string): void {
        this.cacheManager.updateCacheFolder(vocabularyFolderPath);
    }
}