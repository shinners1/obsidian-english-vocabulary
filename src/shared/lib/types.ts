// 공통 기본 타입 정의
export type Difficulty = 'none' | 'easy' | 'good' | 'hard';

export type LLMProvider = 'openai' | 'anthropic' | 'google';

export interface Example {
    english: string;
    korean: string;
}

// API 응답 공통 타입
export interface ApiResponse<T> {
    success: boolean;
    data?: T;
    error?: string;
}

// 검색 관련 타입
export interface SearchOptions {
    query: string;
    bookId?: string;
    difficulty?: Difficulty;
    limit?: number;
}

// 통계 관련 타입
export interface Statistics {
    totalWords: number;
    totalReviews: number;
    streakDays: number;
    averageDifficulty: number;
    wordsByDifficulty: {
        none: number;
        easy: number;
        good: number;
        hard: number;
    };
    recentActivity: {
        date: string;
        wordsStudied: number;
        reviewsCompleted: number;
    }[];
}

// 이벤트 관련 타입
export interface DomainEvent {
    type: string;
    timestamp: string;
    data: any;
}

export interface WordAddedEvent extends DomainEvent {
    type: 'WORD_ADDED';
    data: {
        word: string;
        bookId: string;
    };
}

export interface WordReviewedEvent extends DomainEvent {
    type: 'WORD_REVIEWED';
    data: {
        word: string;
        difficulty: Difficulty;
        previousDifficulty: Difficulty;
    };
}

export interface BookCreatedEvent extends DomainEvent {
    type: 'BOOK_CREATED';
    data: {
        bookId: string;
        name: string;
    };
}

// 유니온 타입으로 모든 이벤트 타입 정의
export type VocabularyEvent = WordAddedEvent | WordReviewedEvent | BookCreatedEvent; 