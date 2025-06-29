import { IBookRepository } from '../../../core/ports/repositories/IBookRepository';
import { Book, BookStatistics, BookListOptions } from '../../../core/entities/Book';
import { VocabularyDatabaseManager } from '../../storage/VocabularyDatabase';

export class BookRepositoryAdapter implements IBookRepository {
    constructor(private databaseManager: VocabularyDatabaseManager) {}

    async add(book: Book): Promise<void> {
        await this.databaseManager.createBook(book.toPlainObject());
    }

    async save(book: Book): Promise<void> {
        await this.databaseManager.createBook(book.toPlainObject());
    }

    async findById(id: string): Promise<Book | null> {
        const bookData = this.databaseManager.getBook(id);
        if (!bookData) return null;
        
        return new Book(
            bookData.id,
            bookData.name,
            bookData.description,
            bookData.createdAt,
            bookData.updatedAt,
            bookData.wordCount,
            bookData.isDefault
        );
    }

    async findAll(options?: BookListOptions): Promise<Book[]> {
        const booksData = this.databaseManager.getAllBooks();
        let books = booksData.map(bookData => new Book(
            bookData.id,
            bookData.name,
            bookData.description,
            bookData.createdAt,
            bookData.updatedAt,
            bookData.wordCount,
            bookData.isDefault
        ));

        // 옵션에 따른 필터링
        if (options) {
            if (options.includeEmpty === false) {
                books = books.filter(book => !book.isEmpty());
            }

            // 정렬
            if (options.sortBy) {
                books.sort((a, b) => {
                    const aValue = a[options.sortBy!];
                    const bValue = b[options.sortBy!];
                    
                    if (typeof aValue === 'string' && typeof bValue === 'string') {
                        return options.sortOrder === 'desc' ? 
                            bValue.localeCompare(aValue) : 
                            aValue.localeCompare(bValue);
                    }
                    
                    if (typeof aValue === 'number' && typeof bValue === 'number') {
                        return options.sortOrder === 'desc' ? bValue - aValue : aValue - bValue;
                    }
                    
                    return 0;
                });
            }

            // 페이지네이션
            if (options.offset || options.limit) {
                const start = options.offset || 0;
                const end = options.limit ? start + options.limit : undefined;
                books = books.slice(start, end);
            }
        }

        return books;
    }

    async update(id: string, book: Book): Promise<void> {
        await this.databaseManager.updateBook(id, book.toPlainObject());
    }

    async delete(id: string): Promise<void> {
        await this.databaseManager.deleteBook(id);
    }

    async findDefault(): Promise<Book | null> {
        return this.findById('default');
    }

    async findByName(name: string): Promise<Book | null> {
        const books = await this.findAll();
        return books.find(book => book.name === name) || null;
    }

    async exists(id: string): Promise<boolean> {
        const book = await this.findById(id);
        return book !== null;
    }

    async count(): Promise<number> {
        const books = await this.findAll();
        return books.length;
    }

    async getStatistics(bookId: string): Promise<BookStatistics | null> {
        const book = await this.findById(bookId);
        if (!book) return null;

        const words = this.databaseManager.getWordsByBook(bookId);
        
        const wordsByDifficulty = {
            easy: words.filter(w => w.difficulty === 'easy').length,
            good: words.filter(w => w.difficulty === 'good').length,
            hard: words.filter(w => w.difficulty === 'hard').length
        };

        const totalReviews = words.reduce((sum, word) => sum + word.reviewCount, 0);
        const averageReviewCount = words.length > 0 ? totalReviews / words.length : 0;

        const lastActivityDate = words.length > 0 ? 
            Math.max(...words.map(w => new Date(w.lastReviewed || w.addedDate).getTime())) :
            null;

        const completionPercentage = words.length > 0 ?
            (wordsByDifficulty.easy / words.length) * 100 : 0;

        return {
            book,
            totalWords: words.length,
            wordsByDifficulty,
            averageReviewCount,
            lastActivityDate: lastActivityDate ? new Date(lastActivityDate).toISOString() : null,
            completionPercentage
        };
    }

    async getAllStatistics(): Promise<BookStatistics[]> {
        const books = await this.findAll();
        const statistics: BookStatistics[] = [];
        
        for (const book of books) {
            const stat = await this.getStatistics(book.id);
            if (stat) {
                statistics.push(stat);
            }
        }
        
        return statistics;
    }

    async getCurrentBook(): Promise<Book | null> {
        const currentBook = this.databaseManager.getCurrentBook();
        if (!currentBook) return null;

        return new Book(
            currentBook.id,
            currentBook.name,
            currentBook.description,
            currentBook.createdAt,
            currentBook.updatedAt,
            currentBook.wordCount,
            currentBook.isDefault
        );
    }

    async setCurrentBook(bookId: string): Promise<void> {
        await this.databaseManager.setCurrentBook(bookId);
    }

    async loadData(): Promise<void> {
        await this.databaseManager.loadAllBooks();
    }

    async saveData(): Promise<void> {
        await this.databaseManager.saveAllData();
    }

    async validateBookName(name: string, excludeId?: string): Promise<boolean> {
        const books = await this.findAll();
        return !books.some(book => 
            book.name === name && 
            (!excludeId || book.id !== excludeId)
        );
    }

    onDataChanged(callback: (books: Book[]) => void): void {
        // 이벤트 리스너 구현 - 나중에 EventEmitter 패턴으로 구현
        // 현재는 빈 구현
    }

    offDataChanged(callback: (books: Book[]) => void): void {
        // 이벤트 리스너 제거 구현
        // 현재는 빈 구현
    }

    onCurrentBookChanged(callback: (book: Book | null) => void): void {
        // 현재 단어장 변경 이벤트 리스너
        // 현재는 빈 구현
    }

    offCurrentBookChanged(callback: (book: Book | null) => void): void {
        // 현재 단어장 변경 이벤트 리스너 제거
        // 현재는 빈 구현
    }
}