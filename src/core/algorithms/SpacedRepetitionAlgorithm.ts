import { Moment } from 'moment';

export enum ReviewResponse {
    Hard = 'hard',    // q = 1: 매우 어렵게 회상하거나 거의 실패에 가까운 경우
    Good = 'good',    // q = 2: 약간의 노력을 들여 회상한 경우  
    Easy = 'easy'     // q = 3: 쉽게 완전 회상한 경우
}

// SM-2 알고리즘의 품질 점수 매핑
export const QUALITY_SCORES = {
    [ReviewResponse.Hard]: 1,
    [ReviewResponse.Good]: 2,
    [ReviewResponse.Easy]: 3
} as const;

export interface SRSSettings {
    // SM-2 Algorithm Settings
    initialEFactor: number;     // SM-2 초기 E-Factor (2.5)
    minimumEFactor: number;     // SM-2 최소 E-Factor (1.3)
    maximumInterval: number;    // Maximum interval in days (36525 = ~100 years)
    
    // Load Balancing Settings
    loadBalance: boolean;       // Enable review load balancing
    maxFuzzingDays: number;     // Maximum fuzzing for load balancing (3)
    
    // Legacy compatibility (deprecated but kept for backward compatibility)
    baseEase: number;           // Starting ease factor (250%) - converted to EFactor
    easyBonus: number;          // Multiplier for easy responses (1.3) - not used in SM-2
    hardPenalty: number;        // Multiplier for hard responses (0.5) - not used in SM-2
    minimumEase: number;        // Minimum ease factor (130%) - converted to EFactor
    initialInterval: number;    // Starting interval in days (1) - not used in SM-2
}

export const DEFAULT_SRS_SETTINGS: SRSSettings = {
    // SM-2 Algorithm Settings
    initialEFactor: 2.5,        // SM-2 표준 초기 E-Factor
    minimumEFactor: 1.3,        // SM-2 표준 최소 E-Factor
    maximumInterval: 36525,     // ~100년
    
    // Load Balancing Settings
    loadBalance: true,
    maxFuzzingDays: 3,
    
    // Legacy compatibility (will be converted)
    baseEase: 250,              // 2.5 * 100
    easyBonus: 1.3,
    hardPenalty: 0.5,
    minimumEase: 130,           // 1.3 * 100
    initialInterval: 1
};

export interface ScheduleInfo {
    dueDate: string;           // ISO date string
    interval: number;          // Days until next review
    ease: number;              // Ease factor (E-Factor * 100, 130-500+)
    reviewCount: number;       // Total number of reviews
    lapseCount: number;        // Number of hard responses
    delayedDays: number;       // Days delayed before this review
    repetition: number;        // SM-2 repetition count (연속 성공 회상 횟수)
}

export interface ReviewResult {
    interval: number;
    ease: number;
    dueDate: string;
    repetition: number;
}

export class SpacedRepetitionAlgorithm {
    private settings: SRSSettings;
    private dueDateHistogram: Map<string, number> = new Map();

    constructor(settings: SRSSettings = DEFAULT_SRS_SETTINGS) {
        this.settings = settings;
    }

    /**
     * Calculate the next review schedule based on user response
     * Implements the SM-2 algorithm according to learning_algorithm.md specification
     */
    schedule(
        response: ReviewResponse,
        currentSchedule?: ScheduleInfo
    ): ReviewResult {
        const now = new Date();
        const q = QUALITY_SCORES[response]; // 품질 점수: 1(hard), 2(good), 3(easy)
        
        // Initialize schedule info for new cards
        if (!currentSchedule) {
            currentSchedule = {
                dueDate: now.toISOString(),
                interval: 0,
                ease: Math.round(this.settings.initialEFactor * 100), // E-Factor를 100으로 곱해서 저장
                reviewCount: 0,
                lapseCount: 0,
                delayedDays: 0,
                repetition: 0
            };
        }

        // 현재 E-Factor 계산 (저장된 값을 100으로 나누어 실제 E-Factor 얻음)
        let currentEFactor = currentSchedule.ease / 100;
        let newRepetition = currentSchedule.repetition;
        
        // SM-2 Algorithm Step 1: E-Factor 업데이트
        // EF_new = EF_old + (0.1 - (3-q) * (0.08 + (3-q) * 0.02))
        const delta = 0.1 - (3 - q) * (0.08 + (3 - q) * 0.02);
        let newEFactor = currentEFactor + delta;
        
        // E-Factor 최소값 제한 (1.3)
        newEFactor = Math.max(this.settings.minimumEFactor, newEFactor);
        
        // SM-2 Algorithm Step 2: Repetition 업데이트
        if (q >= 2) { // good 또는 easy (q = 2 또는 3)
            newRepetition = currentSchedule.repetition + 1;
        } else { // hard (q = 1)
            newRepetition = 0; // repetition 리셋
        }
        
        // SM-2 Algorithm Step 3: 다음 복습 간격 계산
        let newInterval: number;
        
        if (q < 2) { // hard (q = 1)
            // hard 응답 시 즉시 복습 (1일 후)
            newInterval = 1;
        } else {
            // good 또는 easy 응답 시 SM-2 간격 공식 적용
            if (newRepetition === 1) {
                newInterval = 1;
            } else if (newRepetition === 2) {
                newInterval = 6;
            } else {
                // n >= 3: I_n = I_(n-1) * EF_new
                newInterval = Math.round(currentSchedule.interval * newEFactor);
            }
        }
        
        // 최대 간격 제한
        newInterval = Math.min(newInterval, this.settings.maximumInterval);
        
        // 최소 간격 보장 (1일)
        newInterval = Math.max(1, newInterval);

        // Load balancing 적용 (선택사항)
        if (this.settings.loadBalance) {
            newInterval = this.applyLoadBalancing(newInterval);
        }

        // 새로운 만료일 계산
        const newDueDate = new Date(now.getTime() + newInterval * 24 * 60 * 60 * 1000);

        // 히스토그램 업데이트 (load balancing용)
        this.updateDueDateHistogram(newDueDate.toDateString());

        return {
            interval: newInterval,
            ease: Math.round(newEFactor * 100), // E-Factor를 100으로 곱해서 반환
            dueDate: newDueDate.toISOString(),
            repetition: newRepetition
        };
    }

    /**
     * Apply load balancing to distribute reviews evenly across days
     * Based on the histogram-based approach from obsidian-spaced-repetition
     */
    private applyLoadBalancing(interval: number): number {
        if (!this.settings.loadBalance) {
            return interval;
        }

        // Different fuzzing strategies based on interval length
        let fuzzingRange: number;
        
        if (interval <= 21) {
            fuzzingRange = 1; // 1 day fuzzing for short intervals
        } else if (interval <= 180) {
            fuzzingRange = Math.max(1, interval * 0.05); // 5% fuzzing for medium intervals
        } else {
            fuzzingRange = Math.max(1, interval * 0.025); // 2.5% fuzzing for long intervals
        }

        // Cap fuzzing at max setting
        fuzzingRange = Math.min(fuzzingRange, this.settings.maxFuzzingDays);

        // Find the date with minimum reviews in the fuzzing range
        const now = new Date();
        let bestInterval = interval;
        let minReviews = Number.MAX_SAFE_INTEGER;

        for (let offset = -fuzzingRange; offset <= fuzzingRange; offset++) {
            const testInterval = interval + offset;
            if (testInterval < 1) continue;

            const testDate = new Date(now.getTime() + testInterval * 24 * 60 * 60 * 1000);
            const dateString = testDate.toDateString();
            const reviewCount = this.dueDateHistogram.get(dateString) || 0;

            if (reviewCount < minReviews) {
                minReviews = reviewCount;
                bestInterval = testInterval;
            }
        }

        return bestInterval;
    }

    /**
     * Update the due date histogram for load balancing
     */
    private updateDueDateHistogram(dateString: string): void {
        const current = this.dueDateHistogram.get(dateString) || 0;
        this.dueDateHistogram.set(dateString, current + 1);
    }

    /**
     * Get cards that are due for review
     */
    static getCardsForReview(cards: Array<{ scheduleInfo?: ScheduleInfo }>): Array<{ scheduleInfo?: ScheduleInfo }> {
        const now = new Date();
        
        return cards.filter(card => {
            if (!card.scheduleInfo) {
                return true; // New cards are always due
            }
            
            const dueDate = new Date(card.scheduleInfo.dueDate);
            return dueDate <= now;
        });
    }

    /**
     * Calculate the number of cards due in the next N days
     */
    static getCardsDueInDays(cards: Array<{ scheduleInfo?: ScheduleInfo }>, days: number): number {
        const now = new Date();
        const futureDate = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
        
        return cards.filter(card => {
            if (!card.scheduleInfo) {
                return true; // New cards count as due today
            }
            
            const dueDate = new Date(card.scheduleInfo.dueDate);
            return dueDate <= futureDate;
        }).length;
    }

    /**
     * Get learning statistics for a set of cards
     */
    static getStatistics(cards: Array<{ scheduleInfo?: ScheduleInfo }>): {
        total: number;
        new: number;
        learning: number;
        mature: number;
        averageEase: number;
        averageInterval: number;
    } {
        let newCards = 0;
        let learningCards = 0;
        let matureCards = 0;
        let totalEase = 0;
        let totalInterval = 0;
        let cardsWithSchedule = 0;

        cards.forEach(card => {
            if (!card.scheduleInfo) {
                newCards++;
            } else {
                cardsWithSchedule++;
                totalEase += card.scheduleInfo.ease;
                totalInterval += card.scheduleInfo.interval;

                if (card.scheduleInfo.interval < 21) {
                    learningCards++;
                } else {
                    matureCards++;
                }
            }
        });

        return {
            total: cards.length,
            new: newCards,
            learning: learningCards,
            mature: matureCards,
            averageEase: cardsWithSchedule > 0 ? Math.round(totalEase / cardsWithSchedule) : 0,
            averageInterval: cardsWithSchedule > 0 ? Math.round(totalInterval / cardsWithSchedule) : 0
        };
    }

    /**
     * Update algorithm settings
     */
    updateSettings(newSettings: Partial<SRSSettings>): void {
        this.settings = { ...this.settings, ...newSettings };
    }

    /**
     * Get current settings
     */
    getSettings(): SRSSettings {
        return { ...this.settings };
    }

    /**
     * Clear the due date histogram (useful for testing or reset)
     */
    clearHistogram(): void {
        this.dueDateHistogram.clear();
    }
}