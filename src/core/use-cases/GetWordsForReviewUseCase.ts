import { IVocabularyRepository } from '../ports/IVocabularyRepository';
import { IBookRepository } from '../ports/IBookRepository';
import { VocabularyCard } from '../entities/Vocabulary';

export interface GetWordsForReviewRequest {
    bookId?: string;
    limit?: number;
    reviewInterval?: number;
}

export interface GetWordsForReviewResponse {
    success: boolean;
    words?: VocabularyCard[];
    totalCount?: number;
    error?: string;
}

export class GetWordsForReviewUseCase {
    constructor(
        private vocabularyRepository: IVocabularyRepository,
        private bookRepository: IBookRepository
    ) {}

    async execute(request: GetWordsForReviewRequest = {}): Promise<GetWordsForReviewResponse> {
        try {
            // 1. 단어장 설정
            let bookId = request.bookId;
            if (!bookId) {
                const currentBook = await this.bookRepository.getCurrentBook();
                bookId = currentBook?.id;
            }

            // 2. 모든 단어 조회
            const allWords = await this.vocabularyRepository.findByBookId(bookId);
            
            if (allWords.length === 0) {
                return {
                    success: true,
                    words: [],
                    totalCount: 0
                };
            }

            // 3. 복습이 필요한 단어 필터링
            const reviewInterval = request.reviewInterval || 1;
            const wordsNeedingReview = allWords.filter(word => 
                word.needsReview(reviewInterval)
            );

            // 4. 정렬 (우선순위: 오래된 복습 > 어려운 단어 > 복습 횟수 적은 단어)
            wordsNeedingReview.sort((a, b) => {
                // 1순위: 마지막 복습일 (오래된 것부터)
                if (a.lastReviewed && b.lastReviewed) {
                    const aDate = new Date(a.lastReviewed).getTime();
                    const bDate = new Date(b.lastReviewed).getTime();
                    if (aDate !== bDate) return aDate - bDate;
                } else if (a.lastReviewed && !b.lastReviewed) {
                    return -1;
                } else if (!a.lastReviewed && b.lastReviewed) {
                    return 1;
                }

                // 2순위: 난이도 (어려운 것부터)
                const difficultyOrder = { 'hard': 3, 'good': 2, 'easy': 1 };
                const difficultyDiff = difficultyOrder[b.difficulty] - difficultyOrder[a.difficulty];
                if (difficultyDiff !== 0) return difficultyDiff;

                // 3순위: 복습 횟수 (적은 것부터)
                return a.reviewCount - b.reviewCount;
            });

            // 5. 제한 적용
            const limit = request.limit || 20;
            const limitedWords = wordsNeedingReview.slice(0, limit);

            return {
                success: true,
                words: limitedWords,
                totalCount: wordsNeedingReview.length
            };

        } catch (error) {
            console.error('GetWordsForReviewUseCase 실행 중 오류:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.'
            };
        }
    }
} 