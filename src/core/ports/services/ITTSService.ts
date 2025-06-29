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
    speak(text: string, options?: PlaybackOptions): Promise<void>;
    speakWord(word: string, options?: PlaybackOptions): Promise<void>;
    
    // 재생 제어
    pause(): void;
    resume(): void;
    stop(): void;
    
    // 상태 확인
    isSupported(): boolean;
    isSpeaking(): boolean;
    isPaused(): boolean;
    
    // 설정 관리
    setConfig(config: TTSConfig): void;
    getConfig(): TTSConfig;
    getAvailableVoices(): SpeechSynthesisVoice[];
    
    // 이벤트 처리
    onStateChanged(callback: (state: 'idle' | 'speaking' | 'paused') => void): void;
    offStateChanged(callback: (state: 'idle' | 'speaking' | 'paused') => void): void;
} 