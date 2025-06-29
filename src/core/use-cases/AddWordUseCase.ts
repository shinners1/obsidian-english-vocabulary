import { IVocabularyRepository } from '../ports/repositories/IVocabularyRepository';
import { IBookRepository } from '../ports/repositories/IBookRepository';
import { IWordService } from '../ports/services/IWordService';
import { VocabularyCard } from '../entities/Vocabulary';
import { WordAddedEvent } from '../../shared/lib/types';

export interface AddWordRequest {
    word: string;
    bookId?: string;
}

export interface AddWordResponse {
    success: boolean;
    card?: VocabularyCard;
    error?: string;
}

export class AddWordUseCase {
    constructor(
        private vocabularyRepository: IVocabularyRepository,
        private bookRepository: IBookRepository,
        private wordService: IWordService
    ) {}

    async execute(request: AddWordRequest): Promise<AddWordResponse> {
        try {
            // 1. 입력 검증
            if (!request.word || request.word.trim().length === 0) {
                return {
                    success: false,
                    error: '단어를 입력해주세요.'
                };
            }

            const word = request.word.trim().toLowerCase();

            // 2. 중복 확인
            const existingWord = await this.vocabularyRepository.findByWord(word);
            if (existingWord) {
                return {
                    success: false,
                    error: '이미 존재하는 단어입니다.'
                };
            }

            // 3. 단어장 확인 및 설정
            let bookId = request.bookId;
            if (!bookId) {
                const currentBook = await this.bookRepository.getCurrentBook();
                bookId = currentBook?.id || 'default';
            }

            const book = await this.bookRepository.findById(bookId);
            if (!book) {
                return {
                    success: false,
                    error: '단어장을 찾을 수 없습니다.'
                };
            }

            // 4. 단어 데이터 가져오기
            const wordData = await this.wordService.getWordData(word);

            // 5. VocabularyCard 생성
            const vocabularyCard = VocabularyCard.create({
                word: wordData.word,
                meaning: wordData.meaning,
                pronunciation: wordData.pronunciation || '',
                examples: wordData.examples || [],
                bookId: bookId
            });

            // 6. 검증
            const validationErrors = vocabularyCard.validate();
            if (validationErrors.length > 0) {
                return {
                    success: false,
                    error: validationErrors.join(', ')
                };
            }

            // 7. 저장
            await this.vocabularyRepository.add(vocabularyCard);

            // 8. 이벤트 발생
            const event: WordAddedEvent = {
                type: 'WORD_ADDED',
                timestamp: new Date().toISOString(),
                data: {
                    word: vocabularyCard.word,
                    bookId: vocabularyCard.bookId
                }
            };
            
            // 이벤트 발생 (실제 구현에서는 EventBus 사용)
            this.publishEvent(event);

            return {
                success: true,
                card: vocabularyCard
            };

        } catch (error) {
            console.error('AddWordUseCase 실행 중 오류:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.'
            };
        }
    }

    private publishEvent(event: WordAddedEvent): void {
        // 임시 구현 - 나중에 EventBus로 교체
        const customEvent = new CustomEvent('wordAdded', { detail: event.data });
        document.dispatchEvent(customEvent);
    }
} 