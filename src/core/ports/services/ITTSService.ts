// TTS 설정 타입
export interface TTSConfig {
    voice?: string;
    rate?: number;
    pitch?: number;
    volume?: number;
    language?: string;
}

// TTS 재생 옵션
export interface PlaybackOptions extends TTSConfig {
    onStart?: () => void;
    onEnd?: () => void;
    onError?: (error: Error) => void;
}

export interface ITTSService {
    // 기본 재생
    speakText(text: string): Promise<void>;
    speakWord(word: string): Promise<void>;
    speakExample?(example: string): Promise<void>;
    
    // 재생 제어
    pause(): void;
    resume(): void;
    stopSpeaking(): void;
    
    // 상태 확인
    isEnabled?(): boolean;
    isPaused(): boolean;
    
    // 설정 관리
    getAvailableVoices(): SpeechSynthesisVoice[];
    testConnection?(): Promise<boolean>;
    
    // 설정 업데이트 (어댑터용)
    updateSettings?(settings: any): void;
    
    // 정리
    destroy?(): void;
} 