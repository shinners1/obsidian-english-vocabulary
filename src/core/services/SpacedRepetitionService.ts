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
            currentCard: cardsToReview[0]
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
                delayedDays: card.scheduleInfo?.delayedDays || 0
            }
        };

        // Update session
        this.currentSession.cardsReviewed++;
        this.currentSession.completedCards.push(updatedCard);

        // Get next card
        const dueCards = this.getCardsForReview([card]); // This would be replaced with remaining cards
        const nextCard = this.currentSession.cardsReviewed < this.currentSession.totalCards 
            ? dueCards[this.currentSession.cardsReviewed] 
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
                delayedDays: 0
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
}