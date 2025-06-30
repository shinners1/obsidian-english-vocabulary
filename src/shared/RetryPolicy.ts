// 재시도 정책 및 구현

import { getConfigValue, CONFIG_PATHS } from './Config';

export interface RetryOptions {
    maxAttempts?: number;
    delayMs?: number;
    exponentialBackoff?: boolean;
    maxDelayMs?: number;
    backoffMultiplier?: number;
    retryCondition?: (error: Error) => boolean;
}

export interface RetryResult<T> {
    success: boolean;
    result?: T;
    error?: Error;
    attempts: number;
    totalDuration: number;
}

export class RetryPolicy {
    private options: Required<RetryOptions>;

    constructor(options: RetryOptions = {}) {
        this.options = {
            maxAttempts: options.maxAttempts ?? getConfigValue<number>(CONFIG_PATHS.API_RETRY_MAX_ATTEMPTS),
            delayMs: options.delayMs ?? getConfigValue<number>(CONFIG_PATHS.API_RETRY_DELAY),
            exponentialBackoff: options.exponentialBackoff ?? true,
            maxDelayMs: options.maxDelayMs ?? 30000, // 30초
            backoffMultiplier: options.backoffMultiplier ?? 2,
            retryCondition: options.retryCondition ?? this.defaultRetryCondition,
        };
    }

    // 기본 재시도 조건
    private defaultRetryCondition(error: Error): boolean {
        // 네트워크 에러, 타임아웃, 서버 에러는 재시도
        const retryableErrors = [
            'NetworkError',
            'TimeoutError',
            'fetch',
            '502', '503', '504', // 서버 에러
            'ECONNRESET',
            'ETIMEDOUT',
            'ENOTFOUND'
        ];

        const errorMessage = error.message.toLowerCase();
        const errorName = error.name.toLowerCase();

        return retryableErrors.some(pattern => 
            errorMessage.includes(pattern.toLowerCase()) || 
            errorName.includes(pattern.toLowerCase())
        );
    }

    // 지수 백오프 계산
    private calculateDelay(attempt: number): number {
        if (!this.options.exponentialBackoff) {
            return this.options.delayMs;
        }

        const delay = this.options.delayMs * Math.pow(this.options.backoffMultiplier, attempt - 1);
        
        // 지터 추가 (±20%)
        const jitter = delay * 0.2 * (Math.random() - 0.5);
        const finalDelay = Math.floor(delay + jitter);

        return Math.min(finalDelay, this.options.maxDelayMs);
    }

    // 비동기 함수 재시도
    async execute<T>(fn: () => Promise<T>): Promise<RetryResult<T>> {
        const startTime = Date.now();
        let lastError: Error | undefined;

        for (let attempt = 1; attempt <= this.options.maxAttempts; attempt++) {
            try {
                const result = await fn();
                return {
                    success: true,
                    result,
                    attempts: attempt,
                    totalDuration: Date.now() - startTime
                };
            } catch (error) {
                lastError = error instanceof Error ? error : new Error(String(error));

                // 마지막 시도이거나 재시도 조건을 만족하지 않으면 중단
                if (attempt === this.options.maxAttempts || !this.options.retryCondition(lastError)) {
                    break;
                }

                // 다음 시도 전 대기
                const delay = this.calculateDelay(attempt);
                await this.delay(delay);
            }
        }

        return {
            success: false,
            error: lastError,
            attempts: this.options.maxAttempts,
            totalDuration: Date.now() - startTime
        };
    }

    // 동기 함수 재시도
    executeSync<T>(fn: () => T): RetryResult<T> {
        const startTime = Date.now();
        let lastError: Error | undefined;

        for (let attempt = 1; attempt <= this.options.maxAttempts; attempt++) {
            try {
                const result = fn();
                return {
                    success: true,
                    result,
                    attempts: attempt,
                    totalDuration: Date.now() - startTime
                };
            } catch (error) {
                lastError = error instanceof Error ? error : new Error(String(error));

                // 마지막 시도이거나 재시도 조건을 만족하지 않으면 중단
                if (attempt === this.options.maxAttempts || !this.options.retryCondition(lastError)) {
                    break;
                }

                // 동기 함수에서는 즉시 다음 시도 (비동기 대기 불가)
            }
        }

        return {
            success: false,
            error: lastError,
            attempts: this.options.maxAttempts,
            totalDuration: Date.now() - startTime
        };
    }

    private delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // 설정 업데이트
    updateOptions(options: Partial<RetryOptions>): void {
        this.options = { ...this.options, ...options };
    }

    // 현재 설정 반환
    getOptions(): Required<RetryOptions> {
        return { ...this.options };
    }
}

// 특화된 재시도 정책들
export class NetworkRetryPolicy extends RetryPolicy {
    constructor(options: RetryOptions = {}) {
        super({
            maxAttempts: 5,
            delayMs: 1000,
            exponentialBackoff: true,
            maxDelayMs: 10000,
            retryCondition: (error) => {
                // 네트워크 관련 에러만 재시도
                const networkErrors = [
                    'networkerror', 'fetch', 'timeout',
                    'econnreset', 'etimedout', 'enotfound',
                    '502', '503', '504', '408', '429'
                ];
                
                const errorText = error.message.toLowerCase();
                return networkErrors.some(pattern => errorText.includes(pattern));
            },
            ...options
        });
    }
}

export class APIRetryPolicy extends RetryPolicy {
    constructor(options: RetryOptions = {}) {
        super({
            maxAttempts: 3,
            delayMs: 2000,
            exponentialBackoff: true,
            maxDelayMs: 15000,
            retryCondition: (error) => {
                // API 관련 에러 중 재시도 가능한 것들
                const retryableErrors = [
                    '429', // Rate limit
                    '502', '503', '504', // Server errors
                    'timeout',
                    'network'
                ];
                
                const errorText = error.message.toLowerCase();
                return retryableErrors.some(pattern => errorText.includes(pattern));
            },
            ...options
        });
    }
}

export class DatabaseRetryPolicy extends RetryPolicy {
    constructor(options: RetryOptions = {}) {
        super({
            maxAttempts: 3,
            delayMs: 500,
            exponentialBackoff: false, // 데이터베이스는 빠른 재시도
            maxDelayMs: 2000,
            retryCondition: (error) => {
                // 일시적인 데이터베이스 에러만 재시도
                const retryableErrors = [
                    'lock', 'busy', 'timeout',
                    'connection', 'network'
                ];
                
                const errorText = error.message.toLowerCase();
                return retryableErrors.some(pattern => errorText.includes(pattern));
            },
            ...options
        });
    }
}

// 편의 함수들
export async function retryAsync<T>(
    fn: () => Promise<T>,
    options?: RetryOptions
): Promise<T> {
    const policy = new RetryPolicy(options);
    const result = await policy.execute(fn);
    
    if (result.success) {
        return result.result!;
    } else {
        throw result.error;
    }
}

export function retrySync<T>(
    fn: () => T,
    options?: RetryOptions
): T {
    const policy = new RetryPolicy(options);
    const result = policy.executeSync(fn);
    
    if (result.success) {
        return result.result!;
    } else {
        throw result.error;
    }
}

// 네트워크 요청용 편의 함수
export async function retryNetworkRequest<T>(
    fn: () => Promise<T>,
    options?: RetryOptions
): Promise<T> {
    const policy = new NetworkRetryPolicy(options);
    const result = await policy.execute(fn);
    
    if (result.success) {
        return result.result!;
    } else {
        throw result.error;
    }
}

// API 호출용 편의 함수
export async function retryAPICall<T>(
    fn: () => Promise<T>,
    options?: RetryOptions
): Promise<T> {
    const policy = new APIRetryPolicy(options);
    const result = await policy.execute(fn);
    
    if (result.success) {
        return result.result!;
    } else {
        throw result.error;
    }
}

// Circuit Breaker 패턴과 함께 사용할 수 있는 고급 재시도
export class CircuitBreakerRetryPolicy extends RetryPolicy {
    private failureCount = 0;
    private lastFailureTime = 0;
    private circuitBreakerTimeout = 60000; // 1분
    private failureThreshold = 5;

    constructor(options: RetryOptions = {}) {
        super(options);
    }

    async executeWithCircuitBreaker<T>(fn: () => Promise<T>): Promise<RetryResult<T>> {
        // Circuit Breaker 체크
        if (this.isCircuitOpen()) {
            return {
                success: false,
                error: new Error('Circuit breaker is open'),
                attempts: 0,
                totalDuration: 0
            };
        }

        const result = await this.execute(fn);

        // 결과에 따른 Circuit Breaker 상태 업데이트
        if (result.success) {
            this.failureCount = 0;
        } else {
            this.failureCount++;
            this.lastFailureTime = Date.now();
        }

        return result;
    }

    private isCircuitOpen(): boolean {
        if (this.failureCount < this.failureThreshold) {
            return false;
        }

        const timeSinceLastFailure = Date.now() - this.lastFailureTime;
        if (timeSinceLastFailure >= this.circuitBreakerTimeout) {
            this.failureCount = 0; // Reset circuit breaker
            return false;
        }

        return true;
    }
}