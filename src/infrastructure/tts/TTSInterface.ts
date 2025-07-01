// 공통 TTS 인터페이스
export interface TTSService {
    speakText(text: string): Promise<void>;
    speakWord(word: string): Promise<void>;
    speakExample(example: string, word?: string): Promise<void>;
    stopSpeaking(): void;
    isPaused(): boolean;
    resume(): void;
    pause(): void;
    testConnection(): Promise<boolean>;
    getAvailableVoices(): string[];
    destroy(): void;
}