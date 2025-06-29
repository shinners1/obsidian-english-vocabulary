import { Difficulty } from '../../shared/lib/types';
import { VocabularyCard } from './Vocabulary';

// 복습 세션 엔티티
export class ReviewSession {
    constructor(
        public readonly id: string,
        public readonly startTime: string,
        public endTime: string | null,
        public readonly cards: VocabularyCard[],
        public currentIndex: number,
        public results: ReviewResult[],
        public readonly bookId: string
    ) {}

    // 팩토리 메서드: 새 복습 세션 생성
    static create(cards: VocabularyCard[], bookId: string): ReviewSession {
        const id = ReviewSession.generateId();
        const startTime = new Date().toISOString();
        
        return new ReviewSession(
            id,
            startTime,
            null,
            cards,
            0,
            [],
            bookId
        );
    }

    // 비즈니스 로직: 복습 제출
    submitReview(difficulty: Difficulty): ReviewSession {
        if (this.isCompleted()) {
            throw new Error('이미 완료된 복습 세션입니다.');
        }

        const currentCard = this.getCurrentCard();
        if (!currentCard) {
            throw new Error('현재 복습할 카드가 없습니다.');
        }

        const result = new ReviewResult(
            currentCard.word,
            difficulty,
            currentCard.difficulty,
            new Date().toISOString()
        );

        const newResults = [...this.results, result];
        const newIndex = this.currentIndex + 1;

        return new ReviewSession(
            this.id,
            this.startTime,
            newIndex >= this.cards.length ? new Date().toISOString() : this.endTime,
            this.cards,
            newIndex,
            newResults,
            this.bookId
        );
    }

    // 비즈니스 로직: 현재 카드 가져오기
    getCurrentCard(): VocabularyCard | null {
        if (this.currentIndex >= this.cards.length) {
            return null;
        }
        return this.cards[this.currentIndex];
    }

    // 비즈니스 로직: 복습 완료 여부 확인
    isCompleted(): boolean {
        return this.currentIndex >= this.cards.length;
    }

    // 비즈니스 로직: 진행률 계산 (0-100)
    getProgressPercentage(): number {
        if (this.cards.length === 0) return 100;
        return Math.round((this.currentIndex / this.cards.length) * 100);
    }

    // 비즈니스 로직: 복습 시간 계산 (분)
    getDurationMinutes(): number {
        const endTime = this.endTime || new Date().toISOString();
        const start = new Date(this.startTime);
        const end = new Date(endTime);
        return Math.round((end.getTime() - start.getTime()) / (1000 * 60));
    }

    // 비즈니스 로직: 복습 통계 계산
    getStatistics(): ReviewStatistics {
        const total = this.results.length;
        const improved = this.results.filter(r => r.isImproved()).length;
        const maintained = this.results.filter(r => r.isMaintained()).length;
        const declined = this.results.filter(r => r.isDeclined()).length;

        return {
            totalReviewed: total,
            improved,
            maintained,
            declined,
            improvementRate: total > 0 ? Math.round((improved / total) * 100) : 0,
            averageAccuracy: this.calculateAverageAccuracy(),
            durationMinutes: this.getDurationMinutes()
        };
    }

    // 비즈니스 로직: 평균 정확도 계산
    private calculateAverageAccuracy(): number {
        if (this.results.length === 0) return 0;
        
        const accuracySum = this.results.reduce((sum, result) => {
            const accuracy = result.getAccuracy();
            return sum + accuracy;
        }, 0);
        
        return Math.round(accuracySum / this.results.length);
    }

    // ID 생성 유틸리티
    private static generateId(): string {
        return `review_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    // 데이터 직렬화를 위한 메서드
    toPlainObject(): ReviewSessionData {
        return {
            id: this.id,
            startTime: this.startTime,
            endTime: this.endTime,
            cards: this.cards.map(card => card.toPlainObject()),
            currentIndex: this.currentIndex,
            results: this.results.map(result => result.toPlainObject()),
            bookId: this.bookId
        };
    }
}

// 개별 복습 결과 엔티티
export class ReviewResult {
    constructor(
        public readonly word: string,
        public readonly newDifficulty: Difficulty,
        public readonly previousDifficulty: Difficulty,
        public readonly reviewedAt: string
    ) {}

    // 비즈니스 로직: 개선되었는지 확인
    isImproved(): boolean {
        const difficultyOrder = { 'hard': 0, 'good': 1, 'easy': 2 };
        return difficultyOrder[this.newDifficulty] > difficultyOrder[this.previousDifficulty];
    }

    // 비즈니스 로직: 유지되었는지 확인
    isMaintained(): boolean {
        return this.newDifficulty === this.previousDifficulty;
    }

    // 비즈니스 로직: 하락했는지 확인
    isDeclined(): boolean {
        const difficultyOrder = { 'hard': 0, 'good': 1, 'easy': 2 };
        return difficultyOrder[this.newDifficulty] < difficultyOrder[this.previousDifficulty];
    }

    // 비즈니스 로직: 정확도 계산 (0-100)
    getAccuracy(): number {
        const accuracyMap = {
            'easy': 100,
            'good': 75,
            'hard': 50
        };
        return accuracyMap[this.newDifficulty];
    }

    // 데이터 직렬화를 위한 메서드
    toPlainObject(): ReviewResultData {
        return {
            word: this.word,
            newDifficulty: this.newDifficulty,
            previousDifficulty: this.previousDifficulty,
            reviewedAt: this.reviewedAt
        };
    }
}

// 복습 스케줄러 엔티티
export class ReviewScheduler {
    constructor(
        private readonly reviewInterval: number = 1,
        private readonly maxCardsPerSession: number = 20
    ) {}

    // 비즈니스 로직: 복습이 필요한 카드들 선별
    getCardsForReview(allCards: VocabularyCard[]): VocabularyCard[] {
        const cardsNeedingReview = allCards.filter(card => 
            card.needsReview(this.reviewInterval)
        );

        // 우선순위에 따라 정렬 (어려운 것 우선, 오래된 것 우선)
        const sortedCards = cardsNeedingReview.sort((a, b) => {
            // 1. 난이도 우선순위 (hard > good > easy)
            const difficultyOrder = { 'hard': 2, 'good': 1, 'easy': 0 };
            const difficultyDiff = difficultyOrder[b.difficulty] - difficultyOrder[a.difficulty];
            if (difficultyDiff !== 0) return difficultyDiff;

            // 2. 마지막 복습일이 오래된 순
            const aLastReview = a.lastReviewed ? new Date(a.lastReviewed).getTime() : 0;
            const bLastReview = b.lastReviewed ? new Date(b.lastReviewed).getTime() : 0;
            return aLastReview - bLastReview;
        });

        // 최대 카드 수 제한
        return sortedCards.slice(0, this.maxCardsPerSession);
    }

    // 비즈니스 로직: 다음 복습 예정일 계산
    getNextReviewDate(card: VocabularyCard): Date {
        const now = new Date();
        const difficultyMultiplier = {
            'hard': 0.5,
            'good': 1,
            'easy': 2
        };
        
        const daysToAdd = this.reviewInterval * difficultyMultiplier[card.difficulty];
        const nextReviewDate = new Date(now);
        nextReviewDate.setDate(now.getDate() + Math.ceil(daysToAdd));
        
        return nextReviewDate;
    }

    // 비즈니스 로직: 일일 복습 목표 달성 여부 확인
    isDailyGoalMet(todayReviews: ReviewResult[], dailyGoal: number): boolean {
        return todayReviews.length >= dailyGoal;
    }
}

// 데이터 전송용 인터페이스들
export interface ReviewSessionData {
    id: string;
    startTime: string;
    endTime: string | null;
    cards: any[]; // VocabularyCardData[]
    currentIndex: number;
    results: ReviewResultData[];
    bookId: string;
}

export interface ReviewResultData {
    word: string;
    newDifficulty: Difficulty;
    previousDifficulty: Difficulty;
    reviewedAt: string;
}

export interface ReviewStatistics {
    totalReviewed: number;
    improved: number;
    maintained: number;
    declined: number;
    improvementRate: number;
    averageAccuracy: number;
    durationMinutes: number;
} 