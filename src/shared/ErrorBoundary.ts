// 전역 에러 처리 및 경계 관리

import { Notice } from 'obsidian';

export interface ErrorInfo {
    error: Error;
    context?: string;
    userId?: string;
    timestamp: number;
    stackTrace?: string;
}

export class ErrorBoundary {
    private static instance: ErrorBoundary;
    private errorHandlers: Map<string, (error: ErrorInfo) => void> = new Map();
    private isInitialized = false;

    private constructor() {}

    static getInstance(): ErrorBoundary {
        if (!ErrorBoundary.instance) {
            ErrorBoundary.instance = new ErrorBoundary();
        }
        return ErrorBoundary.instance;
    }

    // 전역 에러 핸들러 초기화
    initialize(): void {
        if (this.isInitialized) return;

        // 전역 에러 이벤트 리스너
        window.addEventListener('error', (event) => {
            this.handleError({
                error: event.error || new Error(event.message),
                context: 'Global Error',
                timestamp: Date.now(),
                stackTrace: event.error?.stack
            });
        });

        // Promise rejection 핸들러
        window.addEventListener('unhandledrejection', (event) => {
            this.handleError({
                error: event.reason instanceof Error ? event.reason : new Error(String(event.reason)),
                context: 'Unhandled Promise Rejection',
                timestamp: Date.now(),
                stackTrace: event.reason?.stack
            });
        });

        this.isInitialized = true;
    }

    // 에러 핸들러 등록
    registerHandler(context: string, handler: (error: ErrorInfo) => void): void {
        this.errorHandlers.set(context, handler);
    }

    // 에러 핸들러 제거
    unregisterHandler(context: string): void {
        this.errorHandlers.delete(context);
    }

    // 에러 처리
    handleError(errorInfo: ErrorInfo): void {
        // 콘솔에 에러 로그
        console.error('Error caught by ErrorBoundary:', errorInfo);

        // 사용자에게 친화적인 에러 메시지 표시
        const userMessage = this.getUserFriendlyMessage(errorInfo.error);
        new Notice(userMessage, 0);

        // 등록된 핸들러들 실행
        this.errorHandlers.forEach((handler, context) => {
            try {
                handler(errorInfo);
            } catch (handlerError) {
                console.error(`Error in handler for context ${context}:`, handlerError);
            }
        });
    }

    // 안전한 함수 실행 래퍼
    async safeExecute<T>(
        fn: () => Promise<T> | T,
        context: string,
        fallback?: T
    ): Promise<T | undefined> {
        try {
            return await fn();
        } catch (error) {
            this.handleError({
                error: error instanceof Error ? error : new Error(String(error)),
                context,
                timestamp: Date.now(),
                stackTrace: error instanceof Error ? error.stack : undefined
            });
            return fallback;
        }
    }

    // 동기 함수용 안전한 실행
    safeExecuteSync<T>(
        fn: () => T,
        context: string,
        fallback?: T
    ): T | undefined {
        try {
            return fn();
        } catch (error) {
            this.handleError({
                error: error instanceof Error ? error : new Error(String(error)),
                context,
                timestamp: Date.now(),
                stackTrace: error instanceof Error ? error.stack : undefined
            });
            return fallback;
        }
    }

    // 사용자 친화적인 에러 메시지 생성
    private getUserFriendlyMessage(error: Error): string {
        const errorType = error.name;
        const errorMessage = error.message;

        // 에러 타입별 사용자 친화적 메시지
        const friendlyMessages: Record<string, string> = {
            'NetworkError': '네트워크 연결에 문제가 있습니다. 인터넷 연결을 확인해주세요.',
            'TypeError': '데이터 처리 중 오류가 발생했습니다.',
            'ReferenceError': '필요한 데이터를 찾을 수 없습니다.',
            'SyntaxError': '데이터 형식에 오류가 있습니다.',
            'QuotaExceededError': '저장 공간이 부족합니다.',
            'SecurityError': '보안 정책으로 인해 작업을 수행할 수 없습니다.',
        };

        // API 관련 에러 처리
        if (errorMessage.includes('API') || errorMessage.includes('fetch')) {
            return 'API 서비스에 일시적인 문제가 있습니다. 잠시 후 다시 시도해주세요.';
        }

        // 파일 관련 에러 처리
        if (errorMessage.includes('file') || errorMessage.includes('File')) {
            return '파일 처리 중 오류가 발생했습니다. 파일이 존재하는지 확인해주세요.';
        }

        // 암호화 관련 에러 처리
        if (errorMessage.includes('encrypt') || errorMessage.includes('decrypt')) {
            return 'API 키 처리 중 오류가 발생했습니다. 설정을 다시 확인해주세요.';
        }

        return friendlyMessages[errorType] || 
               `예상치 못한 오류가 발생했습니다: ${errorMessage}`;
    }

    // 에러 복구 시도
    async attemptRecovery(error: Error, context: string): Promise<boolean> {
        // 네트워크 에러의 경우 재시도
        if (error.message.includes('fetch') || error.message.includes('network')) {
            try {
                // 간단한 네트워크 테스트
                await fetch('https://www.google.com/favicon.ico', { 
                    method: 'HEAD',
                    mode: 'no-cors'
                });
                return true;
            } catch {
                return false;
            }
        }

        // 저장소 에러의 경우 클리어 시도
        if (error.name === 'QuotaExceededError') {
            try {
                // 임시 데이터 클리어 (실제 구현에서는 더 신중하게)
                localStorage.removeItem('temp-data');
                return true;
            } catch {
                return false;
            }
        }

        return false;
    }

    // 정리
    cleanup(): void {
        this.errorHandlers.clear();
        this.isInitialized = false;
    }
}

// 편의 함수들
export const safeAsync = async <T>(
    fn: () => Promise<T>,
    context: string,
    fallback?: T
): Promise<T | undefined> => {
    return ErrorBoundary.getInstance().safeExecute(fn, context, fallback);
};

export const safeSync = <T>(
    fn: () => T,
    context: string,
    fallback?: T
): T | undefined => {
    return ErrorBoundary.getInstance().safeExecuteSync(fn, context, fallback);
};

// 데코레이터 함수 (TypeScript 데코레이터 대신 사용)
export function withErrorBoundary<T extends any[], R>(
    fn: (...args: T) => R | Promise<R>,
    context: string
) {
    return async (...args: T): Promise<R | undefined> => {
        const errorBoundary = ErrorBoundary.getInstance();
        if (fn.constructor.name === 'AsyncFunction') {
            return errorBoundary.safeExecute(() => fn(...args), context);
        } else {
            return errorBoundary.safeExecuteSync(() => fn(...args), context);
        }
    };
}