import { ChatterboxTTSService, ChatterboxTTSSettings } from './ChatterboxTTSService';
import { GoogleCloudTTSService, GoogleCloudTTSSettings } from './GoogleCloudTTSService';
import { TTSService } from './TTSInterface';
import { VocabularySettings } from '../../features/settings/ui/settings';
import { decryptApiKey } from '../../utils';
import { App } from 'obsidian';

// TTS 서비스 팩토리
export class TTSServiceFactory {
    static createTTSService(app: App, settings?: VocabularySettings): TTSService {
        if (!settings || !settings.ttsEnabled) {
            return new NoOpTTSService();
        }

        if (settings.ttsProvider === 'google-cloud') {
            const googleSettings: GoogleCloudTTSSettings = {
                enabled: settings.ttsEnabled,
                apiKey: decryptApiKey(settings.googleCloudTTSApiKey),
                voice: settings.ttsVoice,
                languageCode: settings.googleCloudTTSLanguageCode,
                speakingRate: settings.googleCloudTTSSpeakingRate,
                pitch: settings.googleCloudTTSPitch,
                autoPlay: settings.ttsAutoPlay,
                cacheEnabled: settings.ttsCacheEnabled
            };
            return new GoogleCloudTTSService(app, googleSettings);
        } else {
            // 기본값: Chatterbox TTS
            const chatterboxSettings: ChatterboxTTSSettings = {
                enabled: settings.ttsEnabled,
                apiUrl: settings.chatterboxApiUrl,
                voice: settings.ttsVoice,
                response_format: 'wav',
                speed: 1,
                exaggeration: settings.chatterboxExaggeration,
                cfgWeight: settings.chatterboxCfgWeight,
                temperature: settings.chatterboxTemperature,
                streaming_chunk_size: 50,
                streaming_strategy: 'string',
                streaming_buffer_size: 1,
                streaming_quality: 'string',
                autoPlay: settings.ttsAutoPlay
            };
            return new ChatterboxTTSService(chatterboxSettings);
        }
    }
}

// 비활성 상태의 TTS 서비스 (No-Op 패턴)
class NoOpTTSService implements TTSService {
    async speakText(text: string): Promise<void> {
        // 아무것도 하지 않음
    }

    async speakWord(word: string): Promise<void> {
        // 아무것도 하지 않음
    }

    async speakExample(example: string): Promise<void> {
        // 아무것도 하지 않음
    }

    stopSpeaking(): void {
        // 아무것도 하지 않음
    }

    isPaused(): boolean {
        return true;
    }

    resume(): void {
        // 아무것도 하지 않음
    }

    pause(): void {
        // 아무것도 하지 않음
    }

    async testConnection(): Promise<boolean> {
        return false;
    }

    getAvailableVoices(): string[] {
        return [];
    }

    destroy(): void {
        // 아무것도 하지 않음
    }
}

// 호환성을 위한 레거시 인터페이스
export interface LegacyTTSSettings {
    enabled: boolean;
    voice: string;
    playbackSpeed: number;
    autoPlay: boolean;
}

// 레거시 설정을 Chatterbox 설정으로 변환하는 헬퍼 함수
export function convertLegacySettings(legacySettings: LegacyTTSSettings): ChatterboxTTSSettings {
    return {
        enabled: legacySettings.enabled,
        apiUrl: 'http://localhost:4123',
        voice: legacySettings.voice || 'alloy',
        response_format: 'wav',
        speed: 1,
        exaggeration: 0.25,
        cfgWeight: 1,
        temperature: 0.05,
        streaming_chunk_size: 50,
        streaming_strategy: 'string',
        streaming_buffer_size: 1,
        streaming_quality: 'string',
        autoPlay: legacySettings.autoPlay
    };
}

// 호환성을 위한 기본 export
export { ChatterboxTTSService, GoogleCloudTTSService };
export type { ChatterboxTTSSettings, GoogleCloudTTSSettings, TTSService };