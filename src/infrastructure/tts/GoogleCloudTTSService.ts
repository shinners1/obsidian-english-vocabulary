import { Notice } from 'obsidian';
import { TTSService } from './TTSInterface';

export interface GoogleCloudTTSSettings {
    enabled: boolean;
    apiKey: string;
    voice: string;
    languageCode: string;
    speakingRate: number;
    pitch: number;
    autoPlay: boolean;
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
    private audioElement: HTMLAudioElement | null = null;
    private settings: GoogleCloudTTSSettings;

    constructor(settings: GoogleCloudTTSSettings) {
        this.settings = {
            enabled: settings.enabled || false,
            apiKey: settings.apiKey || '',
            voice: settings.voice || 'en-US-Journey-F',
            languageCode: settings.languageCode || 'en-US',
            speakingRate: settings.speakingRate || 1.0,
            pitch: settings.pitch || 0.0,
            autoPlay: settings.autoPlay || false
        };
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

            const audioData = await this.callGoogleCloudAPI(text);
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

        console.log(`TTS: 단어 발음 - "${word}"`);
        await this.speakText(word);
    }

    async speakExample(example: string): Promise<void> {
        if (!example || example.trim().length === 0) {
            console.warn('TTS: 빈 예문입니다.');
            return;
        }

        console.log(`TTS: 예문 발음 - "${example}"`);
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

        console.log('Google Cloud TTS API 요청:', requestBody);

        const response = await fetch(`https://texttospeech.googleapis.com/v1/text:synthesize?key=${this.settings.apiKey}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody)
        });

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
                if (this.audioElement) {
                    this.audioElement.pause();
                    this.audioElement.src = '';
                }

                this.audioElement = new Audio();
                
                const audioBlob = this.base64ToBlob(base64Audio, 'audio/mp3');
                const audioUrl = URL.createObjectURL(audioBlob);
                this.audioElement.src = audioUrl;

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

                this.audioElement.load();

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
        if (this.audioElement) {
            this.audioElement.pause();
            this.audioElement.currentTime = 0;
            
            if (this.audioElement.src && this.audioElement.src.startsWith('blob:')) {
                URL.revokeObjectURL(this.audioElement.src);
            }
            
            this.audioElement.src = '';
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

    updateSettings(newSettings: Partial<GoogleCloudTTSSettings>): void {
        this.settings = { ...this.settings, ...newSettings };
        console.log('Google Cloud TTS 설정 업데이트:', this.settings);
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
        this.audioElement = null;
    }
}