import { Moment } from 'moment';

export enum ReviewResponse {
    Easy = 'easy',
    Good = 'good', 
    Hard = 'hard'
}

export interface SRSSettings {
    baseEase: number;           // Starting ease factor (250%)
    easyBonus: number;          // Multiplier for easy responses (1.3)
    hardPenalty: number;        // Multiplier for hard responses (0.5)
    minimumEase: number;        // Minimum ease factor (130%)
    maximumInterval: number;    // Maximum interval in days (36525 = ~100 years)
    initialInterval: number;    // Starting interval in days (1)
    loadBalance: boolean;       // Enable review load balancing
    maxFuzzingDays: number;     // Maximum fuzzing for load balancing (3)
}

export const DEFAULT_SRS_SETTINGS: SRSSettings = {
    baseEase: 250,
    easyBonus: 1.3,
    hardPenalty: 0.5,
    minimumEase: 130,
    maximumInterval: 36525,
    initialInterval: 1,
    loadBalance: true,
    maxFuzzingDays: 3
};

export interface ScheduleInfo {
    dueDate: string;           // ISO date string
    interval: number;          // Days until next review
    ease: number;              // Ease factor (130-300+)
    reviewCount: number;       // Total number of reviews
    lapseCount: number;        // Number of hard responses
    delayedDays: number;       // Days delayed before this review
}

export interface ReviewResult {
    interval: number;
    ease: number;
    dueDate: string;
}

export class SpacedRepetitionAlgorithm {
    private settings: SRSSettings;
    private dueDateHistogram: Map<string, number> = new Map();

    constructor(settings: SRSSettings = DEFAULT_SRS_SETTINGS) {
        this.settings = settings;
    }

    /**
     * Calculate the next review schedule based on user response
     * Based on SM-2-OSR algorithm from obsidian-spaced-repetition
     */
    schedule(
        response: ReviewResponse,
        currentSchedule?: ScheduleInfo
    ): ReviewResult {
        const now = new Date();
        
        // Initialize schedule info for new cards
        if (!currentSchedule) {
            currentSchedule = {
                dueDate: now.toISOString(),
                interval: 0,
                ease: this.settings.baseEase,
                reviewCount: 0,
                lapseCount: 0,
                delayedDays: 0
            };
        }

        // Calculate days delayed (for cards reviewed late)
        const dueDate = new Date(currentSchedule.dueDate);
        const delayedDays = Math.max(0, Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)));

        let newInterval = currentSchedule.interval;
        let newEase = currentSchedule.ease;

        // Apply SM-2-OSR scheduling algorithm
        switch (response) {
            case ReviewResponse.Easy:
                newEase = Math.min(500, newEase + 20); // Cap at 500%
                newInterval = Math.max(1, ((currentSchedule.interval + delayedDays) * newEase * this.settings.easyBonus) / 100);
                break;

            case ReviewResponse.Good:
                // No ease change for good responses
                newInterval = Math.max(1, ((currentSchedule.interval + delayedDays / 2) * newEase) / 100);
                break;

            case ReviewResponse.Hard:
                newEase = Math.max(this.settings.minimumEase, newEase - 20);
                newInterval = Math.max(1, (currentSchedule.interval + delayedDays / 4) * this.settings.hardPenalty);
                break;
        }

        // Apply first-time learning intervals
        if (currentSchedule.reviewCount === 0) {
            newInterval = this.settings.initialInterval;
        } else if (currentSchedule.reviewCount === 1 && response !== ReviewResponse.Hard) {
            newInterval = 6; // Standard SM-2 second interval
        }

        // Cap maximum interval
        newInterval = Math.min(newInterval, this.settings.maximumInterval);

        // Apply load balancing if enabled
        if (this.settings.loadBalance) {
            newInterval = this.applyLoadBalancing(newInterval);
        }

        // Calculate new due date
        const newDueDate = new Date(now.getTime() + newInterval * 24 * 60 * 60 * 1000);

        // Update histogram for load balancing
        this.updateDueDateHistogram(newDueDate.toDateString());

        return {
            interval: Math.round(newInterval),
            ease: Math.round(newEase),
            dueDate: newDueDate.toISOString()
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