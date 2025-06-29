import { IVocabularyRepository } from '../ports/IVocabularyRepository';
import { VocabularyCard } from '../entities/Vocabulary';
import { Difficulty, WordReviewedEvent } from '../../shared/lib/types';

export interface ReviewWordRequest {
    word: string;
    difficulty: Difficulty;
}

export interface ReviewWordResponse {
    success: boolean;
    card?: VocabularyCard;
    error?: string;
}

export class ReviewWordUseCase {
    constructor(
        private vocabularyRepository: IVocabularyRepository
    ) {}

    async execute(request: ReviewWordRequest): Promise<ReviewWordResponse> {
        try {
            // 1. 입력 검증
            if (!request.word || request.word.trim().length === 0) {
                return {
                    success: false,
                    error: '단어를 입력해주세요.'
                };
            }

            if (!['easy', 'good', 'hard'].includes(request.difficulty)) {
                return {
                    success: false,
                    error: '올바른 난이도를 선택해주세요.'
                };
            }

            // 2. 단어 조회
            const word = request.word.trim().toLowerCase();
            const existingCard = await this.vocabularyRepository.findByWord(word);
            
            if (!existingCard) {
                return {
                    success: false,
                    error: '단어를 찾을 수 없습니다.'
                };
            }

            // 3. 복습 수행 (엔티티의 비즈니스 로직 활용)
            const previousDifficulty = existingCard.difficulty;
            const reviewedCard = existingCard.review(request.difficulty);

            // 4. 저장
            await this.vocabularyRepository.update(reviewedCard);

            // 5. 이벤트 발생
            const event: WordReviewedEvent = {
                type: 'WORD_REVIEWED',
                timestamp: new Date().toISOString(),
                data: {
                    word: reviewedCard.word,
                    difficulty: request.difficulty,
                    previousDifficulty: previousDifficulty
                }
            };
            
            this.publishEvent(event);

            return {
                success: true,
                card: reviewedCard
            };

        } catch (error) {
            console.error('ReviewWordUseCase 실행 중 오류:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.'
            };
        }
    }

    private publishEvent(event: WordReviewedEvent): void {
        // 임시 구현 - 나중에 EventBus로 교체
        const customEvent = new CustomEvent('wordReviewed', { detail: event.data });
        document.dispatchEvent(customEvent);
    }
} 