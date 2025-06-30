import { 
    SpacedRepetitionAlgorithm, 
    ReviewResponse, 
    SRSSettings, 
    DEFAULT_SRS_SETTINGS,
    ScheduleInfo 
} from '../algorithms/SpacedRepetitionAlgorithm';
import { VocabularyCard } from '../../VocabularyCard';

export interface ReviewSession {
    sessionId: string;
    startTime: string;
    cardsReviewed: number;
    totalCards: number;
    completedCards: VocabularyCard[];
    currentCard?: VocabularyCard;
    remainingCards?: VocabularyCard[];
}

export interface StudyStatistics {
    today: {
        newCards: number;
        reviewedCards: number;
        totalTime: number; // minutes
    };
    streak: {
        currentDays: number;
        longestDays: number;
        lastStudyDate: string | null;
    };
    overall: {
        totalCards: number;
        newCards: number;
        learningCards: number;
        matureCards: number;
        averageEase: number;
        averageInterval: number;
    };
}

export class SpacedRepetitionService {
    private algorithm: SpacedRepetitionAlgorithm;
    private currentSession: ReviewSession | null = null;

    constructor(settings: Partial<SRSSettings> = {}) {
        const srsSettings = { ...DEFAULT_SRS_SETTINGS, ...settings };
        this.algorithm = new SpacedRepetitionAlgorithm(srsSettings);
    }

    /**
     * Get cards that are due for review today
     */
    getCardsForReview(allCards: VocabularyCard[]): VocabularyCard[] {
        return SpacedRepetitionAlgorithm.getCardsForReview(allCards) as VocabularyCard[];
    }

    /**
     * Get new cards (never reviewed)
     */
    getNewCards(allCards: VocabularyCard[]): VocabularyCard[] {
        return allCards.filter(card => !card.scheduleInfo || card.reviewCount === 0);
    }

    /**
     * Get learning cards (reviewed but not mature)
     */
    getLearningCards(allCards: VocabularyCard[]): VocabularyCard[] {
        return allCards.filter(card => 
            card.scheduleInfo && 
            card.reviewCount > 0 && 
            card.scheduleInfo.interval < 21
        );
    }

    /**
     * Get mature cards (interval >= 21 days)
     */
    getMatureCards(allCards: VocabularyCard[]): VocabularyCard[] {
        return allCards.filter(card => 
            card.scheduleInfo && 
            card.scheduleInfo.interval >= 21
        );
    }

    /**
     * Start a new review session
     */
    startReviewSession(dueCards: VocabularyCard[], maxCards?: number): ReviewSession {
        const cardsToReview = maxCards ? dueCards.slice(0, maxCards) : dueCards;
        
        this.currentSession = {
            sessionId: this.generateSessionId(),
            startTime: new Date().toISOString(),
            cardsReviewed: 0,
            totalCards: cardsToReview.length,
            completedCards: [],
            currentCard: cardsToReview[0],
            remainingCards: cardsToReview // Add remaining cards to track progress
        };

        return this.currentSession;
    }

    /**
     * Process a review response and get the next card
     */
    processReview(
        card: VocabularyCard, 
        response: ReviewResponse
    ): { 
        updatedCard: VocabularyCard; 
        nextCard?: VocabularyCard; 
        sessionComplete: boolean 
    } {
        if (!this.currentSession) {
            throw new Error('No active review session');
        }

        // Apply spaced repetition algorithm
        const reviewResult = this.algorithm.schedule(response, card.scheduleInfo);
        
        // Update card with new schedule
        const updatedCard: VocabularyCard = {
            ...card,
            reviewCount: (card.scheduleInfo?.reviewCount || 0) + 1,
            difficulty: response,
            lastReviewed: new Date().toISOString(),
            scheduleInfo: {
                dueDate: reviewResult.dueDate,
                interval: reviewResult.interval,
                ease: reviewResult.ease,
                reviewCount: (card.scheduleInfo?.reviewCount || 0) + 1,
                lapseCount: (card.scheduleInfo?.lapseCount || 0) + (response === ReviewResponse.Hard ? 1 : 0),
                delayedDays: card.scheduleInfo?.delayedDays || 0,
                repetition: reviewResult.repetition
            }
        };

        // Update session
        this.currentSession.cardsReviewed++;
        this.currentSession.completedCards.push(updatedCard);

        // Get next card from remaining cards
        const remainingCards = this.currentSession.remainingCards || [];
        const nextCard = this.currentSession.cardsReviewed < remainingCards.length 
            ? remainingCards[this.currentSession.cardsReviewed] 
            : undefined;

        this.currentSession.currentCard = nextCard;

        const sessionComplete = !nextCard || this.currentSession.cardsReviewed >= this.currentSession.totalCards;

        if (sessionComplete) {
            this.endReviewSession();
        }

        return {
            updatedCard,
            nextCard,
            sessionComplete
        };
    }

    /**
     * End the current review session
     */
    endReviewSession(): ReviewSession | null {
        const session = this.currentSession;
        this.currentSession = null;
        return session;
    }

    /**
     * Get current session info
     */
    getCurrentSession(): ReviewSession | null {
        return this.currentSession;
    }

    /**
     * Calculate study statistics
     */
    calculateStatistics(allCards: VocabularyCard[], studyHistory?: any[]): StudyStatistics {
        const now = new Date();
        const today = now.toDateString();
        
        // Overall statistics using the algorithm's static method
        const overallStats = SpacedRepetitionAlgorithm.getStatistics(allCards);

        // Today's statistics (would need to be tracked separately)
        const todayStats = {
            newCards: 0, // Would track from session data
            reviewedCards: 0, // Would track from session data
            totalTime: 0 // Would track from session timing
        };

        // Streak calculation (would need persistent storage)
        const streakStats = {
            currentDays: 0, // Would calculate from study history
            longestDays: 0, // Would calculate from study history
            lastStudyDate: null as string | null
        };

        return {
            today: todayStats,
            streak: streakStats,
            overall: overallStats
        };
    }

    /**
     * Get cards due in the next N days
     */
    getCardsDueInDays(allCards: VocabularyCard[], days: number): number {
        return SpacedRepetitionAlgorithm.getCardsDueInDays(allCards, days);
    }

    /**
     * Reset a card's schedule (for testing or manual intervention)
     */
    resetCardSchedule(card: VocabularyCard): VocabularyCard {
        return {
            ...card,
            reviewCount: 0,
            lastReviewed: null,
            scheduleInfo: undefined
        };
    }

    /**
     * Manually set card difficulty (for bulk operations)
     */
    setCardDifficulty(card: VocabularyCard, difficulty: ReviewResponse): VocabularyCard {
        const reviewResult = this.algorithm.schedule(difficulty, card.scheduleInfo);
        
        return {
            ...card,
            difficulty,
            scheduleInfo: {
                dueDate: reviewResult.dueDate,
                interval: reviewResult.interval,
                ease: reviewResult.ease,
                reviewCount: (card.scheduleInfo?.reviewCount || 0) + 1,
                lapseCount: (card.scheduleInfo?.lapseCount || 0) + (difficulty === ReviewResponse.Hard ? 1 : 0),
                delayedDays: 0,
                repetition: reviewResult.repetition
            }
        };
    }

    /**
     * Update algorithm settings
     */
    updateSettings(settings: Partial<SRSSettings>): void {
        this.algorithm.updateSettings(settings);
    }

    /**
     * Get current algorithm settings
     */
    getSettings(): SRSSettings {
        return this.algorithm.getSettings();
    }

    /**
     * Generate a unique session ID
     */
    private generateSessionId(): string {
        return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Get recommended daily study load
     */
    getRecommendedDailyCards(allCards: VocabularyCard[]): {
        newCards: number;
        reviewCards: number;
        total: number;
    } {
        const dueCards = this.getCardsForReview(allCards);
        const newCards = this.getNewCards(allCards);
        
        // Recommended limits (configurable)
        const maxNewCardsPerDay = 20;
        const maxReviewCardsPerDay = 100;
        
        const recommendedNew = Math.min(newCards.length, maxNewCardsPerDay);
        const recommendedReview = Math.min(dueCards.length - recommendedNew, maxReviewCardsPerDay);
        
        return {
            newCards: recommendedNew,
            reviewCards: recommendedReview,
            total: recommendedNew + recommendedReview
        };
    }

    /**
     * Export cards for data analysis or backup
     */
    exportScheduleData(allCards: VocabularyCard[]): any[] {
        return allCards.map(card => ({
            word: card.word,
            reviewCount: card.reviewCount,
            difficulty: card.difficulty,
            lastReviewed: card.lastReviewed,
            scheduleInfo: card.scheduleInfo,
            addedDate: card.addedDate
        }));
    }

    /**
     * Get the next review intervals for each difficulty level
     * Shows the exact SM-2 algorithm results with E-Factor information
     */
    getNextReviewIntervals(card: VocabularyCard): {
        hard: { interval: number; displayText: string; eFactor: number; repetition: number };
        good: { interval: number; displayText: string; eFactor: number; repetition: number };
        easy: { interval: number; displayText: string; eFactor: number; repetition: number };
    } {
        const hardResult = this.algorithm.schedule(ReviewResponse.Hard, card.scheduleInfo);
        const goodResult = this.algorithm.schedule(ReviewResponse.Good, card.scheduleInfo);
        const easyResult = this.algorithm.schedule(ReviewResponse.Easy, card.scheduleInfo);

        return {
            hard: {
                interval: hardResult.interval,
                displayText: this.formatInterval(hardResult.interval),
                eFactor: hardResult.ease / 100, // Convert back to E-Factor
                repetition: hardResult.repetition
            },
            good: {
                interval: goodResult.interval,
                displayText: this.formatInterval(goodResult.interval),
                eFactor: goodResult.ease / 100,
                repetition: goodResult.repetition
            },
            easy: {
                interval: easyResult.interval,
                displayText: this.formatInterval(easyResult.interval),
                eFactor: easyResult.ease / 100,
                repetition: easyResult.repetition
            }
        };
    }

    /**
     * Format interval as human-readable text
     */
    private formatInterval(days: number): string {
        if (days < 1) {
            return 'today';
        } else if (days === 1) {
            return '1 day';
        } else if (days < 30) {
            return `${days} day${days > 1 ? 's' : ''}`;
        } else if (days < 365) {
            const months = Math.round(days / 30 * 10) / 10;
            return `${months} month${months > 1 ? 's' : ''}`;
        } else {
            const years = Math.round(days / 365 * 10) / 10;
            return `${years} year${years > 1 ? 's' : ''}`;
        }
    }

    /**
     * Get detailed SM-2 algorithm statistics
     */
    getSM2Statistics(allCards: VocabularyCard[]): {
        overview: {
            totalCards: number;
            newCards: number;
            learningCards: number;
            matureCards: number;
        };
        repetitions: {
            rep0: number; // 새 카드
            rep1: number; // 첫 번째 복습
            rep2: number; // 두 번째 복습
            rep3Plus: number; // 세 번째 이상 복습
        };
        eFactors: {
            average: number;
            distribution: { range: string; count: number }[];
        };
        intervals: {
            average: number;
            distribution: { range: string; count: number }[];
        };
    } {
        const stats = {
            overview: { totalCards: 0, newCards: 0, learningCards: 0, matureCards: 0 },
            repetitions: { rep0: 0, rep1: 0, rep2: 0, rep3Plus: 0 },
            eFactors: { average: 0, distribution: [] as { range: string; count: number }[] },
            intervals: { average: 0, distribution: [] as { range: string; count: number }[] }
        };

        let totalEFactor = 0;
        let totalInterval = 0;
        let cardsWithSchedule = 0;
        const eFactorBuckets = new Map<string, number>();
        const intervalBuckets = new Map<string, number>();

        allCards.forEach(card => {
            stats.overview.totalCards++;

            if (!card.scheduleInfo) {
                stats.overview.newCards++;
                stats.repetitions.rep0++;
            } else {
                cardsWithSchedule++;
                const repetition = card.scheduleInfo.repetition || 0;
                const eFactor = card.scheduleInfo.ease / 100;
                const interval = card.scheduleInfo.interval;

                totalEFactor += eFactor;
                totalInterval += interval;

                // Repetition 분포
                if (repetition === 1) stats.repetitions.rep1++;
                else if (repetition === 2) stats.repetitions.rep2++;
                else if (repetition >= 3) stats.repetitions.rep3Plus++;
                else stats.repetitions.rep0++;

                // Mature/Learning 분류
                if (interval >= 21) {
                    stats.overview.matureCards++;
                } else {
                    stats.overview.learningCards++;
                }

                // E-Factor 분포
                const eFactorRange = this.getEFactorRange(eFactor);
                eFactorBuckets.set(eFactorRange, (eFactorBuckets.get(eFactorRange) || 0) + 1);

                // Interval 분포
                const intervalRange = this.getIntervalRange(interval);
                intervalBuckets.set(intervalRange, (intervalBuckets.get(intervalRange) || 0) + 1);
            }
        });

        // 평균 계산
        stats.eFactors.average = cardsWithSchedule > 0 ? Math.round((totalEFactor / cardsWithSchedule) * 100) / 100 : 0;
        stats.intervals.average = cardsWithSchedule > 0 ? Math.round(totalInterval / cardsWithSchedule) : 0;

        // 분포 배열 생성
        stats.eFactors.distribution = Array.from(eFactorBuckets.entries())
            .map(([range, count]) => ({ range, count }))
            .sort((a, b) => parseFloat(a.range.split('-')[0]) - parseFloat(b.range.split('-')[0]));

        stats.intervals.distribution = Array.from(intervalBuckets.entries())
            .map(([range, count]) => ({ range, count }))
            .sort((a, b) => this.compareIntervalRanges(a.range, b.range));

        return stats;
    }

    /**
     * Get E-Factor range for grouping
     */
    private getEFactorRange(eFactor: number): string {
        if (eFactor < 1.5) return '1.3-1.5';
        if (eFactor < 2.0) return '1.5-2.0';
        if (eFactor < 2.5) return '2.0-2.5';
        if (eFactor < 3.0) return '2.5-3.0';
        if (eFactor < 3.5) return '3.0-3.5';
        return '3.5+';
    }

    /**
     * Get interval range for grouping
     */
    private getIntervalRange(interval: number): string {
        if (interval === 1) return '1 day';
        if (interval <= 6) return '2-6 days';
        if (interval <= 20) return '7-20 days';
        if (interval <= 60) return '21-60 days';
        if (interval <= 180) return '2-6 months';
        if (interval <= 365) return '6-12 months';
        return '1+ years';
    }

    /**
     * Compare interval ranges for sorting
     */
    private compareIntervalRanges(a: string, b: string): number {
        const order = ['1 day', '2-6 days', '7-20 days', '21-60 days', '2-6 months', '6-12 months', '1+ years'];
        return order.indexOf(a) - order.indexOf(b);
    }
}