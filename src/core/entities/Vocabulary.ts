import { Difficulty, Example } from '../../shared/lib/types';

// 기본 단어 정보 인터페이스
export interface WordData {
    word: string;
    pronunciation: string;
    meanings: string[];
    similarWords: string[];
    examples: Example[];
}

// 단어 카드 엔티티
export class VocabularyCard {
    constructor(
        public readonly word: string,
        public pronunciation: string,
        public meanings: string[],
        public similarWords: string[],
        public examples: Example[],
        public reviewCount: number,
        public difficulty: Difficulty,
        public lastReviewed: string | null,
        public readonly addedDate: string,
        public bookId: string
    ) {}

    // 팩토리 메서드: WordData로부터 VocabularyCard 생성
    static fromWordData(wordData: WordData, bookId: string): VocabularyCard {
        return new VocabularyCard(
            wordData.word,
            wordData.pronunciation,
            wordData.meanings,
            wordData.similarWords,
            wordData.examples,
            0, // 초기 복습 횟수
            'none', // 초기 난이도 (학습 전)
            null, // 초기 복습 날짜
            new Date().toISOString(), // 추가 날짜
            bookId
        );
    }

    // 비즈니스 로직: 복습 수행
    review(newDifficulty: Difficulty): VocabularyCard {
        return new VocabularyCard(
            this.word,
            this.pronunciation,
            this.meanings,
            this.similarWords,
            this.examples,
            this.reviewCount + 1,
            newDifficulty,
            new Date().toISOString(),
            this.addedDate,
            this.bookId
        );
    }

    // 비즈니스 로직: 단어 정보 업데이트
    updateWordData(wordData: Partial<WordData>): VocabularyCard {
        return new VocabularyCard(
            this.word,
            wordData.pronunciation ?? this.pronunciation,
            wordData.meanings ?? this.meanings,
            wordData.similarWords ?? this.similarWords,
            wordData.examples ?? this.examples,
            this.reviewCount,
            this.difficulty,
            this.lastReviewed,
            this.addedDate,
            this.bookId
        );
    }

    // 비즈니스 로직: 단어장 이동
    moveToBook(newBookId: string): VocabularyCard {
        return new VocabularyCard(
            this.word,
            this.pronunciation,
            this.meanings,
            this.similarWords,
            this.examples,
            this.reviewCount,
            this.difficulty,
            this.lastReviewed,
            this.addedDate,
            newBookId
        );
    }

    // 비즈니스 로직: 복습이 필요한지 확인
    needsReview(reviewInterval: number = 1): boolean {
        if (!this.lastReviewed) return true;
        
        const lastReviewDate = new Date(this.lastReviewed);
        const now = new Date();
        const daysDiff = Math.floor((now.getTime() - lastReviewDate.getTime()) / (1000 * 60 * 60 * 24));
        
        // 난이도에 따른 복습 주기 조정
        const difficultyMultiplier = {
            'none': 0, // 학습하지 않은 단어는 즉시 복습 필요
            'hard': 0.5,
            'good': 1,
            'easy': 2
        };
        
        // 'none' 난이도인 경우 항상 복습 필요
        if (this.difficulty === 'none') return true;
        
        const adjustedInterval = reviewInterval * difficultyMultiplier[this.difficulty];
        return daysDiff >= adjustedInterval;
    }

    // 비즈니스 로직: 학습 진행도 계산 (0-100)
    getProgressPercentage(): number {
        const maxReviews = 10; // 최대 복습 횟수
        const progress = Math.min(this.reviewCount / maxReviews, 1) * 100;
        
        // 난이도 보너스
        const difficultyBonus = {
            'none': 0,  // 학습하지 않은 단어는 보너스 없음
            'easy': 20,
            'good': 10,
            'hard': 0
        };
        
        return Math.min(progress + difficultyBonus[this.difficulty], 100);
    }

    // 데이터 직렬화를 위한 메서드
    toPlainObject(): VocabularyCardData {
        return {
            word: this.word,
            pronunciation: this.pronunciation,
            meanings: this.meanings,
            similarWords: this.similarWords,
            examples: this.examples,
            reviewCount: this.reviewCount,
            difficulty: this.difficulty,
            lastReviewed: this.lastReviewed,
            addedDate: this.addedDate,
            bookId: this.bookId
        };
    }

    // 검증 로직
    validate(): string[] {
        const errors: string[] = [];
        
        if (!this.word || this.word.trim().length === 0) {
            errors.push('단어가 입력되지 않았습니다.');
        }
        
        if (this.meanings.length === 0) {
            errors.push('단어의 뜻이 하나 이상 필요합니다.');
        }
        
        if (!this.bookId || this.bookId.trim().length === 0) {
            errors.push('단어장 ID가 필요합니다.');
        }
        
        return errors;
    }

    static create(data: {
        word: string;
        meaning: string;
        pronunciation?: string;
        examples?: string[];
        bookId?: string;
    }): VocabularyCard {
        return new VocabularyCard(
            data.word,
            data.pronunciation || '',
            [data.meaning], // meanings array
            [], // similarWords
            data.examples?.map(ex => ({ english: ex, korean: '' })) || [], // examples with Example type
            0, // reviewCount
            'none', // difficulty - 초기 난이도 (학습 전)
            null, // lastReviewed
            new Date().toISOString(), // addedDate
            data.bookId || 'default'
        );
    }
}

// 데이터 전송용 인터페이스 (기존 호환성 유지)
export interface VocabularyCardData extends WordData {
    reviewCount: number;
    difficulty: Difficulty;
    lastReviewed: string | null;
    addedDate: string;
    bookId: string;
}

// 검색 결과 타입
export interface SearchResult {
    cards: VocabularyCard[];
    totalCount: number;
    hasMore: boolean;
} 