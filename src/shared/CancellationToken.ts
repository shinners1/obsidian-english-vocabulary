// 작업 취소를 위한 토큰 시스템

export interface CancellationToken {
    readonly isCancelled: boolean;
    throwIfCancelled(): void;
    onCancelled(callback: () => void): void;
}

export class CancellationTokenSource {
    private _isCancelled = false;
    private _callbacks: (() => void)[] = [];

    get token(): CancellationToken {
        return {
            get isCancelled() {
                return this._isCancelled;
            },
            throwIfCancelled: () => {
                if (this._isCancelled) {
                    throw new CancellationError('Operation was cancelled');
                }
            },
            onCancelled: (callback: () => void) => {
                if (this._isCancelled) {
                    callback();
                } else {
                    this._callbacks.push(callback);
                }
            }
        };
    }

    cancel(): void {
        if (this._isCancelled) return;
        
        this._isCancelled = true;
        this._callbacks.forEach(callback => {
            try {
                callback();
            } catch (error) {
                console.error('Error in cancellation callback:', error);
            }
        });
        this._callbacks.clear();
    }

    dispose(): void {
        this._callbacks.clear();
    }
}

export class CancellationError extends Error {
    constructor(message: string = 'Operation was cancelled') {
        super(message);
        this.name = 'CancellationError';
    }
}

// 유틸리티 함수들
export function delay(ms: number, cancellationToken?: CancellationToken): Promise<void> {
    return new Promise((resolve, reject) => {
        if (cancellationToken?.isCancelled) {
            reject(new CancellationError());
            return;
        }

        const timeoutId = setTimeout(() => {
            resolve();
        }, ms);

        cancellationToken?.onCancelled(() => {
            clearTimeout(timeoutId);
            reject(new CancellationError());
        });
    });
}

export async function withCancellation<T>(
    promise: Promise<T>,
    cancellationToken?: CancellationToken
): Promise<T> {
    if (!cancellationToken) {
        return promise;
    }

    return new Promise<T>((resolve, reject) => {
        if (cancellationToken.isCancelled) {
            reject(new CancellationError());
            return;
        }

        let isResolved = false;

        promise.then(
            (value) => {
                if (!isResolved) {
                    isResolved = true;
                    resolve(value);
                }
            },
            (error) => {
                if (!isResolved) {
                    isResolved = true;
                    reject(error);
                }
            }
        );

        cancellationToken.onCancelled(() => {
            if (!isResolved) {
                isResolved = true;
                reject(new CancellationError());
            }
        });
    });
}

// 배치 처리용 취소 가능한 함수
export async function processBatchWithCancellation<T, R>(
    items: T[],
    processor: (item: T, index: number) => Promise<R>,
    options: {
        batchSize?: number;
        delay?: number;
        cancellationToken?: CancellationToken;
        onProgress?: (current: number, total: number) => void;
    } = {}
): Promise<R[]> {
    const {
        batchSize = 10,
        delay: delayMs = 100,
        cancellationToken,
        onProgress
    } = options;

    const results: R[] = [];
    
    for (let i = 0; i < items.length; i += batchSize) {
        cancellationToken?.throwIfCancelled();
        
        const batch = items.slice(i, i + batchSize);
        const batchPromises = batch.map((item, batchIndex) =>
            processor(item, i + batchIndex)
        );

        try {
            const batchResults = await withCancellation(
                Promise.all(batchPromises),
                cancellationToken
            );
            results.push(...batchResults);

            // 진행률 업데이트
            onProgress?.(Math.min(i + batchSize, items.length), items.length);

            // 다음 배치 전 대기 (마지막 배치가 아닌 경우)
            if (i + batchSize < items.length && delayMs > 0) {
                await delay(delayMs, cancellationToken);
            }
        } catch (error) {
            if (error instanceof CancellationError) {
                throw error;
            }
            // 다른 에러는 결과에 포함하거나 재시도 로직 추가 가능
            throw error;
        }
    }

    return results;
}