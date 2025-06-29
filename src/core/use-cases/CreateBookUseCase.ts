import { IBookRepository } from '../ports/repositories/IBookRepository';
import { Book } from '../entities/Book';
import { BookCreatedEvent } from '../../shared/lib/types';

export interface CreateBookRequest {
    name: string;
    description?: string;
}

export interface CreateBookResponse {
    success: boolean;
    book?: Book;
    error?: string;
}

export class CreateBookUseCase {
    constructor(
        private bookRepository: IBookRepository
    ) {}

    async execute(request: CreateBookRequest): Promise<CreateBookResponse> {
        try {
            // 1. 입력 검증
            if (!request.name || request.name.trim().length === 0) {
                return {
                    success: false,
                    error: '단어장 이름을 입력해주세요.'
                };
            }

            const name = request.name.trim();
            
            // 2. 이름 중복 확인
            const existingBooks = await this.bookRepository.findAll();
            const duplicateBook = existingBooks.find(book => 
                book.name.toLowerCase() === name.toLowerCase()
            );
            
            if (duplicateBook) {
                return {
                    success: false,
                    error: '이미 존재하는 단어장 이름입니다.'
                };
            }

            // 3. Book 엔티티 생성
            const book = Book.create(
                name,
                request.description || ''
            );

            // 4. 검증
            const validationErrors = book.validate();
            if (validationErrors.length > 0) {
                return {
                    success: false,
                    error: validationErrors.join(', ')
                };
            }

            // 5. 저장
            await this.bookRepository.add(book);

            // 6. 이벤트 발생
            const event: BookCreatedEvent = {
                type: 'BOOK_CREATED',
                timestamp: new Date().toISOString(),
                data: {
                    bookId: book.id,
                    name: book.name
                }
            };
            
            this.publishEvent(event);

            return {
                success: true,
                book: book
            };

        } catch (error) {
            console.error('CreateBookUseCase 실행 중 오류:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.'
            };
        }
    }

    private publishEvent(event: BookCreatedEvent): void {
        // 임시 구현 - 나중에 EventBus로 교체
        const customEvent = new CustomEvent('bookCreated', { detail: event.data });
        document.dispatchEvent(customEvent);
    }
} 