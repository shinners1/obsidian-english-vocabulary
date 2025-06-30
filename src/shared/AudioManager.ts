// 오디오 리소스 관리 및 정리

export class AudioManager {
    private static instance: AudioManager;
    private activeAudioElements: Set<HTMLAudioElement> = new Set();
    private audioPool: HTMLAudioElement[] = [];
    private readonly maxPoolSize = 10;

    private constructor() {}

    static getInstance(): AudioManager {
        if (!AudioManager.instance) {
            AudioManager.instance = new AudioManager();
        }
        return AudioManager.instance;
    }

    // 오디오 요소 생성 및 관리
    createAudio(src: string): HTMLAudioElement {
        let audio: HTMLAudioElement;

        // 풀에서 재사용 가능한 오디오 요소 찾기
        const availableAudio = this.audioPool.find(a => a.ended || a.paused);
        if (availableAudio) {
            audio = availableAudio;
            audio.src = src;
            audio.currentTime = 0;
        } else {
            audio = new Audio(src);
            this.setupAudioElement(audio);
        }

        this.activeAudioElements.add(audio);
        return audio;
    }

    // 오디오 요소 설정
    private setupAudioElement(audio: HTMLAudioElement): void {
        // 자동 정리 이벤트 리스너
        const cleanup = () => {
            this.releaseAudio(audio);
        };

        audio.addEventListener('ended', cleanup, { once: true });
        audio.addEventListener('error', cleanup, { once: true });

        // 메모리 누수 방지를 위한 타임아웃
        setTimeout(() => {
            if (this.activeAudioElements.has(audio)) {
                this.releaseAudio(audio);
            }
        }, 30000); // 30초 후 자동 정리
    }

    // 오디오 재생 (안전한 래퍼)
    async playAudio(src: string): Promise<void> {
        const audio = this.createAudio(src);
        
        try {
            await audio.play();
        } catch (error) {
            this.releaseAudio(audio);
            throw error;
        }
    }

    // 오디오 요소 해제
    releaseAudio(audio: HTMLAudioElement): void {
        if (!this.activeAudioElements.has(audio)) return;

        // 재생 중이면 정지
        if (!audio.paused) {
            audio.pause();
        }

        // 활성 목록에서 제거
        this.activeAudioElements.delete(audio);

        // 풀에 반환 (크기 제한)
        if (this.audioPool.length < this.maxPoolSize) {
            audio.removeAttribute('src');
            audio.load(); // 메모리 해제
            this.audioPool.push(audio);
        } else {
            // 풀이 가득 찬 경우 완전히 정리
            this.disposeAudio(audio);
        }
    }

    // 오디오 요소 완전 정리
    private disposeAudio(audio: HTMLAudioElement): void {
        audio.pause();
        audio.removeAttribute('src');
        audio.load();
        
        // 모든 이벤트 리스너 제거
        const newAudio = audio.cloneNode() as HTMLAudioElement;
        audio.parentNode?.replaceChild(newAudio, audio);
    }

    // 모든 활성 오디오 정지
    stopAllAudio(): void {
        this.activeAudioElements.forEach(audio => {
            if (!audio.paused) {
                audio.pause();
            }
        });
    }

    // 모든 리소스 정리
    cleanup(): void {
        // 모든 활성 오디오 정리
        this.activeAudioElements.forEach(audio => {
            this.disposeAudio(audio);
        });
        this.activeAudioElements.clear();

        // 풀의 모든 오디오 정리
        this.audioPool.forEach(audio => {
            this.disposeAudio(audio);
        });
        this.audioPool.clear();
    }

    // 현재 상태 정보
    getStatus(): { active: number; pooled: number } {
        return {
            active: this.activeAudioElements.size,
            pooled: this.audioPool.length
        };
    }
}

// 네트워크 리소스 관리
export class NetworkResourceManager {
    private static instance: NetworkResourceManager;
    private abortControllers: Set<AbortController> = new Set();
    private activeRequests: Map<string, AbortController> = new Map();

    private constructor() {}

    static getInstance(): NetworkResourceManager {
        if (!NetworkResourceManager.instance) {
            NetworkResourceManager.instance = new NetworkResourceManager();
        }
        return NetworkResourceManager.instance;
    }

    // 네트워크 요청 생성 (자동 정리 포함)
    createRequest(identifier?: string): AbortController {
        const controller = new AbortController();
        
        this.abortControllers.add(controller);
        
        if (identifier) {
            // 동일한 식별자의 기존 요청 취소
            const existingController = this.activeRequests.get(identifier);
            if (existingController) {
                existingController.abort();
                this.abortControllers.delete(existingController);
            }
            this.activeRequests.set(identifier, controller);
        }

        // 자동 정리를 위한 타임아웃 설정
        setTimeout(() => {
            if (this.abortControllers.has(controller)) {
                controller.abort();
                this.cleanup(controller, identifier);
            }
        }, 60000); // 60초 타임아웃

        return controller;
    }

    // 요청 완료 시 정리
    completeRequest(controller: AbortController, identifier?: string): void {
        this.cleanup(controller, identifier);
    }

    // 특정 요청 취소
    cancelRequest(identifier: string): void {
        const controller = this.activeRequests.get(identifier);
        if (controller) {
            controller.abort();
            this.cleanup(controller, identifier);
        }
    }

    // 내부 정리 로직
    private cleanup(controller: AbortController, identifier?: string): void {
        this.abortControllers.delete(controller);
        if (identifier) {
            this.activeRequests.delete(identifier);
        }
    }

    // 모든 활성 요청 취소
    cancelAllRequests(): void {
        this.abortControllers.forEach(controller => {
            controller.abort();
        });
        this.abortControllers.clear();
        this.activeRequests.clear();
    }

    // Fetch 래퍼 (자동 정리 포함)
    async fetch(
        url: string, 
        options: RequestInit = {}, 
        identifier?: string,
        timeout: number = 30000
    ): Promise<Response> {
        const controller = this.createRequest(identifier);
        
        const timeoutId = setTimeout(() => {
            controller.abort();
        }, timeout);

        try {
            const response = await fetch(url, {
                ...options,
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            this.completeRequest(controller, identifier);
            
            return response;
        } catch (error) {
            clearTimeout(timeoutId);
            this.cleanup(controller, identifier);
            throw error;
        }
    }

    // 현재 상태 정보
    getStatus(): { active: number; identified: number } {
        return {
            active: this.abortControllers.size,
            identified: this.activeRequests.size
        };
    }
}